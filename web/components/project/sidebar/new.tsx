"use client"

import {
  combinePaths,
  normalizePath,
  validateName,
} from "@/context/FileExplorerContext"
import { useChangedFilesOptimistic } from "@/hooks/useChangedFilesOptimistic"
import { fileRouter, githubRouter } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { mergeRefs } from "react-merge-refs"
import { toast } from "sonner"
import {
  DEFAULT_FILE,
  DEFAULT_FOLDER,
  getIconForFile,
  getIconForFolder,
} from "vscode-icons-js"

interface NewProps {
  projectId: string
  type: "file" | "folder"
  /** The base folder path where this item will be created (e.g., "/src" or "/") */
  basePath: string
  stopEditing: () => void
  /** Ref to the input element */
  ref?: React.Ref<HTMLInputElement>
}

export default function New({
  projectId,
  type,
  basePath,
  stopEditing,
  ref,
}: NewProps) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const internalRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { updateChangedFilesOptimistically } = useChangedFilesOptimistic()

  // Auto-focus the input when mounted
  useEffect(() => {
    internalRef.current?.focus()
  }, [])

  const { mutate: createFile, isPending: isCreatingFile } =
    fileRouter.createFile.useMutation({
      onMutate: async ({ name }) => {
        // Optimistically update changed files
        updateChangedFilesOptimistically("create", name, "")
      },
      onSuccess() {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            })
          )
          .then(() => {
            stopEditing()
          })
      },
      onError() {
        toast.error("Failed to create file")
      },
    })

  const { mutate: createFolder, isPending: isCreatingFolder } =
    fileRouter.createFolder.useMutation({
      onSuccess() {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            })
          )
          .then(() => {
            // Invalidate changed files query to refresh the list
            queryClient.invalidateQueries(
              githubRouter.getChangedFiles.getOptions({
                projectId,
              })
            )
            stopEditing()
          })
      },
      onError() {
        toast.error("Failed to create folder")
      },
    })

  const isPending = isCreatingFile || isCreatingFolder

  // Get the display name (last segment) for icon lookup
  const displayName = value.split("/").filter(Boolean).pop() || ""
  const icon =
    type === "file"
      ? getIconForFile(displayName) ?? DEFAULT_FILE
      : getIconForFolder(displayName) ?? DEFAULT_FOLDER

  // Validate and create the new item
  const createNew = useCallback(() => {
    const trimmedValue = value.trim()

    // If empty, just close
    if (!trimmedValue) {
      stopEditing()
      return
    }

    // Validate the name/path
    const validation = validateName(trimmedValue, type)
    if (!validation.isValid) {
      setError(validation.error ?? "Invalid name")
      toast.error(validation.error ?? "Invalid name")
      return
    }

    // Combine with base path to get the full path
    // For files: basePath="/src", value="components/Button.tsx" → "/src/components/Button.tsx"
    // For folders: basePath="/src", value="components/ui" → "/src/components/ui"
    const fullPath = combinePaths(basePath, trimmedValue)

    // The API expects the path without leading slash for creation
    const nameForApi = normalizePath(fullPath)

    const createItem = type === "file" ? createFile : createFolder
    createItem({
      name: nameForApi,
      projectId,
    })
  }, [value, type, basePath, projectId, createFile, createFolder, stopEditing])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        stopEditing()
      }
    },
    [stopEditing]
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.currentTarget.value)
    setError(null) // Clear error on change
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      createNew()
    },
    [createNew]
  )

  return (
    <div className="w-full flex items-center gap-2 h-7 px-1 hover:bg-secondary rounded-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
      {isPending ? (
        <Loader2 className="animate-spin size-[1.125rem] shrink-0" />
      ) : (
        <Image
          src={`/icons/${icon}`}
          alt={`${type} Icon`}
          width={18}
          height={18}
          className="shrink-0"
        />
      )}
      <form onSubmit={handleSubmit} className="flex-1 min-w-0">
        <input
          ref={mergeRefs([internalRef, ref])}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            type === "file"
              ? "filename or path/to/file"
              : "folder or nested/folder"
          }
          className={cn(
            "bg-transparent transition-all focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-ring rounded-sm w-full truncate",
            error && "ring-2 ring-destructive"
          )}
          autoFocus
          disabled={isPending}
          onBlur={createNew}
        />
      </form>
    </div>
  )
}
