// Allowed image MIME types
export const ALLOWED_IMAGE_TYPES: string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]

// Allowed file MIME types (includes images)
export const ALLOWED_FILE_TYPES: string[] = [
  // Text files
  "text/plain",
  "text/markdown",
  "text/csv",
  // Code files
  "application/xml",
  "application/toml",
  "application/json",
  "text/javascript",
  "text/typescript",
  "text/html",
  "text/css",
  // Documents
  "application/pdf",
  // Images
  ...ALLOWED_IMAGE_TYPES,
]

export const TEXT_LIKE_MIMES = new Set([
  // text/* is handled by startsWith below, add non-text that are still editable:
  "application/json",
  "application/xml",
  "application/toml",
  "text/javascript",
  "text/markdown",
  "text/csv",
  "image/svg+xml", // treat SVG as text (editable)
  "text/typescript",
])
