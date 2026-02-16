import { createRouter } from "@/lib/api/create-app"
import { CONTAINER_TIMEOUT } from "@gitwit/lib/utils/constants"
import { zValidator } from "@hono/zod-validator"
import z from "zod"

import { Project } from "@gitwit/lib/services/Project"

export const fileRouter = createRouter()
  // Get file content
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        fileId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { fileId, projectId } = c.req.valid("query")

      // Initialize project
      const project = new Project(projectId)
      await project.initialize()

      try {
        if (!project.fileManager) {
          throw new Error("File manager not available")
        }

        const file = await project.fileManager.getFile(fileId)
        return c.json({ message: "success", data: file })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to read file"
        // Return 200 with empty string for non-existent files
        if (
          errorMessage.includes("does not exist") ||
          (error as any)?.name === "NotFoundError"
        ) {
          return c.json({ message: "success", data: "" })
        }
        console.error(`Error reading file ${fileId}:`, error)
        return c.json({ error: errorMessage }, 500)
      } finally {
        // Clean up project resources if needed
        await project.disconnect()
      }
    }
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
      })
    ),
    async (c) => {
      const { fileId, content, projectId } = c.req.valid("json")

      // Initialize project
      const project = new Project(projectId)
      await project.initialize()

      try {
        // Apply rate limiting
        // const user = c.get("user") as User
        // await saveFileRL.consume(user.id, 1)

        if (!project.fileManager) {
          throw new Error("File manager not available")
        }

        await project.fileManager.saveFile(fileId, content)
        return c.json(
          {
            success: true,
            message: "File saved successfully",
          },
          200
        )
      } catch (error) {
        console.error("Error saving file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to save file: ${errorMessage}`,
          },
          500
        )
      } finally {
        // Clean up project resources
        await project.disconnect()
      }
    }
  )

  // Create a new file
  .post(
    "/create",
    zValidator(
      "json",
      z.object({
        name: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { name, projectId } = c.req.valid("json")

      // Initialize project
      const project = new Project(projectId)
      await project.initialize()

      try {
        // Apply rate limiting
        // const user = c.get("user") as User
        // await createFileRL.consume(user.id, 1)

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
          200
        )
      } catch (error) {
        console.error("Error creating file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to create file: ${errorMessage}`,
          },
          500
        )
      } finally {
        // Clean up project resources if needed
        await project.disconnect()
      }
    }
  )

  // Delete a file
  .delete(
    "/",
    zValidator(
      "query",
      z.object({
        fileId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { fileId, projectId } = c.req.valid("query")

      const project = new Project(projectId)
      await project.initialize()

      try {
        // Apply rate limiting
        // const user = c.get("user") as User
        // await deleteFileRL.consume(user.id, 1)

        const result = await project.fileManager?.deleteFile(fileId)
        return c.json(
          {
            success: true,
            message: "File deleted successfully",
            data: result,
          },
          200
        )
      } catch (error) {
        console.error("Error deleting file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to delete file: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
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
      })
    ),
    async (c) => {
      const { fileId, folderId, projectId } = c.req.valid("json")

      const project = new Project(projectId)
      await project.initialize()

      try {
        const result = await project.fileManager?.moveFile(fileId, folderId)
        return c.json(
          {
            success: true,
            message: "File moved successfully",
            data: result,
          },
          200
        )
      } catch (error) {
        console.error("Error moving file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to move file: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
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
      })
    ),
    async (c) => {
      const { fileId, newName, projectId } = c.req.valid("json")

      const project = new Project(projectId)
      await project.initialize()

      try {
        await project.fileManager?.renameFile(fileId, newName)
        return c.json(
          {
            success: true,
            message: "File renamed successfully",
          },
          200
        )
      } catch (error) {
        console.error("Error renaming file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to rename file: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Create a folder
  .post(
    "/folder",
    zValidator(
      "json",
      z.object({
        name: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { name, projectId } = c.req.valid("json")

      const project = new Project(projectId)
      await project.initialize()

      try {
        // Apply rate limiting
        // const user = c.get("user") as User
        // await createFolderRL.consume(user.id, 1)

        await project.fileManager?.createFolder(name)
        return c.json(
          {
            success: true,
            message: "Folder created successfully",
          },
          200
        )
      } catch (error) {
        console.error("Error creating folder:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to create folder: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Delete a folder
  .delete(
    "/folder",
    zValidator(
      "query",
      z.object({
        folderId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { folderId, projectId } = c.req.valid("query")

      const project = new Project(projectId)
      await project.initialize()

      try {
        const result = await project.fileManager?.deleteFolder(folderId)
        return c.json(
          {
            success: true,
            message: "Folder deleted successfully",
            data: result,
          },
          200
        )
      } catch (error) {
        console.error("Error deleting folder:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to delete folder: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Get folder contents
  .get(
    "/folder",
    zValidator(
      "query",
      z.object({
        folderId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { folderId, projectId } = c.req.valid("query")

      const project = new Project(projectId)
      await project.initialize()

      try {
        const folder = await project.fileManager?.getFolder(folderId)
        if (!folder) {
          return c.json({ error: "Folder not found" }, 404)
        }
        return c.json(folder, 200)
      } catch (error) {
        console.error("Error getting folder:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            error: `Failed to get folder: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Download files as archive
  .get(
    "/download",
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { projectId } = c.req.valid("query")
      const project = new Project(projectId)
      await project.initialize()

      try {
        if (!project.fileManager) {
          throw new Error("No file manager")
        }

        const archive = await project.fileManager.getFilesForDownload()
        return c.json({ archive })
      } catch (error) {
        console.error("Error downloading files:", error)
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to download files",
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Get file tree
  .get(
    "/tree",
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { projectId } = c.req.valid("query")

      const project = new Project(projectId)
      await project.initialize()

      try {
        const fileTree = await project.fileManager?.getFileTree()
        return c.json(
          {
            success: true,
            data: fileTree,
          },
          200
        )
      } catch (error) {
        console.error("Error getting file tree:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to get file tree: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Handle heartbeat
  .post(
    "/heartbeat",
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        isOwner: z.boolean(),
      })
    ),
    async (c) => {
      const { projectId, isOwner } = c.req.valid("json")

      const project = new Project(projectId)
      await project.initialize()

      try {
        // Only keep the container alive if the owner is still connected
        if (isOwner) {
          try {
            await project.container?.setTimeout(CONTAINER_TIMEOUT)
          } catch (error) {
            console.error("Failed to set container timeout:", error)
            return c.json({ success: false }, 500)
          }
        }
        return c.json({ success: true }, 200)
      } catch (error) {
        console.error("Error handling heartbeat:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to handle heartbeat: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )
