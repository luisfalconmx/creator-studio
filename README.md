<p align="center">
  <img src="packages/ui/src/assets/logo.svg" width="96" alt="Creator Studio" />
</p>

<h1 align="center">Creator Studio</h1>

<p align="center">
  Videos, imágenes y descargas en una sola app de escritorio para <b>Windows</b>, <b>macOS</b> y <b>Linux</b>.
</p>

---

Creator Studio reúne tres herramientas en una sola ventana. Se cambia de una a otra desde el menú lateral, y
cada sección conserva su estado al cambiar: el proyecto abierto, la cola de imágenes o las descargas en curso.

| Sección       | Qué hace                                                                                                                                                                                                | Antes      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Videos**    | Editor de video (línea de tiempo, recortes, transiciones, zoom, portada, exportación hasta 4K/120 fps con H.264, H.265 o NVENC) y gestor de metadatos sin renderizar (un video o una carpeta completa). | ClipStudio |
| **Imágenes**  | Optimizador de JPG, PNG, WebP y AVIF con los códecs de Squoosh, varias densidades (@2x, @3x…) y sin metadatos. Todo se procesa en tu equipo.                                                            | Pixelair   |
| **Descargas** | Videos y audio de YouTube y más de 1.800 sitios con yt-dlp: todas las calidades, playlists, subtítulos, SponsorBlock y cola de descargas.                                                               | Streamline |

Los instaladores incluyen **ffmpeg/ffprobe**, **yt-dlp** y **deno**, así que no hay que instalar nada más.
En Windows, el instalador agrega **«Editar en Creator Studio»** al menú contextual de los videos.

Los proyectos `.clipstudio` se siguen abriendo, y los de ClipStudio se copian solos a Creator Studio la primera vez.

## Stack

| Capa       | Tecnología                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Monorepo   | [Turborepo](https://turborepo.com) + pnpm workspaces + Cargo workspace                                              |
| Escritorio | [Tauri 2](https://tauri.app) (Rust): un plugin por sección                                                          |
| UI         | React 19 + TypeScript 7 + [Vite](https://vite.dev), [HeroUI v3](https://heroui.com), Tailwind CSS v4                |
| Calidad    | Biome, Vitest + Testing Library, Playwright (Chromium ≈ WebView2, WebKit ≈ WKWebView/WebKitGTK), commitlint + husky |
| Motores    | ffmpeg, yt-dlp + deno (sidecars), códecs WASM de Squoosh (jSquash)                                                  |

```
creator-studio/
├── apps/desktop/          # App Tauri: menú lateral, actualizaciones, e2e y src-tauri (un solo binario)
├── packages/
│   ├── ui/                # Tema y componentes compartidos (look & feel de ClipStudio)
│   ├── videos/            # Sección Videos
│   ├── images/            # Sección Imágenes
│   └── downloads/         # Sección Descargas
├── crates/
│   ├── videos/            # tauri-plugin-videos: ffmpeg, render, metadata, proyectos
│   ├── images/            # tauri-plugin-images: guardar resultados
│   └── downloads/         # tauri-plugin-downloads: yt-dlp, lectura de páginas
├── scripts/               # Sidecars y publicación de releases
├── docker/ + compose.yaml + Makefile
└── .github/workflows/     # CI y release multiplataforma
```

## Desarrollo (todo en Docker)

No hace falta instalar Node, pnpm ni Rust en tu equipo. Solo necesitas Docker.

```bash
make setup
```

**UI en el navegador** (backend simulado, con recarga en caliente) en http://localhost:1420:

```bash
make dev
```

**App de escritorio real** (WSLg en Windows 11 o un servidor X11/Wayland):

```bash
make tauri
```

**Calidad**: todo lo que corre la CI.

```bash
make check
```

**Instaladores**: Linux (`.deb`, `.rpm`, `.AppImage`) o Windows (`.exe` NSIS, compilación cruzada con cargo-xwin). Quedan en `target/`.

```bash
make tauri-build
```

```bash
make build-windows
```

Para ver todos los comandos: `make help`.

## Publicar una versión

Las actualizaciones van firmadas. La llave privada está fuera del repo, en `~/.tauri/creator-studio.key`
(la pública está en `apps/desktop/src-tauri/tauri.conf.json`). **Respáldala**: si se pierde, las apps instaladas
no podrán actualizarse.

Una sola vez, súbela como secreto del repositorio:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/creator-studio.key
```

Para cada versión, cambia `version` en `apps/desktop/package.json` (y en `Cargo.toml` del workspace), y sube un tag.
El workflow [`release.yml`](.github/workflows/release.yml) compila Windows, Linux y macOS (Apple Silicon e Intel),
firma las actualizaciones y publica el Release con instaladores sin versión en el nombre y el `latest.json` que lee la app:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Si prefieres compilar macOS en tu Mac: `pnpm release:mac`.

## Licencias de terceros

- [yt-dlp](https://github.com/yt-dlp/yt-dlp): Unlicense.
- [FFmpeg](https://ffmpeg.org): binarios GPL de [yt-dlp/FFmpeg-Builds](https://github.com/yt-dlp/FFmpeg-Builds) (Windows/Linux) y [Martin Riedl](https://ffmpeg.martin-riedl.de) (macOS).
- [Deno](https://deno.com): MIT.
- [jSquash](https://github.com/jamsinclair/jSquash) / Squoosh: Apache-2.0.

Descarga solo contenido del que tengas derechos o permiso, y respeta los términos de servicio de cada sitio.
