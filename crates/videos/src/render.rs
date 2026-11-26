//! Renderizado de la línea de tiempo con ffmpeg (recortes + concatenación + portada).

pub use crate::args::{build_args, RenderJob};
use crate::ffmpeg;
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RenderProgress {
    pub percent: f64,
    pub seconds: f64,
    pub total: f64,
    pub fps: f64,
    pub speed: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RenderDone {
    pub ok: bool,
    pub cancelled: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct RenderState {
    pub child: Arc<Mutex<Option<Child>>>,
    pub cancelled: Arc<Mutex<bool>>,
}

pub fn start(app: AppHandle, state: &RenderState, job: RenderJob) -> Result<(), String> {
    {
        let guard = state.child.lock().unwrap();
        if guard.is_some() {
            return Err("Ya hay un renderizado en curso.".into());
        }
    }
    let total: f64 = crate::args::output_duration(&job);
    let args = build_args(&job)?;
    let mut cmd = ffmpeg::command("ffmpeg")?;
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("No se pudo iniciar ffmpeg: {e}"))?;
    let stdout = child.stdout.take().ok_or("Sin stdout")?;
    let stderr = child.stderr.take().ok_or("Sin stderr")?;

    *state.child.lock().unwrap() = Some(child);
    *state.cancelled.lock().unwrap() = false;

    // stderr en un hilo aparte para no bloquear el proceso
    let err_buf = Arc::new(Mutex::new(String::new()));
    {
        let err_buf = err_buf.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                let mut b = err_buf.lock().unwrap();
                b.push_str(&line);
                b.push('\n');
                if b.len() > 16_000 {
                    let cut = b.len() - 8_000;
                    let cut = (cut..b.len()).find(|i| b.is_char_boundary(*i)).unwrap_or(0);
                    b.drain(..cut);
                }
            }
        });
    }

    let child_ref = state.child.clone();
    let cancelled = state.cancelled.clone();
    let output = job.output.clone();
    std::thread::spawn(move || {
        let mut fps = 0.0;
        let mut speed = String::new();
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some((k, v)) = line.split_once('=') {
                match k {
                    "fps" => fps = v.trim().parse().unwrap_or(0.0),
                    "speed" => speed = v.trim().to_string(),
                    "out_time_us" | "out_time_ms" => {
                        let secs = v.trim().parse::<f64>().unwrap_or(0.0) / 1_000_000.0;
                        let pct = if total > 0.0 {
                            (secs / total * 100.0).clamp(0.0, 100.0)
                        } else {
                            0.0
                        };
                        let _ = app.emit(
                            "render-progress",
                            RenderProgress {
                                percent: pct,
                                seconds: secs,
                                total,
                                fps,
                                speed: speed.clone(),
                            },
                        );
                    }
                    _ => {}
                }
            }
        }
        let status = {
            let mut guard = child_ref.lock().unwrap();
            let st = guard.as_mut().and_then(|c| c.wait().ok());
            *guard = None;
            st
        };
        let was_cancelled = *cancelled.lock().unwrap();
        let ok = status.map(|s| s.success()).unwrap_or(false) && !was_cancelled;
        if !ok {
            let _ = std::fs::remove_file(&output);
        }
        let error = if ok || was_cancelled {
            None
        } else {
            let e = err_buf.lock().unwrap().clone();
            Some(if e.trim().is_empty() {
                "ffmpeg terminó con error.".to_string()
            } else {
                e
            })
        };
        let _ = app.emit(
            "render-done",
            RenderDone {
                ok,
                cancelled: was_cancelled,
                output,
                error,
            },
        );
    });
    Ok(())
}

pub fn cancel(state: &RenderState) {
    *state.cancelled.lock().unwrap() = true;
    if let Some(child) = state.child.lock().unwrap().as_mut() {
        let _ = child.kill();
    }
}
