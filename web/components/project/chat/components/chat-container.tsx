"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditor } from "@/context/editor-context"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import { AnimatePresence, motion } from "framer-motion"
import {
  BrainIcon,
  ChevronDown,
  FoldHorizontal,
  MaximizeIcon,
  MinimizeIcon,
} from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from "react"
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom"
// #region ContainerRoot
interface ChatContainerContextValue {
  maximized: boolean
  toggleMaximized: () => void
}
const ChatContainerContext = createContext<
  ChatContainerContextValue | undefined
>(undefined)

const useChatContainerContext = () => {
  const context = useContext(ChatContainerContext)
  if (!context) {
    throw new Error(
      "useChatContainerContext must be used within a ChatContainerProvider",
    )
  }
  return context
}

function withViewTransition(fn: () => void) {
  if (document.startViewTransition) {
    document.startViewTransition(fn)
  } else {
    fn()
  }
}

export type ChatContainerRootProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

function ChatContainerRoot({
  children,
  className,
  style,
  ...props
}: ChatContainerRootProps) {
  const [maximized, setMaximized] = useState(false)
  const toggleMaximized = useCallback(() => {
    withViewTransition(() => setMaximized((prev) => !prev))
  }, [])

  useEffect(() => {
    // when escape is pressed, toggle preview maximize state
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !(event.target as HTMLElement)?.matches(
          "input, textarea, [contenteditable]",
        )
      ) {
        withViewTransition(() => setMaximized(false))
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <ChatContainerContext.Provider value={{ maximized, toggleMaximized }}>
      <AnimatePresence>
        {maximized && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="fixed inset-0 z-20 bg-background/10"
            transition={{ duration: 0.3 }}
            onClick={toggleMaximized}
          />
        )}
      </AnimatePresence>
      <div
        className={cn(
          "chat-container-transition flex flex-col bg-background",
          maximized
            ? "fixed inset-4 z-50 rounded-lg shadow-[0_0_0_1px_hsl(var(--muted-foreground)_/_0.4)]"
            : "h-full",
          className,
        )}
        style={style}
        {...props}
      >
        {children}
      </div>
    </ChatContainerContext.Provider>
  )
}
// #endregion

// #region Container
export type ChatScrollContainerProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

function ChatScrollContainer({
  children,
  className,
  ...props
}: ChatScrollContainerProps) {
  return (
    <StickToBottom
      className={cn("flex overflow-y-hidden", className)}
      resize="smooth"
      initial="instant"
      role="log"
      {...props}
    >
      {children}
    </StickToBottom>
  )
}

//  #endregion

// #region ContainerContent
export type ChatContainerContentProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

function ChatContainerContent({
  children,
  className,
  ...props
}: ChatContainerContentProps) {
  return (
    <StickToBottom.Content
      className={cn("flex w-full flex-col", className)}
      {...props}
    >
      {children}
    </StickToBottom.Content>
  )
}
// #endregion

// #region ContainerScrollAnchor
export type ChatContainerScrollAnchorProps = {
  className?: string
  ref?: React.RefObject<HTMLDivElement>
} & React.HTMLAttributes<HTMLDivElement>

function ChatContainerScrollAnchor({
  className,
  ...props
}: ChatContainerScrollAnchorProps) {
  return (
    <div
      className={cn("h-px w-full shrink-0 scroll-mt-4", className)}
      aria-hidden="true"
      {...props}
    />
  )
}
// #endregion

// #region Header
function ChatContainerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex justify-between items-center text-center sm:text-left px-3 py-2 sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  )
}

// #endregion

// #region Title
function ChatContainerTitle({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("font-medium leading-none tracking-tight", className)}
      style={{ viewTransitionName: "chat-container-title", ...style }}
      {...props}
    />
  )
}
// #endregion

// #region Actions
function ChatContainerActions({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex space-x-2", className)}
      style={{ viewTransitionName: "chat-container-actions" }}
      {...props}
    />
  )
}
// #endregion

// #region Action
export interface ChatContainerActionProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  label: string
  asChild?: boolean
}

function ChatContainerAction({
  className,
  label,
  variant = "ghost",
  size = "smIcon",
  asChild = false,
  style,
  ...props
}: ChatContainerActionProps) {
  const Comp = asChild ? Slot : "button"
  const id = useId()
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <Comp
          className={cn(
            buttonVariants({ variant, size, className }),
            "h-6 w-6",
          )}
          style={{ viewTransitionName: `chat-action-${id}`, ...style }}
          onFocus={(e: React.FocusEvent) => e.preventDefault()}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}
// #endregion

// #region Footer
function ChatContainerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />
}
// #endregion

// #region Empty
type ChatContainerEmptyProps = {
  onSuggestionClick?: (text: string) => void
} & React.HTMLAttributes<HTMLDivElement>

const SUGGESTIONS = [
  "Explain how this code works",
  "Help me fix a bug",
  "Add a new feature",
  "Refactor this file",
]

function ChatContainerEmpty({
  className,
  onSuggestionClick,
  ...props
}: ChatContainerEmptyProps) {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col justify-center items-center gap-5 px-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-center size-10 rounded-full bg-muted">
        <BrainIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="text-center space-y-1.5">
        <h2 className="text-base font-semibold">How can I help?</h2>
        <p className="text-muted-foreground text-sm max-w-[240px]">
          Ask me anything about your project or try a suggestion below.
        </p>
      </div>
      {onSuggestionClick && (
        <div className="flex flex-wrap justify-center gap-2 max-w-sm">
          {SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onSuggestionClick(text)}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
// #region Custom Acions

export type ScrollButtonProps = {
  className?: string
  variant?: VariantProps<typeof buttonVariants>["variant"]
  size?: VariantProps<typeof buttonVariants>["size"]
} & React.ButtonHTMLAttributes<HTMLButtonElement>

function ScrollButton({
  className,
  variant = "outline",
  size = "sm",
  ...props
}: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "h-10 w-10 rounded-full transition-all duration-150 ease-out",
        !isAtBottom
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-4 scale-95 opacity-0",
        className,
      )}
      onClick={() => scrollToBottom()}
      {...props}
    >
      <ChevronDown className="h-5 w-5" />
    </Button>
  )
}

export function ChatContainerCollapse() {
  const { gridRef } = useEditor()
  function toggleAIChat() {
    const panel = gridRef.current?.getPanel("chat")
    panel?.api.setVisible(!panel.api.isVisible)
  }
  const { maximized } = useChatContainerContext()

  return (
    <ChatContainerAction
      disabled={maximized}
      label="Collapse chat"
      onClick={toggleAIChat}
    >
      <FoldHorizontal size={16} />
    </ChatContainerAction>
  )
}
function ChatContainerMaximizeToggle() {
  const { maximized: maximize, toggleMaximized: toggleMaximize } =
    useChatContainerContext()
  return (
    <ChatContainerAction
      label={maximize ? "Minimize" : "Maximize"}
      onClick={toggleMaximize}
    >
      {maximize ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
    </ChatContainerAction>
  )
}

// #endregion Settings

export {
  ChatContainerAction,
  ChatContainerActions,
  ChatContainerContent,
  ChatContainerEmpty,
  ChatContainerFooter,
  ChatContainerHeader,
  ChatContainerMaximizeToggle,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
  ChatContainerTitle,
  ChatScrollContainer,
  ScrollButton,
}
