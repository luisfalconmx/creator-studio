import { formatBytes, formatDuration, formatEta, formatSpeed, looksLikeUrl } from './format'

describe('formatBytes', () => {
  it('returns a dash for missing or invalid sizes', () => {
    expect(formatBytes(undefined)).toBe('—')
    expect(formatBytes(0)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
  })
  it('uses whole numbers below MB and decimals above', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1.5 * 1024 ** 2)).toBe('1.5 MB')
  })
  it('formats speeds', () => {
    expect(formatSpeed(3 * 1024 ** 2)).toBe('3.0 MB/s')
  })
})

describe('formatDuration / formatEta', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3725)).toBe('1:02:05')
    expect(formatEta(42)).toBe('42 s')
    expect(formatEta(125)).toBe('2 min 5 s')
  })
})

describe('looksLikeUrl', () => {
  it('accepts http(s) links only', () => {
    expect(looksLikeUrl('https://youtu.be/abc')).toBe(true)
    expect(looksLikeUrl(' http://example.com/v.mp4 ')).toBe(true)
    expect(looksLikeUrl('ftp://example.com')).toBe(false)
    expect(looksLikeUrl('not a url')).toBe(false)
  })
})
