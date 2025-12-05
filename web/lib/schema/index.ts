import { KNOWN_PLATFORMS } from "@gitwit/db/constants"
import { z } from "zod"

export const editUserSchema = z.object({
  id: z.string().trim(),
  username: z.string().trim().min(1, "Username must be at least 1 character"),
  oldUsername: z.string().trim(),
  name: z.string().trim().min(1, "Name must be at least 1 character").max(80, "Name must be 80 characters or less"),
  bio: z.string().trim().max(200, "Bio must be 200 characters or less").optional(),
  personalWebsite: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || val === "" || /^https?:\/\/.+/.test(val),
      "Personal website must be a valid URL starting with http:// or https://"
    ),
  links: z
    .array(
      z.object({
        url: z.string().trim(),
        platform: z.enum(KNOWN_PLATFORMS),
      })
    )
    .catch([]),
})
export type EditUserSchema = z.infer<typeof editUserSchema>
