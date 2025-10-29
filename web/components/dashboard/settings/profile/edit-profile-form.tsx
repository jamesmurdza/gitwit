"use client"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import SubmitButton from "@/components/ui/submit-button"
import { Textarea } from "@/components/ui/textarea"
import { updateUser } from "@/lib/api/actions"
import { socialIcons } from "@/lib/data"
import { editUserSchema, EditUserSchema } from "@/lib/schema"
import { UserLink } from "@/lib/types"
import { cn, parseSocialLink } from "@/lib/utils"
import { useRouter } from "@bprogress/next/app"
import { useUser } from "@clerk/nextjs"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { useActionState, useEffect, useRef, useTransition } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"

export default function EditProfileForm(props: {
  name: string
  username: string
  avatarUrl: string | null
  bio: string | null
  personalWebsite: string | null
  socialLinks: UserLink[]
  toggleEdit: () => void
}) {
  const router = useRouter()
  const { user } = useUser()
  const formRef = useRef<HTMLFormElement>(null)
  const [formState, formAction] = useActionState(updateUser, {
    message: "",
  })
  const [isPending, startTransition] = useTransition()
  const { name, username, bio, personalWebsite, socialLinks, toggleEdit } =
    props
  const form = useForm<EditUserSchema>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      oldUsername: username,
      id: user?.id,
      name,
      username,
      bio: bio ?? "",
      personalWebsite: personalWebsite ?? "",
      links:
        socialLinks.length > 0
          ? socialLinks
          : [{ url: "", platform: "generic" }],
      ...(formState.fields ?? {}),
    },
  })
  const { fields, append, remove } = useFieldArray({
    name: "links",
    control: form.control,
  })
  useEffect(() => {
    const message = formState.message
    if (!Boolean(message)) return
    if ("error" in formState) {
      toast.error(formState.message)
      return
    }
    toast.success(formState.message as String)
    toggleEdit()
    if (formState?.newRoute) {
      router.replace(formState.newRoute)
    }
  }, [formState])
  return (
    <Form {...form}>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={(evt) => {
          evt.preventDefault()
          form.handleSubmit(() => {
            startTransition(() => {
              formAction(new FormData(formRef.current!))
            })
          })(evt)
        }}
        className="space-y-3 w-full"
      >
        <input type="hidden" name="id" value={user?.id || ""} />
        <input type="hidden" name="oldUsername" value={username || ""} />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="marie doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>User name</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    className="peer ps-6"
                    type="text"
                    placeholder="Username"
                    {...field}
                  />
                  <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-2 text-sm text-muted-foreground peer-disabled:opacity-50">
                    @
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="hi, I love building things!"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="personalWebsite"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Website</FormLabel>
              <FormControl>
                <Input placeholder="https://chillguy.dev" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`links.${index}`}
              render={({ field: { onChange, value, ...field } }) => {
                const Icon = socialIcons[value.platform] ?? socialIcons.generic
                return (
                  <FormItem>
                    <FormLabel className={cn(index !== 0 && "sr-only")}>
                      Social Links
                    </FormLabel>
                    <FormDescription className={cn(index !== 0 && "sr-only")}>
                      Add links to your blogs or social media profiles.
                    </FormDescription>
                    <FormControl>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            {...field}
                            className="peer ps-9"
                            value={value.url}
                            onChange={(e) =>
                              onChange(parseSocialLink(e.currentTarget.value))
                            }
                          />
                          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
                            <Icon
                              size={16}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                        <Button
                          size="smIcon"
                          type="button"
                          variant="secondary"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => append({ url: "", platform: "generic" })}
          >
            Add URL
          </Button>
        </div>
        <SubmitButton
          isPending={isPending}
          disabled={!form.formState.isDirty}
        />
      </form>
    </Form>
  )
}
