import { Button } from "@/components/ui/button"
import { FileIcon, FileImage, TextIcon, X } from "lucide-react"
import Image from "next/image"
import { memo, useMemo } from "react"
import { getIconForFile } from "vscode-icons-js"
import { type ContextTab } from "../lib/types"

const ContextTab = memo(
  (
    props: ContextTab & {
      removeContext?: (id: string) => void
    }
  ) => {
    const icon = useMemo(() => {
      if (props.type === "code") {
        const imgSrc = `/icons/${getIconForFile(props.name)}`
        return (
          <Image
            src={imgSrc}
            alt="File Icon"
            className="size-3.5"
            width={16}
            height={16}
          />
        )
      } else if (props.type === "file") {
        return <FileIcon className="size-3.5" />
      } else if (props.type === "text") {
        return <TextIcon className="size-3.5" />
      }
      return <FileImage className="size-3.5" />
    }, [props])

    const name = useMemo(() => {
      return props.name
    }, [props.name])

    const lineRange = useMemo(() => {
      if (props.type === "code" && props.lineRange) {
        return props.lineRange.start === props.lineRange.end
          ? `${props.lineRange.start}`
          : `${props.lineRange.start}-${props.lineRange.end}`
      }
      return null
    }, [props.type, (props as any)?.lineRange])

    return (
      <div className="flex items-center p-1 gap-1 border-[0.5px] rounded">
        {icon}
        <p className="flex-1 text-xs truncate">
          {name}
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
