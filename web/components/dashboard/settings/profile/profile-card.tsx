import Avatar from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import StatsItem from "@/components/ui/stats-item"
import SubscriptionBadge from "@/components/ui/subscription-badge"
import { socialIcons } from "@/lib/data"
import { TIERS } from "@/lib/tiers"
import { SandboxWithLiked, UserLink } from "@/lib/types"
import { Globe, Heart, Package2 } from "lucide-react"
import { useMemo } from "react"

export default function ProfileCard({
  name,
  username,
  avatarUrl,
  sandboxes,
  joinedDate,
  generations,
  bio,
  personalWebsite,
  socialLinks = [],
  tier,
}: {
  name: string
  username: string
  avatarUrl: string | null
  bio: string | null
  personalWebsite: string | null
  socialLinks: UserLink[]
  sandboxes: SandboxWithLiked[]
  joinedDate: Date
  generations?: number
  tier: string
}) {
  const joinedAt = useMemo(() => {
    const date = new Date(joinedDate).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })
    return `Joined ${date}`
  }, [joinedDate])

  const stats = useMemo(() => {
    const totalSandboxes = sandboxes.length
    const totalLikes = sandboxes.reduce(
      (sum, sandbox) => sum + sandbox.likeCount,
      0
    )

    return {
      sandboxes:
        totalSandboxes === 1 ? "1 sandbox" : `${totalSandboxes} sandboxes`,
      likes: totalLikes === 1 ? "1 like" : `${totalLikes} likes`,
    }
  }, [sandboxes])

  return (
    <Card className="mb-6 md:mb-0 sticky top-6">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-2 items-center w-full max-w-full overflow-hidden">
          <Avatar name={name} avatarUrl={avatarUrl} className="size-36" />
          <div className="space-y-1 w-full max-w-full px-2">
            <CardTitle className="text-2xl text-center break-words">{name}</CardTitle>
            <CardDescription className="text-center break-words">{`@${username}`}</CardDescription>
          </div>
          {bio && <p className="text-sm text-center break-words px-2 w-full max-w-full">{bio}</p>}
          {((Array.isArray(socialLinks) && socialLinks.length > 0) ||
            personalWebsite) && (
            <div className="flex gap-2 justify-center">
              {personalWebsite && (
                <Button variant="secondary" size="smIcon" asChild>
                  <a
                    href={personalWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="size-4" />
                    <span className="sr-only">Personal Website</span>
                  </a>
                </Button>
              )}
              {Array.isArray(socialLinks) &&
                socialLinks.map((link, index) => {
                  const Icon = socialIcons[link.platform]
                  return (
                    <Button
                      key={index}
                      variant="secondary"
                      size="smIcon"
                      asChild
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon className="size-4" />
                        <span className="sr-only">{link.platform}</span>
                      </a>
                    </Button>
                  )
                })}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 items-center">
          {typeof generations === "number" && (
            <div className="flex justify-center">
              <SubscriptionBadge
                generations={generations}
                tier={tier as keyof typeof TIERS}
              />
            </div>
          )}
          <div className="flex gap-4">
            <StatsItem icon={Package2} label={stats.sandboxes} />
            <StatsItem icon={Heart} label={stats.likes} />
          </div>
        </div>
        <p className="text-xs mt-2 text-muted-foreground text-center">
          {joinedAt}
        </p>
      </CardContent>
    </Card>
  )
}
