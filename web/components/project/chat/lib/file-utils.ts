import { extractFilePathFromCode } from "@/lib/utils"
import { Message } from "./types"
import { normalizePath } from "./utils"

export type GeneratedFile = {
  id: string
  name: string
  path: string
  additions: number
  code?: string
}

const HARDCODED_ADDITIONS = 3

export function getDisplayName(path: string) {
  const normalized = normalizePath(path)
  const parts = normalized.split("/")
  return parts[parts.length - 1] || normalized
}

export function stripCodeFence(codeBlock: string) {
  return codeBlock.replace(/^```[\w-]*\s*\n?/, "").replace(/```\s*$/, "")
}

export function extractFilesFromMarkdown(markdown: string): {
  path: string
  code?: string
}[] {
  if (!markdown) return []

  const files: Array<{ path: string; code?: string }> = []
  const codeBlockFileMap = new Map<string, string>()
  const codeBlockRegex = /```[\s\S]*?```/g
  let match
  let previousCodeBlockEnd = 0

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const codeBlock = match[0]
    const code = stripCodeFence(codeBlock)
    if (!code.trim()) continue

    // Pass the index of where this code block starts in the markdown
    const codeBlockIndex = match.index
    const filePath = extractFilePathFromCode(
      code,
      markdown,
      codeBlockFileMap,
      codeBlockIndex,
      previousCodeBlockEnd
    )
    if (filePath) {
      const normalized = normalizePath(filePath)
      files.push({ path: normalized, code })
    }

    // Update previous code block end position
    previousCodeBlockEnd = match.index + match[0].length
  }

  if (files.length === 0) {
    const filePattern = /File:\s*([^\n]+)/gi
    const seenPaths = new Set<string>()
    let fallbackMatch
    while ((fallbackMatch = filePattern.exec(markdown)) !== null) {
      const cleanPath = fallbackMatch[1]
        .replace(/\s*\(new file\)\s*$/i, "")
        .trim()
      if (cleanPath) {
        const normalized = normalizePath(cleanPath)
        if (!seenPaths.has(normalized)) {
          seenPaths.add(normalized)
          files.push({ path: normalized })
        }
      }
    }
  }

  return files
}

export function extractFilesFromMessages(messages: Message[]): {
  files: GeneratedFile[]
  sourceKey: string | null
} {
  if (!messages.length) return { files: [], sourceKey: null }

  const latestAssistant = [...messages]
    .reverse()
    .find(
      (message) => message.role === "assistant" && !!message.content?.trim()
    )

  if (!latestAssistant?.content) return { files: [], sourceKey: null }

  const files = extractFilesFromMarkdown(latestAssistant.content).map(
    ({ path, code }) => ({
      id: path,
      path,
      name: getDisplayName(path),
      code,
      additions: HARDCODED_ADDITIONS,
    })
  )

  return { files, sourceKey: latestAssistant.content }
}
