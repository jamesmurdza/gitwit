"use client"

import { Button } from "@/components/ui/button"
import type { TTab } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { useQueryClient } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { useCodeApply } from "../project/chat/contexts/code-apply-context"

export interface CodeBlockActionsProps {
  code: string
  language?: string
  onApply?: (code: string) => void
  onReject?: () => void
  className?: string
  isForCurrentFile?: boolean
  intendedFile?: string | null
}

export function CodeBlockActions({
  code,
  language,
  onApply,
  onReject,
  className,
  isForCurrentFile,
  intendedFile,
}: CodeBlockActionsProps) {
  const [isApplied, setIsApplied] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const activeTab = useAppStore((s) => s.activeTab)
  const tabs = useAppStore((s) => s.tabs)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const drafts = useAppStore((s) => s.drafts)
  const { onApplyCode, onRejectCode } = useCodeApply()
  const queryClient = useQueryClient()
  const { id: projectId } = useParams<{ id: string }>()
  console.log("drafts", drafts)
  const applyHandler = onApply ?? onApplyCode
  const rejectHandler = onReject ?? onRejectCode

  // Keep latest handlers in refs so delayed calls get fresh closures
  const latestApplyRef = useRef<typeof applyHandler>()
  useEffect(() => {
    latestApplyRef.current = onApply ?? onApplyCode
  }, [onApply, onApplyCode])

  const computedIsForCurrentFile = useMemo(() => {
    if (typeof isForCurrentFile === "boolean") return isForCurrentFile
    if (!intendedFile) return false
    console.log("[AI Apply] Computed is for current file", intendedFile)
    // Do not strip path here; `markdown.tsx` now preserves AI's path. Only normalize slashes and trim.
    const normalized = intendedFile.trim().replace(/\\/g, "/")
    console.log("[AI Apply] Normalized", normalized)
    const activeId = activeTab?.id
    const activeName = activeTab?.name
    if (!activeId || !activeName) return false
    return (
      normalized === activeId ||
      normalized.endsWith(activeId) ||
      normalized === activeName ||
      normalized.endsWith(activeName)
    )
  }, [isForCurrentFile, intendedFile, activeTab?.id, activeTab?.name])

  const handleApply = () => {
    if (isApplied || isRejected) return
    setIsApplied(true)
    // If this code is intended for a different tab (supports nested paths), switch first
    if (!computedIsForCurrentFile && intendedFile) {
      // Trust the path from AI; just normalize slashes
      const normalized = intendedFile.trim().replace(/\\/g, "/")
      const fileName = normalized.split("/").pop() || normalized
      const matchBy = (t: { id: string; name: string }) =>
        normalized === t.id ||
        normalized.endsWith(t.id) ||
        normalized === t.name ||
        normalized.endsWith(t.name)
      let target = tabs.find(matchBy)
      if (!target) {
        target = {
          id: normalized,
          name: fileName,
          type: "file",
          saved: true,
        } as TTab
        console.log(
          "[AI Apply] Target not in open tabs; creating tab ref",
          target
        )
      }
      if (target && (!activeTab || !matchBy(activeTab))) {
        console.log("[AI Apply] Switching file before applying diff", {
          intendedFile,
          targetId: target.id,
          targetName: target.name,
          currentActive: activeTab?.id,
        })
        // Use the exact intended path (no guessing/candidates)
        const resolvedId = normalized
        console.log("[AI Apply] Using exact intended path", { resolvedId })
        const resolvedName = resolvedId.split("/").pop() || resolvedId
        const resolvedTab: TTab = {
          id: resolvedId,
          name: resolvedName,
          type: "file",
          saved: true,
        }
        setActiveTab(resolvedTab)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            console.log(
              "[AI Apply] Applying after switch using latest handler (no network)",
              { resolvedId }
            )
            latestApplyRef.current?.(code)
          })
        })
        return
      }
    }
    applyHandler?.(code)
  }

  const handleReject = () => {
    if (isApplied || isRejected) return
    setIsRejected(true)
    rejectHandler?.()
  }

  // Position controls beside the copy button (top-right), mirroring its behavior
  const positioned = cn(
    "absolute top-2 right-10 shrink-0 flex items-center gap-1",
    "opacity-0 group-hover:opacity-100 transition-all",
    className
  )

  if (isApplied) {
    return (
      <div className={positioned} title="Applied">
        <span className="inline-flex items-center gap-1 rounded-md px-2 h-7 text-[11px] font-medium bg-green-600/10 text-green-600 border border-green-600/20">
          <Check size={14} />
          Applied
        </span>
      </div>
    )
  }

  if (isRejected) {
    return (
      <div className={positioned} title="Rejected">
        <span className="inline-flex items-center gap-1 rounded-md px-2 h-7 text-[11px] font-medium bg-red-600/10 text-red-600 border border-red-600/20">
          <X size={14} />
          Rejected
        </span>
      </div>
    )
  }

  return (
    <div className={positioned}>
      <Button
        variant="ghost"
        size="smIcon"
        onClick={handleApply}
        className="size-7"
        title={"Apply this code"}
      >
        <Check size={14} />
      </Button>
      <Button
        variant="ghost"
        size="smIcon"
        onClick={handleReject}
        className="size-7"
        title="Reject"
      >
        <X size={14} />
      </Button>
    </div>
  )
}
