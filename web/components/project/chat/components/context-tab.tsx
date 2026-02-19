import { Button } from "@/components/ui/button"
import { FileIcon, FileImage, TextIcon, X } from "lucide-react"
import Image from "next/image"
import { memo } from "react"
import { getIconForFile } from "vscode-icons-js"
import { type ContextTab } from "../lib/types"

function ContextTabIcon({ type, name }: { type: string; name: string }) {
  if (type === "code") {
    return (
      <Image
        src={`/icons/${getIconForFile(name)}`}
        alt="File Icon"
        className="size-3.5"
        width={16}
        height={16}
      />
    )
  }
  if (type === "file") return <FileIcon className="size-3.5" />
  if (type === "text") return <TextIcon className="size-3.5" />
  return <FileImage className="size-3.5" />
}

const ContextTab = memo(
  (
    props: ContextTab & {
      removeContext?: (id: string) => void
    }
  ) => {
    const lineRange =
      props.type === "code" && props.lineRange
        ? props.lineRange.start === props.lineRange.end
          ? `${props.lineRange.start}`
          : `${props.lineRange.start}-${props.lineRange.end}`
        : null

    return (
      <div className="flex items-center p-1 gap-1 border-[0.5px] rounded">
        <ContextTabIcon type={props.type} name={props.name} />
        <p className="flex-1 text-xs truncate">
          {props.name}
          {lineRange && (
            <span className="text-muted-foreground">:{lineRange}</span>
          )}
        </p>
        {props.removeContext && (
          <Button
            variant="ghost"
            size="icon"
            className="size-4"
            onClick={() => props.removeContext?.(props.id)}
          >
            <X size={12} />
          </Button>
        )}
      </div>
    )
  }
)

export { ContextTab }
