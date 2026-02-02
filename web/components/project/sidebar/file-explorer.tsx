"use client"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useContainer } from "@/context/container-context"
import { useEditorLayout } from "@/context/EditorLayoutContext"
import {
  FileExplorerProvider,
  useFileExplorer,
} from "@/context/FileExplorerContext"
import { cn } from "@/lib/utils"
import { DragDropProvider, useDroppable } from "@dnd-kit/react"
import { FilePlus, FolderPlus, MessageSquareMore, Sparkles } from "lucide-react"
import { useParams } from "next/navigation"
import * as React from "react"
import { useFileTree } from "../hooks/useFile"
import SidebarFile from "./file"
import SidebarFolder from "./folder"
import New from "./new"

export function FileExplorer() {
  const { id: projectId } = useParams<{ id: string }>()
  const { dockRef } = useContainer()
  const { moveFile } = useFileTree()

  // Ref to track the last pointer position during drag
  const lastPointerPositionRef = React.useRef<{ x: number; y: number } | null>(
    null,
  )

  // Track whether we're currently dragging a file (for external drop detection)
  const isDraggingFileRef = React.useRef(false)
  const isOverDockviewRef = React.useRef(false)

  // Track pointer position during drag
  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      lastPointerPositionRef.current = { x: e.clientX, y: e.clientY }
    }
    document.addEventListener("pointermove", handlePointerMove)
    return () => document.removeEventListener("pointermove", handlePointerMove)
  }, [])

  // Helper to check if pointer is over dockview
  const checkIsOverDockview = React.useCallback(
    (x: number, y: number): boolean => {
      const dockviewElement = document.querySelector('[class*="dv-dockview"]')
      if (dockviewElement) {
        const rect = dockviewElement.getBoundingClientRect()
        return (
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        )
      }
      return false
    },
    [],
  )

  // Update visual feedback on dockview when dragging over it
  const updateDockviewFeedback = React.useCallback((isOver: boolean) => {
    const dockviewElement = document.querySelector('[class*="dv-dockview"]')
    if (dockviewElement) {
      if (isOver) {
        dockviewElement.setAttribute("data-file-drag-over", "true")
        // Hide the drag feedback clone when over dockview
        document.body.setAttribute("data-dragging-to-dockview", "true")
      } else {
        dockviewElement.removeAttribute("data-file-drag-over")
        document.body.removeAttribute("data-dragging-to-dockview")
      }
    }
  }, [])

  return (
    <FileExplorerProvider>
      <DragDropProvider
        onDragStart={(event) => {
          const { source } = event.operation
          if (source?.type === "file") {
            isDraggingFileRef.current = true
          }
        }}
        onDragMove={(event) => {
          // Only track for file drags
          if (!isDraggingFileRef.current) return
          const pointerPos = lastPointerPositionRef.current
        }}
        onDragEnd={(event) => {
          // Clean up visual feedback
          updateDockviewFeedback(false)
          const wasOverDockview = isOverDockviewRef.current
          isDraggingFileRef.current = false
          isOverDockviewRef.current = false

          if (event.canceled) return
          const { source, target } = event.operation

          // Handle file move within file explorer
          if (source && target) {
            if (source.type === "file" && target.type === "folder") {
              const fileId = source.id.toString() // e.g. "/src/hello.ts"
              const targetFolderId = target.id.toString() // e.g. "/src"

              // compute the file's current folder:
              const idx = fileId.lastIndexOf("/")
              const currentFolderId = fileId.substring(0, idx) || "/" // e.g /viteconfig.js
              if (currentFolderId === targetFolderId) return
              moveFile({
                projectId,
                folderId: targetFolderId,
                fileId,
              })
              return
            }
          }

          // Handle file drop outside file explorer (into dockview)
          // This happens when source exists but target is null/undefined
          if (source && !target && source.type === "file" && wasOverDockview) {
            const fileId = source.id.toString()
            const fileName = fileId.split("/").pop() || fileId

            // Abort the drag operation to prevent return animation
            const suspension = event.suspend()
            suspension.abort()

            if (dockRef.current) {
              // Check if file is already open
              const existingPanel = dockRef.current.getPanel(fileId)
              if (existingPanel) {
                // Just activate the existing panel
                existingPanel.api.setActive()
              } else {
                // Add the file as a new editor panel
                dockRef.current.addPanel({
                  id: fileId,
                  component: "editor",
                  title: fileName,
                  tabComponent: "editor",
                })
              }
            }
          }
        }}
      >
        <div className="flex flex-col h-full">
          <RootFolder />
          {/* <AIChatControl /> */}
        </div>
      </DragDropProvider>
    </FileExplorerProvider>
  )
}

function RootFolder() {
  const { id: projectId } = useParams<{ id: string }>()
  const { fileTree, isLoadingFileTree } = useFileTree()

  // Use the file explorer context for creation state
  const { activeFolderPath, creationType, startCreating, stopCreating } =
    useFileExplorer()

  // Check if we should show the New form at root level
  const showNewFormAtRoot = activeFolderPath === "/" && creationType !== null

  const { ref: droppableRef, isDropTarget } = useDroppable({
    id: "/",
    type: "folder",
    accept(source) {
      if (source.type === "file" || source.type === "folder") {
        return true
      }
      return false
    },
  })

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      ;(droppableRef as unknown as (node: HTMLDivElement | null) => void)(node)
    },
    [droppableRef],
  )

  return (
    <div
      ref={setRefs}
      data-isdrop={isDropTarget}
      className="styled-scrollbar flex-1 hover-scrollbar flex-grow overflow-auto px-2 pt-0 pb-4 relative data-[isdrop=true]:bg-secondary/50 data-[isdrop=true]:rounded-sm data-[isdrop=true]:overflow-hidden min-w-0"
    >
      <div className="flex w-full items-center justify-between h-8 pb-1 isolate z-10 sticky pt-2 top-0 bg-background">
        <h2 className="font-medium">Explorer</h2>
        <div className="flex space-x-1">
          <button
            disabled={!!creationType}
            onClick={() => startCreating("file")}
            className="h-6 w-6 text-muted-foreground ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:hover:bg-background"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            disabled={!!creationType}
            onClick={() => startCreating("folder")}
            className="h-6 w-6 text-muted-foreground ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:hover:bg-background"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="rounded-sm w-full mt-1 flex flex-col min-w-0">
        {isLoadingFileTree ? (
          <div className="w-full flex flex-col justify-center">
            {new Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-[1.625rem] mb-0.5 rounded-sm" />
            ))}
          </div>
        ) : (
          <>
            {fileTree.map((child) =>
              child.type === "file" ? (
                <SidebarFile key={child.id} {...child} />
              ) : (
                <SidebarFolder key={child.id} {...child} />
              ),
            )}
            {showNewFormAtRoot && creationType !== null && (
              <New
                projectId={projectId}
                type={creationType}
                basePath="/"
                stopEditing={stopCreating}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AIChatControl() {
  const { toggleAIChat, isAIChatOpen } = useEditorLayout()

  return (
    <div className="flex flex-col p-2 bg-background">
      <Button
        variant="ghost"
        className="w-full justify-start text-sm text-muted-foreground font-normal h-8 px-2 mb-2"
        disabled
        aria-disabled="true"
        style={{ opacity: 1 }}
      >
        <Sparkles className="h-4 w-4 mr-2 text-indigo-500 opacity-70" />
        AI Editor
        <div className="ml-auto">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>G
          </kbd>
        </div>
      </Button>
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start text-sm font-normal h-8 px-2 mb-2 border-t",
          isAIChatOpen
            ? "bg-muted-foreground/25 text-foreground"
            : "text-muted-foreground",
        )}
        onClick={toggleAIChat}
        aria-disabled={false}
        style={{ opacity: 1 }}
      >
        <MessageSquareMore
          className={cn(
            "h-4 w-4 mr-2",
            isAIChatOpen ? "text-indigo-500" : "text-indigo-500 opacity-70",
          )}
        />
        AI Chat
        <div className="ml-auto">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>L
          </kbd>
        </div>
      </Button>
    </div>
  )
}
