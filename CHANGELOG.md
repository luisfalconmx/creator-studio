# Changelog

Todos los cambios importantes de Creator Studio se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

Cada release publica en GitHub la sección de su versión como notas (ver `scripts/release-lib.mjs`):
**no se puede publicar una versión sin su entrada aquí.**

## [Sin publicar]

### Cambiado

- **Imágenes** y **Descargas** estrenan una pantalla de inicio con el mismo estilo que la de Videos:
  fondo 3D animado (fotos flotantes en Imágenes, tarjetas de descarga en Descargas), bienvenida
  grande y tarjetas de acción. En Descargas puedes pegar el enlace del portapapeles, ir a la cola o
  abrir los ajustes desde el inicio.

## [1.0.0] - 2026-11-26

Primera versión de Creator Studio: une ClipStudio, Pixelair y Streamline en una sola app de
escritorio para Windows, macOS y Linux.

### Agregado

- **Menú lateral** con tres secciones: Videos, Imágenes y Descargas. Cada sección conserva su estado
  al cambiar de pestaña (el proyecto abierto, la cola de imágenes y las descargas en curso), y la app
  recuerda la última sección abierta.
- **Videos** (antes ClipStudio): editor con línea de tiempo, recortes, transiciones, zoom y encuadre
  por clip, portada y exportación hasta 4K a 120 fps (H.264, H.265 o NVENC). Incluye **Metadatos**:
  título, portada y etiquetas de un video o de una carpeta completa, sin renderizar.
- **Imágenes** (antes Pixelair): optimizador de JPG, PNG, WebP y AVIF con los códecs de Squoosh,
  exportación en varias densidades (@0.5x a @4x) y sin metadatos. Todo se procesa en el equipo.
- **Descargas** (antes Streamline): videos y audio de YouTube y más de 1.800 sitios con yt-dlp, con
  todas las calidades, playlists, subtítulos, SponsorBlock, cookies del navegador y cola de descargas.
- ffmpeg, ffprobe, yt-dlp y deno vienen dentro del instalador: no hay que instalar nada más.
- Menú contextual del Explorador de Windows: **«Editar en Creator Studio»** abre uno o varios videos
  como proyecto nuevo.
- Actualizaciones automáticas firmadas desde GitHub Releases.

### Cambiado

- Toda la app usa el diseño de ClipStudio (oscuro con rojo, paneles de vidrio, Inter) y está en español.
- Los proyectos de video ahora usan la extensión `.cstudio`. Los `.clipstudio` se siguen abriendo y,
  la primera vez, los proyectos de ClipStudio se copian a Creator Studio.
- Arrastrar archivos a la ventana solo afecta a la sección visible.

[Sin publicar]: https://github.com/luisfalconmx/creator-studio/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/luisfalconmx/creator-studio/releases/tag/v1.0.0
