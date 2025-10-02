import { AIRequest } from "../types"

/**
 * Prompt builder class that generates context-aware system prompts for AI interactions
 * Supports different modes (chat, edit, generate) and project templates
 *
 * @example
 * ```typescript
 * const builder = new PromptBuilder()
 * const prompt = builder.build({
 *   mode: "chat",
 *   context: { templateType: "nextjs", userId: "user123" },
 *   messages: []
 * })
 * ```
 */
export class PromptBuilder {
  /**
   * Builds a system prompt based on the AI request mode and context
   *
   * @param request - AI request object containing mode and context information
   * @returns Generated system prompt string tailored to the request
   */
  build(request: AIRequest): string {
    const { mode } = request

    switch (mode) {
      case "edit":
        return this.buildEditPrompt(request)
      case "chat":
      default:
        return this.buildChatPrompt(request)
    }
  }

  /**
   * Builds a chat-oriented system prompt with project context and conventions
   * Includes template-specific information when available
   *
   * @param request - AI request object with chat context
   * @returns System prompt optimized for conversational AI interactions
   */
  private buildChatPrompt(request: AIRequest): string {
    const { context } = request
    const templateConfig = context.templateType && context.templateConfigs
      ? context.templateConfigs[context.templateType]
      : null
    
    let prompt = `You are an intelligent programming assistant for a ${
      context.templateType || "web"
    } project.`

    if (templateConfig) {
      prompt += `
      
Project Template: ${templateConfig.name}

Conventions:
${templateConfig.conventions.join("\n")}

Dependencies:
${JSON.stringify(templateConfig.dependencies, null, 2)}

Scripts:
${JSON.stringify(templateConfig.scripts, null, 2)}
`
    }

    if (context.activeFileContent) {
      prompt += `\n\nActive File Content:\n${context.activeFileContent}`
    }
    if (context.contextContent) {
      prompt += `\n\nAdditional Context(selected files):\n${context.contextContent}`
    }

    prompt += `

Please respond concisely. When providing code:
1. Format it using triple backticks with the appropriate language identifier
2. CRITICAL: Always specify the complete file path relative to the project root
3. For new files, add "(new file)" after the path
4. Before any code block, include a line like "File: /path/to/file.ext" to indicate which file the code belongs to
5. Keep responses brief and to the point`

    return prompt
  }

  /**
   * Builds an edit-focused system prompt for code modification tasks
   * Emphasizes minimal context and precise code changes
   *
   * @param request - AI request object with edit context
   * @returns System prompt optimized for code editing operations
   */
  private buildEditPrompt(request: AIRequest): string {
    const { context } = request

    return `You are a code editor AI. Your task is to generate ONLY the code needed for the edit.

Rules:
- Return ONLY code, no explanations
- Include minimal context (few lines before/after changes)
- Use comments to indicate where unchanged code is skipped
- Preserve the exact formatting and style of the existing code
- If multiple edits are needed, show them in order of appearance

Current file: ${context.fileName || "unknown"}
${context.activeFileContent ? `\nFile content:\n${context.activeFileContent}` : ""}`
  }
}
