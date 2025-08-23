import { fileRouter } from "@/lib/api"
import { TFile, TFolder } from "@/lib/types"
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
}) => {
  let contextMessage: string[] = []
  if (contextTabs.length === 0) return ""
  const codeContextTabs = contextTabs.filter((tab) => tab.type === "code")

  const remainingContextTabs = contextTabs.filter((tab) => tab.type !== "code")
  remainingContextTabs.forEach((tab) => {
    if (tab.type === "file") {
      const cleanContent = tab.content
        .replace(/^```[\w-]*\n/, "")
        .replace(/\n```$/, "")
      const fileExt = tab.name.split(".").pop() || "txt"
      contextMessage.push(
        `File ${tab.name}:\n\`\`\`${fileExt}\n${cleanContent}\n\`\`\``
      )
    } else {
      contextMessage.push(`Image ${tab.name}:\n${tab.content}`)
    }
  })
  const getCodeContents = codeContextTabs.map((c) => {
    const draftContent = drafts[c.id]
    // Check the draft first
    if (draftContent !== undefined) {
      contextMessage.push(
        `Code from ${c.id}:\n\`\`\`typescript\n${draftContent}\n\`\`\``
      )
      return Promise.resolve()
    }
    // Check query cache next, then finally fetch it not available
    return queryClient
      .ensureQueryData(
        fileRouter.fileContent.getOptions({
          fileId: c.id,
          projectId: projectId,
        })
      )
      .then((data) => {
        contextMessage.push(
          `Code from ${c.id}:\n\`\`\`typescript\n${data.data}\n\`\`\``
        )
      })
  })
  // Fetch all content in parallel for speed
  await Promise.all(getCodeContents)

  return contextMessage.join("\n\n")
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
export { getAllFiles, getCombinedContext, stringifyContent }
