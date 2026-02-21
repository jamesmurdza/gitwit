import type { UIMessage } from "ai"

export interface Message {
  id?: string
  role: "user" | "assistant"
  content: string
  context?: ContextTab[]
  parts?: UIMessage["parts"]
}

export type ContextTab =
  | {
      id: string
      type: "file" | "image"
      name: string
      content: string
    }
  | {
      id: string
      type: "code"
      name: string
      content?: string
      lineRange?: { start: number; end: number }
    }
  | {
      id: string
      type: "text"
      name: string
      content: string
    }

export type FileMergeResult = {
  mergedCode: string
  originalCode: string
}

export type PrecomputeMergeArgs = {
  filePath: string
  code: string
}

export type ApplyMergedFileArgs = FileMergeResult & {
  filePath: string
  displayName?: string
}

export type GetCurrentFileContentFn = (
  filePath: string,
) => Promise<string> | string
