import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { advancePosition, interpolatePower } from './playback'
import { usePlayback } from './usePlayback'

let nextFrameId = 0
let pendingFrames: Map<number, FrameRequestCallback>
let requestAnimationFrameMock: ReturnType<typeof vi.fn>
let cancelAnimationFrameMock: ReturnType<typeof vi.fn>

const runNextFrame = (timestamp: number) => {
  const nextFrame = pendingFrames.entries().next().value as
    | [number, FrameRequestCallback]
    | undefined
  expect(nextFrame).toBeDefined()

  const [id, callback] = nextFrame!
  pendingFrames.delete(id)
  act(() => callback(timestamp))
}

beforeEach(() => {
  nextFrameId = 0
  pendingFrames = new Map()
  requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrameId
    pendingFrames.set(id, callback)
    return id
  })
  cancelAnimationFrameMock = vi.fn((id: number) => {
    pendingFrames.delete(id)
  })
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('playback math', () => {
  it('plays one simulated day per minute', () => {
    expect(advancePosition(0, 60_000, 8_928)).toBe(288)
  })

  it('wraps automatic playback after the final interval', () => {
    expect(advancePosition(8_927, 1_000, 8_928)).toBeCloseTo(3.8, 10)
  })

  it('returns zero safely when there are no records', () => {
    expect(advancePosition(12, 1_000, 0)).toBe(0)
  })

  it('returns finite predictable positions for non-finite inputs', () => {
    expect(advancePosition(12, 1_000, Number.POSITIVE_INFINITY)).toBe(0)
    expect(advancePosition(Number.NaN, 1_000, 100)).toBe(0)
    expect(advancePosition(102, Number.NaN, 100)).toBe(2)
  })

  it('normalizes the record count to a positive integer', () => {
    expect(advancePosition(4, 0, 3.8)).toBe(1)
    expect(advancePosition(4, 0, 0.8)).toBe(0)
  })

  it('interpolates power and clamps the fraction', () => {
    expect(interpolatePower(1, 3, 0.25)).toBe(1.5)
    expect(interpolatePower(1, 3, -1)).toBe(1)
    expect(interpolatePower(1, 3, 2)).toBe(3)
  })
})

describe('usePlayback', () => {
  it('advances a floating live position from animation-frame elapsed time', () => {
    const { result } = renderHook(() => usePlayback(8_928))

    expect(result.current).toMatchObject({
      index: 0,
      fraction: 0,
      isPlaying: true,
    })

    runNextFrame(100)
    runNextFrame(60_100)

    expect(result.current.index).toBe(288)
    expect(result.current.fraction).toBeCloseTo(0, 10)
  })

  it('preserves fractional playback within the final interval', () => {
    const { result } = renderHook(() => usePlayback(500))
    act(() => result.current.scrubTo(499))

    runNextFrame(100)
    runNextFrame(200)

    expect(result.current.index).toBe(499)
    expect(result.current.fraction).toBeCloseTo(0.48, 10)
  })

  it('clamps scrubs and day jumps instead of wrapping manual navigation', () => {
    const { result } = renderHook(() => usePlayback(500))

    act(() => result.current.scrubTo(999))
    expect(result.current.index).toBe(499)

    act(() => result.current.jumpDay(-2))
    expect(result.current.index).toBe(0)

    act(() => result.current.jumpDay(1))
    expect(result.current.index).toBe(288)
  })

  it('pauses on a history anchor and play returns to the live position', () => {
    const { result } = renderHook(() => usePlayback(8_928))
    runNextFrame(100)
    runNextFrame(30_100)
    expect(result.current.index).toBe(144)

    act(() => result.current.setHistoryAnchor(10))
    expect(result.current).toMatchObject({ index: 10, isPlaying: false })

    act(() => result.current.play())
    expect(result.current).toMatchObject({ index: 144, isPlaying: true })

    runNextFrame(50_000)
    runNextFrame(60_000)
    expect(result.current.index).toBe(192)
  })

  it('supports explicit pause and toggle controls', () => {
    const { result } = renderHook(() => usePlayback(100))

    act(() => result.current.pause())
    expect(result.current.isPlaying).toBe(false)

    act(() => result.current.toggle())
    expect(result.current.isPlaying).toBe(true)

    act(() => result.current.toggle())
    expect(result.current.isPlaying).toBe(false)
  })

  it('is inert and safe when there are no records', () => {
    const { result } = renderHook(() => usePlayback(0))

    expect(result.current).toMatchObject({
      index: 0,
      fraction: 0,
      isPlaying: false,
    })
    expect(requestAnimationFrameMock).not.toHaveBeenCalled()

    act(() => {
      result.current.play()
      result.current.scrubTo(20)
      result.current.jumpDay(1)
      result.current.setHistoryAnchor(8)
    })

    expect(result.current).toMatchObject({
      index: 0,
      fraction: 0,
      isPlaying: false,
    })
  })

  it('cancels the pending animation frame on unmount', () => {
    const { unmount } = renderHook(() => usePlayback(100))
    expect(pendingFrames.size).toBe(1)

    unmount()

    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1)
    expect(pendingFrames.size).toBe(0)
  })

  it('never exposes an out-of-range live index when the record count shrinks', () => {
    const observedIndexes: number[] = []
    const { result, rerender } = renderHook(
      ({ count }) => {
        const playback = usePlayback(count)
        observedIndexes.push(playback.index)
        return playback
      },
      { initialProps: { count: 500 } },
    )
    act(() => result.current.scrubTo(499))

    const observationStart = observedIndexes.length
    rerender({ count: 100 })

    expect(observedIndexes.slice(observationStart).length).toBeGreaterThan(0)
    expect(
      observedIndexes.slice(observationStart).every((index) => index < 100),
    ).toBe(true)
    expect(result.current.index).toBe(99)
  })

  it('never exposes an out-of-range history anchor when the record count shrinks', () => {
    const observedIndexes: number[] = []
    const { result, rerender } = renderHook(
      ({ count }) => {
        const playback = usePlayback(count)
        observedIndexes.push(playback.index)
        return playback
      },
      { initialProps: { count: 500 } },
    )
    act(() => result.current.setHistoryAnchor(450))

    const observationStart = observedIndexes.length
    rerender({ count: 100 })

    expect(observedIndexes.slice(observationStart).length).toBeGreaterThan(0)
    expect(
      observedIndexes.slice(observationStart).every((index) => index < 100),
    ).toBe(true)
    expect(result.current.index).toBe(99)
  })
})
