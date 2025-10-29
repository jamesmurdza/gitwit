import { AIRequest } from "../types"
import { formatFileTree } from "./file-tree-formatter"

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
    const templateConfig =
      context.templateType && context.templateConfigs
        ? context.templateConfigs[context.templateType]
        : null

    let prompt = `You are an intelligent programming assistant for a ${
      context.templateType || "web"
    } project.`

    if (templateConfig) {
      prompt += `
File Tree:
${formatFileTree(context.fileTree || [])}

Conventions:
${templateConfig.conventions.join("\n")}
`
    }

    if (context.activeFileContent) {
      prompt += `\n\nActive File Content:\n${context.activeFileContent}`
    }
    if (context.contextContent) {
      prompt += `\n\nAdditional Context(selected files):\n${context.contextContent}`
    }

    prompt += `

🚨 CRITICAL INSTRUCTION: When providing code changes, show ONLY the modified sections, not the entire file.

MANDATORY Rules for code changes:
1. Show only the lines that need to be changed
2. Include a few lines of context before and after the changes for clarity
3. 🚨 ALWAYS use comments like "// ... existing code ..." to indicate unchanged sections in code even when unchanged code is boiler plate code similar to example formats.
4. For deletions: Use comments like "// REMOVED: [description of what was removed]" to indicate deleted code
5. For additions: Use comments like "// NEW: [description of what was added]" to indicate new code
6. Format using triple backticks with the appropriate language identifier
7. CRITICAL: Always specify the complete file path relative to the project root
8. For new files, add "(new file)" after the path
9. Before any code block, include a line like "File: /path/to/file.ext" to indicate which file the code belongs to
10. Keep responses brief and to the point

🚨 NEVER show complete files. ALWAYS use "// ... existing code ..." comments for unchanged sections.

Example format for additions:
File: /src/components/Button.tsx
\`\`\`tsx
// ... existing imports ...

export function Button({ onClick, children }: ButtonProps) {
  // ... existing code ...
  const handleClick = () => {
    console.log('Button clicked'); // NEW: Added logging
    onClick?.();
  };
  // ... existing code ...
}
\`\`\`

Example format for deletions:
File: /src/components/Button.tsx
\`\`\`tsx
// ... existing imports ...

export function Button({ onClick, children }: ButtonProps) {
  // ... existing code ...
  // REMOVED: Old handleClick function with console.log
  const handleClick = () => {
    onClick?.();
  };
  // ... existing code ...
}
\`\`\`

For HTML files, use:
\`\`\`html
// ... existing code ...
<head>
  // ... existing code ...
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  // ... existing code ...
</head>
// ... existing code ...
\`\`\``

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
${
  context.activeFileContent
    ? `\nFile content:\n${context.activeFileContent}`
    : ""
}`
  }
}
