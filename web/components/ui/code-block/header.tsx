import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface CodeBlockHeaderProps {
  language: string
  filename?: string
  isNewFile?: boolean
  children: ReactNode
}

export const CodeBlockHeader = ({
  language,
  filename,
  isNewFile,
  children,
}: CodeBlockHeaderProps) => (
  <div
    className="flex items-center justify-between gap-2 bg-muted/80 px-2 py-1 text-muted-foreground text-xs"
    data-language={language}
    data-streamdown="code-block-header"
  >
    <div className="flex items-center gap-2">
      <span className="ml-1 font-mono lowercase">{filename ?? language}</span>
      {isNewFile && (
        <span
          className={cn(
            "rounded bg-green-500/20 px-1.5 py-0.5 font-medium text-green-600 text-[10px] dark:text-green-400",
          )}
        >
          new
        </span>
      )}
    </div>
    <div className="flex items-center gap-1">{children}</div>
  </div>
)
