"use client"

import { Button } from "@/components/ui/button"
import type { TTab } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { Check, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useCodeApply } from "../project/chat/contexts/code-apply-context"
import { normalizePath, pathMatchesTab } from "../project/chat/lib/utils"

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
  const { onApplyCode, onRejectCode } = useCodeApply()

  const applyHandler = onApply ?? onApplyCode
  const rejectHandler = onReject ?? onRejectCode

  // Keep latest handlers in refs so delayed calls get fresh closures
  const latestApplyRef = useRef<typeof applyHandler>()
  useEffect(() => {
    latestApplyRef.current = onApply ?? onApplyCode
  }, [onApply, onApplyCode])

  const isActiveForPath = useMemo(
    () => (path: string) => pathMatchesTab(path, activeTab),
    [activeTab?.id, activeTab?.name]
  )
  const computedIsForCurrentFile = useMemo(() => {
    if (typeof isForCurrentFile === "boolean") return isForCurrentFile
    if (!intendedFile) return false
    const normalized = normalizePath(intendedFile)
    return isActiveForPath(normalized)
  }, [isForCurrentFile, intendedFile, isActiveForPath])

  const handleApply = () => {
    if (isApplied || isRejected) return
    setIsApplied(true)
    // If this code is intended for a different tab (supports nested paths), switch first
    if (!computedIsForCurrentFile && intendedFile) {
      const normalized = normalizePath(intendedFile)
      const fileName = normalized.split("/").pop() || normalized
      const matchBy = (t: { id: string; name: string }) =>
        pathMatchesTab(normalized, t)
      let target = tabs.find(matchBy)
      if (!target) {
        target = {
          id: normalized,
          name: fileName,
          type: "file",
          saved: true,
        } as TTab
      }
      if (target && (!activeTab || !matchBy(activeTab))) {
        // Use the exact intended path (no guessing/candidates)
        const resolvedId = normalized
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
