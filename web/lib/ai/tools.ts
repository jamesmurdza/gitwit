import { tool, jsonSchema } from "ai"
import type { Project } from "@gitwit/lib/services/Project"

interface SerperResponse {
  organic?: Array<{
    title: string
    link: string
    snippet: string
    date?: string
  }>
  searchInformation?: {
    totalResults: number
  }
}

export const webSearchTool = tool({
  description:
    "Search the web for current information using Google search results",
  inputSchema: jsonSchema<{ query: string; maxResults?: number }>({
    type: "object",
    properties: {
      query: { type: "string", description: "The search query to look up" },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return",
      },
    },
    required: ["query"],
  }),
  execute: async ({ query, maxResults = 5 }) => {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          num: maxResults,
        }),
      })

      const data = (await response.json()) as SerperResponse

      const results =
        data.organic?.slice(0, maxResults).map((result) => ({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          publishedDate: result.date,
        })) || []

      return {
        query,
        results,
        totalResults: data.searchInformation?.totalResults || 0,
        searchedAt: new Date().toISOString(),
      }
    } catch (error) {
      return {
        query,
        error: `Search failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        results: [],
        totalResults: 0,
        searchedAt: new Date().toISOString(),
      }
    }
  },
})

/** Create file inspection tools bound to a project's container */
export function createFileTools(project: Project) {
  return {
    readFile: tool({
      description:
        "Read the contents of a file in the project. Use the file path relative to the project root (e.g. 'src/App.tsx', 'package.json').",
      inputSchema: jsonSchema<{ filePath: string }>({
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Relative path to the file from the project root",
          },
        },
        required: ["filePath"],
      }),
      execute: async ({ filePath }) => {
        try {
          const content = await project.fileManager!.getFile(filePath)
          if (content === undefined) {
            return { error: `File not found: ${filePath}` }
          }
          return { filePath, content }
        } catch (error) {
          return {
            error: `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    listFiles: tool({
      description:
        "List all files and folders in the project. Returns the full file tree excluding node_modules.",
      inputSchema: jsonSchema<Record<string, never>>({
        type: "object",
        properties: {},
      }),
      execute: async () => {
        try {
          const tree = await project.fileManager!.getFileTree()
          return { tree }
        } catch (error) {
          return {
            error: `Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    searchFiles: tool({
      description:
        "Search for a text pattern across project files using grep. Returns matching lines with file paths and line numbers.",
      inputSchema: jsonSchema<{
        pattern: string
        fileGlob?: string
      }>({
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The text or regex pattern to search for",
          },
          fileGlob: {
            type: "string",
            description:
              "Optional glob to filter files (e.g. '*.tsx', '*.css'). Defaults to all files.",
          },
        },
        required: ["pattern"],
      }),
      execute: async ({ pattern, fileGlob }) => {
        try {
          const includeFlag = fileGlob ? `--include='${fileGlob}'` : ""
          const result = await project.container!.commands.run(
            `cd /home/user/project && grep -rn ${includeFlag} --exclude-dir=node_modules --exclude-dir=.git -- ${JSON.stringify(pattern)} . | head -50`,
            { timeoutMs: 10000 },
          )
          const matches = result.stdout.trim()
          return {
            pattern,
            matches: matches || "No matches found.",
          }
        } catch (error) {
          return {
            error: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),
  }
}

export const defaultTools = {
  webSearch: webSearchTool,
}
