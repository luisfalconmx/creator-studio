//! Plugin `downloads`: video and audio downloader powered by the bundled
//! yt-dlp, ffmpeg and deno sidecars.

mod scrape;
mod ytdlp;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Wry};

pub fn init() -> TauriPlugin<Wry> {
    Builder::new("downloads")
        .setup(|app, _api| {
            app.manage(ytdlp::Jobs::default());
            ytdlp::clear_stale_temp(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ytdlp::fetch_info,
            scrape::scrape_page,
            ytdlp::probe_media,
            ytdlp::probe_sizes,
            ytdlp::start_download,
            ytdlp::cancel_download,
            ytdlp::default_download_dir,
            ytdlp::tool_versions,
            ytdlp::update_ytdlp,
            ytdlp::reveal_file,
            ytdlp::open_file,
        ])
        .build()
}
