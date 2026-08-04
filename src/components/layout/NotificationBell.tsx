import * as React from "react"
import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { Bell, Check, Search } from "lucide-react"
import { useNotifications } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Notification } from "@/types"

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [unreadOnly, setUnreadOnly] = React.useState(false)

  const filtered = notifications.filter((n) => {
    if (unreadOnly && n.is_read) return false
    if (search && !`${n.title} ${n.message ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id)
    if (n.action_url) {
      navigate(n.action_url)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border/60 p-3">
          <span className="font-display text-sm font-semibold">Notifications</span>
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} disabled={unreadCount === 0}>
            <Check className="size-3.5" /> Mark all read
          </Button>
        </div>
        <div className="flex items-center gap-2 border-b border-border/60 p-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="h-8 pl-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant={unreadOnly ? "default" : "outline"}
            className="h-8 shrink-0 text-xs"
            onClick={() => setUnreadOnly((v) => !v)}
          >
            Unread
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No notifications.</p>
          )}
          {filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b border-border/40 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/10",
                !n.is_read && "bg-accent/5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("font-medium", !n.is_read && "text-foreground")}>{n.title}</span>
                {!n.is_read && <Badge variant="warning" className="h-4 px-1.5 text-[9px]">New</Badge>}
              </div>
              {n.message && <span className="text-xs text-muted-foreground">{n.message}</span>}
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
