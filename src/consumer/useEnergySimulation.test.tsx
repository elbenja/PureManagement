import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateMonth } from '../simulation/generateMonth'
import { useEnergySimulation } from './useEnergySimulation'

let nextFrameId = 0
let pendingFrames: Map<number, FrameRequestCallback>

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
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrameId
    pendingFrames.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
    pendingFrames.delete(id)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useEnergySimulation', () => {
  const records = generateMonth()
  const calendarRecords = records.slice(0, 5).map((record, index) => {
    const dates = [
      [1, 30],
      [1, 31],
      [2, 1],
      [2, 2],
      [3, 1],
    ] as const
    const [month, day] = dates[index]!
    return {
      ...record,
      index,
      year: 2026,
      month,
      day,
      iso: `2026-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T00:00:00.000-08:00`,
    }
  })

  it('starts with component-ready live and trailing 24-hour views', () => {
    const { result } = renderHook(() => useEnergySimulation(records))

    expect(result.current.range).toBe('24h')
    expect(result.current.isPlaying).toBe(true)
    expect(result.current.live).toMatchObject({ index: 0, fraction: 0 })
    expect(result.current.history?.range).toMatchObject({
      key: '24h',
      startIndex: 0,
      endIndex: 0,
    })
  })

  it('switches ranges without moving the displayed anchor', () => {
    const { result } = renderHook(() => useEnergySimulation(records))
    act(() => result.current.scrubTo(3_000))

    act(() => result.current.setRange('7d'))

    expect(result.current.range).toBe('7d')
    expect(result.current.live?.index).toBe(3_000)
    expect(result.current.history?.range).toMatchObject({
      key: '7d',
      startIndex: 985,
      endIndex: 3_000,
    })
  })

  it.each(['30d', 'month', 'ytd'] as const)(
    'switches to the %s annual history range',
    (range) => {
      const { result } = renderHook(() => useEnergySimulation(records))
      act(() => result.current.scrubTo(3_000))

      act(() => result.current.setRange(range))

      expect(result.current.range).toBe(range)
      expect(result.current.live?.index).toBe(3_000)
      expect(result.current.history?.range.key).toBe(range)
    },
  )

  it('exposes a memoized seven-day outlook from the displayed anchor', () => {
    const { result, rerender } = renderHook(() => useEnergySimulation(records))

    expect(result.current.outlook).toHaveLength(7)
    expect(result.current.outlook[0]).toMatchObject({ date: '2026-08-01' })
    const outlook = result.current.outlook

    rerender()
    expect(result.current.outlook).toBe(outlook)
  })

  it('opens the immediately preceding period and pauses playback', () => {
    const { result } = renderHook(() => useEnergySimulation(records))
    act(() => result.current.scrubTo(1_000))

    act(() => result.current.previousPeriod())

    expect(result.current.isPlaying).toBe(false)
    expect(result.current.live?.index).toBe(712)
    expect(result.current.history?.range).toMatchObject({
      startIndex: 425,
      endIndex: 712,
    })
  })

  it('moves next by one full range without crossing the retained live position', () => {
    const { result } = renderHook(() => useEnergySimulation(records))
    act(() => result.current.scrubTo(1_000))

    expect(result.current.history?.range.canGoNext).toBe(false)

    act(() => result.current.previousPeriod())
    expect(result.current.history?.range.canGoNext).toBe(true)

    act(() => result.current.nextPeriod())
    expect(result.current.live?.index).toBe(1_000)
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.history?.range.canGoNext).toBe(false)

    const historyAtLive = result.current.history
    act(() => result.current.nextPeriod())
    expect(result.current.live?.index).toBe(1_000)
    expect(result.current.history).toBe(historyAtLive)
  })

  it('uses calendar range anchors for reversible period navigation', () => {
    const { result } = renderHook(() => useEnergySimulation(calendarRecords))
    act(() => result.current.scrubTo(3))
    act(() => result.current.setRange('month'))

    expect(result.current.history?.range).toMatchObject({
      startIndex: 2,
      endIndex: 3,
      previousAnchor: 1,
      nextAnchor: 4,
      canGoNext: false,
    })

    act(() => result.current.previousPeriod())
    expect(result.current.live?.index).toBe(1)
    expect(result.current.history?.range).toMatchObject({
      startIndex: 0,
      endIndex: 1,
      nextAnchor: 2,
      canGoNext: true,
    })

    act(() => result.current.nextPeriod())
    expect(result.current.live?.index).toBe(2)
    expect(result.current.history?.range).toMatchObject({
      startIndex: 2,
      endIndex: 3,
      canGoNext: false,
    })
  })

  it('returns from history to the retained live position and resumes animation', () => {
    const { result } = renderHook(() => useEnergySimulation(records))
    runNextFrame(100)
    runNextFrame(200_100)
    expect(result.current.live?.index).toBe(960)

    act(() => result.current.previousPeriod())
    expect(result.current.live?.index).toBe(672)

    act(() => result.current.play())
    expect(result.current.live?.index).toBe(960)
    expect(result.current.isPlaying).toBe(true)

    runNextFrame(300_000)
    runNextFrame(310_000)
    expect(result.current.live?.index).toBe(1_008)
  })

  it('exposes bounded scrubbing and day jumps from playback', () => {
    const { result } = renderHook(() => useEnergySimulation(records))

    act(() => result.current.scrubTo(records.length + 100))
    expect(result.current.live?.index).toBe(records.length - 1)

    act(() => result.current.jumpDay(-1))
    expect(result.current.live?.index).toBe(records.length - 1 - 288)
  })

  it('memoizes views and never mutates the record collection', () => {
    const source = records.slice(0, 1_000)
    const before = source.slice()
    const { result, rerender } = renderHook(() => useEnergySimulation(source))
    const initialLive = result.current.live
    const initialHistory = result.current.history

    act(() => result.current.pause())
    expect(result.current.live).toBe(initialLive)
    expect(result.current.history).toBe(initialHistory)

    rerender()
    expect(result.current.live).toBe(initialLive)
    expect(result.current.history).toBe(initialHistory)
    expect(source).toEqual(before)
    expect(source.every((record, index) => record === before[index])).toBe(true)
  })

  it('is inert and null-safe for an empty collection', () => {
    const { result } = renderHook(() => useEnergySimulation([]))

    expect(result.current).toMatchObject({
      live: null,
      history: null,
      outlook: [],
      range: '24h',
      isPlaying: false,
    })

    act(() => {
      result.current.setRange('7d')
      result.current.play()
      result.current.pause()
      result.current.toggle()
      result.current.scrubTo(20)
      result.current.jumpDay(1)
      result.current.previousPeriod()
      result.current.nextPeriod()
    })

    expect(result.current).toMatchObject({
      live: null,
      history: null,
      outlook: [],
      range: '24h',
      isPlaying: false,
    })
  })

  it('clears retained history when records become empty before being restored', () => {
    const { result, rerender } = renderHook(
      ({ source }: { source: typeof records }) => useEnergySimulation(source),
      { initialProps: { source: records } },
    )
    act(() => result.current.scrubTo(1_000))
    act(() => result.current.previousPeriod())
    expect(result.current.live?.index).toBe(712)

    rerender({ source: [] })
    expect(result.current.live).toBeNull()
    expect(result.current.history).toBeNull()

    rerender({ source: records })
    expect(result.current.live?.index).toBe(0)
    expect(result.current.history?.range.canGoNext).toBe(false)

    act(() => result.current.nextPeriod())
    expect(result.current.live?.index).toBe(0)
  })

  it('resets for a different dataset but preserves history for an equivalent copy', () => {
    const source = records.slice(0, 1_200)
    const replacement = source.map((record, index) => {
      if (index !== 0 && index !== source.length - 1) return record
      return { ...record, iso: record.iso.replace('2026-08', '2026-09') }
    })
    const { result, rerender } = renderHook(
      ({ current }: { current: typeof source }) => useEnergySimulation(current),
      { initialProps: { current: source } },
    )
    act(() => result.current.scrubTo(1_000))
    act(() => result.current.previousPeriod())
    expect(result.current.live?.index).toBe(712)

    rerender({ current: source.slice() })
    expect(result.current.live?.index).toBe(712)

    rerender({ current: replacement })
    expect(result.current.live?.index).toBe(0)
    expect(result.current.history?.range.canGoNext).toBe(false)

    act(() => result.current.nextPeriod())
    expect(result.current.live?.index).toBe(0)
  })
})
