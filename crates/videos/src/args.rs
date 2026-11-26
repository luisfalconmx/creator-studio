//! Construcción de argumentos de ffmpeg para el render (sin dependencias de Tauri).

use serde::Deserialize;
use std::collections::BTreeMap;

/// Transiciones soportadas (nombres del filtro `xfade` de ffmpeg).
pub const TRANSITIONS: &[&str] = &[
    "fade",
    "fadeblack",
    "fadewhite",
    "dissolve",
    "wipeleft",
    "wiperight",
    "slideleft",
    "slideup",
    "circleopen",
    "radial",
    "pixelize",
    "smoothleft",
];

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Transition {
    pub kind: String,
    pub duration: f64,
}

/// Zoom / encuadre de un clip: `scale` ≥ 1 y posición `x`,`y` en [-1, 1] (0 = centro).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Zoom {
    pub scale: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RenderClip {
    pub path: String,
    pub start: f64,
    pub end: f64,
    pub has_audio: bool,
    /// Transición hacia el clip siguiente (se ignora en el último).
    #[serde(default)]
    pub transition: Option<Transition>,
    #[serde(default)]
    pub zoom: Option<Zoom>,
}

/// Filtro de zoom: amplía el cuadro ya ajustado (w×h) y recorta w×h, así el
/// resultado conserva exactamente el formato de salida (p. ej. 16:9).
pub fn zoom_filter(z: &Option<Zoom>, w: u32, h: u32) -> String {
    let Some(z) = z else { return String::new() };
    let scale = z.scale.clamp(1.0, 5.0);
    if scale < 1.001 {
        return String::new();
    }
    let even = |v: f64| ((v / 2.0).round() as u32) * 2;
    let (zw, zh) = (even(w as f64 * scale).max(w), even(h as f64 * scale).max(h));
    let px = ((zw - w) as f64 * (z.x.clamp(-1.0, 1.0) + 1.0) / 2.0).round() as u32;
    let py = ((zh - h) as f64 * (z.y.clamp(-1.0, 1.0) + 1.0) / 2.0).round() as u32;
    format!(",scale={zw}:{zh}:flags=lanczos,crop={w}:{h}:{px}:{py}")
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RenderJob {
    pub clips: Vec<RenderClip>,
    pub output: String,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    /// "h264" | "hevc" | "h264_nvenc" | "hevc_nvenc"
    pub codec: String,
    /// CRF / CQ (menor = mejor calidad)
    pub quality: u32,
    pub cover: Option<String>,
    /// Metadata del video exportado (título, descripción, etc.).
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
}

fn clip_len(c: &RenderClip) -> f64 {
    (c.end - c.start).max(0.04)
}

/// Encuadre de un fotograma igual que en el render: ajuste al cuadro w×h con
/// barras si hace falta, y después el zoom/recorte del clip.
pub fn framing_filter(w: u32, h: u32, zoom: &Option<Zoom>) -> String {
    format!(
        "scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,\
         pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black{},setsar=1",
        zoom_filter(zoom, w, h)
    )
}

/// Duración efectiva de la transición entre `a` y `b` (o 0 si no hay).
/// Se limita a 2/5 del clip más corto para que siempre quepa.
pub fn transition_secs(a: &RenderClip, b: &RenderClip) -> f64 {
    match &a.transition {
        Some(t) if TRANSITIONS.contains(&t.kind.as_str()) && t.duration > 0.0 => {
            t.duration.min(clip_len(a).min(clip_len(b)) * 0.4).max(0.05)
        }
        _ => 0.0,
    }
}

/// Duración final del video (las transiciones solapan clips).
pub fn output_duration(job: &RenderJob) -> f64 {
    let total: f64 = job.clips.iter().map(clip_len).sum();
    let overlap: f64 = job
        .clips
        .windows(2)
        .map(|w| transition_secs(&w[0], &w[1]))
        .sum();
    (total - overlap).max(0.0)
}

/// Construye los argumentos de ffmpeg para el trabajo. Público para pruebas.
pub fn build_args(job: &RenderJob) -> Result<Vec<String>, String> {
    if job.clips.is_empty() {
        return Err("La línea de tiempo está vacía.".into());
    }
    if job.fps < 60 {
        return Err("El mínimo es 60 fps.".into());
    }
    let (w, h, fps) = (job.width, job.height, job.fps);
    let mut a: Vec<String> = vec![
        "-y".into(),
        "-hide_banner".into(),
        "-nostats".into(),
        "-loglevel".into(),
        "error".into(),
        "-progress".into(),
        "pipe:1".into(),
    ];

    for c in &job.clips {
        let dur = (c.end - c.start).max(0.04);
        a.extend([
            "-ss".into(),
            format!("{:.3}", c.start.max(0.0)),
            "-t".into(),
            format!("{:.3}", dur),
            "-i".into(),
            c.path.clone(),
        ]);
    }
    let cover_input = job.clips.len();
    if let Some(cover) = &job.cover {
        a.extend(["-i".into(), cover.clone()]);
    }

    let mut graph = String::new();
    for (i, c) in job.clips.iter().enumerate() {
        let dur = clip_len(c);
        let zoom = zoom_filter(&c.zoom, w, h);
        // fps tras setpts (CFR) + settb=AVTB: misma base de tiempo y frecuencia constante,
        // requisitos de xfade.
        graph.push_str(&format!(
            "[{i}:V:0]scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,\
             pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black{zoom},setsar=1,fps={fps},format=yuv420p,\
             trim=duration={dur:.3},setpts=PTS-STARTPTS,fps={fps},settb=AVTB[v{i}];"
        ));
        if c.has_audio {
            graph.push_str(&format!(
                "[{i}:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,\
                 apad,atrim=duration={dur:.3},asetpts=PTS-STARTPTS[a{i}];"
            ));
        } else {
            graph.push_str(&format!(
                "anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration={dur:.3},\
                 aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[a{i}];"
            ));
        }
    }

    // Unión clip a clip: corte directo (concat) o transición (xfade + acrossfade).
    let n = job.clips.len();
    let (mut cv, mut ca) = ("v0".to_string(), "a0".to_string());
    let mut length = clip_len(&job.clips[0]);
    for k in 1..n {
        let (prev, next) = (&job.clips[k - 1], &job.clips[k]);
        let d = transition_secs(prev, next);
        let (nv, na) = (format!("cv{k}"), format!("ca{k}"));
        if d > 0.0 {
            let kind = &prev.transition.as_ref().unwrap().kind;
            let offset = (length - d).max(0.0);
            graph.push_str(&format!(
                "[{cv}][v{k}]xfade=transition={kind}:duration={d:.3}:offset={offset:.3},settb=AVTB[{nv}];\
                 [{ca}][a{k}]acrossfade=d={d:.3}:c1=tri:c2=tri[{na}];"
            ));
            length += clip_len(next) - d;
        } else {
            graph.push_str(&format!(
                "[{cv}][{ca}][v{k}][a{k}]concat=n=2:v=1:a=1[t{nv}][{na}];[t{nv}]fps={fps},settb=AVTB[{nv}];"
            ));
            length += clip_len(next);
        }
        cv = nv;
        ca = na;
    }
    graph.push_str(&format!("[{cv}]null[outv];[{ca}]anull[outa]"));

    a.extend([
        "-filter_complex".into(),
        graph,
        "-map".into(),
        "[outv]".into(),
        "-map".into(),
        "[outa]".into(),
    ]);

    let q = job.quality.to_string();
    let enc: Vec<&str> = match job.codec.as_str() {
        "hevc" => vec![
            "-c:v:0",
            "libx265",
            "-preset:v:0",
            "medium",
            "-crf:v:0",
            &q,
            "-tag:v:0",
            "hvc1",
            "-x265-params",
            "log-level=error",
        ],
        "h264_nvenc" => vec![
            "-c:v:0",
            "h264_nvenc",
            "-preset:v:0",
            "p5",
            "-rc:v:0",
            "vbr",
            "-cq:v:0",
            &q,
            "-b:v:0",
            "0",
        ],
        "hevc_nvenc" => vec![
            "-c:v:0",
            "hevc_nvenc",
            "-preset:v:0",
            "p5",
            "-rc:v:0",
            "vbr",
            "-cq:v:0",
            &q,
            "-b:v:0",
            "0",
            "-tag:v:0",
            "hvc1",
        ],
        _ => vec!["-c:v:0", "libx264", "-preset:v:0", "medium", "-crf:v:0", &q],
    };
    a.extend(enc.into_iter().map(String::from));
    a.extend(["-c:a".into(), "aac".into(), "-b:a".into(), "192k".into()]);

    if job.cover.is_some() {
        a.extend([
            "-map".into(),
            format!("{cover_input}:v:0"),
            "-c:v:1".into(),
            "mjpeg".into(),
            "-q:v:1".into(),
            "2".into(),
            "-disposition:v:1".into(),
            "attached_pic".into(),
        ]);
    }
    a.extend(["-map_metadata".into(), "-1".into()]);
    for (k, v) in &job.metadata {
        let key: String = k
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
            .collect();
        if !key.is_empty() && !v.trim().is_empty() {
            a.extend(["-metadata".into(), format!("{key}={}", v.trim())]);
        }
    }
    a.extend(["-movflags".into(), "+faststart".into(), job.output.clone()]);
    Ok(a)
}
