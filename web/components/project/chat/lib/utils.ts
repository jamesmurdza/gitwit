import { fileRouter } from "@/lib/api"
import { TFile, TFolder } from "@/lib/types"
import { processFileType } from "@/lib/utils"
import { EditorSlice } from "@/store/slices/editor"
import { QueryClient } from "@tanstack/react-query"
import * as React from "react"
import { ignoredFiles, ignoredFolders } from "./ignored-paths"
import { ContextTab } from "./types"

// Get all files from the file tree to search for context
const getAllFiles = (items: (TFile | TFolder)[]): TFile[] => {
  if (!items || !Array.isArray(items)) {
    return []
  }

  return items.reduce((acc: TFile[], item) => {
    // Add file if it's not ignored
    if (item.type === "file") {
      const isIgnored = ignoredFiles.some((pattern: string) => {
        if (pattern.includes("*")) {
          // Handle glob patterns properly
          const regex = new RegExp(pattern.replace(/\*/g, ".*"))
          return regex.test(item.name)
        }
        return item.name === pattern
      })

      if (!isIgnored) {
        acc.push(item)
      }
    } else if (item.type === "folder") {
      // Check if folder should be ignored
      const isIgnoredFolder = ignoredFolders.some(
        (folder: string) => folder === item.name
      )

      if (!isIgnoredFolder && item.children && Array.isArray(item.children)) {
        acc.push(...getAllFiles(item.children))
      }
    }

    return acc
  }, [])
}

const formatLineInfo = (lineRange?: { start: number; end: number }): string => {
  if (!lineRange) return ""
  return lineRange.start === lineRange.end
    ? ` (line ${lineRange.start})`
    : ` (lines ${lineRange.start}-${lineRange.end})`
}

const processCodeContext = async ({
  tab,
  queryClient,
  projectId,
  drafts,
}: {
  tab: ContextTab & { type: "code" }
  queryClient: QueryClient
  projectId: string
  drafts: EditorSlice["drafts"]
}): Promise<string> => {
  const lineInfo = formatLineInfo(tab.lineRange)
  const language = processFileType(tab.name)
  if (tab.content) {
    return `Code from ${tab.name}${lineInfo}:\n\`\`\`${language}\n${tab.content}\n\`\`\``
  }

  const draftContent = drafts[tab.id]
  if (draftContent !== undefined) {
    return `Code from ${tab.name}${lineInfo}:\n\`\`\`${language}\n${draftContent}\n\`\`\``
  }

  try {
    const data = await queryClient.ensureQueryData(
      fileRouter.fileContent.getOptions({
        fileId: tab.id,
        projectId: projectId,
      })
    )
    return `Code from ${tab.name}${lineInfo}:\n\`\`\`${language}\n${data.data}\n\`\`\``
  } catch (error) {
    console.error(`Failed to fetch content for ${tab.name}:`, error)
    return `Code from ${tab.name}${lineInfo}: [Failed to load content]`
  }
}

const getCombinedContext = async ({
  contextTabs,
  queryClient,
  projectId,
  drafts,
}: {
  contextTabs: ContextTab[]
  queryClient: QueryClient
  projectId: string
  drafts: EditorSlice["drafts"]
}): Promise<string> => {
  if (contextTabs.length === 0) return ""

  const contextMessages: string[] = []

  const codeContextTabs = contextTabs.filter(
    (tab): tab is ContextTab & { type: "code" } => tab.type === "code"
  )
  const textContextTabs = contextTabs.filter(
    (tab): tab is ContextTab & { type: "text" } => tab.type === "text"
  )
  const fileContextTabs = contextTabs.filter(
    (tab): tab is ContextTab & { type: "file" } => tab.type === "file"
  )
  const imageContextTabs = contextTabs.filter(
    (tab): tab is ContextTab & { type: "image" } => tab.type === "image"
  )

  if (codeContextTabs.length > 0) {
    const codeContexts = await Promise.all(
      codeContextTabs.map((tab) =>
        processCodeContext({ tab, queryClient, projectId, drafts })
      )
    )
    contextMessages.push(...codeContexts)
  }

  textContextTabs.forEach((tab) => {
    contextMessages.push(
      `Text snippet ${tab.name}:\n\`\`\`text\n${tab.content}\n\`\`\``
    )
  })

  fileContextTabs.forEach((tab) => {
    const cleanContent = tab.content
      .replace(/^```[\w-]*\n/, "")
      .replace(/\n```$/, "")
    const fileExt = tab.name.split(".").pop() || "txt"
    contextMessages.push(
      `File ${tab.name}:\n\`\`\`${fileExt}\n${cleanContent}\n\`\`\``
    )
  })

  imageContextTabs.forEach((tab) => {
    contextMessages.push(`Image ${tab.name}:\n${tab.content}`)
  })

  return contextMessages.join("\n\n")
}

/**
 * Convert any content to a string representation
 * Handles React elements, objects, arrays, and circular references
 */
const stringifyContent = (content: any, seen = new WeakSet()): string => {
  // Handle primitive types
  if (typeof content === "string") return content
  if (content == null) return String(content)
  if (typeof content === "number" || typeof content === "boolean") {
    return content.toString()
  }
  if (typeof content === "function") return content.toString()
  if (typeof content === "symbol") return content.toString()
  if (typeof content === "bigint") return content.toString() + "n"

  // Handle React elements
  if (React.isValidElement(content)) {
    return React.Children.toArray(
      (content as React.ReactElement).props.children
    )
      .map((child) => stringifyContent(child, seen))
      .join("")
  }

  // Handle arrays
  if (Array.isArray(content)) {
    return (
      "[" + content.map((item) => stringifyContent(item, seen)).join(", ") + "]"
    )
  }

  // Handle objects
  if (typeof content === "object") {
    if (seen.has(content)) return "[Circular]"
    seen.add(content)
    try {
      const pairs = Object.entries(content).map(
        ([key, value]) => `${key}: ${stringifyContent(value, seen)}`
      )
      return "{" + pairs.join(", ") + "}"
    } catch (error) {
      return Object.prototype.toString.call(content)
    }
  }

  return String(content)
}

/**
 * Normalize a path by trimming and converting backslashes to forward slashes.
 */
const normalizePath = (p?: string | null): string =>
  p ? p.trim().replace(/\\/g, "/") : ""

/**
 * Check whether a normalized path corresponds to a given tab (by id or name).
 */
const pathMatchesTab = (
  path: string,
  tab?: { id?: string; name?: string }
): boolean => {
  if (!tab?.id || !tab?.name) return false
  return (
    path === tab.id ||
    path.endsWith(tab.id) ||
    path === tab.name ||
    path.endsWith(tab.name)
  )
}

function shouldTreatAsContext(text: string) {
  const long = text.length > 400
  const paragraphs = text.split("\n").length > 2
  const markdown = /[#>*`]|-{2,}|```/.test(text)
  const code = /(function|\{|}|\(|\)|=>|class )/.test(text)
  const lists = /^[0-9]+\./m.test(text) || /^[-*•]\s/m.test(text)

  return long || paragraphs || markdown || code || lists
}

export {
  formatLineInfo,
  getAllFiles,
  getCombinedContext,
  normalizePath,
  pathMatchesTab,
  processCodeContext,
  shouldTreatAsContext,
  stringifyContent
}


export function findPanelByPath(
  dockApi: { getPanel: (id: string) => { api: { setActive: () => void } } | undefined; panels: { id: string }[] } | null,
  filePath: string
): { api: { setActive: () => void } } | undefined {
  if (!dockApi?.panels?.length) return undefined
  const normalized = normalizePath(filePath)
  const exact = dockApi.getPanel(normalized)
  if (exact) return exact
  
  const found = dockApi.panels.find((p) =>
    pathMatchesTab(normalized, {
      id: p.id,
      name: p.id.split("/").pop() || p.id,
    })
  )
  return found ? dockApi.getPanel(found.id) : undefined
}

