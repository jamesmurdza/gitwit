/**
 * Formats a file tree structure into a visual tree representation using box-drawing characters
 *
 * @param files - Array of file objects with name and optional children properties
 * @param depth - Current depth in the tree (default: 0)
 * @param maxDepth - Maximum depth to traverse (default: 3)
 * @param isLast - Whether this is the last item in its parent's children array
 * @param prefix - Accumulated prefix string for indentation and connectors
 * @returns Formatted string representation of the file tree
 *
 * @example
 * ```typescript
 * const tree = [
 *   { name: "src", children: [
 *     { name: "index.ts", children: [] },
 *     { name: "utils.ts", children: [] }
 *   ]},
 *   { name: "package.json", children: [] }
 * ]
 * console.log(formatFileTree(tree))
 * // Output:
 * // ├─ src/
 * // │ ├─ index.ts
 * // │ └─ utils.ts
 * // └─ package.json
 * ```
 */
export function formatFileTree(
  files: any[],
  depth = 0,
  maxDepth = 3,
  isLast = true,
  prefix = ""
): string {
  if (!files || depth > maxDepth) return ""

  return files
    .map((file: any, index: number) => {
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
            file.children,
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
