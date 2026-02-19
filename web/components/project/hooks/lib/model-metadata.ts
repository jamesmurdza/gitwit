import type { DiffBlock } from "@/lib/types"
import type * as monaco from "monaco-editor"

interface ModelMetadata {
  originalContent?: string
  mergedContent?: string
  granularBlocks?: DiffBlock[]
  diffDecorationsCollection?: monaco.editor.IEditorDecorationsCollection
}

const modelMetadata = new WeakMap<monaco.editor.ITextModel, ModelMetadata>()

export function getModelMeta(model: monaco.editor.ITextModel): ModelMetadata {
  return modelMetadata.get(model) ?? {}
}

export function setModelMeta(
  model: monaco.editor.ITextModel,
  meta: Partial<ModelMetadata>,
): void {
  modelMetadata.set(model, { ...getModelMeta(model), ...meta })
}

// Editor-level cleanup functions (not model-level)
const editorCleanups = new WeakMap<
  monaco.editor.IStandaloneCodeEditor,
  () => void
>()

export function setEditorCleanup(
  editor: monaco.editor.IStandaloneCodeEditor,
  cleanup: () => void,
): void {
  editorCleanups.set(editor, cleanup)
}

export function getEditorCleanup(
  editor: monaco.editor.IStandaloneCodeEditor | null | undefined,
): (() => void) | undefined {
  if (!editor) return undefined
  return editorCleanups.get(editor)
}
