#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol("asset", |_app, request| {
            let uri_str = request.uri().to_string();
            // Extract path after "asset://localhost/" or "asset:///"
            let path = if let Some(rest) = uri_str.strip_prefix("asset://localhost/") {
                rest
            } else if let Some(rest) = uri_str.strip_prefix("asset:///") {
                rest
            } else {
                &uri_str
            };

            // Decode percent-encoded bytes to UTF-8 string
            let file_path = percent_decode(path);
            eprintln!("ASSET FILE: {}", file_path);

            let path_buf = PathBuf::from(&file_path);
            eprintln!("ASSET EXISTS: {}", path_buf.exists());
            eprintln!("ASSET PATH: {:?}", path_buf);
            if !path_buf.exists() {
                // Try with normalized path separators
                let normalized = file_path.replace('/', "\\");
                let path_buf2 = PathBuf::from(&normalized);
                eprintln!("ASSET NORMALIZED EXISTS: {}", path_buf2.exists());
                if path_buf2.exists() {
                    // Found with normalization
                    match std::fs::read(&path_buf2) {
                        Ok(contents) => {
                            let ext = path_buf2
                                .extension()
                                .and_then(|e| e.to_str())
                                .unwrap_or("")
                                .to_lowercase();
                            let mime = match ext.as_str() {
                                "jpg" | "jpeg" => "image/jpeg",
                                "png" => "image/png",
                                "gif" => "image/gif",
                                "webp" => "image/webp",
                                _ => "application/octet-stream",
                            };
                            return tauri::http::Response::builder()
                                .header("Content-Type", mime)
                                .body(contents)
                                .unwrap();
                        }
                        Err(e) => {
                            eprintln!("ASSET READ ERROR: {}", e);
                        }
                    }
                }
                eprintln!("ASSET NOT FOUND");
                return tauri::http::Response::builder()
                    .status(404)
                    .body(b"not found".to_vec())
                    .unwrap();
            }

            match std::fs::read(&path_buf) {
                Ok(contents) => {
                    let ext = path_buf
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    let mime = match ext.as_str() {
                        "jpg" | "jpeg" => "image/jpeg",
                        "png" => "image/png",
                        "gif" => "image/gif",
                        "webp" => "image/webp",
                        _ => "application/octet-stream",
                    };
                    tauri::http::Response::builder()
                        .header("Content-Type", mime)
                        .body(contents)
                        .unwrap()
                }
                Err(e) => {
                    eprintln!("ASSET READ ERROR: {}", e);
                    tauri::http::Response::builder()
                        .status(500)
                        .body(b"read error".to_vec())
                        .unwrap()
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
            // Push ASCII char as UTF-8 byte
            let mut buf = [0u8; 4];
            let s = c.encode_utf8(&mut buf);
            bytes.extend_from_slice(s.as_bytes());
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}
