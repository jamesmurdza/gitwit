import { cn } from "@/lib/utils"
import Image from "next/image"
import type { ReactNode } from "react"
import { getIconForFile } from "vscode-icons-js"

const DEFAULT_FILE_ICON = "/icons/default_file.svg"

interface CodeBlockHeaderProps {
  language: string
  filename?: string
  filePath?: string | null
  isNewFile?: boolean
  onOpenFile?: (filePath: string) => void
  children: ReactNode
}

export const CodeBlockHeader = ({
  language,
  filename,
  filePath,
  isNewFile,
  onOpenFile,
  children,
}: CodeBlockHeaderProps) => {
  const displayName = filename ?? language
  const iconSrc = filename
    ? `/icons/${getIconForFile(filename)}`
    : DEFAULT_FILE_ICON
  const isClickable = Boolean(filePath && onOpenFile)

  return (
    <div
      className="flex items-center justify-between gap-2 bg-muted/80 px-2 py-1 text-muted-foreground text-xs"
      data-language={language}
      data-streamdown="code-block-header"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {filename && (
          <Image
            src={iconSrc}
            alt=""
            width={14}
            height={14}
            className="shrink-0"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_FILE_ICON
            }}
          />
        )}
        {isClickable ? (
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              try {
                await onOpenFile?.(filePath!)
              } catch (err) {
                console.error("Error opening file:", err)
              }
            }}
            className={cn(
              "ml-1 truncate font-mono lowercase hover:underline hover:text-foreground",
            )}
          >
            {displayName}
          </button>
        ) : (
          <span className="ml-1 font-mono lowercase">{displayName}</span>
        )}
        {isNewFile && (
          <span
            className={cn(
              "shrink-0 rounded bg-green-500/20 px-1.5 py-0.5 font-medium text-green-600 text-[10px] dark:text-green-400",
            )}
          >
            new
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}
