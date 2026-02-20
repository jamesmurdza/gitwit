import { useCallback, useState } from "react"

export type VariantInfo = {
  total: number
  current: number // 0-indexed
}

/**
 * Manages response variant state for ChatGPT-style regeneration.
 * Tracks old assistant responses keyed by the preceding user message ID,
 * and allows cycling through them.
 */
export function useResponseVariants() {
  // Stores ALL previous assistant responses for a turn (not including current live one).
  const [variants, setVariants] = useState<Record<string, string[]>>({})
  // null = show current live response; number = index into variants array
  const [activeIdx, setActiveIdx] = useState<Record<string, number | null>>({})

  /** Save the current response as a variant before regenerating */
  const pushVariant = useCallback((userMsgId: string, content: string) => {
    setVariants((prev) => ({
      ...prev,
      [userMsgId]: [...(prev[userMsgId] ?? []), content],
    }))
    setActiveIdx((prev) => ({ ...prev, [userMsgId]: null }))
  }, [])

  /** Get variant info for display (e.g. "2/3") */
  const getVariantInfo = useCallback(
    (userMsgId: string): VariantInfo | null => {
      const old = variants[userMsgId]
      if (!old || old.length === 0) return null
      const total = old.length + 1
      const current = activeIdx[userMsgId] ?? old.length
      return { total, current }
    },
    [variants, activeIdx],
  )

  /** Navigate between response variants */
  const navigateVariant = useCallback(
    (userMsgId: string, direction: "prev" | "next") => {
      const old = variants[userMsgId]
      if (!old || old.length === 0) return
      const total = old.length + 1
      const current = activeIdx[userMsgId] ?? old.length

      let next = direction === "prev" ? current - 1 : current + 1
      next = Math.max(0, Math.min(next, total - 1))

      setActiveIdx((prev) => ({
        ...prev,
        [userMsgId]: next === old.length ? null : next,
      }))
    },
    [variants, activeIdx],
  )

  /** Resolve the displayed content for an assistant message, applying variant override if active */
  const resolveContent = useCallback(
    (userMsgId: string, liveContent: string): string => {
      const idx = activeIdx[userMsgId]
      const old = variants[userMsgId]
      if (idx != null && old && old[idx] !== undefined) {
        return old[idx]
      }
      return liveContent
    },
    [variants, activeIdx],
  )

  return { pushVariant, getVariantInfo, navigateVariant, resolveContent }
}
