import { errMsg, formatBytes, inTauri } from './lib'

describe('formatBytes', () => {
  it('formats bytes with binary units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB')
  })
})

describe('errMsg', () => {
  it('reads strings, errors and anything else', () => {
    expect(errMsg('boom')).toBe('boom')
    expect(errMsg(new Error('bad'))).toBe('bad')
    expect(errMsg(42)).toBe('42')
  })
})

describe('inTauri', () => {
  it('is false in the browser / jsdom', () => {
    expect(inTauri()).toBe(false)
  })
})
