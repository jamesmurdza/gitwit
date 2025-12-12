import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, Info, Loader2, X } from "lucide-react"
import React from "react"
import { GeneratedFile, extractFilesFromMessages } from "../lib/file-utils"
import type {
  ApplyMergedFileArgs,
  FileMergeResult,
  GetCurrentFileContentFn,
  PrecomputeMergeArgs,
} from "../lib/types"
import { useChat } from "../providers/chat-provider"

type GeneratedFilesPreviewProps = {
  files?: GeneratedFile[]
  className?: string
  precomputeMerge?: (args: PrecomputeMergeArgs) => Promise<FileMergeResult>
  applyPrecomputedMerge?: (args: ApplyMergedFileArgs) => Promise<void>
  restoreOriginalFile?: (args: ApplyMergedFileArgs) => Promise<void>
  getCurrentFileContent?: GetCurrentFileContentFn
}

export function GeneratedFilesPreview({
  files,
  className,
  precomputeMerge,
  applyPrecomputedMerge,
  restoreOriginalFile,
  getCurrentFileContent,
  activeFileId,
  onApplyCode,
  onOpenFile,
}: GeneratedFilesPreviewProps & {
  activeFileId?: string
  onApplyCode?: (
    code: string,
    language?: string,
    options?: {
      mergeStatuses?: Record<
        string,
        { status: string; result?: FileMergeResult; error?: string }
      >
      getCurrentFileContent?: (filePath: string) => Promise<string> | string
      getMergeStatus?: (
        filePath: string
      ) =>
        | { status: string; result?: FileMergeResult; error?: string }
        | undefined
    }
  ) => Promise<void>
  onOpenFile?: (filePath: string) => void
}) {
  const {
    messages,
    markFileActionStatus,
    latestAssistantId,
    mergeStatuses,
    setMergeStatuses,
    fileActionStatuses,
  } = useChat()
  const [isOpen, setIsOpen] = React.useState(true)
  const [applyingMap, setApplyingMap] = React.useState<Record<string, boolean>>(
    {}
  )
  const [rejectingMap, setRejectingMap] = React.useState<
    Record<string, boolean>
  >({})
  const [resolvedFiles, setResolvedFiles] = React.useState<
    Record<string, "applied" | "rejected">
  >({})
  const applyingRef = React.useRef(applyingMap)
  React.useEffect(() => {
    applyingRef.current = applyingMap
  }, [applyingMap])
  const rejectingRef = React.useRef(rejectingMap)
  React.useEffect(() => {
    rejectingRef.current = rejectingMap
  }, [rejectingMap])

  const [{ files: extractedFiles, sourceKey }, setExtracted] = React.useState<{
    files: GeneratedFile[]
    sourceKey: string | null
  }>({ files: [], sourceKey: null })

  React.useEffect(() => {
    setExtracted(extractFilesFromMessages(messages))
  }, [messages])

  const providedFiles = files ?? []
  const shouldUseDerived = providedFiles.length === 0

  // Memoize generatedFiles to prevent unnecessary re-renders
  const generatedFiles = React.useMemo(() => {
    return shouldUseDerived ? extractedFiles : providedFiles
  }, [shouldUseDerived, extractedFiles, providedFiles])

  const batchKey = React.useMemo(() => {
    if (shouldUseDerived && sourceKey) return sourceKey
    if (!generatedFiles.length) return null
    return generatedFiles
      .map((file) => `${file.id}:${file.code?.length ?? 0}`)
      .join("|")
  }, [generatedFiles, sourceKey, shouldUseDerived])

  // Create a stable key from file paths to track when new files arrive
  const filesKey = React.useMemo(() => {
    return generatedFiles
      .map((file) => file.path)
      .sort()
      .join("|")
  }, [generatedFiles])

  const mergeStatusRef = React.useRef(mergeStatuses)
  React.useEffect(() => {
    mergeStatusRef.current = mergeStatuses
  }, [mergeStatuses])

  const mergeJobsRef = React.useRef(new Map<string, Promise<FileMergeResult>>())
  const batchRef = React.useRef<string | null>(batchKey)
  const processedFilesRef = React.useRef(new Set<string>())
  const mergeStartedForBatchRef = React.useRef<string | null>(null)
  const generatedFilesRef = React.useRef(generatedFiles)
  // Use sourceKey as the stable batch identifier (only changes on new AI response)
  const stableBatchIdRef = React.useRef<string | null>(sourceKey)

  // Track which files have been auto-previewed to avoid repeated calls
  const autoPreviewedRef = React.useRef(new Set<string>())

  React.useEffect(() => {
    generatedFilesRef.current = generatedFiles
  }, [generatedFiles])

  React.useEffect(() => {
    // Only reset if sourceKey changed (truly new AI response)
    // Don't reset when files are added incrementally to the same response
    if (stableBatchIdRef.current !== sourceKey) {
      // New batch - reset everything
      batchRef.current = batchKey
      mergeJobsRef.current.clear()
      processedFilesRef.current.clear()
      mergeStartedForBatchRef.current = null
      setMergeStatuses({})
      mergeStatusRef.current = {}
      setApplyingMap({})
      applyingRef.current = {}
      setRejectingMap({})
      rejectingRef.current = {}
      setResolvedFiles({})
      autoPreviewedRef.current.clear()
      stableBatchIdRef.current = sourceKey
    } else {
      // Same batch, just update batchKey ref (files being added incrementally)
      batchRef.current = batchKey
    }
  }, [batchKey, sourceKey])

  React.useEffect(() => {
    setMergeStatuses((prev) => {
      const next: Record<string, any> = {}
      generatedFiles.forEach((file) => {
        // Only set to idle if it doesn't exist, preserve existing statuses
        next[file.path] = prev[file.path] ?? { status: "idle" }
      })
      return next
    })
  }, [generatedFiles])

  // Store precomputeMerge in ref to prevent effect re-runs
  const precomputeMergeRef = React.useRef(precomputeMerge)
  React.useEffect(() => {
    precomputeMergeRef.current = precomputeMerge
  }, [precomputeMerge])

  React.useEffect(() => {
    if (!precomputeMergeRef.current || !batchKey) return

    // Store current batch to check against during async operations
    const currentBatch = batchKey
    const currentPrecomputeMerge = precomputeMergeRef.current

    // Collect all files to process first, then start ALL merges in parallel
    const filesToProcess: Array<{ key: string; code: string }> = []

    generatedFilesRef.current.forEach((file) => {
      if (!file.code) return
      const key = file.path

      // Skip if already processed in this batch (prevents duplicates)
      if (processedFilesRef.current.has(key)) return

      // Skip if merge job is already in progress
      if (mergeJobsRef.current.has(key)) {
        processedFilesRef.current.add(key)
        return
      }

      // Check current status from ref (updated by separate effect)
      const currentStatus = mergeStatusRef.current[key]?.status

      // Skip if merge is already ready or pending
      if (currentStatus === "ready" || currentStatus === "pending") {
        processedFilesRef.current.add(key)
        return
      }

      // Only process if idle or error (retry on error)
      if (
        currentStatus &&
        currentStatus !== "idle" &&
        currentStatus !== "error"
      ) {
        processedFilesRef.current.add(key)
        return
      }

      // Mark as processed immediately to prevent duplicates
      processedFilesRef.current.add(key)
      filesToProcess.push({ key, code: file.code })
    })

    // Only proceed if there are files to process
    if (filesToProcess.length === 0) return

    // Start ALL merges in parallel (not sequential)
    filesToProcess.forEach(({ key, code }) => {
      // Set pending status immediately
      setMergeStatuses((prev) => ({
        ...prev,
        [key]: { status: "pending" },
      }))

      const mergePromise = currentPrecomputeMerge({
        filePath: key,
        code: code,
      })
      mergeJobsRef.current.set(key, mergePromise)
      const jobBatch = batchRef.current
      mergePromise
        .then((result) => {
          if (batchRef.current !== jobBatch) return
          setMergeStatuses((prev) => ({
            ...prev,
            [key]: { status: "ready", result },
          }))
        })
        .catch((error) => {
          if (batchRef.current !== jobBatch) return
          setMergeStatuses((prev) => ({
            ...prev,
            [key]: {
              status: "error",
              error: error?.message ?? "Failed to prepare merge",
            },
          }))
        })
        .finally(() => {
          mergeJobsRef.current.delete(key)
        })
    })
    // Depend on filesKey to process new files as they stream in
    // But processedFilesRef ensures each file is only processed once
  }, [sourceKey, filesKey])

  // Auto-apply diff view when ready and active
  React.useEffect(() => {
    if (!onApplyCode) return

    generatedFiles.forEach((file) => {
      const key = file.path

      if (autoPreviewedRef.current.has(key)) return

      const status = mergeStatuses[key]
      if (status?.status === "ready" && status.result && file.code) {
        // If file is active, apply diff
        if (key === activeFileId) {
          autoPreviewedRef.current.add(key)
          onApplyCode(file.code, undefined, {
            getMergeStatus: (path) => mergeStatusRef.current[path],
          })
        }
        // If file is NOT active, open it (which will trigger this effect again when activeFileId changes)
        else if (onOpenFile) {
          onOpenFile(key)
        }
      }
    })
  }, [generatedFiles, mergeStatuses, activeFileId, onApplyCode, onOpenFile])

  const handleKeepFile = React.useCallback(
    (file: GeneratedFile) => {
      if (!applyPrecomputedMerge) {
        return
      }
      const key = file.path
      const currentStatus = mergeStatusRef.current[key]
      const startLoading = () =>
        setApplyingMap((prev) => ({ ...prev, [key]: true }))
      const stopLoading = () =>
        setApplyingMap((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })

      const applyWithResult = (result: FileMergeResult) =>
        applyPrecomputedMerge({
          filePath: key,
          mergedCode: result.mergedCode,
          originalCode: result.originalCode,
          displayName: file.name,
        })
          .then(() => {
            setResolvedFiles((prev) => ({ ...prev, [key]: "applied" }))
            if (latestAssistantId) {
              markFileActionStatus(latestAssistantId, key, "applied")
            }
          })
          .catch((error) => {
            console.error("Failed to apply file changes:", error)
            // Don't mark as applied if it failed
          })
          .finally(stopLoading)

      const waitForJob = (promise: Promise<FileMergeResult>) => {
        promise
          .then((result) => {
            if (batchRef.current !== batchKey) {
              stopLoading()
              return
            }
            setMergeStatuses((prev) => ({
              ...prev,
              [key]: { status: "ready", result },
            }))
            return applyWithResult(result)
          })
          .catch((error) => {
            setMergeStatuses((prev) => ({
              ...prev,
              [key]: {
                status: "error",
                error: error?.message ?? "Failed to apply",
              },
            }))
            stopLoading()
          })
      }

      startLoading()

      // If we have a ready merge, use it directly (skip file content check to avoid delay)
      if (currentStatus?.status === "ready") {
        // Use precomputed merge directly - no need to check file content again
        applyWithResult(currentStatus.result)
        return
      }

      let job = mergeJobsRef.current.get(key)
      if (!job && file.code && precomputeMerge) {
        job = precomputeMerge({ filePath: key, code: file.code })
        mergeJobsRef.current.set(key, job)
        setMergeStatuses((prev) => ({
          ...prev,
          [key]: { status: "pending" },
        }))
      }

      if (job) {
        waitForJob(job)
        return
      }

      stopLoading()
    },
    [
      applyPrecomputedMerge,
      precomputeMerge,
      batchKey,
      latestAssistantId,
      markFileActionStatus,
      getCurrentFileContent,
    ]
  )

  const handleRejectFile = React.useCallback(
    (file: GeneratedFile) => {
      if (!restoreOriginalFile) {
        return
      }
      const key = file.path
      const currentStatus = mergeStatusRef.current[key]
      const startLoading = () =>
        setRejectingMap((prev) => ({ ...prev, [key]: true }))
      const stopLoading = () =>
        setRejectingMap((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })

      const revertWithResult = (result: FileMergeResult) =>
        restoreOriginalFile({
          filePath: key,
          mergedCode: result.mergedCode,
          originalCode: result.originalCode,
          displayName: file.name,
        })
          .then(() => {
            setResolvedFiles((prev) => ({ ...prev, [key]: "rejected" }))
            if (latestAssistantId) {
              markFileActionStatus(latestAssistantId, key, "rejected")
            }
          })
          .catch((error) => {
            console.error("Failed to restore file:", error)
            // Don't mark as rejected if it failed
          })
          .finally(stopLoading)

      const waitForJob = (promise: Promise<FileMergeResult>) => {
        promise
          .then((result) => {
            if (batchRef.current !== batchKey) {
              stopLoading()
              return
            }
            setMergeStatuses((prev) => ({
              ...prev,
              [key]: { status: "ready", result },
            }))
            return revertWithResult(result)
          })
          .catch((error) => {
            console.error("Reject failed:", error)
            setMergeStatuses((prev) => ({
              ...prev,
              [key]: {
                status: "error",
                error: error?.message ?? "Failed to reject",
              },
            }))
            stopLoading()
          })
      }

      startLoading()

      if (currentStatus?.status === "ready") {
        revertWithResult(currentStatus.result)
        return
      }

      let job = mergeJobsRef.current.get(key)
      if (!job && file.code && precomputeMerge) {
        job = precomputeMerge({ filePath: key, code: file.code })
        mergeJobsRef.current.set(key, job)
        setMergeStatuses((prev) => ({
          ...prev,
          [key]: { status: "pending" },
        }))
      }

      if (job) {
        waitForJob(job)
        return
      }

      stopLoading()
    },
    [
      restoreOriginalFile,
      precomputeMerge,
      batchKey,
      markFileActionStatus,
      latestAssistantId,
    ]
  )

  if (!generatedFiles.length) {
    return null
  }

  // Check if files are resolved either locally or via code block actions
  const visibleFiles = generatedFiles.filter((file) => {
    const isResolvedLocally = resolvedFiles[file.path]
    const isResolvedViaCodeBlock =
      latestAssistantId &&
      fileActionStatuses[latestAssistantId]?.[file.path] !== undefined
    return !isResolvedLocally && !isResolvedViaCodeBlock
  })

  if (!visibleFiles.length) {
    return null
  }

  return (
    <div
      className={cn(
        "mb-2 rounded-md border border-border/70 bg-background/70 p-2 shadow-[0_1px_4px_rgba(0,0,0,0.04)]",
        className
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            aria-label={isOpen ? "Collapse files" : "Expand files"}
            onClick={() => setIsOpen((prev) => !prev)}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border border-border transition-colors",
              "hover:border-foreground/40"
            )}
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                isOpen ? "duration-700 rotate-0" : "duration-500 -rotate-90"
              )}
            />
          </button>
          <Info className="size-3.5" />
          <span className="font-medium">
            {visibleFiles.length} File
            {visibleFiles.length > 1 ? "s" : ""} Edited
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <Button
            size="xs"
            className="h-5 px-2 text-[10px]"
            onClick={() => {
              visibleFiles.forEach((file) => handleKeepFile(file))
            }}
            disabled={!applyPrecomputedMerge}
          >
            Keep All
          </Button>
          <Button
            variant="destructive"
            size="xs"
            className="h-5 px-2 text-[10px] text-destructive hover:text-destructive"
            onClick={() => {
              visibleFiles.forEach((file) => handleRejectFile(file))
            }}
            disabled={!restoreOriginalFile}
          >
            Reject
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "space-y-1 overflow-hidden transition-all ease-out",
          isOpen
            ? "max-h-48 opacity-100 duration-700"
            : "max-h-0 opacity-0 duration-500"
        )}
      >
        {visibleFiles.map((file) => {
          const status = mergeStatuses[file.path]?.status
          const isApplying = applyingMap[file.path]
          const isRejecting = rejectingMap[file.path]
          const isProcessing = isApplying || isRejecting
          const isPreparing = status === "pending"
          return (
            <div
              key={file.id}
              className="group relative flex items-center gap-2 rounded-md border border-transparent bg-muted/30 px-2 py-1 text-[11px] transition hover:border-border hover:bg-background"
            >
              <div className="flex flex-1 items-center gap-2">
                <Info className="size-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-foreground">
                  {file.name}
                </span>
                {isPreparing && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                    preparing
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 transition",
                  isProcessing
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                )}
              >
                <HoverIconButton
                  aria-label="Keep file"
                  onClick={() => handleKeepFile(file)}
                  isLoading={isApplying}
                  disabled={isRejecting}
                >
                  <Check className="size-3.5 text-emerald-500" />
                </HoverIconButton>
                <HoverIconButton
                  aria-label="Reject file"
                  onClick={() => handleRejectFile(file)}
                  isLoading={isRejecting}
                  disabled={isApplying}
                >
                  <X className="size-3.5 text-red-500" />
                </HoverIconButton>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HoverIconButton({
  children,
  isLoading,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }) {
  const isDisabled = disabled || isLoading
  return (
    <button
      type="button"
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background shadow-sm transition hover:border-foreground/40",
        isDisabled && "opacity-60",
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : (
        children
      )}
    </button>
  )
}
