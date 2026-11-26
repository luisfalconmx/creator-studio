//! Plugin `images`: the image optimizer runs in the webview (Squoosh WASM codecs);
//! the backend only writes the results to the folder the user picks.

mod export;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::Wry;

pub fn init() -> TauriPlugin<Wry> {
    Builder::new("images")
        .invoke_handler(tauri::generate_handler![export::save_output])
        .build()
}
