import { TFile, TFolder, TTab } from "@/lib/types"
import { TemplateConfig } from "@gitwit/templates"
import * as monaco from "monaco-editor"
import { Socket } from "socket.io-client"

// Message interface
export interface Message {
  role: "user" | "assistant"
  content: string
  context?: ContextTab[]
}

// Context tab interface
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
      lineRange?: { start: number; end: number }
    }

// AIChat props interface
export interface AIChatProps {
  activeFileContent: string
  activeFileName: string
  onClose: () => void
  editorRef: React.MutableRefObject<
    monaco.editor.IStandaloneCodeEditor | undefined
  >
  lastCopiedRangeRef: React.MutableRefObject<{
    startLine: number
    endLine: number
  } | null>
  templateType: string
  templateConfig?: TemplateConfig
  projectName: string
  handleApplyCode: (mergedCode: string, originalCode: string) => void
  mergeDecorationsCollection?: monaco.editor.IEditorDecorationsCollection
  setMergeDecorationsCollection?: (collection: undefined) => void
  selectFile: (tab: TTab) => void
  tabs: TTab[]
  projectId: string
  files: TFile[]
}

// Chat input props interface
export interface ChatInputProps {
  input: string
  setInput: (input: string) => void
  isGenerating: boolean
  handleSend: (useFullContext?: boolean) => void
  handleStopGeneration: () => void
  onImageUpload: (file: File) => void
  addContextTab: (
    type: "file" | "code" | "image",
    title: string,
    content: string,
    lineRange?: { start: number; end: number }
  ) => void
  activeFileName?: string
  editorRef: React.MutableRefObject<
    monaco.editor.IStandaloneCodeEditor | undefined
  >
  lastCopiedRangeRef: React.MutableRefObject<{
    startLine: number
    endLine: number
  } | null>
  contextTabs: {
    id: string
    type: string
    title: string
    content: string
    lineRange?: { start: number; end: number }
  }[]
  onRemoveTab: (id: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

// Chat message props interface
export interface MessageProps {
  message: {
    role: "user" | "assistant"
    content: string
    context?: string
  }
  setContext: (
    context: string | null,
    name: string,
    range?: { start: number; end: number }
  ) => void
  setIsContextExpanded: (isExpanded: boolean) => void
  socket: Socket | null
  handleApplyCode: (mergedCode: string, originalCode: string) => void
  activeFileName: string
  activeFileContent: string
  editorRef: any
  mergeDecorationsCollection?: monaco.editor.IEditorDecorationsCollection
  setMergeDecorationsCollection?: (collection: undefined) => void
  selectFile: (tab: TTab) => void
  tabs: TTab[]
  projectId: string
  templateType?: string
  projectName?: string
}

// Context tabs props interface
export interface ContextTabsProps {
  activeFileName: string
  onAddFile: (tab: ContextTab) => void
  contextTabs: ContextTab[]
  onRemoveTab: (id: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
  files?: (TFile | TFolder)[]
  onFileSelect?: (file: TFile) => void
  socket: Socket | null
}
