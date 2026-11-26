const COMMANDS: &[&str] = &["save_output"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
