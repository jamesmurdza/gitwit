import type { FileTreeNode } from "../types"

/**
 * Formats a file tree structure into a visual tree representation using box-drawing characters.
 */
export function formatFileTree(
  files: FileTreeNode[],
  depth = 0,
  maxDepth = 3,
  isLast = true,
  prefix = ""
): string {
  if (!files || depth > maxDepth) return ""

  return files
    .map((file, index) => {
      const isLastItem = index === files.length - 1
      const connector = isLastItem ? "└─ " : "├─ "
      const childPrefix = prefix + (isLastItem ? "  " : "│ ")

      const hasChildren =
        file.children && file.children.length > 0 && depth < maxDepth
      let result = `${prefix}${connector}${file.name}${hasChildren ? "/" : ""}`

      if (hasChildren) {
        result +=
          "\n" +
          formatFileTree(
            file.children!,
            depth + 1,
            maxDepth,
            isLastItem,
            childPrefix
          )
      }

      return result
    })
    .join("\n")
}
