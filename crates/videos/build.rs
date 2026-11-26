const COMMANDS: &[&str] = &[
    "ffmpeg_status",
    "probe_media",
    "thumbnail",
    "capture_frame",
    "read_cover",
    "write_metadata",
    "scan_folder",
    "editable_tags",
    "start_render",
    "cancel_render",
    "save_text",
    "load_text",
    "file_exists",
    "projects_dir",
    "new_project_path",
    "list_projects",
    "delete_project",
    "take_startup_paths",
    "default_export_dir",
    "dir_exists",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
