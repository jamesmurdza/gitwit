import { apiClient } from "@/server/client"
import { FileMergeResult } from "../../chat/lib/types"

interface MergeStatusAccessor {
  getMergeStatus?: (
    filePath: string,
  ) => { status: string; result?: FileMergeResult; error?: string } | undefined
}

/**
 * Resolves a merge result by checking precomputed status, polling pending merges,
 * or computing a fresh merge as a fallback.
 */
export async function resolveMergeResult(
  normalizedPath: string,
  code: string,
  fileName: string,
  projectId: string,
  getCurrentFileContent: (filePath: string) => Promise<string>,
  options?: MergeStatusAccessor,
): Promise<FileMergeResult> {
  // 1. Check precomputed status
  const mergeStatus = options?.getMergeStatus?.(normalizedPath)
  if (mergeStatus?.status === "ready" && mergeStatus.result) {
    const currentContent = await getCurrentFileContent(normalizedPath)
    if (currentContent === mergeStatus.result.originalCode) {
      return mergeStatus.result
    }
  }

  // 2. If pending, poll
  if (mergeStatus?.status === "pending" && options?.getMergeStatus) {
    let waited = 0
    while (waited < 10000) {
      await new Promise((r) => setTimeout(r, 100))
      waited += 100
      const updated = options.getMergeStatus(normalizedPath)
      if (updated?.status === "ready" && updated.result) {
        const current = await getCurrentFileContent(normalizedPath)
        if (current === updated.result.originalCode) {
          return updated.result
        }
      }
      if (updated?.status === "error") break
    }
  }

  // 3. Compute fresh merge
  const originalCode = await getCurrentFileContent(normalizedPath)
  const res = await apiClient.ai["merge-code"].$post({
    json: {
      partialCode: code,
      originalCode,
      fileName,
      projectId,
    },
  })
  if (!res.ok) {
    throw new Error("Merge request failed")
  }
  const { mergedCode } = await res.json()
  return { mergedCode, originalCode }
}
