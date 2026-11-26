mod args;
mod ffmpeg;
mod render;

use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::collections::BTreeMap;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, State, Wry};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn unique_name(prefix: &str, ext: &str) -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{ts}-{n}.{ext}")
}

fn dir(app: &AppHandle, sub: &str) -> Result<PathBuf, String> {
    let base = if sub == "covers" {
        app.path().app_data_dir()
    } else {
        app.path().app_cache_dir()
    }
    .map_err(|e| e.to_string())?;
    let d = base.join(sub);
    std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

async fn blocking<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegStatus {
    ffmpeg: Option<String>,
    ffprobe: Option<String>,
    version: Option<String>,
}

#[tauri::command]
async fn ffmpeg_status() -> Result<FfmpegStatus, String> {
    blocking(|| {
        let ffmpeg_path = ffmpeg::locate("ffmpeg");
        let version = ffmpeg::command("ffmpeg").ok().and_then(|mut c| {
            c.arg("-version");
            ffmpeg::run(c).ok().and_then(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .lines()
                    .next()
                    .map(String::from)
            })
        });
        Ok(FfmpegStatus {
            ffmpeg: ffmpeg_path.map(|p| p.to_string_lossy().to_string()),
            ffprobe: ffmpeg::locate("ffprobe").map(|p| p.to_string_lossy().to_string()),
            version,
        })
    })
    .await
}

#[tauri::command]
async fn probe_media(path: String) -> Result<ffmpeg::MediaInfo, String> {
    blocking(move || ffmpeg::probe(&path)).await
}

/// Miniatura pequeña (cacheada) para la biblioteca / línea de tiempo.
#[tauri::command]
async fn thumbnail(
    app: AppHandle,
    path: String,
    time: f64,
    width: Option<u32>,
) -> Result<String, String> {
    let width = width.unwrap_or(320).clamp(64, 1920);
    let d = dir(&app, "thumbs")?;
    blocking(move || {
        let mut h = DefaultHasher::new();
        path.hash(&mut h);
        ((time * 10.0) as i64).hash(&mut h);
        width.hash(&mut h);
        if let Ok(meta) = std::fs::metadata(&path) {
            meta.len().hash(&mut h);
        }
        let out = d.join(format!("{:x}.jpg", h.finish()));
        if !out.is_file() {
            ffmpeg::extract_frame(&path, time, &out, Some(width))?;
        }
        Ok(out.to_string_lossy().to_string())
    })
    .await
}

/// Captura un fotograma a resolución completa (para usarlo como portada).
#[derive(serde::Deserialize)]
struct FrameSpec {
    width: u32,
    height: u32,
    #[serde(default)]
    zoom: Option<args::Zoom>,
}

#[tauri::command]
async fn capture_frame(
    app: AppHandle,
    path: String,
    time: f64,
    frame: Option<FrameSpec>,
) -> Result<String, String> {
    let out = dir(&app, "covers")?.join(unique_name("frame", "png"));
    blocking(move || {
        // Con `frame`: mismo encuadre/zoom que el video exportado. Sin él: fotograma original.
        let vf = frame.map(|f| args::framing_filter(f.width, f.height, &f.zoom));
        ffmpeg::extract_frame_vf(&path, time, &out, vf)?;
        Ok(out.to_string_lossy().to_string())
    })
    .await
}

fn file_key(path: &str, extra: i64) -> String {
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    extra.hash(&mut h);
    if let Ok(meta) = std::fs::metadata(path) {
        meta.len().hash(&mut h);
        if let Ok(m) = meta.modified() {
            m.hash(&mut h);
        }
    }
    format!("{:x}", h.finish())
}

/// Extrae la portada actual de un video, si la tiene (cacheada por archivo+fecha).
#[tauri::command]
async fn read_cover(app: AppHandle, path: String) -> Result<Option<String>, String> {
    let d = dir(&app, "thumbs")?;
    blocking(move || {
        let info = ffmpeg::probe(&path)?;
        let Some(stream) = info.cover_stream else {
            return Ok(None);
        };
        let out = d.join(format!("cover-{}.jpg", file_key(&path, 0)));
        if !out.is_file() {
            ffmpeg::extract_cover(&path, stream, &out)?;
        }
        Ok(Some(out.to_string_lossy().to_string()))
    })
    .await
}

fn is_editable(path: &Path) -> bool {
    path.extension()
        .map(|e| ["mp4", "m4v"].contains(&e.to_string_lossy().to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Escribe metadata y/o portada copiando streams (sin re-codificar).
/// Si `output` es None sobrescribe el original. Devuelve la ruta final.
#[tauri::command]
async fn write_metadata(
    video: String,
    tags: BTreeMap<String, String>,
    cover: ffmpeg::CoverChange,
    output: Option<String>,
) -> Result<String, String> {
    blocking(move || {
        let src = Path::new(&video);
        if !is_editable(src) {
            return Err("Solo se puede editar la metadata de archivos MP4 y M4V.".into());
        }
        let info = ffmpeg::probe(&video)?;
        match output {
            Some(out) => {
                if Path::new(&out) == src {
                    return Err("Elige una ruta distinta al original o usa 'Sobrescribir'.".into());
                }
                ffmpeg::write_metadata(&video, Path::new(&out), &info, &tags, &cover)?;
                Ok(out)
            }
            None => {
                ffmpeg::rewrite_in_place(src, |tmp| {
                    ffmpeg::write_metadata(&video, tmp, &info, &tags, &cover)
                })?;
                Ok(video)
            }
        }
    })
    .await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanItem {
    path: String,
    name: String,
    folder: String,
    editable: bool,
    info: Option<ffmpeg::MediaInfo>,
    error: Option<String>,
}

/// Revisa todos los videos de una carpeta (en paralelo).
#[tauri::command]
async fn scan_folder(path: String, recursive: bool) -> Result<Vec<ScanItem>, String> {
    blocking(move || {
        let root = PathBuf::from(&path);
        if !root.is_dir() {
            return Err("La carpeta no existe.".into());
        }
        let mut files = Vec::new();
        ffmpeg::list_videos(&root, recursive, &mut files);
        let threads = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .min(8);
        let chunk = files.len().div_ceil(threads).max(1);
        let mut items: Vec<ScanItem> = Vec::with_capacity(files.len());
        std::thread::scope(|sc| {
            let handles: Vec<_> = files
                .chunks(chunk)
                .map(|part| {
                    let root = &root;
                    sc.spawn(move || {
                        part.iter()
                            .map(|f| {
                                let p = f.to_string_lossy().to_string();
                                let (info, error) = match ffmpeg::probe(&p) {
                                    Ok(i) => (Some(i), None),
                                    Err(e) => (None, Some(e)),
                                };
                                ScanItem {
                                    name: f
                                        .file_name()
                                        .map(|n| n.to_string_lossy().to_string())
                                        .unwrap_or_default(),
                                    folder: f
                                        .parent()
                                        .and_then(|d| d.strip_prefix(root).ok())
                                        .map(|d| d.to_string_lossy().to_string())
                                        .unwrap_or_default(),
                                    editable: is_editable(f),
                                    path: p,
                                    info,
                                    error,
                                }
                            })
                            .collect::<Vec<_>>()
                    })
                })
                .collect();
            for h in handles {
                if let Ok(v) = h.join() {
                    items.extend(v);
                }
            }
        });
        Ok(items)
    })
    .await
}

#[tauri::command]
fn editable_tags() -> Vec<&'static str> {
    ffmpeg::EDITABLE_TAGS.to_vec()
}

#[tauri::command]
fn start_render(
    app: AppHandle,
    state: State<'_, render::RenderState>,
    job: render::RenderJob,
) -> Result<(), String> {
    render::start(app, &state, job)
}

#[tauri::command]
fn cancel_render(state: State<'_, render::RenderState>) {
    render::cancel(&state);
}

/// Carpeta de proyectos: datos de la app (datos de la app/projects).
fn projects_dir_path(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("projects");
    std::fs::create_dir_all(&d).map_err(|e| format!("No se pudo crear {}: {e}", d.display()))?;
    Ok(d)
}

/// Extensión de los proyectos de video. Los `.clipstudio` (formato idéntico) se siguen abriendo.
pub const PROJECT_EXT: &str = "cstudio";
const LEGACY_EXT: &str = "clipstudio";

fn is_project(p: &Path) -> bool {
    p.extension()
        .map(|x| x == PROJECT_EXT || x == LEGACY_EXT)
        .unwrap_or(false)
}

/// Copia (una sola vez) los proyectos de ClipStudio a la carpeta de Creator Studio.
/// No borra nada: ClipStudio sigue funcionando si sigue instalado.
fn import_clipstudio_projects(app: &AppHandle) {
    let (Ok(data), Ok(new_dir)) = (app.path().data_dir(), projects_dir_path(app)) else {
        return;
    };
    let marker = new_dir.join(".clipstudio-imported");
    if marker.exists() {
        return;
    }
    if let Ok(rd) = std::fs::read_dir(data.join("com.clipstudio.app").join("projects")) {
        for e in rd.flatten() {
            let p = e.path();
            if p.extension().map(|x| x == LEGACY_EXT).unwrap_or(false) {
                let stem = p
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let mut target = new_dir.join(format!("{stem}.{PROJECT_EXT}"));
                let mut n = 2;
                while target.exists() {
                    target = new_dir.join(format!("{stem} ({n}).{PROJECT_EXT}"));
                    n += 1;
                }
                let _ = std::fs::copy(&p, &target);
            }
        }
    }
    let _ = std::fs::write(marker, "");
}

/// Carpeta por defecto para exportar: %USERPROFILE%\Videos
#[tauri::command]
fn default_export_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .video_dir()
        .or_else(|_| app.path().home_dir())
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn dir_exists(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command]
fn projects_dir(app: AppHandle) -> Result<String, String> {
    projects_dir_path(&app).map(|p| p.to_string_lossy().to_string())
}

fn sanitize_name(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| {
            if "<>:\"/\\|?*".contains(c) || c.is_control() {
                '_'
            } else {
                c
            }
        })
        .collect();
    let s = s.trim().trim_end_matches('.').to_string();
    if s.is_empty() {
        "Proyecto".into()
    } else {
        s
    }
}

/// Ruta libre para un proyecto nuevo dentro de `dir` (o la carpeta por defecto).
#[tauri::command]
fn new_project_path(app: AppHandle, name: String, dir: Option<String>) -> Result<String, String> {
    let d = match dir {
        Some(d) => PathBuf::from(d),
        None => projects_dir_path(&app)?,
    };
    let base = sanitize_name(&name);
    let mut p = d.join(format!("{base}.{PROJECT_EXT}"));
    let mut n = 2;
    while p.exists() {
        p = d.join(format!("{base} ({n}).{PROJECT_EXT}"));
        n += 1;
    }
    Ok(p.to_string_lossy().to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectEntry {
    path: String,
    name: String,
    clips: usize,
    media: usize,
    modified: u64,
    /// Duración total de la línea de tiempo en segundos.
    duration: f64,
    /// Portada del proyecto (si existe en disco).
    cover: Option<String>,
    /// Video + segundo para generar una vista previa si no hay portada.
    preview_path: Option<String>,
    preview_time: f64,
    resolution: String,
    fps: u32,
    orientation: String,
}

/// Proyectos de video de la carpeta por defecto, más recientes primero.
#[tauri::command]
fn list_projects(app: AppHandle) -> Result<Vec<ProjectEntry>, String> {
    let d = projects_dir_path(&app)?;
    let mut out = Vec::new();
    for e in std::fs::read_dir(&d).map_err(|e| e.to_string())?.flatten() {
        let p = e.path();
        if is_project(&p) {
            let modified = e
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let v: serde_json::Value = std::fs::read_to_string(&p)
                .ok()
                .and_then(|t| serde_json::from_str(&t).ok())
                .unwrap_or_default();
            let clips = v["clips"].as_array().cloned().unwrap_or_default();
            let media = v["media"].as_array().cloned().unwrap_or_default();
            let duration: f64 = clips
                .iter()
                .map(|c| {
                    (c["out"].as_f64().unwrap_or(0.0) - c["in"].as_f64().unwrap_or(0.0)).max(0.0)
                })
                .sum();
            // Vista previa: un poco después del inicio del primer clip cuyo archivo exista.
            let (preview_path, preview_time) = clips
                .iter()
                .find_map(|c| {
                    let m = media.iter().find(|m| m["id"] == c["mediaId"])?;
                    let path = m["path"].as_str()?;
                    if !Path::new(path).is_file() {
                        return None;
                    }
                    let (i, o) = (
                        c["in"].as_f64().unwrap_or(0.0),
                        c["out"].as_f64().unwrap_or(0.0),
                    );
                    Some((path.to_string(), (i + ((o - i) * 0.25).min(3.0)).max(0.0)))
                })
                .map(|(p, t)| (Some(p), t))
                .unwrap_or((None, 0.0));
            let cover = v["cover"]
                .as_str()
                .filter(|c| Path::new(c).is_file())
                .map(String::from);
            out.push(ProjectEntry {
                name: v["name"].as_str().map(String::from).unwrap_or_else(|| {
                    p.file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                }),
                clips: clips.len(),
                media: media.len(),
                path: p.to_string_lossy().to_string(),
                modified,
                duration,
                cover,
                preview_path,
                preview_time,
                resolution: v["export"]["resolution"]
                    .as_str()
                    .unwrap_or("1080p")
                    .to_string(),
                fps: v["export"]["fps"].as_u64().unwrap_or(60) as u32,
                orientation: v["export"]["orientation"]
                    .as_str()
                    .unwrap_or("landscape")
                    .to_string(),
            });
        }
    }
    out.sort_by_key(|a| std::cmp::Reverse(a.modified));
    Ok(out)
}

/// Mueve un proyecto de video a la Papelera de reciclaje (recuperable).
/// Los videos originales y las portadas no se tocan.
#[tauri::command]
async fn delete_project(path: String) -> Result<(), String> {
    blocking(move || {
        let p = Path::new(&path);
        if !is_project(p) {
            return Err("Solo se pueden eliminar archivos de proyecto de video.".into());
        }
        if !p.is_file() {
            return Err("El proyecto ya no existe.".into());
        }
        trash::delete(p).map_err(|e| format!("No se pudo mover a la Papelera: {e}"))
    })
    .await
}

/// Rutas de video recibidas por línea de comandos (menú contextual del Explorador).
pub fn video_args<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter(|a| !a.starts_with("--"))
        .filter(|a| {
            let p = Path::new(a);
            p.is_file()
                && p.extension()
                    .map(|e| {
                        ffmpeg::VIDEO_EXTS.contains(&e.to_string_lossy().to_lowercase().as_str())
                    })
                    .unwrap_or(false)
        })
        .collect()
}

#[derive(Default)]
pub struct StartupPaths(Mutex<Vec<String>>);

/// Devuelve (una sola vez) los videos con los que se abrió la app.
#[tauri::command]
fn take_startup_paths(state: State<'_, StartupPaths>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[tauri::command]
fn save_text(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("No se pudo guardar: {e}"))
}

#[tauri::command]
fn load_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("No se pudo abrir: {e}"))
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).is_file()
}

/// Plugin `videos`: editor de video y gestor de metadata (ffmpeg).
///
/// `startup_paths` son los videos con los que se abrió la app (menú contextual del Explorador).
pub fn init(startup_paths: Vec<String>) -> TauriPlugin<Wry> {
    Builder::new("videos")
        .setup(move |app, _api| {
            app.manage(render::RenderState::default());
            app.manage(StartupPaths(Mutex::new(startup_paths)));
            let _ = projects_dir_path(app);
            import_clipstudio_projects(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ffmpeg_status,
            probe_media,
            thumbnail,
            capture_frame,
            read_cover,
            write_metadata,
            scan_folder,
            editable_tags,
            start_render,
            cancel_render,
            save_text,
            load_text,
            file_exists,
            projects_dir,
            new_project_path,
            list_projects,
            delete_project,
            take_startup_paths,
            default_export_dir,
            dir_exists
        ])
        .build()
}

#[cfg(test)]
mod tests {
    use super::args::*;

    #[test]
    fn args_build() {
        let job = RenderJob {
            clips: vec![
                RenderClip {
                    path: "a.mp4".into(),
                    start: 1.0,
                    end: 3.5,
                    has_audio: true,
                    transition: None,
                    zoom: None,
                },
                RenderClip {
                    path: "b.mp4".into(),
                    start: 0.0,
                    end: 2.0,
                    has_audio: false,
                    transition: None,
                    zoom: None,
                },
            ],
            output: "out.mp4".into(),
            width: 1920,
            height: 1080,
            fps: 60,
            codec: "h264".into(),
            quality: 20,
            cover: Some("c.png".into()),
            metadata: Default::default(),
        };
        let a = build_args(&job).unwrap();
        println!("{}", a.join(" "));
        assert!(a.contains(&"attached_pic".to_string()));
    }
}
