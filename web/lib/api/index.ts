import { apiClient } from "@/server/client"
import type { TFile, TFolder } from "@/lib/types"
import { inferFnData, router } from "react-query-kit"

function parseGithubError(
  data: { message?: string; data?: string },
  fallback: string,
): string {
  if (typeof data.message === "string" && typeof data.data === "string") {
    const match = data.data.match(/{.*}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (parsed.message) {
          return `${fallback}: ${parsed.message}`
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    }
  } else if (typeof data.message === "string") {
    return data.message
  }
  return fallback
}

// Common API response shapes (Hono client can't infer these due to type inference limitations)
type ApiMsg = { success: boolean; message: string }
type ApiData<T> = ApiMsg & { data: T }

// #region Github
export const githubRouter = router("github", {
  githubUser: router.query({
    fetcher: async () => {
      const res = await apiClient.github.user.$get()
      if (!res.ok) {
        return null
      }
      const data = (await res.json()) as ApiData<{
        login: string
        name: string | null
        avatar_url: string
        html_url: string
      }>

      return data
    },
  }),
  login: router.mutation({
    mutationFn: async ({ code }: { code: string }) => {
      const res = await apiClient.github.login.$post({
        query: { code },
      })
      if (!res.ok) {
        throw new Error("Login failed")
      }
      const data = (await res.json()) as ApiMsg
      return data
    },
  }),
  logout: router.mutation({
    mutationFn: async () => {
      const res = await apiClient.github.logout.$post()
      if (!res.ok) {
        throw new Error("Logout failed")
      }
      const data = (await res.json()) as ApiMsg
      return data
    },
  }),
  gethAuthUrl: router.mutation({
    mutationFn: async () => {
      const res = await apiClient.github["auth_url"].$get()
      if (!res.ok) {
        throw new Error("Failed to get GitHub auth URL")
      }
      const data = (await res.json()) as {
        success: boolean
        data: { auth_url: string }
      }
      return data
    },
  }),
  createCommit: router.mutation({
    mutationFn: async ({
      projectId,
      message,
    }: {
      projectId: string
      message: string
    }) => {
      const res = await apiClient.github.repo.commit.$post({
        json: {
          projectId,
          message,
        },
      })
      const data = (await res.json()) as ApiMsg & { data?: string }
      if (!res.ok) {
        throw new Error(parseGithubError(data, "Failed to commit changes"))
      }
      return data
    },
  }),
  createRepo: router.mutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.github.repo.create.$post({
        json: {
          projectId,
        },
      })
      const data = (await res.json()) as ApiMsg & { data?: string }
      if (!res.ok) {
        throw new Error(parseGithubError(data, "Failed to create repository"))
      }
      return data
    },
  }),
  removeRepo: router.mutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.github.repo.remove.$delete({
        json: { projectId },
      })
      const data = (await res.json()) as ApiMsg & { data?: string }
      if (!res.ok) {
        throw new Error(parseGithubError(data, "Failed to delete repository"))
      }
      return data
    },
  }),
  repoStatus: router.query({
    fetcher: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.github.repo.status.$get({
        query: { projectId },
      })
      if (!res.ok) {
        if ((res.status as number) === 403) {
          // User not authenticated with GitHub
          return null
        }
        throw new Error("Failed to get repo status")
      }
      const data = (await res.json()) as ApiData<{
        existsInDB: boolean
        existsInGitHub: boolean
        repo: { id: string; name: string } | null
      }>
      return data
    },
  }),
  checkPullStatus: router.query({
    fetcher: async ({ projectId }: { projectId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono can't type compound path segments
      const res = await (apiClient.github.repo as Record<string, any>)[
        "pull/check"
      ].$get({
        query: { projectId },
      })
      if (!res.ok) {
        if (res.status === 403) {
          // User not authenticated with GitHub
          return null
        }
        throw new Error("Failed to check pull status")
      }
      const data = (await res.json()) as ApiData<{
        needsPull: boolean
        behind?: number
      }>
      return data
    },
  }),
  getChangedFiles: router.query({
    fetcher: async ({ projectId }: { projectId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono can't type compound path segments
      const res = await (apiClient.github.repo as Record<string, any>)[
        "changed-files"
      ].$get({
        query: { projectId },
      })
      if (!res.ok) {
        throw new Error("Failed to get changed files")
      }
      const data = (await res.json()) as ApiData<{
        modified?: Array<{ path: string }>
        created?: Array<{ path: string }>
        deleted?: Array<{ path: string }>
      }>
      return data
    },
  }),
  pullFromGithub: router.mutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.github.repo.pull.$post({
        json: {
          projectId,
        },
      })
      const data = (await res.json()) as ApiMsg & {
        data?:
          | {
              success: boolean
              conflicts: Array<{
                path: string
                localContent: string
                incomingContent: string
              }>
              newFiles: string[]
              deletedFiles: string[]
              updatedFiles: string[]
            }
          | string
      }
      if (!res.ok) {
        const errData = {
          message: data.message,
          data: typeof data.data === "string" ? data.data : undefined,
        }
        throw new Error(parseGithubError(errData, "Failed to pull from GitHub"))
      }
      return data
    },
  }),
  resolveConflicts: router.mutation({
    mutationFn: async ({
      projectId,
      conflictResolutions,
    }: {
      projectId: string
      conflictResolutions: Array<{
        path: string
        resolutions: Array<{
          conflictIndex: number
          resolution: "local" | "incoming"
          localContent: string
          incomingContent: string
        }>
      }>
    }) => {
      const res = await apiClient.github.repo["resolve-conflicts"].$post({
        json: {
          projectId,
          conflictResolutions,
        },
      })
      const data = (await res.json()) as ApiMsg
      if (!res.ok) {
        throw new Error(data.message || "Failed to resolve conflicts")
      }
      return data
    },
  }),
})

export type GithubUser = NonNullable<
  Awaited<ReturnType<typeof githubRouter.githubUser.fetcher>>
>["data"]

// #endregion

// #region File
const HEARTBEAT_POLL_INTERVERAL_MS = 10_000 // same as 10 seconds
export const fileRouter = router("file", {
  heartbeat: router.query({
    fetcher: async ({
      projectId,
      isOwner,
    }: {
      projectId: string
      isOwner: boolean
    }) => {
      const res = await apiClient.file.heartbeat.$post({
        json: { projectId, isOwner },
      })
      if (!res.ok) {
        throw new Error("Failed to fetch hearbeat")
      }
      const data = (await res.json()) as { success: boolean }
      return data
    },
    refetchInterval: HEARTBEAT_POLL_INTERVERAL_MS,
  }),
  fileContent: router.query({
    fetcher: async ({
      fileId,
      projectId,
    }: {
      fileId: string
      projectId: string
    }) => {
      const res = await apiClient.file.$get({
        query: { fileId, projectId },
      })
      if (!res.ok) {
        throw new Error("Failed to fetch file content")
      }
      const data = (await res.json()) as { message: string; data: string }
      return data
    },
  }),
  saveFile: router.mutation({
    mutationFn: async (options: {
      fileId: string
      content: string
      projectId: string
    }) => {
      const res = await apiClient.file.save.$post({
        json: options,
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message || "Failed to save file")
      }
      const data = (await res.json()) as ApiMsg
      return data
    },
  }),
  createFile: router.mutation({
    mutationFn: async (options: { name: string; projectId: string }) => {
      const res = await apiClient.file.create.$post({
        json: options,
      })
      if (!res.ok) {
        throw new Error("Failed to create new file")
      }
      const data = (await res.json()) as ApiMsg
      return data
    },
  }),
  createFolder: router.mutation({
    mutationFn: async (options: { name: string; projectId: string }) => {
      const res = await apiClient.file.folder.$post({
        json: options,
      })
      if (!res.ok) {
        throw new Error("Failed to create new folder")
      }
      const data = (await res.json()) as ApiMsg
      return data
    },
  }),
  moveFile: router.mutation({
    mutationFn: async (options: {
      fileId: string
      folderId: string
      projectId: string
    }) => {
      const res = await apiClient.file.move.$post({
        json: options,
      })
      if (!res.ok) {
        throw new Error("Failed to move file")
      }
      const data = (await res.json()) as ApiData<(TFile | TFolder)[]>
      return data
    },
  }),
  fileTree: router.query({
    fetcher: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.file.tree.$get({
        query: { projectId },
      })
      if (!res.ok) {
        throw new Error("Failed to fetch file tree")
      }
      const data = (await res.json()) as {
        success: boolean
        data: (TFile | TFolder)[]
      }
      return data
    },
  }),
  deleteFile: router.mutation({
    mutationFn: async ({
      fileId,
      projectId,
    }: {
      fileId: string
      projectId: string
    }) => {
      const res = await apiClient.file.$delete({
        query: {
          fileId,
          projectId,
        },
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message || "Failed to delete file")
      }
      return (await res.json()) as ApiMsg
    },
  }),
  deleteFolder: router.mutation({
    mutationFn: async ({
      folderId,
      projectId,
    }: {
      folderId: string
      projectId: string
    }) => {
      const res = await apiClient.file.folder.$delete({
        query: {
          folderId,
          projectId,
        },
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message || "Failed to delete folder")
      }
      return (await res.json()) as ApiMsg
    },
  }),
  rename: router.mutation({
    mutationFn: async ({
      fileId,
      projectId,
      newName,
    }: {
      fileId: string
      projectId: string
      newName: string
    }) => {
      // Validate name
      const res = await apiClient.file.rename.$post({
        json: {
          fileId,
          projectId,
          newName,
        },
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message || "Failed to rename file")
      }
      return (await res.json()) as ApiMsg
    },
  }),
})

export type FileTree = NonNullable<
  inferFnData<typeof fileRouter.moveFile>["data"]
>

// #endregion

// #region User
export const userRouter = router("user", {
  availableModels: router.query({
    fetcher: async () => {
      const res = await apiClient.user["available-models"].$get()
      if (!res.ok) {
        throw new Error("Failed to fetch available models")
      }
      const data = (await res.json()) as {
        models: Array<{ id: string; name: string; provider: string }>
        defaultModel?: string
        selectedProvider?: string
      }
      return data
    },
  }),
  updateSelectedModel: router.mutation({
    mutationFn: async ({
      provider,
      modelId,
    }: {
      provider: "anthropic" | "openai" | "openrouter" | "aws"
      modelId: string
    }) => {
      const res = await apiClient.user["selected-model"].$put({
        json: {
          provider,
          modelId,
        },
      })
      if (!res.ok) {
        throw new Error("Failed to update selected model")
      }
      const data = (await res.json()) as ApiMsg
      return data
    },
  }),
})

export type AvailableModels = Awaited<
  ReturnType<typeof userRouter.availableModels.fetcher>
>

// #endregion

// #region AI
export const aiApiRouter = router("ai", {
  processEdit: router.mutation({
    mutationFn: async ({
      messages,
      context,
    }: {
      messages: Array<{ role: string; content: string }>
      context?: {
        templateType?: string
        activeFileContent?: string
        fileName?: string
        projectId?: string
        projectName?: string
      }
    }) => {
      const res = await apiClient.ai["process-edit"].$post({
        json: {
          messages: messages as Array<{
            role: "user" | "assistant"
            content: string
          }>,
          context,
        },
      })
      if (!res.ok) {
        throw new Error("Failed to process edit")
      }
      const data = (await res.json()) as { content: string }
      return data
    },
  }),
  mergeCode: router.mutation({
    mutationFn: async ({
      partialCode,
      originalCode,
      fileName,
      projectId,
    }: {
      partialCode: string
      originalCode: string
      fileName: string
      projectId?: string
    }) => {
      const res = await apiClient.ai["merge-code"].$post({
        json: { partialCode, originalCode, fileName, projectId },
      })
      if (!res.ok) {
        throw new Error("Failed to merge code")
      }
      const data = (await res.json()) as { mergedCode: string }
      return data
    },
  }),
})
// #endregion
