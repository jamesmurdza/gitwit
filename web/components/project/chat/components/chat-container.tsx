"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditorLayout } from "@/context/EditorLayoutContext"
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
  SettingsIcon,
} from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
      "useChatContainerContext must be used within a ChatContainerProvider"
    )
  }
  return context
}
export type ChatContainerRootProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

function ChatContainerRoot({
  children,
  className,
  ...props
}: ChatContainerRootProps) {
  const [maximized, setMaximized] = useState(false)
  const toggleMaximized = useCallback(
    () => document.startViewTransition(() => setMaximized((prev) => !prev)),
    []
  )
  useEffect(() => {
    // when escape is pressed, toggle preview maximize state
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !(event.target as HTMLElement)?.matches(
          "input, textarea, [contenteditable]"
        )
      ) {
        document.startViewTransition(() => setMaximized(false))
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
          "flex flex-col bg-background",
          maximized
            ? "fixed inset-4 z-50 rounded-lg shadow-[0_0_0_1px_hsl(var(--muted-foreground)_/_0.4)]"
            : "h-full",
          className
        )}
        style={{
          viewTransitionName: "chat-container",
        }}
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
        "flex justify-between items-center text-center sm:text-left p-2 sticky top-0 border-b border-border",
        className
      )}
      {...props}
    />
  )
}

// #endregion

// #region Title
function ChatContainerTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("font-medium leading-none tracking-tight", className)}
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
  return <div className={cn("flex space-x-2", className)} {...props} />
}
// #endregion

// #region Action
export interface ChatContainerActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
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
  ...props
}: ChatContainerActionProps) {
  const Comp = asChild ? Slot : "button"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Comp
          className={cn(
            buttonVariants({ variant, size, className }),
            "h-6 w-6"
          )}
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
function ChatContainerEmpty({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col justify-center items-center gap-3",
        className
      )}
      {...props}
    >
      <BrainIcon className="size-8" />
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold">Ask about your sandbox.</h2>
        <p className="text-muted-foreground text-sm">
          Get help with your coding questions.
        </p>
      </div>
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
        className
      )}
      onClick={() => scrollToBottom()}
      {...props}
    >
      <ChevronDown className="h-5 w-5" />
    </Button>
  )
}

export function ChatContainerCollapse() {
  const { toggleAIChat } = useEditorLayout()
  const { maximized } = useChatContainerContext()
  if (maximized) {
    return null
  }
  return (
    <ChatContainerAction label="Collapse chat" onClick={toggleAIChat}>
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
