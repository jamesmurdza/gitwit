import { Loader2 } from "lucide-react"
import { useFormStatus } from "react-dom"
import { Button } from "./button"

export default function SubmitButton({
  isPending,
  disabled = false,
}: {
  isPending: boolean
  disabled?: boolean
}) {
  const formStatus = useFormStatus()
  const { pending } = formStatus
  const pend = pending || isPending

  return (
    <Button
      size="sm"
      type="submit"
      className="w-full mt-2"
      disabled={pend || disabled}
    >
      {pend && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  )
}
