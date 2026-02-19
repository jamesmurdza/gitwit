import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { env } from "../env"
import type { AppBindings } from "./types"

export function createRouter<T extends AppBindings = AppBindings>() {
  return new Hono<T>({
    strict: false,
  })
}

export default function createApp() {
  const app = createRouter().basePath("/api")

  // Not Found
  app.notFound((c) => {
    return c.json(
      {
        message: `Route not found - ${c.req.path}`,
      },
      404,
    )
  })

  // Error Handler
  app.onError((err, c) => {
    console.error("Error occurred: ", err)
    const currentStatus =
      "status" in err ? err.status : c.newResponse(null).status
    const statusCode =
      currentStatus !== 200 ? (currentStatus as ContentfulStatusCode) : 500
    return c.json(
      {
        success: false,
        message: err.message,

        stack: env.NODE_ENV === "production" ? undefined : err.stack,
      },
      statusCode,
    )
  })

  return app
}
