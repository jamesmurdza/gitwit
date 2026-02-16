import { AIRequest } from "../types"
import { formatFileTree } from "./file-tree-formatter"

/**
 * Builds a system prompt based on the AI request mode and context.
 */
export function buildPrompt(request: AIRequest): string {
  switch (request.mode) {
    case "edit":
      return buildEditPrompt(request)
    case "chat":
    default:
      return buildChatPrompt(request)
  }
}

function buildChatPrompt(request: AIRequest): string {
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

🚨 CRITICAL INSTRUCTION: When providing code changes, show ONLY the modified sections, not the entire file. Use the **aider diff** format with search/replace blocks inside code blocks.

MANDATORY Rules for code changes:
- Format using triple backticks with the appropriate language identifier
- CRITICAL: Always specify the complete file path relative to the project root
- For new files, add "(new file)" after the path
- Before any code block, include a line like "File: /path/to/file.ext" to indicate which file the code belongs to
- Keep responses brief and to the point
- Use aider diff format: \`<<<<<<< SEARCH\` / \`=======\` / \`>>>>>>> REPLACE\` blocks inside code blocks
- If multiple search/replace blocks are for the same file, group them in the same code block
- For NEW FILES: Use an empty SEARCH block (just \`<<<<<<< SEARCH\` followed immediately by \`=======\`) and put the entire file content in the REPLACE block

🚨 NEVER show complete files for EXISTING files. ALWAYS use "// ... existing code ..." comments for unchanged sections.
🚨 For NEW FILES: Show the complete file content in the REPLACE block with an empty SEARCH block.

Example format for additions:
File: /src/components/Button.tsx
\`\`\`tsx
<<<<<<< SEARCH
export function Button({ onClick, children }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>
}
=======
export function Button({ onClick, children }: ButtonProps) {
  const handleClick = () => {
    console.log('Button clicked'); // NEW: Added logging
    onClick?.();
  };
  return <button onClick={handleClick}>{children}</button>
}
>>>>>>> REPLACE
\`\`\`

Example format for deletions:
File: /src/components/Button.tsx
\`\`\`tsx
<<<<<<< SEARCH
export function Button({ onClick, children }: ButtonProps) {
  const handleClick = () => {
    console.log('Button clicked');
    onClick?.();
  };
  return <button onClick={handleClick}>{children}</button>
}
=======
export function Button({ onClick, children }: ButtonProps) {
  const handleClick = () => {
    onClick?.();
  };
  return <button onClick={handleClick}>{children}</button>
}
>>>>>>> REPLACE
\`\`\`

Example for multiple changes in the same file (grouped in one code block):
File: /src/components/Button.tsx
\`\`\`tsx
<<<<<<< SEARCH
export function Button({ onClick, children }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>
}
=======
export function Button({ onClick, children }: ButtonProps) {
  const handleClick = () => {
    console.log('Button clicked');
    onClick?.();
  };
  return <button onClick={handleClick}>{children}</button>
}
>>>>>>> REPLACE

<<<<<<< SEARCH
  return <button onClick={handleClick}>{children}</button>
=======
  return <button onClick={handleClick} className="btn-primary">{children}</button>
>>>>>>> REPLACE
\`\`\`

For HTML files, use:
File: /index.html
\`\`\`html
<<<<<<< SEARCH
  <title>My App — Page Title</title>
=======
  <title>My App — Testing Code</title>
>>>>>>> REPLACE
\`\`\`

Example for NEW FILES (empty SEARCH block):
File: /src/utils/helpers.ts (new file)
\`\`\`ts
<<<<<<< SEARCH
=======
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
>>>>>>> REPLACE
\`\`\``

  return prompt
}

function buildEditPrompt(request: AIRequest): string {
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

/**
 * @deprecated Use buildPrompt() instead. Kept for backward compat.
 */
export class PromptBuilder {
  build(request: AIRequest): string {
    return buildPrompt(request)
  }
}
