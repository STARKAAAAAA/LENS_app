#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use image::GenericImageView;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol("asset", |_app, request| {
            let uri_str = request.uri().to_string();
            let path = if let Some(rest) = uri_str.strip_prefix("asset://localhost/") {
                rest
            } else if let Some(rest) = uri_str.strip_prefix("asset:///") {
                rest
            } else {
                &uri_str
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
                    // 对 JPEG 大图自动缩放到最长边 1920px
                    let body = if ext == "jpg" || ext == "jpeg" {
                        resize_jpeg(&contents, 1920)
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

fn resize_jpeg(data: &[u8], max_dim: u32) -> Vec<u8> {
    // 小于 500KB 的图不处理，直接返回原图
    if data.len() < 500_000 {
        return data.to_vec();
    }
    match image::load_from_memory(data) {
        Ok(img) => {
            let (w, h) = img.dimensions();
            let longest = w.max(h);
            if longest <= max_dim {
                return data.to_vec(); // 已足够小
            }
            let ratio = max_dim as f64 / longest as f64;
            let nw = (w as f64 * ratio) as u32;
            let nh = (h as f64 * ratio) as u32;
            let resized = img.resize_exact(nw, nh, image::imageops::FilterType::Lanczos3);
            let mut buf = std::io::Cursor::new(Vec::new());
            match resized.write_to(&mut buf, image::ImageFormat::Jpeg) {
                Ok(_) => buf.into_inner(),
                Err(_) => data.to_vec(),
            }
        }
        Err(_) => data.to_vec(), // 解码失败返回原图
    }
}

fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let mut chars = input.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next().unwrap_or('0');
            let h2 = chars.next().unwrap_or('0');
            if let Ok(byte) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) {
                bytes.push(byte);
            }
        } else {
            let mut buf = [0u8; 4];
            let s = c.encode_utf8(&mut buf);
            bytes.extend_from_slice(s.as_bytes());
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}
