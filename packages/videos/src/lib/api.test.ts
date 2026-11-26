import { baseName, isProjectFile, joinPath, limiter, stripExt } from './api'

describe('path helpers', () => {
  it('handles Windows and POSIX separators', () => {
    expect(baseName('C:\\Videos\\clip.mp4')).toBe('clip.mp4')
    expect(baseName('/home/me/clip.mp4')).toBe('clip.mp4')
    expect(stripExt('clip.final.mp4')).toBe('clip.final')
    expect(joinPath('C:\\Videos', 'a.mp4')).toBe('C:\\Videos\\a.mp4')
    expect(joinPath('/home/me/', 'a.mp4')).toBe('/home/me/a.mp4')
  })

  it('recognises new and legacy project files', () => {
    expect(isProjectFile('Vlog.cstudio')).toBe(true)
    expect(isProjectFile('Vlog.CLIPSTUDIO')).toBe(true)
    expect(isProjectFile('Vlog.mp4')).toBe(false)
  })
})

describe('limiter', () => {
  it('never runs more tasks than allowed at once', async () => {
    const limit = limiter(2)
    let running = 0
    let peak = 0
    const task = () =>
      limit(async () => {
        running++
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 5))
        running--
      })
    await Promise.all([task(), task(), task(), task(), task()])
    expect(peak).toBe(2)
  })
})
