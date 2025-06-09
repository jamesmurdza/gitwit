import { drizzle } from "drizzle-orm/node-postgres"
import { Socket } from "socket.io"
import { z } from "zod"
import * as schema from "../db/schema"
import { isClerkConfigured, verifyClerkToken } from "../utils/clerk"

// Load the database credentials
import "dotenv/config"

// Initialize database
const db = drizzle(process.env.DATABASE_URL as string, { schema })

// Middleware for socket authentication
export const socketAuth = async (socket: Socket, next: Function) => {
  try {
    // Define the schema for handshake query/auth validation
    const handshakeSchema = z.object({
      token: z.string(), // Clerk token
      sandboxId: z.string(),
    })

    const q = (socket.handshake.auth as any) || socket.handshake.query
    const parseQuery = handshakeSchema.safeParse(q)

    // Check if the query is valid according to the schema
    if (!parseQuery.success) {
      next(new Error("Invalid request: Missing required fields"))
      return
    }

    const { sandboxId: projectId, token } = parseQuery.data

    // Verify Clerk token and get user
    if (!isClerkConfigured()) {
      next(new Error("Authentication system not configured"))
      return
    }

    try {
      const { user: clerkUser } = await verifyClerkToken(token)
      const userId = clerkUser.id

      // Fetch user data to verify project access using Drizzle
      const dbUserJSON = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
        with: {
          sandbox: true,
          usersToSandboxes: true,
        },
      })

      if (!dbUserJSON) {
        next(new Error("User not found"))
        return
      }

      // Check if the user owns the project or has shared access
      const project = (dbUserJSON.sandbox as any[])?.find(
        (s: any) => s.id === projectId
      )
      const sharedProjects = (dbUserJSON.usersToSandboxes as any[])?.find(
        (uts: any) => uts.sandboxId === projectId
      )

      // If user doesn't own or have shared access to the project, deny access
      if (!project && !sharedProjects) {
        next(new Error("Unauthorized: No access to this project"))
        return
      }

      // Set socket data with user information
      socket.data = {
        userId,
        projectId,
        isOwner: project !== undefined,
      }

      // Also set Clerk auth data
      socket.auth = {
        userId,
        user: clerkUser,
      }
      // Allow the connection
      next()
    } catch (error) {
      console.error("Token verification failed:", error)
      next(new Error("Authentication failed"))
    }
  } catch (error) {
    console.error("Socket authentication error:", error)
    next(new Error("Internal server error"))
  }
}
