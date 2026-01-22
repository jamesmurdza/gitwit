"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "../../ui/button"

export interface EditCodeWidgetProps {
  isSelected: boolean
  showSuggestion: boolean
  onAiEdit: () => void
  suggestionRef: React.MutableRefObject<HTMLDivElement | null>
}

/**
 * Edit Code Widget that appears when text is selected
 * Shows an animated "Edit Code" button with AI capabilities
 *
 * IMPORTANT: The widget container is created imperatively (not via JSX) because
 * Monaco moves the DOM node to its overlay. If React managed this node,
 * it would crash when trying to unmount a node that's no longer in its expected location.
 */
export default function EditCodeWidget({
  isSelected,
  showSuggestion,
  onAiEdit,
  suggestionRef,
}: EditCodeWidgetProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  // Create the container div imperatively on mount
  useEffect(() => {
    const div = document.createElement("div")
    div.className = "relative"
    suggestionRef.current = div
    setContainer(div)

    // Cleanup: remove from DOM if it's still attached somewhere
    return () => {
      suggestionRef.current = null
      if (div.parentNode) {
        div.parentNode.removeChild(div)
      }
    }
  }, [suggestionRef])

  // Don't render anything if container doesn't exist yet
  if (!container) return null

  // Use portal to render content into the imperatively created container
  return createPortal(
    <AnimatePresence>
      {isSelected && showSuggestion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ ease: "easeOut", duration: 0.2 }}
          className="absolute z-50"
        >
          <Button
            size="xs"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAiEdit()
            }}
            className="shadow-md"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Edit Code
          </Button>
        </motion.div>
      )}
    </AnimatePresence>,
    container,
  )
}
