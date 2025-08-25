"use client"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fileRouter } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  ArrowUp,
  Check,
  CheckIcon,
  ChevronDown,
  FileCode2,
  FileImage,
  FileUp,
  Paperclip,
  Square,
} from "lucide-react"
import { nanoid } from "nanoid"
import Image from "next/image"
import { useParams } from "next/navigation"
import React, {
  createContext,
  KeyboardEventHandler,
  useContext,
  useRef,
  useState,
} from "react"
import { getIconForFile } from "vscode-icons-js"
import { Button } from "../../../ui/button"
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_IMAGE_TYPES,
  TEXT_LIKE_MIMES,
} from "../lib/constants"
import { getAllFiles } from "../lib/utils"
import { useChat } from "../providers/chat-provider"

type ChatInputContextType = {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  disabled?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

const ChatInputContext = createContext<ChatInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
  textareaRef: React.createRef<HTMLTextAreaElement>(),
})

function useChatInput() {
  const context = useContext(ChatInputContext)
  if (!context) {
    throw new Error("useChatInput must be used within a ChatInput")
  }
  return context
}

type ChatInputProps = {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
}

function ChatInput({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  children,
}: ChatInputProps) {
  const [internalValue, setInternalValue] = useState(value || "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  return (
    <ChatInputContext.Provider
      value={{
        isLoading,
        value: value ?? internalValue,
        setValue: onValueChange ?? handleChange,
        maxHeight,
        onSubmit,
        textareaRef,
      }}
    >
      <form
        className={cn(
          "border-input bg-background cursor-text border rounded p-2 shadow-xs",
          className
        )}
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit?.()
        }}
      >
        {children}
      </form>
    </ChatInputContext.Provider>
  )
}

export type ChatInputTextareaProps = {
  disableAutosize?: boolean
} & React.ComponentProps<typeof Textarea>

function ChatInputTextarea({
  className,
  onKeyDown,
  disableAutosize = false,
  ...props
}: ChatInputTextareaProps) {
  const { value, setValue, isLoading, disabled, textareaRef } = useChatInput()

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    onKeyDown?.(e)
    if (e.key === "Enter") {
      // Don't submit if IME composition is in progress
      if (e.nativeEvent.isComposing) {
        return
      }
      if (e.shiftKey) {
        // Allow newline
        return
      }
      e.preventDefault()
      if (isLoading) {
        // Don't submit or add a new line while loading
        return
      }
      // Submit on Enter (without Shift)
      const form = e.currentTarget.form
      if (form) {
        form.requestSubmit()
      }
    }
  }

  return (
    <Textarea
      ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full resize-none rounded-none border-none px-2 py-3 shadow-none outline-none ring-0",
        "field-sizing-content max-h-[6lh] bg-transparent dark:bg-transparent",
        "focus-visible:ring-0",
        className
      )}
      rows={1}
      disabled={disabled}
      {...props}
    />
  )
}

type ChatInputActionBarProps = React.HTMLAttributes<HTMLDivElement>

function ChatInputActionBar({
  children,
  className,
  ...props
}: ChatInputActionBarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  )
}

type ChatInputActionsProps = React.HTMLAttributes<HTMLDivElement>

function ChatInputActions({
  children,
  className,
  ...props
}: ChatInputActionsProps) {
  return (
    <div className={cn("flex-1 flex items-center gap-1", className)} {...props}>
      {children}
    </div>
  )
}

export interface ChatInputActionProps
  extends React.ComponentProps<typeof Button> {
  className?: string
  tooltip?: React.ReactNode
  children: React.ReactNode
}

function ChatInputAction({
  tooltip,
  children,
  className,
  ...props
}: ChatInputActionProps) {
  const { disabled } = useChatInput()

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger
          asChild
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
        >
          <Button size="icon" className={cn("h-8 w-8", className)} {...props}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Button disabled={disabled} className={cn("", className)} {...props}>
      {children}
    </Button>
  )
}

// #region Custom Chat Actions
function ChatInputSubmit() {
  const { disabled, isLoading, onSubmit } = useChatInput()
  return (
    <ChatInputAction
      tooltip={isLoading ? "Stop generation" : "Send message"}
      onClick={onSubmit}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <Square className="size-5 fill-current" />
      ) : (
        <ArrowUp className="size-5" />
      )}
    </ChatInputAction>
  )
}
const models = [
  {
    value: "gpt-4",
    label: "GPT-4",
  },
  {
    value: "gpt-3.5",
    label: "GPT-3.5",
  },
  {
    value: "llama-3",
    label: "Llama 3",
  },
  {
    value: "gemini",
    label: "Gemini",
  },
  {
    value: "mistral",
    label: "Mistral",
  },
]

function ChatInputModelSelect() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(models[0].value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          size="sm"
          aria-expanded={open}
          className="gap-2 max-w-[180px]"
        >
          <span className="truncate">
            {value
              ? models.find((model) => model.value === value)?.label
              : "Select models..."}
          </span>
          <ChevronDown size={16} className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search models..." className="h-9" />
          <CommandList>
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.value}
                  value={model.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue)
                    setOpen(false)
                  }}
                >
                  {model.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === model.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
function ChatInputContextMenu() {
  const { id: projectId } = useParams<{ id: string }>()
  const { contextTabs, addContextTab } = useChat()
  const { data: fileTree = [] } = fileRouter.fileTree.useQuery({
    variables: {
      projectId,
    },
    select(data) {
      return data.data ?? []
    },
  })
  const [contextOpenMenu, setContextOpenMenu] = useState(false)
  const codeContextTabs = React.useMemo(
    () => contextTabs.filter((tab) => tab.type === "code"),
    [contextTabs]
  )
  const files = React.useMemo(() => getAllFiles(fileTree), [fileTree])
  const handleFileUpload: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = ALLOWED_FILE_TYPES.join(",")
    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = () => {
          addContextTab({
            id: nanoid(),
            type: "file",
            name: file.name,
            content: reader.result as string,
          })
          setContextOpenMenu(false)
        }
        if (TEXT_LIKE_MIMES.has(file.type)) {
          reader.readAsDataURL(file)
        } else {
          reader.readAsDataURL(file)
        }
      }
    }
    fileInput.click()
  }
  const handleImageUpload: React.MouseEventHandler<HTMLDivElement> = (
    event
  ) => {
    event.preventDefault()
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = ALLOWED_IMAGE_TYPES.join(",")
    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = () => {
          addContextTab({
            id: nanoid(),
            type: "image",
            name: file.name,
            content: reader.result as string,
          })
          setContextOpenMenu(false)
        }
        if (TEXT_LIKE_MIMES.has(file.type)) {
          reader.readAsDataURL(file)
        } else {
          reader.readAsDataURL(file)
        }
      }
    }
    fileInput.click()
  }
  return (
    <DropdownMenu open={contextOpenMenu} onOpenChange={setContextOpenMenu}>
      <DropdownMenuTrigger asChild>
        <ChatInputAction variant="outline" tooltip={"Add context"}>
          <Paperclip className="size-4" />
        </ChatInputAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Add ...</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem className="gap-2" onClick={handleImageUpload}>
            <FileImage size={16} />
            <span className="truncate"> Images</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={handleFileUpload}>
            <FileUp size={16} />
            <span className="truncate">Files</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <FileCode2 size={16} />
              <span className="truncate">File context</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              collisionPadding={8}
              hideWhenDetached
              className="p-0"
            >
              <Command className="h-[250px]">
                <CommandInput
                  placeholder="Filter filters..."
                  autoFocus={true}
                  className="h-9"
                />
                <CommandList>
                  <CommandEmpty>No label found.</CommandEmpty>
                  <CommandGroup>
                    {files.map((file) => {
                      const imgSrc = `/icons/${getIconForFile(file.name)}`
                      const isSelected = codeContextTabs.some(
                        (tab) => tab.name === file.name
                      )
                      return (
                        <CommandItem
                          key={file.id}
                          value={file.name}
                          onSelect={() => {
                            addContextTab({
                              id: file.id,
                              type: "code",
                              name: file.name,
                            })
                          }}
                        >
                          <Image
                            src={imgSrc}
                            alt="File Icon"
                            width={16}
                            height={16}
                            className="mr-1"
                          />
                          <span className="">{file.name}</span>
                          {isSelected && (
                            <CheckIcon size={16} className="ml-auto" />
                          )}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
// #endregion

export {
  ChatInput,
  ChatInputAction,
  ChatInputActionBar,
  ChatInputActions,
  ChatInputContextMenu,
  ChatInputModelSelect,
  ChatInputSubmit,
  ChatInputTextarea,
}
