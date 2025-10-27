import { TIERS } from "@/lib/tiers"
import { Badge } from "./badge"
import { Button } from "./button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card"
import { Info, Sparkles } from "lucide-react"
import { Progress } from "./progress"

export default function SubscriptionBadge({
    generations,
    tier = "FREE",
  }: {
    generations: number
    tier?: keyof typeof TIERS
  }) {
    return (
      <div className="flex gap-2 items-center">
        <Badge variant="secondary" className="text-sm cursor-pointer">
          {tier}
        </Badge>
        <HoverCard>
          <HoverCardTrigger>
            <Button variant="ghost" size="smIcon" className="size-[26px]">
              <Info size={16} />
            </Button>
          </HoverCardTrigger>
          <HoverCardContent>
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">AI Generations</span>
                <span>{`${generations} / ${TIERS[tier].generations}`}</span>
              </div>
              <Progress
                value={generations}
                max={TIERS[tier].generations}
                className="w-full"
              />
            </div>
            <Button size="sm" className="w-full mt-4">
              <Sparkles className="mr-2 h-4 w-4" /> Upgrade to Pro
            </Button>
          </HoverCardContent>
        </HoverCard>
      </div>
    )
  }
  // #endregion