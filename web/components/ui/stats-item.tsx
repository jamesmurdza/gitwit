import { LucideIcon } from "lucide-react"

export interface StatsItemProps {
    icon: LucideIcon
    label: string
  }
  
  export default function StatsItem({ icon: Icon, label }: StatsItemProps) {
    return (
      <div className="flex items-center gap-2">
      <Icon size={16} />
      <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      )
}
  