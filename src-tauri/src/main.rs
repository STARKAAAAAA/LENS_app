#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::{Mutex, atomic::{AtomicU32, Ordering}};
use image::GenericImageView;
use tauri::Emitter;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![generate_thumbnails, get_cache_info, clear_cache, get_exif_info])
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

// ========== 缩略图生成 ==========

/// 生成缩略图缓存，返回 {原图路径: 缩略图缓存路径}
#[tauri::command]
async fn generate_thumbnails(
    app: tauri::AppHandle,
    paths: Vec<String>,
    cache_dir: String,
) -> Result<HashMap<String, String>, String> {
    let cache_dir = PathBuf::from(&cache_dir);
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

    // spawn_blocking: 按 CPU 核心数并行生成缩略图
    tauri::async_runtime::spawn_blocking(move || {
        let map = Mutex::new(HashMap::new());
        let done = AtomicU32::new(0);
        let fresh = AtomicU32::new(0);
        let num_threads = num_cpus::get().max(16);
        let chunk_size = num_threads;

        for chunk in paths.chunks(chunk_size) {
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

/// 为单张照片生成缩略图（turbojpeg SIMD 解码 + Lanczos3 缩放 + 品质 95）
fn generate_one(original: &str, dest: &PathBuf) {
    let data = match std::fs::read(original) {
        Ok(d) => d,
        Err(_) => return,
    };

    // 尝试 turbojpeg 解码（SIMD 加速，比 image crate 快 2-3x）
    let (w, h, pixels) = if let Ok(img) = turbojpeg::decompress_image::<image::Rgb<u8>>(&data) {
        let (iw, ih) = (img.width() as u32, img.height() as u32);
        (iw, ih, img.into_raw())
    } else if let Ok(img) = image::load_from_memory(&data) {
        // 非 JPEG 回退到 image crate
        let rgb = img.to_rgb8();
        let (w, h) = rgb.dimensions();
        (w, h, rgb.into_raw())
    } else {
        return;
    };

    let longest = w.max(h);
    let (tw, th, final_pixels) = if longest <= 480 {
        (w as usize, h as usize, pixels)
    } else {
        // Lanczos3 缩放到 480px（用 image crate）
        let ratio = 480.0 / longest as f64;
        let nw = (w as f64 * ratio) as u32;
        let nh = (h as f64 * ratio) as u32;
        let src = image::RgbImage::from_raw(w, h, pixels).unwrap();
        let resized = image::DynamicImage::from(src)
            .resize_exact(nw, nh, image::imageops::FilterType::Lanczos3)
            .to_rgb8();
        let (rw, rh) = resized.dimensions();
        (rw as usize, rh as usize, resized.into_raw())
    };

    // turbojpeg 编码（SIMD 加速，品质 95）
    let enc_image = turbojpeg::Image {
        pixels: final_pixels.as_slice(),
        width: tw,
        height: th,
        pitch: tw * 3,
        format: turbojpeg::PixelFormat::RGB,
    };
    if let Ok(jpg) = turbojpeg::compress(enc_image, 95, turbojpeg::Subsamp::Sub2x2) {
        let _ = std::fs::write(dest, jpg);
    }
}

// ========== 缓存管理 ==========

#[derive(serde::Serialize)]
struct CacheInfo {
    size_bytes: u64,
    file_count: u32,
}

#[tauri::command]
fn get_cache_info(_app: tauri::AppHandle, cache_dir: String) -> Result<CacheInfo, String> {
    let cache_dir = PathBuf::from(&cache_dir);

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
fn clear_cache(_app: tauri::AppHandle, cache_dir: String) -> Result<(), String> {
    let cache_dir = PathBuf::from(&cache_dir);

    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ========== EXIF 信息提取 ==========

#[derive(serde::Serialize)]
struct ExifInfo {
    camera: String,
    lens: String,
    aperture: String,
    shutter: String,
    iso: String,
    focal_length: String,
    date: String,
    width: u32,
    height: u32,
    filesize: u64,
}

#[tauri::command]
fn get_exif_info(path: String) -> Result<ExifInfo, String> {
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    let filesize = data.len() as u64;

    let mut width: u32 = 0;
    let mut height: u32 = 0;

    let mut exif_data = ExifInfo {
        camera: String::new(),
        lens: String::new(),
        aperture: String::new(),
        shutter: String::new(),
        iso: String::new(),
        focal_length: String::new(),
        date: String::new(),
        width,
        height,
        filesize,
    };

    let reader = exif::Reader::new();
    let mut cursor = std::io::Cursor::new(&data);
    if let Ok(exif) = reader.read_from_container(&mut cursor) {
        // 相机制造商 + 型号
        let make = exif.get_field(exif::Tag::Make, exif::In::PRIMARY)
            .map(|f| f.display_value().to_string().trim().to_string())
            .unwrap_or_default();
        let model = exif.get_field(exif::Tag::Model, exif::In::PRIMARY)
            .map(|f| f.display_value().to_string().trim().to_string())
            .unwrap_or_default();
        exif_data.camera = if !make.is_empty() && !model.is_empty() {
            if model.starts_with(&make) { model }
            else { format!("{} {}", make, model) }
        } else { make + &model };

        // 镜头型号
        exif_data.lens = exif.get_field(exif::Tag::LensModel, exif::In::PRIMARY)
            .map(|f| f.display_value().to_string().trim().to_string())
            .unwrap_or_default();

        // 光圈 f-number
        if let Some(f) = exif.get_field(exif::Tag::FNumber, exif::In::PRIMARY) {
            if let Some((num, denom)) = get_rational(&f.value) {
                let v = num as f64 / denom as f64;
                exif_data.aperture = format!("f/{:.0}", v);
            }
        }
        // 快门速度
        if let Some(f) = exif.get_field(exif::Tag::ExposureTime, exif::In::PRIMARY) {
            if let Some((num, denom)) = get_rational(&f.value) {
                let secs = num as f64 / denom as f64;
                if secs < 1.0 {
                    exif_data.shutter = format!("1/{:.0}s", 1.0 / secs);
                } else {
                    exif_data.shutter = format!("{:.0}s", secs);
                }
            }
        }
        // ISO
        exif_data.iso = exif.get_field(exif::Tag::ISOSpeed, exif::In::PRIMARY)
            .map(|f| format!("ISO {}", f.display_value()))
            .unwrap_or_default();

        // 焦距
        if let Some(f) = exif.get_field(exif::Tag::FocalLength, exif::In::PRIMARY) {
            if let Some((num, denom)) = get_rational(&f.value) {
                let v = num as f64 / denom as f64;
                exif_data.focal_length = format!("{:.0}mm", v);
            }
        }
        // 拍摄日期
        exif_data.date = exif.get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
            .map(|f| f.display_value().to_string().trim().to_string())
            .unwrap_or_default();

        // 从 EXIF 获取尺寸（避免完整解码大图）
        let w = exif.get_field(exif::Tag::PixelXDimension, exif::In::PRIMARY)
            .and_then(|f| match &f.value { exif::Value::Long(v) => v.first().copied(), _ => None });
        let h = exif.get_field(exif::Tag::PixelYDimension, exif::In::PRIMARY)
            .and_then(|f| match &f.value { exif::Value::Long(v) => v.first().copied(), _ => None });
        width = w.unwrap_or(0);
        height = h.unwrap_or(0);
    }

    // EXIF 没有尺寸信息时回退到完整解码
    if width == 0 || height == 0 {
        if let Ok(img) = image::load_from_memory(&data) {
            (width, height) = img.dimensions();
        }
    }
    exif_data.width = width;
    exif_data.height = height;

    Ok(exif_data)
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

/// 从 EXIF Value 中提取第一个有理数 (num, denom)
fn get_rational(v: &exif::Value) -> Option<(u32, u32)> {
    match v {
        exif::Value::Rational(ref vec) => {
            vec.first().map(|r| (r.num, r.denom))
        }
        _ => None,
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
