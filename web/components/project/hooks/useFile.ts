import { useSocket } from "@/context/SocketContext"
import { useChangedFilesOptimistic } from "@/hooks/useChangedFilesOptimistic"
import { fileRouter, FileTree } from "@/lib/api"
import { TFile, TFolder } from "@/lib/types"
import { sortFileExplorer } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import { insertNode, rebaseNodeIds, removeNode } from "./lib/file-tree-utils"

export function useFileTree() {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setTabs = useAppStore((s) => s.setTabs)
  const { updateChangedFilesOptimistically } = useChangedFilesOptimistic()
  const { socket } = useSocket()

  const { data: fileTree = [], isLoading: isLoadingFileTree } =
    fileRouter.fileTree.useQuery({
      variables: {
        projectId,
      },
      select(data) {
        return sortFileExplorer(data.data ?? [])
      },
    })
  const { mutate: deleteFolder, isPending: isDeletingFolder } =
    fileRouter.deleteFolder.useMutation({
      onMutate({ folderId }) {
        setTabs((tabs) =>
          tabs.filter(
            (tab) => tab.id !== folderId && !tab.id.startsWith(folderId + "/"),
          ),
        )
        setActiveTab((activeTab) => {
          if (
            activeTab?.id === folderId ||
            activeTab?.id.startsWith(folderId + "/")
          ) {
            return undefined
          }
          return activeTab
        })
      },
      onSuccess({ message }, { folderId }) {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            }),
          )
          .then(() => {
            toast.success(message)
          })
      },
      onError() {
        toast.error("Couldn't delete folder")
      },
    })

  const { mutate: deleteFile, isPending: isDeletingFile } =
    fileRouter.deleteFile.useMutation({
      onMutate: async ({ fileId }) => {
        setTabs((tabs) => tabs.filter((tab) => tab.id !== fileId))
        setActiveTab((activeTab) => {
          if (activeTab?.id === fileId) {
            return undefined
          }
          return activeTab
        })
      },
      onSuccess({ message }) {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            }),
          )
          .then(() => {
            toast.success(message)
          })
      },
      onError() {
        toast.error("Couldn't delete file")
      },
    })

  const { mutate: renameFile, isPending: isRenamingFile } =
    fileRouter.rename.useMutation({
      onSuccess({ message }, { newName }) {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            }),
          )
          .then(() => {
            toast.success(message)
          })
      },
      onError() {
        toast.error("Couldn't delete file")
      },
    })

  const { mutateAsync: rawSaveFile } = fileRouter.saveFile.useMutation({
    onSuccess(_, { fileId }) {
      return queryClient.invalidateQueries(
        fileRouter.fileContent.getOptions({
          fileId,
          projectId,
        }),
      )
    },
  })

  const fileTreeKey = fileRouter.fileTree.getKey({ projectId })
  const { mutate: moveFile } = fileRouter.moveFile.useMutation({
    onMutate: async (toBeMoved) => {
      await queryClient.cancelQueries(
        fileRouter.fileTree.getOptions({ projectId }),
      )

      const previous = queryClient.getQueryData(fileTreeKey)

      // Optimistically update to the new value
      if (previous?.data) {
        const newTree = structuredClone(previous.data)

        const movedNode = removeNode(newTree, toBeMoved.fileId)
        if (movedNode) {
          const rebased = rebaseNodeIds(movedNode, toBeMoved.folderId)
          // TODO: Further optimiztion: move queryCache value of file content to newId; move draft to new Id; account for if it's a activeTab;
          insertNode(newTree, toBeMoved.folderId, rebased)

          // Optimistically update changed files - treat move as update with new path
          const newPath = toBeMoved.folderId + "/" + movedNode.name
          updateChangedFilesOptimistically("update", newPath, "")
        }

        queryClient.setQueryData(fileTreeKey, (old) =>
          old
            ? {
                ...old,
                data: newTree,
              }
            : old,
        )
      }

      return { previous }
    },

    onError: (_err, _variables, context) => {
      // Roll back to the previous tree
      if (context?.previous) {
        queryClient.setQueryData(fileTreeKey, context.previous)
      }
      toast.error("Failed to move file")
    },

    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries(
        fileRouter.fileTree.getOptions({ projectId }),
      )
    },
  })

  function saveFile(...args: Parameters<typeof rawSaveFile>) {
    toast.promise(rawSaveFile(...args), {
      loading: "Saving...",
      success: (data) => {
        return data.message
      },
      error: (error: Error) => error.message || "Error saving file",
    })
  }

  React.useEffect(() => {
    if (!socket) return
    const handleRefreshFiles = (files: (TFolder | TFile)[]) => {
      queryClient.setQueryData(fileTreeKey, {
        data: files,
        success: true,
      })
    }
    socket.on("refreshFiles", handleRefreshFiles)

    return () => {
      socket.off("refreshFiles", handleRefreshFiles)
    }
  }, [socket])

  return {
    fileTree,
    deleteFolder,
    deleteFile,
    renameFile,
    saveFile,
    moveFile,

    isLoadingFileTree,
    isDeletingFolder,
    isDeletingFile,
    isRenamingFile,
  }
}

export function useFileContent(
  {
    id: fileId,
    enabled = true,
  }: {
    id: string
    enabled?: boolean
  } = { id: "", enabled: true },
) {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: fileContent, isLoading: isLoadingFileContent } =
    fileRouter.fileContent.useQuery({
      enabled: enabled ?? !!fileId,
      variables: {
        fileId,
        projectId,
      },
      select(data) {
        return data.data
      },
    })

  const prefetchFileContent = React.useCallback(async () => {
    await queryClient.prefetchQuery(
      fileRouter.fileContent.getFetchOptions({
        fileId,
        projectId,
      }),
    )
  }, [fileId, projectId])

  return {
    fileContent,
    isLoadingFileContent,
    prefetchFileContent,
  }
}

