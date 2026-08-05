import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { EnergyInterval } from '../domain/energy'
import { usePlayback } from '../playback/usePlayback'
import { rangeSlots, type TimeRange } from '../simulation/aggregate'
import {
  getHistoryView,
  getLiveFrame,
  type HistoryView,
  type LiveFrame,
} from './views'

export interface EnergySimulationController {
  live: LiveFrame | null
  history: HistoryView | null
  range: TimeRange
  setRange: (range: TimeRange) => void
  play: () => void
  pause: () => void
  toggle: () => void
  scrubTo: (index: number) => void
  jumpDay: (delta: number) => void
  previousPeriod: () => void
  nextPeriod: () => void
  isPlaying: boolean
}

export const useEnergySimulation = (
  records: readonly EnergyInterval[],
): EnergySimulationController => {
  const playback = usePlayback(records.length)
  const [range, setRangeState] = useState<TimeRange>('24h')
  const [historyAnchor, setHistoryAnchor] = useState<number | null>(null)
  const retainedLiveIndex = useRef(0)
  const datasetKey = records.length === 0
    ? 'empty'
    : `${records.length}:${records[0]?.iso ?? ''}:${records.at(-1)?.iso ?? ''}`
  const previousDatasetKey = useRef(datasetKey)

  useLayoutEffect(() => {
    if (datasetKey === previousDatasetKey.current) return

    previousDatasetKey.current = datasetKey
    retainedLiveIndex.current = 0
    setHistoryAnchor(null)
    playback.scrubTo(0)
  }, [datasetKey, playback.scrubTo])

  useEffect(() => {
    if (historyAnchor === null) retainedLiveIndex.current = playback.index
  }, [historyAnchor, playback.index])

  const live = useMemo(
    () => getLiveFrame(records, playback.index, playback.fraction),
    [records, playback.index, playback.fraction],
  )
  const selectedHistory = useMemo(
    () => getHistoryView(records, range, playback.index),
    [records, range, playback.index],
  )
  const history = useMemo(() => {
    if (selectedHistory === null) return null

    const nextAnchor = playback.index + rangeSlots[range]
    const canGoNext = selectedHistory.range.canGoNext &&
      historyAnchor !== null &&
      nextAnchor <= retainedLiveIndex.current

    return {
      ...selectedHistory,
      range: {
        ...selectedHistory.range,
        canGoNext,
      },
    }
  }, [historyAnchor, playback.index, range, selectedHistory])

  const setRange = useCallback((nextRange: TimeRange) => {
    if (records.length > 0) setRangeState(nextRange)
  }, [records.length])

  const play = useCallback(() => {
    if (records.length === 0) return
    setHistoryAnchor(null)
    playback.play()
  }, [playback.play, records.length])

  const pause = useCallback(() => {
    if (records.length > 0) playback.pause()
  }, [playback.pause, records.length])

  const toggle = useCallback(() => {
    if (records.length === 0) return
    if (playback.isPlaying) playback.pause()
    else {
      setHistoryAnchor(null)
      playback.play()
    }
  }, [playback.isPlaying, playback.pause, playback.play, records.length])

  const scrubTo = useCallback((index: number) => {
    if (records.length === 0) return
    setHistoryAnchor(null)
    playback.scrubTo(index)
  }, [playback.scrubTo, records.length])

  const jumpDay = useCallback((delta: number) => {
    if (records.length === 0) return
    setHistoryAnchor(null)
    playback.jumpDay(delta)
  }, [playback.jumpDay, records.length])

  const previousPeriod = useCallback(() => {
    if (!history?.range.canGoPrevious) return
    const anchor = playback.index - rangeSlots[range]
    setHistoryAnchor(anchor)
    playback.setHistoryAnchor(anchor)
  }, [history, playback.index, playback.setHistoryAnchor, range])

  const nextPeriod = useCallback(() => {
    if (!history?.range.canGoNext) return
    const anchor = playback.index + rangeSlots[range]
    setHistoryAnchor(anchor)
    playback.setHistoryAnchor(anchor)
  }, [history, playback.index, playback.setHistoryAnchor, range])

  return {
    live,
    history,
    range,
    setRange,
    play,
    pause,
    toggle,
    scrubTo,
    jumpDay,
    previousPeriod,
    nextPeriod,
    isPlaying: playback.isPlaying,
  }
}
