import { AIClient } from "../client"
import { AIRequest } from "../types"

/**
 * Service for merging partial code changes with original code using AI
 * Uses a separate model to intelligently merge partial changes into complete files
 */
export class CodeMerger {
  private aiClient: AIClient

  constructor(aiClient: AIClient) {
    this.aiClient = aiClient
  }

  /**
   * Merges partial code changes with the original file content
   * Uses AI to intelligently apply changes while preserving the original structure
   *
   * @param partialCode - The partial code changes from AI
   * @param originalCode - The original complete file content
   * @param fileName - The name of the file being modified
   * @returns Promise that resolves to the merged complete code
   */
  async mergeCode(
    partialCode: string,
    originalCode: string,
    fileName: string
  ): Promise<string> {
    try {
      const mergeRequest: Partial<AIRequest> = {
        messages: [
          {
            role: "user",
            content: `Merge these partial code changes into the original file:

Partial changes:
${partialCode}

Original complete file:
${originalCode}

Return ONLY the complete merged file with the changes applied. Preserve all existing code structure and formatting.`,
          },
        ],
        mode: "edit",
        context: {
          userId: "system",
          fileName: fileName,
          activeFileContent: originalCode,
        },
      }

      const result = await this.aiClient.processEdit(mergeRequest)
      return result.content
    } catch (error) {
      console.error("Code merge failed:", error)
      // Fallback: return original code if merge fails
      return originalCode
    }
  }

  /**
   * Factory method to create a CodeMerger with a configured AI client
   */
  static async create(userId: string, projectId?: string): Promise<CodeMerger> {
    const aiClient = await AIClient.create({
      userId,
      projectId,
      tools: {}, // No tools needed for merging
      disableTools: true,
    })
    return new CodeMerger(aiClient)
  }
}
