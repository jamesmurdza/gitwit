import type { HighlightResult } from "@streamdown/code"
import { type ReactNode, useEffect, useRef, useState } from "react"

const COLLAPSED_HEIGHT = 96 // ~4 lines of code
const MIN_LINES_TO_COLLAPSE = 6
const STREAMING_DEBOUNCE_MS = 800

/**
 * Wraps a code block body with collapse/expand behavior.
 *
 * When collapsed, shows the first ~4 lines with a gradient fade and a
 * "Show N lines" toggle. While the code is still streaming, a shimmer
 * bar animates at the bottom edge to indicate activity.
 */
export function CollapsibleCode({
  enabled,
  code,
  displayCode,
  result,
  children,
}: {
  enabled?: boolean
  code: string
  displayCode: string
  result: HighlightResult
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(true)
  const lineCount = displayCode.split("\n").length
  const shouldCollapse = enabled && lineCount > MIN_LINES_TO_COLLAPSE
  const isCollapsed = shouldCollapse && collapsed

  // Detect streaming: code is still changing
  const prevCodeRef = useRef(code)
  const [isStreaming, setIsStreaming] = useState(false)
  useEffect(() => {
    if (enabled && code !== prevCodeRef.current) {
      setIsStreaming(true)
      prevCodeRef.current = code
    }
    const timer = setTimeout(() => setIsStreaming(false), STREAMING_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [code, enabled])

  return (
    <div className="relative">
      {/* Code body — clipped when collapsed */}
      <div style={isCollapsed ? { maxHeight: `${COLLAPSED_HEIGHT}px`, overflow: "hidden" } : undefined}>
        {children}
      </div>

      {/* Gradient fade overlay */}
      {isCollapsed && (
        <div
          className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${result.bg || "var(--color-muted)"} 20%, transparent)`,
          }}
        />
      )}

      {/* Streaming shimmer bar */}
      {isCollapsed && isStreaming && (
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden">
          <div className="h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        </div>
      )}

      {/* Expand / Collapse toggle */}
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors bg-muted/50 border-t border-border"
        >
          {collapsed ? `Show ${lineCount} lines` : "Collapse"}
        </button>
      )}
    </div>
  )
}
