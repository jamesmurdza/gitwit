"use client"

import { Button } from "@/components/ui/button"
import type { TTab } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { Check, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useCodeApply } from "../project/chat/contexts/code-apply-context"
import { normalizePath, pathMatchesTab } from "../project/chat/lib/utils"
import { useChat } from "../project/chat/providers/chat-provider"

export interface CodeBlockActionsProps {
  code: string
  language?: string
  onApply?: (code: string) => Promise<void>
  onReject?: () => void
  className?: string
  isForCurrentFile?: boolean
  intendedFile?: string | null
  placement?: "floating" | "toolbar"
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
  const placement =
    (arguments[0] as CodeBlockActionsProps).placement ?? "floating"
  const [isApplied, setIsApplied] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const activeTab = useAppStore((s) => s.activeTab)
  const tabs = useAppStore((s) => s.tabs)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const { onApplyCode, onRejectCode, messageId } = useCodeApply()
  const { fileActionStatuses } = useChat()

  const applyHandler = onApply ?? onApplyCode
  const rejectHandler = onReject ?? onRejectCode

  // Keep latest handlers in refs so delayed calls get fresh closures
  const latestApplyRef = useRef<typeof applyHandler>()
  useEffect(() => {
    latestApplyRef.current = onApply ?? onApplyCode
  }, [onApply, onApplyCode])

  // Defer apply until after tab switch by tracking intent instead of timing hacks
  const pendingApplyRef = useRef<{
    code: string
    targetId: string
  } | null>(null)

  // When activeTab switches to the intended target, apply once and clear intent
  useEffect(() => {
    const pending = pendingApplyRef.current
    if (!pending) return
    const matches = activeTab && pathMatchesTab(pending.targetId, activeTab)
    if (matches) {
      const codeToApply = pending.code
      pendingApplyRef.current = null
      setIsLoading(true)

      setTimeout(() => {
        const applyPromise = latestApplyRef.current?.(codeToApply)
        if (applyPromise) {
          applyPromise
            .then(() => {
              setIsApplied(true)
              setIsLoading(false)
            })
            .catch((error) => {
              console.error("Apply failed:", error)
              setIsLoading(false)
            })
        } else {
          setIsLoading(false)
        }
      }, 100) // Small delay to allow Editor component to mount
    }
  }, [activeTab?.id, activeTab?.name])
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

  const normalizedIntendedFile = useMemo(
    () => (intendedFile ? normalizePath(intendedFile) : undefined),
    [intendedFile]
  )

  const externalStatus =
    messageId && normalizedIntendedFile
      ? fileActionStatuses[messageId]?.[normalizedIntendedFile]
      : undefined

  useEffect(() => {
    if (externalStatus === "applied") {
      setIsApplied(true)
      setIsRejected(false)
    } else if (externalStatus === "rejected") {
      setIsRejected(true)
      setIsApplied(false)
    }
  }, [externalStatus])

  const handleApply = async () => {
    if (isApplied || isRejected || isLoading) return
    setIsLoading(true)

    try {
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
          // Record intent and switch tabs; an effect will run when activeTab updates
          pendingApplyRef.current = { code, targetId: resolvedId }
          setActiveTab(resolvedTab)
          return
        }
      }

      // Wait for apply to complete
      await applyHandler?.(code)
      setIsApplied(true)
    } catch (error) {
      console.error("Apply failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = () => {
    if (isApplied || isRejected) return
    setIsRejected(true)
    rejectHandler?.()
  }

  // Position controls
  const positioned =
    placement === "floating"
      ? cn(
          "absolute top-2 right-10 shrink-0 flex items-center gap-1",
          "opacity-0 group-hover:opacity-100 transition-all",
          className
        )
      : cn("flex items-center gap-1", className)

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
        title={isLoading ? "Applying..." : "Apply this code"}
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
        ) : (
          <Check size={14} />
        )}
      </Button>
      <Button
        variant="ghost"
        size="smIcon"
        onClick={handleReject}
        className="size-7"
        title="Reject"
        disabled={isLoading}
      >
        <X size={14} />
      </Button>
    </div>
  )
}
