//! Utilidades para localizar y ejecutar ffmpeg / ffprobe.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Evita que se abra una ventana de consola por cada proceso en Windows.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn exe_name(base: &str) -> String {
    if cfg!(windows) {
        format!("{base}.exe")
    } else {
        base.to_string()
    }
}

/// Busca el binario: junto al ejecutable (sidecar incluido en el instalador)
/// o en el PATH del sistema.
pub fn locate(base: &str) -> Option<PathBuf> {
    let name = exe_name(base);
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for candidate in [
                dir.join(&name),
                dir.join("ffmpeg").join(&name),
                dir.join("bin").join(&name),
            ] {
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }
    // PATH
    let path_var = std::env::var_os("PATH")?;
    std::env::split_paths(&path_var)
        .map(|p| p.join(&name))
        .find(|p| p.is_file())
}

pub fn command(base: &str) -> Result<Command, String> {
    let bin = locate(base).ok_or_else(|| {
        format!(
            "No se encontró {base}. Reinstala Creator Studio o agrega {} al PATH.",
            exe_name(base)
        )
    })?;
    let mut cmd = Command::new(bin);
    cmd.stdin(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    Ok(cmd)
}

pub fn run(mut cmd: Command) -> Result<Output, String> {
    let out = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("No se pudo ejecutar el proceso: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let tail: Vec<&str> = err.lines().rev().take(8).collect();
        let tail: Vec<&str> = tail.into_iter().rev().collect();
        return Err(tail.join("\n"));
    }
    Ok(out)
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub path: String,
    pub name: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub has_audio: bool,
    pub video_codec: String,
    /// Índice absoluto del stream de portada (attached_pic), si existe.
    pub cover_stream: Option<u32>,
    /// Número de streams de video que NO son portada.
    pub video_streams: u32,
    /// Tags de metadata del contenedor (claves en minúsculas).
    pub tags: BTreeMap<String, String>,
    pub size: u64,
    pub format_name: String,
    pub bit_rate: u64,
    pub audio_codec: String,
    pub audio_channels: u32,
    pub audio_sample_rate: u32,
    pub subtitle_streams: u32,
    pub chapters: u32,
}

fn parse_rate(r: &str) -> f64 {
    let mut it = r.split('/');
    let n: f64 = it.next().and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let d: f64 = it.next().and_then(|s| s.parse().ok()).unwrap_or(1.0);
    if d == 0.0 {
        0.0
    } else {
        n / d
    }
}

pub fn probe(path: &str) -> Result<MediaInfo, String> {
    let mut cmd = command("ffprobe")?;
    cmd.args([
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        "-show_chapters",
    ])
    .arg(path);
    let out = run(cmd)?;
    let json: serde_json::Value = serde_json::from_slice(&out.stdout)
        .map_err(|e| format!("Respuesta inválida de ffprobe: {e}"))?;

    let streams = json["streams"].as_array().cloned().unwrap_or_default();
    let mut info = MediaInfo {
        path: path.to_string(),
        name: Path::new(path)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
        duration: json["format"]["duration"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0),
        width: 0,
        height: 0,
        fps: 0.0,
        has_audio: false,
        video_codec: String::new(),
        cover_stream: None,
        video_streams: 0,
        tags: json["format"]["tags"]
            .as_object()
            .map(|o| {
                o.iter()
                    .filter_map(|(k, v)| v.as_str().map(|v| (k.to_lowercase(), v.to_string())))
                    .collect()
            })
            .unwrap_or_default(),
        size: json["format"]["size"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0),
        format_name: json["format"]["format_name"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        bit_rate: json["format"]["bit_rate"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0),
        audio_codec: String::new(),
        audio_channels: 0,
        audio_sample_rate: 0,
        subtitle_streams: 0,
        chapters: json["chapters"]
            .as_array()
            .map(|a| a.len() as u32)
            .unwrap_or(0),
    };

    for s in &streams {
        match s["codec_type"].as_str() {
            Some("video") => {
                let is_cover = s["disposition"]["attached_pic"].as_i64() == Some(1);
                if is_cover {
                    if info.cover_stream.is_none() {
                        info.cover_stream = s["index"].as_u64().map(|v| v as u32);
                    }
                    continue;
                }
                info.video_streams += 1;
                if info.width == 0 {
                    info.width = s["width"].as_u64().unwrap_or(0) as u32;
                    info.height = s["height"].as_u64().unwrap_or(0) as u32;
                    info.fps = parse_rate(s["avg_frame_rate"].as_str().unwrap_or("0/1"));
                    if info.fps == 0.0 {
                        info.fps = parse_rate(s["r_frame_rate"].as_str().unwrap_or("0/1"));
                    }
                    info.video_codec = s["codec_name"].as_str().unwrap_or("").to_string();
                    if info.duration == 0.0 {
                        info.duration = s["duration"]
                            .as_str()
                            .and_then(|v| v.parse().ok())
                            .unwrap_or(0.0);
                    }
                }
            }
            Some("audio") => {
                if !info.has_audio {
                    info.audio_codec = s["codec_name"].as_str().unwrap_or("").to_string();
                    info.audio_channels = s["channels"].as_u64().unwrap_or(0) as u32;
                    info.audio_sample_rate = s["sample_rate"]
                        .as_str()
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(0);
                }
                info.has_audio = true;
            }
            Some("subtitle") => info.subtitle_streams += 1,
            _ => {}
        }
    }

    if info.video_streams == 0 {
        return Err("El archivo no contiene una pista de video.".into());
    }
    Ok(info)
}

/// Extrae un fotograma en `time` segundos. Si `max_width` es Some, lo reduce.
pub fn extract_frame(
    src: &str,
    time: f64,
    out: &Path,
    max_width: Option<u32>,
) -> Result<(), String> {
    extract_frame_vf(
        src,
        time,
        out,
        max_width.map(|w| format!("scale='min({w},iw)':-2")),
    )
}

/// Extrae un fotograma aplicando un filtro de video opcional (p. ej. encuadre + zoom).
pub fn extract_frame_vf(
    src: &str,
    time: f64,
    out: &Path,
    vf: Option<String>,
) -> Result<(), String> {
    let mut cmd = command("ffmpeg")?;
    cmd.args(["-y", "-hide_banner", "-loglevel", "error"])
        .args(["-ss", &format!("{:.3}", time.max(0.0))])
        .arg("-i")
        .arg(src)
        .args(["-map", "0:V:0", "-frames:v", "1"]);
    if let Some(vf) = &vf {
        cmd.args(["-vf", vf]);
    }
    if out.extension().map(|e| e == "jpg").unwrap_or(false) {
        cmd.args(["-q:v", "3"]);
    }
    cmd.arg(out);
    run(cmd)?;
    if !out.is_file() {
        // Si el tiempo cae justo al final, ffmpeg no produce nada: reintenta un poco antes.
        if time > 0.2 {
            return extract_frame_vf(src, time - 0.2, out, vf);
        }
        return Err("No se pudo extraer el fotograma.".into());
    }
    Ok(())
}

/// Extrae la portada existente (attached_pic) de un video.
pub fn extract_cover(src: &str, stream: u32, out: &Path) -> Result<(), String> {
    let mut cmd = command("ffmpeg")?;
    cmd.args(["-y", "-hide_banner", "-loglevel", "error", "-i"])
        .arg(src)
        .args(["-map", &format!("0:{stream}"), "-frames:v", "1"])
        .arg(out);
    run(cmd)?;
    Ok(())
}

/// Qué hacer con la portada al escribir metadata.
#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CoverChange {
    Keep,
    Remove,
    Set { path: String },
}

/// Claves que el muxer MP4 de ffmpeg escribe como átomos iTunes estándar
/// (las que leen Windows, VLC, iTunes, Plex, etc.).
pub const EDITABLE_TAGS: &[&str] = &[
    "title",
    "artist",
    "date",
    "genre",
    "media_type",
    "copyright",
    "description",
    "synopsis",
    "comment",
    "show",
    "season_number",
    "episode_sort",
    "episode_id",
    "network",
];

/// Reescribe el contenedor copiando los streams (sin re-codificar) con nueva
/// metadata y/o portada. `tags`: valor vacío = borrar la etiqueta.
pub fn write_metadata(
    src: &str,
    out: &Path,
    info: &MediaInfo,
    tags: &BTreeMap<String, String>,
    cover: &CoverChange,
) -> Result<(), String> {
    let mut cmd = command("ffmpeg")?;
    cmd.args(["-y", "-hide_banner", "-loglevel", "error", "-i"])
        .arg(src);
    if let CoverChange::Set { path } = cover {
        cmd.arg("-i").arg(path);
    }
    cmd.args(["-map", "0:V", "-map", "0:a?", "-map", "0:s?"]);
    let cover_idx = info.video_streams;
    match cover {
        CoverChange::Keep => {
            if let Some(idx) = info.cover_stream {
                cmd.args(["-map", &format!("0:{idx}")]);
            }
        }
        CoverChange::Remove => {}
        CoverChange::Set { .. } => {
            cmd.args(["-map", "1:v:0"]);
        }
    }
    cmd.args(["-map_metadata", "0", "-map_chapters", "0", "-c", "copy"]);
    match cover {
        CoverChange::Set { .. } => {
            cmd.args([&format!("-c:v:{cover_idx}"), "mjpeg"])
                .args([&format!("-q:v:{cover_idx}"), "2"])
                .args([&format!("-disposition:v:{cover_idx}"), "attached_pic"]);
        }
        CoverChange::Keep if info.cover_stream.is_some() => {
            cmd.args([&format!("-disposition:v:{cover_idx}"), "attached_pic"]);
        }
        _ => {}
    }
    for (k, v) in tags {
        let key: String = k
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
            .collect();
        if key.is_empty() {
            continue;
        }
        cmd.args(["-metadata", &format!("{key}={}", v.trim())]);
    }
    cmd.args(["-movflags", "+faststart"]).arg(out);
    run(cmd)?;
    Ok(())
}

/// Reemplaza `src` por el resultado de `f(tmp)` de forma segura.
pub fn rewrite_in_place<F: FnOnce(&Path) -> Result<(), String>>(
    src: &Path,
    f: F,
) -> Result<(), String> {
    let stem = src
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = src
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();
    let tmp = src.with_file_name(format!("{stem}.cstudio-tmp.{ext}"));
    if let Err(e) = f(&tmp) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    std::fs::rename(&tmp, src).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("No se pudo reemplazar el archivo original (¿está abierto en otro programa?): {e}")
    })
}

pub const VIDEO_EXTS: &[&str] = &["mp4", "m4v", "mov", "mkv", "webm", "avi"];

/// Lista videos de una carpeta (opcionalmente recursiva).
pub fn list_videos(dir: &Path, recursive: bool, out: &mut Vec<PathBuf>) {
    let Ok(rd) = std::fs::read_dir(dir) else {
        return;
    };
    let mut entries: Vec<_> = rd.filter_map(Result::ok).collect();
    entries.sort_by_key(|e| e.file_name());
    for e in entries {
        let p = e.path();
        let name = e.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name.contains(".cstudio-tmp.") {
            continue;
        }
        if p.is_dir() {
            if recursive {
                list_videos(&p, true, out);
            }
        } else if p
            .extension()
            .map(|x| VIDEO_EXTS.contains(&x.to_string_lossy().to_lowercase().as_str()))
            .unwrap_or(false)
        {
            out.push(p);
        }
    }
}
