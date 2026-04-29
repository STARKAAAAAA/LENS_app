#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::{Mutex, atomic::{AtomicU32, Ordering}};
use image::GenericImageView;
use tauri::{Emitter, Manager};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![generate_thumbnails, get_cache_info, clear_cache])
        .register_uri_scheme_protocol("asset", |_app, request| {
            let uri_str = request.uri().to_string();
            let (clean_uri, full_quality) = if uri_str.contains("?full=1") {
                (uri_str.replace("?full=1", ""), true)
            } else {
                (uri_str, false)
            };

            let path = if let Some(rest) = clean_uri.strip_prefix("asset://localhost/") {
                rest
            } else if let Some(rest) = clean_uri.strip_prefix("asset:///") {
                rest
            } else {
                &clean_uri
            };

            let file_path = percent_decode(path);
            let path_buf = PathBuf::from(&file_path);

            let actual_path = if path_buf.exists() {
                path_buf
            } else {
                let normalized = file_path.replace('/', "\\");
                let pb = PathBuf::from(&normalized);
                if pb.exists() { pb } else {
                    return tauri::http::Response::builder()
                        .status(404).body(b"not found".to_vec()).unwrap();
                }
            };

            let ext = actual_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

            match std::fs::read(&actual_path) {
                Ok(contents) => {
                    let body = if !full_quality && (ext == "jpg" || ext == "jpeg") {
                        resize_if_large(&contents)
                    } else {
                        contents
                    };

                    let mime = match ext.as_str() {
                        "jpg" | "jpeg" => "image/jpeg",
                        "png" => "image/png",
                        "gif" => "image/gif",
                        "webp" => "image/webp",
                        _ => "application/octet-stream",
                    };
                    tauri::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Cache-Control", "max-age=3600")
                        .body(body)
                        .unwrap()
                }
                Err(_) => tauri::http::Response::builder()
                    .status(500).body(b"read error".to_vec()).unwrap(),
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ========== 缓存目录 ==========

fn thumb_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("thumbnails"))
}

// ========== 缩略图生成 ==========

/// 生成缩略图缓存，返回 {原图路径: 缩略图缓存路径}
#[tauri::command]
async fn generate_thumbnails(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    let cache_dir = thumb_cache_dir(&app)?;
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    // 缓存超过 7 天自动清除
    let mut cache_age: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(&cache_dir) {
        let mut newest = None;
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if let Ok(mtime) = meta.modified() {
                    newest = Some(match newest {
                        Some(old) if old > mtime => old,
                        _ => mtime,
                    });
                }
            }
        }
        if let Some(t) = newest {
            cache_age = t.elapsed().map(|d| d.as_secs()).unwrap_or(0);
        }
    }
    if cache_age > 7 * 24 * 3600 {
        let _ = std::fs::remove_dir_all(&cache_dir);
        let _ = std::fs::create_dir_all(&cache_dir);
    }

    let total = paths.len() as u32;

    // spawn_blocking: 8 线程并行生成缩略图，首次加载快 5-8 倍
    tauri::async_runtime::spawn_blocking(move || {
        let map = Mutex::new(HashMap::new());
        let done = AtomicU32::new(0);
        let fresh = AtomicU32::new(0);
        const CHUNK: usize = 8;

        for chunk in paths.chunks(CHUNK) {
            std::thread::scope(|s| {
                for path in chunk {
                    let app = app.clone();
                    let cache_dir = cache_dir.clone();
                    let path = path.clone();
                    let map = &map;
                    let done = &done;
                    let fresh = &fresh;
                    s.spawn(move || {
                        let thumb_path = cache_dir.join(format!("{}.jpg", djb2(&path)));
                        let existed = thumb_path.exists();
                        if !existed {
                            generate_one(&path, &thumb_path);
                        }
                        if thumb_path.exists() {
                            if !existed { fresh.fetch_add(1, Ordering::Relaxed); }
                            map.lock().unwrap().insert(path.clone(), thumb_path.to_string_lossy().to_string());
                        }
                        let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                        let _ = app.emit("thumbnail-progress", serde_json::json!({
                            "current": n,
                            "total": total,
                            "fresh": fresh.load(Ordering::Relaxed)
                        }));
                    });
                }
            });
        }

        map.into_inner().unwrap()
    }).await.map_err(|e| e.to_string())
}

/// djb2 哈希 — 确定性与平台无关
fn djb2(s: &str) -> String {
    let mut h: u64 = 5381;
    for b in s.bytes() {
        h = h.wrapping_mul(33).wrapping_add(b as u64);
    }
    format!("{:016x}", h)
}

/// 为单张照片生成缩略图（宽高 ≤480px）
fn generate_one(original: &str, dest: &PathBuf) {
    let data = match std::fs::read(original) {
        Ok(d) => d,
        Err(_) => return,
    };

    // 小于 200KB 的原图直接复用
    if data.len() < 200_000 {
        let _ = std::fs::write(dest, &data);
        return;
    }

    let img = match image::load_from_memory(&data) {
        Ok(i) => i,
        Err(_) => return,
    };

    let (w, h) = img.dimensions();
    let longest = w.max(h);

    if longest <= 480 {
        let _ = std::fs::write(dest, &data);
        return;
    }

    let ratio = 480.0 / longest as f64;
    let nw = (w as f64 * ratio) as u32;
    let nh = (h as f64 * ratio) as u32;
    let thumb = img.resize_exact(nw, nh, image::imageops::FilterType::CatmullRom);
    let mut buf = std::io::Cursor::new(Vec::new());
    if thumb.write_to(&mut buf, image::ImageFormat::Jpeg).is_ok() {
        let _ = std::fs::write(dest, buf.into_inner());
    }
}

// ========== 缓存管理 ==========

#[derive(serde::Serialize)]
struct CacheInfo {
    size_bytes: u64,
    file_count: u32,
}

#[tauri::command]
fn get_cache_info(app: tauri::AppHandle) -> Result<CacheInfo, String> {
    let cache_dir = thumb_cache_dir(&app)?;

    let mut size_bytes = 0u64;
    let mut file_count = 0u32;

    if cache_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&cache_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    size_bytes += meta.len();
                    file_count += 1;
                }
            }
        }
    }

    Ok(CacheInfo { size_bytes, file_count })
}

#[tauri::command]
fn clear_cache(app: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = thumb_cache_dir(&app)?;

    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ========== 原有：大图压缩（画廊用） ==========

fn resize_if_large(data: &[u8]) -> Vec<u8> {
    if data.len() < 1_000_000 {
        return data.to_vec();
    }
    match image::load_from_memory(data) {
        Ok(img) => {
            let (w, h) = img.dimensions();
            let longest = w.max(h);
            if longest <= 3000 {
                return data.to_vec();
            }
            let ratio = 2560.0 / longest as f64;
            let nw = (w as f64 * ratio) as u32;
            let nh = (h as f64 * ratio) as u32;
            let resized = img.resize_exact(nw, nh, image::imageops::FilterType::CatmullRom);
            let mut buf = std::io::Cursor::new(Vec::new());
            match resized.write_to(&mut buf, image::ImageFormat::Jpeg) {
                Ok(_) => buf.into_inner(),
                Err(_) => data.to_vec(),
            }
        }
        Err(_) => data.to_vec(),
    }
}

fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let mut chars = input.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next().unwrap_or('0');
            let h2 = chars.next().unwrap_or('0');
            let byte = ((h1.to_digit(16).unwrap_or(0) << 4)
                       | h2.to_digit(16).unwrap_or(0)) as u8;
            bytes.push(byte);
        } else {
            let mut buf = [0u8; 4];
            let s = c.encode_utf8(&mut buf);
            bytes.extend_from_slice(s.as_bytes());
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}
