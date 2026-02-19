import { createRouter } from "@/lib/api/create-app"
import { db } from "@gitwit/db"
import {
  sandbox,
  sandboxInsertSchema,
  sandboxLikes,
  sandboxUpdateSchema,
  user,
  UsersToSandboxes,
  usersToSandboxes,
} from "@gitwit/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import z from "zod"

export const projectRouter = createRouter()
  // #region GET /
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        id: z.string().optional(),
      })
    ),
    async (c) => {
      const { id } = c.req.valid("query")
      const userId = c.get("user").id
      if (id) {
        const res = await db.query.sandbox.findFirst({
          where: (sandbox, { eq }) => eq(sandbox.id, id),
          with: {
            usersToSandboxes: true,
          },
        })
        if (!res) {
          return c.json({ success: false, message: "Sandbox not found" }, 404)
        }
        return c.json(
          {
            ...res,
            usersToSandboxes: res.usersToSandboxes as UsersToSandboxes[],
          },
          200
        )
      } else {
        const res = await db.select().from(sandbox).where(
          // check for authed user
          eq(sandbox.userId, userId)
        )
        return c.json(res ?? {}, 200)
      }
    }
  )
  // #endregion

  // #region DELETE /
  .delete(
    "/",
    zValidator(
      "query",
      z.object({
        id: z.string(),
      })
    ),
    async (c) => {
      const { id } = c.req.valid("query")
      await db.delete(sandboxLikes).where(eq(sandboxLikes.sandboxId, id))
      await db
        .delete(usersToSandboxes)
        .where(eq(usersToSandboxes.sandboxId, id))
      await db.delete(sandbox).where(eq(sandbox.id, id))
      return c.json(
        { success: true, message: "Sandbox Deleted successfully" },
        200
      )
    }
  )
  // #endregion

  // #region POST /
  .post(
    "/",
    zValidator(
      "json",
      sandboxInsertSchema.omit({
        userId: true,
      })
    ),
    async (c) => {
      const data = c.req.valid("json")
      const userId = c.get("user").id
      const { type, name, visibility, repositoryId } = data

      const userSandboxes = await db
        .select()
        .from(sandbox)
        .where(eq(sandbox.userId, userId))

      if (userSandboxes.length >= 8) {
        return c.json(
          {
            success: false,
            message: "You reached the maximum # of sandboxes.",
          },
          400
        )
      }

      const sb = (
        await db
          .insert(sandbox)
          .values({
            type,
            name,
            userId,
            visibility,
            createdAt: new Date(),
            repositoryId,
          })
          .returning()
      )[0]

      return c.json(
        {
          success: true,
          message: "Sandbox created successfully",
          data: {
            sandbox: sb,
          },
        },
        200
      )
    }
  )
  // #endregion

  // #region PATCH /
  .patch(
    "/",
    zValidator(
      "json",
      sandboxUpdateSchema.extend({
        id: z.string().meta({
          description: "Unique identifier for the sandbox to be updated",
          example: "sandbox_12345",
        }),
      })
    ),
    async (c) => {
      const data = c.req.valid("json")
      const { id, name, visibility, containerId, repositoryId } = data

      const sb = (
        await db
          .update(sandbox)
          .set({
            name,
            visibility,
            containerId,
            repositoryId,
          })
          .where(eq(sandbox.id, id))
          .returning()
      )[0]

      return c.json(
        {
          success: true,
          message: "Sandbox updated successfully",
          data: {
            sandbox: sb,
          },
        },
        200
      )
    }
  )
  // #endregion

  // #region GET /share
  .get(
    "/share",
    async (c) => {
      const { id } = c.get("user")

      const shared = await db
        .select({
          id: sandbox.id,
          name: sandbox.name,
          type: sandbox.type,
          sharedOn: usersToSandboxes.sharedOn,
          author: user.name,
          authorAvatarUrl: user.avatarUrl,
        })
        .from(usersToSandboxes)
        .innerJoin(sandbox, eq(usersToSandboxes.sandboxId, sandbox.id))
        .innerJoin(user, eq(sandbox.userId, user.id))
        .where(eq(usersToSandboxes.userId, id))

      return c.json(
        {
          success: true,
          message: "Shared sandboxes retrieved successfully",
          data: shared,
        },
        200
      )
    }
  )
  // #endregion

  // #region POST /share
  .post(
    "/share",
    zValidator(
      "json",
      z.object({
        sandboxId: z.string(),
        email: z.string().email(),
      })
    ),
    async (c) => {
      const { sandboxId, email } = c.req.valid("json")

      const user = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.email, email),
        with: {
          sandbox: true,
          usersToSandboxes: true,
        },
      })

      if (!user) {
        return c.json(
          { success: false, message: "No user associated with email." },
          400
        )
      }

      if (
        Array.isArray(user.sandbox) &&
        user.sandbox.find((sb) => sb.id === sandboxId)
      ) {
        return c.json(
          { success: false, message: "Cannot share with yourself!" },
          400
        )
      }

      if (
        Array.isArray(user.usersToSandboxes) &&
        user.usersToSandboxes.find((uts) => uts.sandboxId === sandboxId)
      ) {
        return c.json(
          { success: false, message: "User already has access." },
          400
        )
      }

      await db
        .insert(usersToSandboxes)
        .values({ userId: user.id, sandboxId, sharedOn: new Date() })

      return c.json(
        {
          success: true,
          message: "Sandbox shared successfully",
        },
        200
      )
    }
  )
  // #endregion

  // #region DELETE /share
  .delete(
    "/share",
    zValidator(
      "json",
      z.object({
        sandboxId: z.string(),
        userId: z.string(),
      })
    ),
    async (c) => {
      const { sandboxId, userId } = c.req.valid("json")

      await db
        .delete(usersToSandboxes)
        .where(
          and(
            eq(usersToSandboxes.userId, userId),
            eq(usersToSandboxes.sandboxId, sandboxId)
          )
        )

      return c.json(
        { success: true, message: "Sharing access removed successfully" },
        200
      )
    }
  )
  // #endregion

  // #region POST /like
  .post(
    "/like",
    zValidator(
      "json",
      z.object({
        userId: z.string(),
        sandboxId: z.string(),
      })
    ),
    async (c) => {
      const { userId, sandboxId } = c.req.valid("json")
      // Check if user has already liked
      const existingLike = await db.query.sandboxLikes.findFirst({
        where: (likes, { and, eq }) =>
          and(eq(likes.sandboxId, sandboxId), eq(likes.userId, userId)),
      })

      if (existingLike) {
        // Unlike
        await db
          .delete(sandboxLikes)
          .where(
            and(
              eq(sandboxLikes.sandboxId, sandboxId),
              eq(sandboxLikes.userId, userId)
            )
          )

        await db
          .update(sandbox)
          .set({
            likeCount: sql`${sandbox.likeCount} - 1`,
          })
          .where(eq(sandbox.id, sandboxId))

        return c.json(
          {
            success: true,
            message: "Unlike successful",
            data: {
              liked: false,
            },
          },
          200
        )
      } else {
        // Like
        await db.insert(sandboxLikes).values({
          sandboxId,
          userId,
          createdAt: new Date(),
        })

        await db
          .update(sandbox)
          .set({
            likeCount: sql`${sandbox.likeCount} + 1`,
          })
          .where(eq(sandbox.id, sandboxId))

        return c.json(
          {
            success: true,
            message: "Like successful",
            data: { liked: true },
          },
          200
        )
      }
    }
  )
  // #endregion

  // #region GET /like
  .get(
    "/like",
    zValidator(
      "query",
      z.object({
        sandboxId: z.string(),
        userId: z.string(),
      })
    ),
    async (c) => {
      const { sandboxId, userId } = c.req.valid("query")

      const like = await db.query.sandboxLikes.findFirst({
        where: (likes, { and, eq }) =>
          and(eq(likes.sandboxId, sandboxId), eq(likes.userId, userId)),
      })

      return c.json(
        {
          success: true,
          message: "Like check successful",
          data: { liked: !!like },
        },
        200
      )
    }
  )

// #endregion
