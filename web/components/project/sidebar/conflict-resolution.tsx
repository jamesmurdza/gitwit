"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConflictResolutionProps } from "@/lib/types"
import { Check } from "lucide-react"

function ConflictSection({
  label,
  buttonLabel,
  content,
  isSelected,
  onSelect,
}: {
  label: string
  buttonLabel: string
  content: string
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={`flex-1 border rounded p-2 bg-background ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-xs">{label}</span>
        <Button
          size="xs"
          variant={isSelected ? "default" : "outline"}
          onClick={onSelect}
        >
          {isSelected && <Check className="inline mr-1" size={14} />}
          {buttonLabel}
        </Button>
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto border bg-muted/10 p-2 rounded">
        {content.slice(0, 1000) || (
          <span className="text-muted-foreground">(empty)</span>
        )}
      </pre>
    </div>
  )
}

export function ConflictResolution({
  conflictFiles,
  fileResolutions,
  onFileResolutionChange,
  onResolve,
  onCancel,
  open,
  pendingPull,
}: ConflictResolutionProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {conflictFiles.length} file{conflictFiles.length !== 1 ? "s" : ""}{" "}
            have conflicts. Please resolve each one.
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-8">
            {conflictFiles.map((file, idx) => {
              const resolution =
                fileResolutions[idx]?.resolutions?.[0]?.resolution
              return (
                <div
                  key={file.path}
                  className="border rounded-lg p-4 bg-muted/40"
                >
                  <div className="font-semibold mb-2 text-sm">{file.path}</div>
                  <div className="flex flex-col md:flex-row gap-4">
                    <ConflictSection
                      label="Local"
                      buttonLabel="Keep Local"
                      content={file.localContent}
                      isSelected={resolution === "local"}
                      onSelect={() => onFileResolutionChange(idx, "local")}
                    />
                    <ConflictSection
                      label="Incoming"
                      buttonLabel="Use Incoming"
                      content={file.incomingContent}
                      isSelected={resolution === "incoming"}
                      onSelect={() => onFileResolutionChange(idx, "incoming")}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-4 border-t bottom-0 bg-background z-10 mt-4">
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={onResolve} disabled={pendingPull}>
            Resolve All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
