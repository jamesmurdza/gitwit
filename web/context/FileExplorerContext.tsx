"use client"

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react"

type CreationType = "file" | "folder" | null

interface FileExplorerContextValue {
  /** The currently active/focused folder path (where new files/folders will be created) */
  activeFolderPath: string
  /** Set the active folder path */
  setActiveFolderPath: (path: string) => void
  /** What type of item is being created (file, folder, or null if nothing) */
  creationType: CreationType
  /** Start creating a new file or folder */
  startCreating: (type: "file" | "folder") => void
  /** Stop/cancel creation mode */
  stopCreating: () => void
}

const FileExplorerContext = createContext<FileExplorerContextValue | null>(null)

export function FileExplorerProvider({ children }: { children: ReactNode }) {
  // Root path "/" is the default active folder
  const [activeFolderPath, setActiveFolderPath] = useState<string>("/")
  const [creationType, setCreationType] = useState<CreationType>(null)

  const startCreating = useCallback((type: "file" | "folder") => {
    setCreationType(type)
  }, [])

  const stopCreating = useCallback(() => {
    setCreationType(null)
  }, [])

  return (
    <FileExplorerContext.Provider
      value={{
        activeFolderPath,
        setActiveFolderPath,
        creationType,
        startCreating,
        stopCreating,
      }}
    >
      {children}
    </FileExplorerContext.Provider>
  )
}

export function useFileExplorer() {
  const ctx = useContext(FileExplorerContext)
  if (!ctx) {
    throw new Error(
      "useFileExplorer must be used within a FileExplorerProvider",
    )
  }
  return ctx
}

// #region Utilities
/** Characters that are not allowed in file/folder names */
const INVALID_CHARS = /[<>:"|?*\x00-\x1F]/

/** Reserved names on Windows */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i

interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validates a file or folder name/path.
 * Supports nested paths like "hello/world.tsx" or "src/components/"
 *
 * @param name - The name or path to validate
 * @param type - Whether this is a file or folder
 * @returns Validation result with error message if invalid
 */
export function validateName(
  name: string,
  type: "file" | "folder",
): ValidationResult {
  // Trim whitespace
  const trimmed = name.trim()

  if (!trimmed) {
    return { isValid: false, error: "Name cannot be empty" }
  }

  // Split into path segments
  const segments = trimmed.split("/").filter(Boolean)

  if (segments.length === 0) {
    return { isValid: false, error: "Name cannot be empty" }
  }

  // Validate each segment
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLastSegment = i === segments.length - 1
    const segmentType = isLastSegment ? type : "folder"

    const result = validateSegment(segment, segmentType)
    if (!result.isValid) {
      return result
    }
  }

  return { isValid: true }
}

/**
 * Validates a single path segment (file or folder name)
 */
function validateSegment(
  segment: string,
  type: "file" | "folder",
): ValidationResult {
  if (!segment) {
    return { isValid: false, error: "Name cannot be empty" }
  }

  if (segment.length > 255) {
    return { isValid: false, error: "Name is too long (max 255 characters)" }
  }

  if (INVALID_CHARS.test(segment)) {
    return {
      isValid: false,
      error: 'Name contains invalid characters: < > : " | ? *',
    }
  }

  if (RESERVED_NAMES.test(segment)) {
    return { isValid: false, error: `"${segment}" is a reserved name` }
  }

  if (segment.startsWith(" ") || segment.endsWith(" ")) {
    return {
      isValid: false,
      error: "Name cannot start or end with spaces",
    }
  }

  if (segment.endsWith(".")) {
    return { isValid: false, error: "Name cannot end with a period" }
  }

  // For files, check if there's a reasonable extension pattern
  if (type === "file" && segment.startsWith(".") && segment.length === 1) {
    return { isValid: false, error: "Invalid file name" }
  }

  return { isValid: true }
}

/**
 * Normalizes a path by:
 * - Trimming whitespace
 * - Removing trailing slashes (except for root)
 * - Removing leading slashes
 * - Collapsing multiple slashes
 */
export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\/+/g, "/") // Collapse multiple slashes
    .replace(/^\//, "") // Remove leading slash
    .replace(/\/$/, "") // Remove trailing slash
}

/**
 * Combines a base folder path with a relative name/path
 *
 * @param basePath - The base folder path (e.g., "/src/components" or "/")
 * @param relativePath - The relative path to append (e.g., "Button.tsx" or "ui/Button.tsx")
 * @returns The combined full path (e.g., "/src/components/Button.tsx")
 */
export function combinePaths(basePath: string, relativePath: string): string {
  const normalizedBase = basePath === "/" ? "" : basePath.replace(/\/$/, "")
  const normalizedRelative = normalizePath(relativePath)

  return `${normalizedBase}/${normalizedRelative}`
}

/**
 * Extracts the parent folder path from a file/folder path
 *
 * @param path - The full path (e.g., "/src/components/Button.tsx")
 * @returns The parent folder path (e.g., "/src/components") or "/" for root-level items
 */
export function getParentPath(path: string): string {
  const lastSlashIndex = path.lastIndexOf("/")
  if (lastSlashIndex <= 0) {
    return "/"
  }
  return path.substring(0, lastSlashIndex)
}

// #endregion
