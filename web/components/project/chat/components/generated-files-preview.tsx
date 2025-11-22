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
}: GeneratedFilesPreviewProps) {
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
  const generatedFiles = shouldUseDerived ? extractedFiles : providedFiles
  const batchKey = React.useMemo(() => {
    if (shouldUseDerived && sourceKey) return sourceKey
    if (!generatedFiles.length) return null
    return generatedFiles
      .map((file) => `${file.id}:${file.code?.length ?? 0}`)
      .join("|")
  }, [generatedFiles, sourceKey])

  const mergeStatusRef = React.useRef(mergeStatuses)
  React.useEffect(() => {
    mergeStatusRef.current = mergeStatuses
  }, [mergeStatuses])

  const mergeJobsRef = React.useRef(new Map<string, Promise<FileMergeResult>>())
  const batchRef = React.useRef<string | null>(batchKey)

  React.useEffect(() => {
    batchRef.current = batchKey
    mergeJobsRef.current.clear()
    setMergeStatuses({})
    mergeStatusRef.current = {}
    setApplyingMap({})
    applyingRef.current = {}
    setRejectingMap({})
    rejectingRef.current = {}
    setResolvedFiles({})
  }, [batchKey])

  React.useEffect(() => {
    setMergeStatuses((prev) => {
      const next: Record<string, any> = {}
      generatedFiles.forEach((file) => {
        next[file.path] = prev[file.path] ?? { status: "idle" }
      })
      return next
    })
  }, [generatedFiles])

  React.useEffect(() => {
    if (!precomputeMerge) return
    generatedFiles.forEach((file) => {
      if (!file.code) return
      const key = file.path
      if (mergeJobsRef.current.has(key)) return
      const currentStatus = mergeStatusRef.current[key]?.status
      if (
        currentStatus &&
        currentStatus !== "idle" &&
        currentStatus !== "error"
      )
        return

      const mergePromise = precomputeMerge({
        filePath: key,
        code: file.code,
      })
      mergeJobsRef.current.set(key, mergePromise)
      setMergeStatuses((prev) => ({
        ...prev,
        [key]: { status: "pending" },
      }))
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
  }, [generatedFiles, precomputeMerge])

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

      // If we have a ready merge, check if file content has changed
      if (currentStatus?.status === "ready") {
        const checkAndApply = async () => {
          if (!getCurrentFileContent || !precomputeMerge) {
            // If we can't check, just use the precomputed merge
            applyWithResult(currentStatus.result)
            return
          }

          try {
            // Get current file content
            const currentContent = await Promise.resolve(
              getCurrentFileContent(key)
            )

            // Compare with original code used in merge
            if (currentContent !== currentStatus.result.originalCode) {
              // Content has changed, re-calculate merge with current content
              if (!file.code || !precomputeMerge) {
                // Can't re-calculate, use precomputed merge
                applyWithResult(currentStatus.result)
                return
              }

              setMergeStatuses((prev) => ({
                ...prev,
                [key]: { status: "pending" },
              }))

              const newJob = precomputeMerge({ filePath: key, code: file.code })
              mergeJobsRef.current.set(key, newJob)
              waitForJob(newJob)
            } else {
              // Content hasn't changed, use precomputed merge
              applyWithResult(currentStatus.result)
            }
          } catch (error) {
            console.warn(
              "Failed to check current file content, using precomputed merge:",
              error
            )
            // On error, fall back to precomputed merge
            applyWithResult(currentStatus.result)
          }
        }

        checkAndApply()
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
