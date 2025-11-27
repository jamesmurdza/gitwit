"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { fileRouter } from "@/lib/api"
import { TFile } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { useDraggable } from "@dnd-kit/react"
import { useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2 } from "lucide-react"
import Image from "next/image"
import { useParams } from "next/navigation"
import React, { useCallback, useRef, useState } from "react"
import { getIconForFile } from "vscode-icons-js"
import { useDiffSessionManager } from "../hooks/useDiffSessionManager"
import { useFileContent, useFileTree } from "../hooks/useFile"

const HOVER_PREFETCH_DELAY = 100
const DOUBLE_CLICK_DELAY = 200
const DEFAULT_FILE_ICON = "/icons/default_file.svg"

const noop = () => {}
const noopFalse = () => false
const noopNull = () => null

/**
 * Hook to manage file selection with diff session handling
 */
function useFileSelection(file: TFile) {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const diffFunctions = useAppStore((s) => s.diffFunctions)

  const { handleSetActiveTab } = useDiffSessionManager(
    diffFunctions?.hasActiveWidgets ?? noopFalse,
    diffFunctions?.getUnresolvedSnapshot ?? noopNull,
    diffFunctions?.restoreFromSnapshot ?? noop,
    diffFunctions?.clearVisuals ?? noop,
    diffFunctions?.forceClearAllDecorations ?? noop
  )

  const selectFile = useCallback(async () => {
    const newTab = { ...file, saved: true }
    await queryClient.ensureQueryData(
      fileRouter.fileContent.getFetchOptions({
        projectId,
        fileId: file.id,
      })
    )
    handleSetActiveTab(newTab)
  }, [file, projectId, queryClient, handleSetActiveTab])

  return { selectFile }
}

/**
 * Hook to manage hover-based content prefetching
 */
function useHoverPrefetch(
  prefetchFileContent: () => Promise<void>,
  isDisabled: boolean
) {
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (isDisabled) return

    hoverTimeoutRef.current = setTimeout(() => {
      prefetchFileContent()
    }, HOVER_PREFETCH_DELAY)
  }, [prefetchFileContent, isDisabled])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  return { handleMouseEnter, handleMouseLeave }
}

/**
 * Displays a file in the sidebar with rename, delete, and drag-drop support
 */
function SidebarFile(props: TFile) {
  const { id: projectId } = useParams<{ id: string }>()

  // File tree operations
  const { deleteFile, renameFile, isDeletingFile, isRenamingFile } =
    useFileTree()
  const { prefetchFileContent } = useFileContent({ id: props.id })

  // File selection
  const { selectFile } = useFileSelection(props)

  // Drag and drop
  const { ref, isDragging } = useDraggable({
    id: props.id,
    type: props.type,
    feedback: "clone",
  })

  // Local state
  const inputRef = useRef<HTMLInputElement>(null)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [imgSrc, setImgSrc] = useState(
    () => `/icons/${getIconForFile(props.name)}`
  )
  const [isEditing, setIsEditing] = useState(false)

  // Hover prefetching
  const { handleMouseEnter, handleMouseLeave } = useHoverPrefetch(
    prefetchFileContent,
    isEditing || isDeletingFile
  )

  // Event handlers
  const handleRename = useCallback(() => {
    const newName = inputRef.current?.value ?? props.name
    if (newName === props.name) {
      setIsEditing(false)
      return
    }
    renameFile({ fileId: props.id, projectId, newName })
    setIsEditing(false)
  }, [props.id, props.name, projectId, renameFile])

  const handleDelete = useCallback(() => {
    deleteFile({ fileId: props.id, projectId })
  }, [props.id, projectId, deleteFile])

  const handleImageError = useCallback(() => {
    setImgSrc(DEFAULT_FILE_ICON)
  }, [])

  const handleClick = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
      return
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null
      selectFile()
    }, DOUBLE_CLICK_DELAY)
  }, [selectFile])

  const handleDoubleClick = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
    setIsEditing(true)
  }, [])

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      handleRename()
    },
    [handleRename]
  )

  const handleInputClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const handleContextMenuClose = useCallback((event: Event) => {
    if (inputRef.current) {
      inputRef.current.focus()
      event.preventDefault()
    }
  }, [])

  const handleStartRename = useCallback(() => {
    setIsEditing(true)
  }, [])

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={ref}
        disabled={isDeletingFile || isDragging}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-dragging={isDragging}
        className="data-[dragging=true]:opacity-50 data-[dragging=true]:hover:!bg-background data-[state=open]:bg-secondary/50 w-full flex items-center h-7 px-1 hover:bg-secondary rounded-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-0"
      >
        <Image
          src={imgSrc}
          alt="File Icon"
          width={18}
          height={18}
          className="mr-2"
          onError={handleImageError}
        />
        {isDeletingFile ? (
          <div className="text-muted-foreground animate-pulse truncate">
            Deleting...
          </div>
        ) : (
          <FileNameInput
            ref={inputRef}
            isRenaming={isRenamingFile}
            defaultValue={props.name}
            isEditing={isEditing}
            onSubmit={handleFormSubmit}
            onClick={handleInputClick}
            onBlur={handleRename}
          />
        )}
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={handleContextMenuClose}>
        <ContextMenuItem onClick={handleStartRename}>
          <Pencil className="w-4 h-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem disabled={isDeletingFile} onClick={handleDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Editable file name input with form handling
 */
function FileNameInput({
  ref,
  defaultValue,
  isEditing,
  isRenaming,
  onSubmit,
  onClick,
  onBlur,
}: {
  ref: React.Ref<HTMLInputElement>
  defaultValue: string
  isEditing: boolean
  isRenaming: boolean
  onSubmit: (e: React.FormEvent) => void
  onClick: (e: React.MouseEvent) => void
  onBlur: () => void
}) {
  React.useEffect(() => {
    if (isEditing && ref && "current" in ref && ref.current) {
      ref.current.select()
    }
  }, [isEditing, ref])
  return (
    <form className="flex-1 min-w-0" onSubmit={onSubmit}>
      <input
        ref={ref}
        className={cn(
          "bg-transparent transition-all focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-ring rounded-sm w-full truncate",
          !isEditing && "pointer-events-none",
          isRenaming && "animate-pulse"
        )}
        disabled={!isEditing}
        autoFocus
        onClick={onClick}
        defaultValue={defaultValue}
        onBlur={onBlur}
      />
    </form>
  )
}

export default SidebarFile
