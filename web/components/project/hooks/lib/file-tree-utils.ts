import { FileTree } from "@/lib/api"

/** Remove a node by path, returning the removed node */
export function removeNode(
  nodes: FileTree,
  targetPath: string,
): FileTree[number] | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.id === targetPath) {
      return nodes.splice(i, 1)[0]
    }
    if (node.type === "folder") {
      const removed = removeNode(node.children, targetPath)
      if (removed) return removed
    }
  }
  return null
}

/** Recursively update a node's id (and its subtree) to live under `newParentPath` */
export function rebaseNodeIds<
  N extends {
    id: string
    name: string
    type: "file" | "folder"
    children?: N[]
  },
>(node: N, newParentPath: string): N {
  const parent = newParentPath === "/" ? "" : newParentPath.replace(/\/$/, "")

  const newId = `${parent}/${node.name}`

  if (node.type === "folder" && Array.isArray(node.children)) {
    return {
      ...node,
      id: newId,
      children: node.children.map((child) => rebaseNodeIds(child, newId)),
    } as N
  }

  return {
    ...node,
    id: newId,
  } as N
}

/** Insert a node into a folder (or root if folderPath is "/") */
export function insertNode(
  nodes: FileTree,
  folderPath: string,
  nodeToInsert: FileTree[number],
): boolean {
  if (folderPath === "/") {
    nodes.push(nodeToInsert)
    return true
  }

  for (const node of nodes) {
    if (node.type === "folder") {
      if (node.id === folderPath) {
        node.children.push(nodeToInsert)
        return true
      }
      if (insertNode(node.children, folderPath, nodeToInsert)) {
        return true
      }
    }
  }

  return false
}
