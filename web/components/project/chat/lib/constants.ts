// Allowed image MIME types
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const

// Allowed file MIME types (includes images)
export const ALLOWED_FILE_TYPES = [
  // Text files
  "text/plain",
  "text/markdown",
  "text/csv",
  // Code files
  "application/json",
  "text/javascript",
  "text/typescript",
  "text/html",
  "text/css",
  // Documents
  "application/pdf",
  // Images
  ...ALLOWED_IMAGE_TYPES,
] as const
