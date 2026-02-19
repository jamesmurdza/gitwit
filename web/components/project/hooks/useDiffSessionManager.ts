import { DiffSession, TTab } from "@/lib/types"
import { useAppStore } from "@/store/context"
import { useCallback, useEffect, useRef } from "react"

/**
 * Custom hook that manages diff sessions when switching between files
 * This ensures diff sessions are saved/restored regardless of how files are opened
 */
export function useDiffSessionManager(
  hasActiveWidgets: () => boolean,
  getUnresolvedSnapshot: (fileId: string) => DiffSession | null,
  restoreFromSnapshot: (session: DiffSession) => void,
  clearVisuals: () => void,
  forceClearAllDecorations: () => void
) {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const saveDiffSession = useAppStore((s) => s.saveDiffSession)
  const getDiffSession = useAppStore((s) => s.getDiffSession)
  const previousActiveTabRef = useRef<string | undefined>(activeTab?.id)

  // Sync the ref with the current activeTab from store
  useEffect(() => {
    if (activeTab?.id && activeTab.id !== previousActiveTabRef.current) {
      previousActiveTabRef.current = activeTab.id
    }
  }, [activeTab?.id])

  /**
   * Enhanced setActiveTab that handles diff sessions
   */
  const handleSetActiveTab = useCallback(
    (tab: TTab) => {
      // Save diff session for previous file if it has unresolved widgets
      if (
        previousActiveTabRef.current &&
        previousActiveTabRef.current !== tab.id
      ) {
        if (hasActiveWidgets()) {
          try {
            const session = getUnresolvedSnapshot(previousActiveTabRef.current)
            if (session) {
              saveDiffSession(previousActiveTabRef.current, session)
            }
          } catch (error) {
            console.warn("Failed to snapshot unresolved diffs:", error)
          }
        }

        // Clear widgets from previous file
        try {
          clearVisuals()
        } catch (error) {
          forceClearAllDecorations()
        }
      }

      // Update the active tab
      setActiveTab(tab)
      previousActiveTabRef.current = tab.id

      // Restore diff session for new file if it exists
      setTimeout(() => {
        const session = getDiffSession(tab.id)
        if (session && session.unresolvedBlocks.length > 0) {
          try {
            restoreFromSnapshot(session)
          } catch (error) {
            console.warn("Failed to restore diff session:", error)
          }
        }
      }, 50) // Small delay to ensure editor is ready
    },
    [
      hasActiveWidgets,
      getUnresolvedSnapshot,
      saveDiffSession,
      clearVisuals,
      forceClearAllDecorations,
      getDiffSession,
      restoreFromSnapshot,
    ]
  )

  return {
    handleSetActiveTab,
  }
}
