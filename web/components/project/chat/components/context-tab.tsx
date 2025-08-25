import { Button } from "@/components/ui/button"
import { FileIcon, FileImage, X } from "lucide-react"
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
        return <Image src={imgSrc} alt="File Icon" width={16} height={16} />
      } else if (props.type === "file") {
        return <FileIcon className="size-4" />
      }
      return <FileImage className="size-4" />
    }, [props])
    return (
      <div className="flex items-center p-1 gap-1 border-[0.5px] rounded max-w-[140px]">
        {icon}
        <p className="flex-1 text-xs truncate">{props.name}</p>
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
