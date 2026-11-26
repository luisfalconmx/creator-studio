const COMMANDS: &[&str] = &[
    "fetch_info",
    "scrape_page",
    "probe_media",
    "probe_sizes",
    "start_download",
    "cancel_download",
    "default_download_dir",
    "tool_versions",
    "update_ytdlp",
    "reveal_file",
    "open_file",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
