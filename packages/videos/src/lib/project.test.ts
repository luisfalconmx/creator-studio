import { type Clip, formatTime, outputDuration } from './project'

const clip = (id: string, inP: number, out: number, transition?: number): Clip =>
  ({
    id,
    mediaId: 'm',
    in: inP,
    out,
    ...(transition ? { transition: { kind: 'fade', duration: transition } } : {}),
  }) as Clip

describe('formatTime', () => {
  it('formats minutes, hours and centiseconds', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(75)).toBe('01:15')
    expect(formatTime(3661)).toBe('1:01:01')
    expect(formatTime(1.5, true)).toBe('00:01.50')
    expect(formatTime(Number.NaN)).toBe('00:00')
  })
})

describe('outputDuration', () => {
  it('subtracts the overlap of transitions', () => {
    expect(outputDuration([clip('a', 0, 10), clip('b', 0, 5)])).toBe(15)
    expect(outputDuration([clip('a', 0, 10, 1), clip('b', 0, 5)])).toBe(14)
  })
})
