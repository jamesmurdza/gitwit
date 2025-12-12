import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ArrowDown, ArrowUp, CheckCheck, X } from "lucide-react"

interface DiffNavigationWidgetProps {
  onAcceptAll: () => void
  onRejectAll: () => void
  onNext: () => void
  onPrev: () => void
}

export function DiffNavigationWidget({
  onAcceptAll,
  onRejectAll,
  onNext,
  onPrev,
}: DiffNavigationWidgetProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 bg-background border rounded-md shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1 border-r pr-1 mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={onAcceptAll}
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Accept All</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={onRejectAll}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject All</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPrev}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous Change</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNext}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next Change</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
