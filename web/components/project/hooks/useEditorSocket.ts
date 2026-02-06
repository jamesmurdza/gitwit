import { useContainer } from "@/context/container-context"
import { useSocket } from "@/context/SocketContext"
import { useCallback, useEffect } from "react"
import { toast } from "sonner"

export const useEditorSocket = () => {
  const { socket } = useSocket()
  const { dockRef } = useContainer()

  // Preview URL handler
  const handlePreviewURL = useCallback((url: string) => {
    const previewPanel = dockRef.current?.getPanel("preview")
    if (previewPanel) {
      previewPanel.api.updateParameters({ src: url })
      previewPanel.api.setActive()
      return
    }

    const groups = dockRef.current?.groups
    // If we have exactly one group, split to the right for the preview
    // Otherwise open in default location
    if (groups?.length === 1) {
      dockRef.current?.addPanel({
        id: "preview",
        component: "preview",
        title: "Preview",
        tabComponent: "preview",
        params: { src: url },
        renderer: "always",
        position: {
          referenceGroup: groups[0].id,
          direction: "right",
        },
      })
    } else {
      dockRef.current?.addPanel({
        id: "preview",
        component: "preview",
        title: "Preview",
        renderer: "always",
        tabComponent: "preview",
        params: { src: url },
      })
    }
  }, [])

  // Register socket event listeners
  useEffect(() => {
    if (!socket) return

    const onError = (message: string) => {
      toast.error(message)
    }

    // Register events
    socket.on("error", onError)
    socket.on("previewURL", handlePreviewURL)

    return () => {
      socket.off("error", onError)
      socket.off("previewURL", handlePreviewURL)
    }
  }, [socket, handlePreviewURL])

  return {
    socket,
  }
}
