import { useCallback, useEffect, useRef, useState } from 'react'
import { advancePosition } from './playback'

const SLOTS_PER_DAY = 288

const clampIndex = (index: number, count: number): number => {
  if (count <= 0 || !Number.isFinite(index)) return 0
  return Math.min(count - 1, Math.max(0, Math.trunc(index)))
}

export interface PlaybackController {
  index: number
  fraction: number
  isPlaying: boolean
  play: () => void
  pause: () => void
  toggle: () => void
  scrubTo: (index: number) => void
  jumpDay: (delta: number) => void
  setHistoryAnchor: (index: number) => void
}

export const usePlayback = (recordCount: number): PlaybackController => {
  const count = Number.isFinite(recordCount)
    ? Math.max(0, Math.trunc(recordCount))
    : 0
  const [position, setPosition] = useState(0)
  const [historyAnchor, setHistoryAnchorState] = useState<number | null>(null)
  const [isPlaying, setIsPlayingState] = useState(count > 0)
  const positionRef = useRef(0)
  const isPlayingRef = useRef(count > 0)
  const lastTimestampRef = useRef<number | null>(null)

  const setPlaying = useCallback((next: boolean) => {
    isPlayingRef.current = next
    setIsPlayingState(next)
  }, [])

  useEffect(() => {
    const nextPosition = clampIndex(positionRef.current, count)
    positionRef.current = nextPosition
    setPosition(nextPosition)
    setHistoryAnchorState((current) =>
      current === null || count <= 0 ? null : clampIndex(current, count),
    )

    if (count <= 0) setPlaying(false)
  }, [count, setPlaying])

  useEffect(() => {
    lastTimestampRef.current = null
    if (!isPlaying || count <= 0) return

    let frameId = 0
    const advance = (timestamp: number) => {
      const previousTimestamp = lastTimestampRef.current
      if (previousTimestamp !== null) {
        const elapsedMs = Math.max(0, timestamp - previousTimestamp)
        const nextPosition = advancePosition(
          positionRef.current,
          elapsedMs,
          count,
        )
        positionRef.current = nextPosition
        setPosition(nextPosition)
      }

      lastTimestampRef.current = timestamp
      frameId = requestAnimationFrame(advance)
    }

    frameId = requestAnimationFrame(advance)
    return () => {
      cancelAnimationFrame(frameId)
      lastTimestampRef.current = null
    }
  }, [count, isPlaying])

  const play = useCallback(() => {
    setHistoryAnchorState(null)
    lastTimestampRef.current = null
    if (count > 0) setPlaying(true)
  }, [count, setPlaying])

  const pause = useCallback(() => {
    setPlaying(false)
  }, [setPlaying])

  const toggle = useCallback(() => {
    if (isPlayingRef.current) pause()
    else play()
  }, [pause, play])

  const scrubTo = useCallback(
    (index: number) => {
      const nextPosition = clampIndex(index, count)
      positionRef.current = nextPosition
      setPosition(nextPosition)
      setHistoryAnchorState(null)
      lastTimestampRef.current = null
    },
    [count],
  )

  const jumpDay = useCallback(
    (delta: number) => {
      scrubTo(positionRef.current + delta * SLOTS_PER_DAY)
    },
    [scrubTo],
  )

  const setHistoryAnchor = useCallback(
    (index: number) => {
      setHistoryAnchorState(clampIndex(index, count))
      setPlaying(false)
    },
    [count, setPlaying],
  )

  const displayedPosition = historyAnchor ?? position
  const clampedDisplayedPosition =
    count > 0 && Number.isFinite(displayedPosition)
      ? Math.min(count - 1, Math.max(0, displayedPosition))
      : 0
  const index = Math.floor(clampedDisplayedPosition)
  const fraction = clampedDisplayedPosition - index

  return {
    index,
    fraction,
    isPlaying,
    play,
    pause,
    toggle,
    scrubTo,
    jumpDay,
    setHistoryAnchor,
  }
}
