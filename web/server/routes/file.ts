import { createRouter } from "@/lib/api/create-app"
import { CONTAINER_TIMEOUT } from "@gitwit/lib/utils/constants"
import { zValidator } from "@hono/zod-validator"
import type { Context } from "hono"
import z from "zod"

import { Project } from "@gitwit/lib/services/Project"

async function withProject<T>(
  projectId: string,
  c: Context,
  action: string,
  handler: (project: Project) => Promise<T>,
): Promise<T | Response> {
  const project = new Project(projectId)
  await project.initialize()
  try {
    return await handler(project)
  } catch (error) {
    console.error(`Error ${action}:`, error)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return c.json(
      { success: false, message: `Failed to ${action}: ${errorMessage}` },
      500,
    )
  } finally {
    await project.disconnect()
  }
}

export const fileRouter = createRouter()
  // Get file content
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        fileId: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { fileId, projectId } = c.req.valid("query")
      return withProject(projectId, c, "read file", async (project) => {
        if (!project.fileManager) {
          throw new Error("File manager not available")
        }
        try {
          const file = await project.fileManager.getFile(fileId)
          return c.json({ message: "success", data: file })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to read file"
          if (
            errorMessage.includes("does not exist") ||
            (error as any)?.name === "NotFoundError"
          ) {
            return c.json({ message: "success", data: "" })
          }
          throw error
        }
      })
    },
  )

  // Save file content
  .post(
    "/save",
    zValidator(
      "json",
      z.object({
        fileId: z.string(),
        content: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { fileId, content, projectId } = c.req.valid("json")
      return withProject(projectId, c, "save file", async (project) => {
        if (!project.fileManager) {
          throw new Error("File manager not available")
        }
        await project.fileManager.saveFile(fileId, content)
        return c.json(
          { success: true, message: "File saved successfully" },
          200,
        )
      })
    },
  )

  // Create a new file
  .post(
    "/create",
    zValidator(
      "json",
      z.object({
        name: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { name, projectId } = c.req.valid("json")
      return withProject(projectId, c, "create file", async (project) => {
        if (!project.fileManager) {
          throw new Error("File manager not available")
        }
        const success = await project.fileManager.createFile(name)
        return c.json(
          {
            success,
            message: success
              ? "File created successfully"
              : "Failed to create file",
          },
          200,
        )
      })
    },
  )

  // Delete a file
  .delete(
    "/",
    zValidator(
      "query",
      z.object({
        fileId: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { fileId, projectId } = c.req.valid("query")
      return withProject(projectId, c, "delete file", async (project) => {
        const result = await project.fileManager?.deleteFile(fileId)
        return c.json(
          { success: true, message: "File deleted successfully", data: result },
          200,
        )
      })
    },
  )

  // Move a file
  .post(
    "/move",
    zValidator(
      "json",
      z.object({
        fileId: z.string(),
        folderId: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { fileId, folderId, projectId } = c.req.valid("json")
      return withProject(projectId, c, "move file", async (project) => {
        const result = await project.fileManager?.moveFile(fileId, folderId)
        return c.json(
          { success: true, message: "File moved successfully", data: result },
          200,
        )
      })
    },
  )

  // Rename a file
  .post(
    "/rename",
    zValidator(
      "json",
      z.object({
        fileId: z.string(),
        newName: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { fileId, newName, projectId } = c.req.valid("json")
      return withProject(projectId, c, "rename file", async (project) => {
        await project.fileManager?.renameFile(fileId, newName)
        return c.json(
          { success: true, message: "File renamed successfully" },
          200,
        )
      })
    },
  )

  // Create a folder
  .post(
    "/folder",
    zValidator(
      "json",
      z.object({
        name: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { name, projectId } = c.req.valid("json")
      return withProject(projectId, c, "create folder", async (project) => {
        await project.fileManager?.createFolder(name)
        return c.json(
          { success: true, message: "Folder created successfully" },
          200,
        )
      })
    },
  )

  // Delete a folder
  .delete(
    "/folder",
    zValidator(
      "query",
      z.object({
        folderId: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { folderId, projectId } = c.req.valid("query")
      return withProject(projectId, c, "delete folder", async (project) => {
        const result = await project.fileManager?.deleteFolder(folderId)
        return c.json(
          {
            success: true,
            message: "Folder deleted successfully",
            data: result,
          },
          200,
        )
      })
    },
  )

  // Get folder contents
  .get(
    "/folder",
    zValidator(
      "query",
      z.object({
        folderId: z.string(),
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { folderId, projectId } = c.req.valid("query")
      return withProject(projectId, c, "get folder", async (project) => {
        const folder = await project.fileManager?.getFolder(folderId)
        if (!folder) {
          return c.json({ error: "Folder not found" }, 404)
        }
        return c.json(folder, 200)
      })
    },
  )

  // Download files as archive
  .get(
    "/download",
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { projectId } = c.req.valid("query")
      return withProject(projectId, c, "download files", async (project) => {
        if (!project.fileManager) {
          throw new Error("No file manager")
        }
        const archive = await project.fileManager.getFilesForDownload()
        return c.json({ archive })
      })
    },
  )

  // Get file tree
  .get(
    "/tree",
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
      }),
    ),
    async (c) => {
      const { projectId } = c.req.valid("query")
      return withProject(projectId, c, "get file tree", async (project) => {
        const fileTree = await project.fileManager?.getFileTree()
        return c.json({ success: true, data: fileTree }, 200)
      })
    },
  )

  // Handle heartbeat
  .post(
    "/heartbeat",
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        isOwner: z.boolean(),
      }),
    ),
    async (c) => {
      const { projectId, isOwner } = c.req.valid("json")
      return withProject(projectId, c, "handle heartbeat", async (project) => {
        if (isOwner) {
          try {
            await project.container?.setTimeout(CONTAINER_TIMEOUT)
          } catch (error) {
            console.error("Failed to set container timeout:", error)
            return c.json({ success: false }, 500)
          }
        }
        return c.json({ success: true }, 200)
      })
    },
  )
