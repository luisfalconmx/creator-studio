use tauri::{Emitter, Manager};

fn focus_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be the first plugin: a second launch focuses the running window and
        // forwards the videos it was opened with (Explorer context menu).
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            focus_main(app);
            let paths = tauri_plugin_videos::video_args(argv);
            if !paths.is_empty() {
                let _ = app.emit("open-as-project", paths);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_videos::init(tauri_plugin_videos::video_args(
            std::env::args(),
        )))
        .plugin(tauri_plugin_images::init())
        .plugin(tauri_plugin_downloads::init())
        .run(tauri::generate_context!())
        .expect("error al iniciar Creator Studio");
}
