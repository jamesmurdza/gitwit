export const CodeBlockSkeleton = () => (
  <div className="w-full divide-y divide-border overflow-hidden rounded-xl border border-border">
    <div className="px-2 py-1 w-full bg-muted/80 flex gap-2 justify-between">
      <div className="h-4 rounded-md bg-muted-foreground w-7" />
      <div className="flex items-center gap-1">
        <div className="rounded-md size-7 bg-muted-foreground"></div>
        <div className="rounded-md size-7 bg-muted-foreground"></div>
      </div>
    </div>
    <div className="space-y-2 p-4">
      <div className="h-3 bg-muted rounded-md w-3/4 animate-pulse" />
      <div className="h-3 bg-muted rounded-md w-full animate-pulse" />
      <div className="h-3 bg-muted rounded-md w-5/6 animate-pulse" />
      <div className="h-3 bg-muted rounded-md w-2/3 animate-pulse" />
      <div className="h-3 bg-muted rounded-md w-4/5 animate-pulse" />
    </div>
  </div>
)
