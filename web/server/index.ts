import createApp from "@/lib/api/create-app"
import { clerkAuth } from "./middlewares/clerkAuth"
import { apiKeysRouter } from "./routes/api-keys"
import { fileRouter } from "./routes/file"
import { githubRouter } from "./routes/github"
import { projectRouter } from "./routes/project"
import { openUserRouter, userRouter } from "./routes/user"

const app = createApp()
  .route("/user", openUserRouter)
  .use(clerkAuth)
  .route("/user", userRouter)
  .route("/project", projectRouter)
  .route("/file", fileRouter)
  .route("/github", githubRouter)
  .route("/api-keys", apiKeysRouter)

export type AppType = typeof app

export default app
