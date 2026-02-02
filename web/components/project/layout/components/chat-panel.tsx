"use client"

import { IGridviewPanelProps } from "dockview"
import { AIChat } from "../../chat"
import type {
  ApplyMergedFileArgs,
  FileMergeResult,
  PrecomputeMergeArgs,
} from "../../chat/lib/types"

export interface ChatPanelParams {
  onApplyCode?: (
    code: string,
    language?: string,
    options?: {
      mergeStatuses?: Record<
        string,
        { status: string; result?: FileMergeResult; error?: string }
      >
      getCurrentFileContent?: (filePath: string) => Promise<string> | string
      getMergeStatus?: (
        filePath: string,
      ) =>
        | { status: string; result?: FileMergeResult; error?: string }
        | undefined
    },
  ) => Promise<void>
  onRejectCode?: () => void
  precomputeMergeForFile?: (
    args: PrecomputeMergeArgs,
  ) => Promise<FileMergeResult>
  applyPrecomputedMerge?: (args: ApplyMergedFileArgs) => Promise<void>
  restoreOriginalFile?: (args: ApplyMergedFileArgs) => Promise<void>
  getCurrentFileContent?: (filePath: string) => Promise<string> | string
  onOpenFile?: (filePath: string) => void
}

export function ChatPanel(props: IGridviewPanelProps<ChatPanelParams>) {
  const {
    onApplyCode,
    onRejectCode,
    precomputeMergeForFile,
    applyPrecomputedMerge,
    restoreOriginalFile,
    getCurrentFileContent,
    onOpenFile,
  } = props.params

  return (
    <div className="h-full bg-background">
      <AIChat
        onApplyCode={onApplyCode}
        onRejectCode={onRejectCode}
        precomputeMergeForFile={precomputeMergeForFile}
        applyPrecomputedMerge={applyPrecomputedMerge}
        restoreOriginalFile={restoreOriginalFile}
        getCurrentFileContent={getCurrentFileContent}
        onOpenFile={onOpenFile}
      />
    </div>
  )
}
