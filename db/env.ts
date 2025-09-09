import "zod-openapi/extend" // For extending the Zod schema with OpenAPI properties

export const env = {
  // Server-side environment variables
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID as string,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET as string,
  E2B_API_KEY: process.env.E2B_API_KEY as string,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY as string,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,
  DATABASE_URL: process.env.DATABASE_URL as string,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY as string,
  NODE_ENV:
    (process.env.NODE_ENV as "development" | "production" | "test") ||
    "development",

  // Client-side environment variables
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env
    .NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL as string,
  NEXT_PUBLIC_SERVER_URL:
    process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/sign-up",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || "/sign-in",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || "/sign-up",
}
