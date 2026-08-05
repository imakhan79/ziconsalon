import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Bell, Send, Mail, MessageSquare, Radio } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useBranches"
import { requestBrowserPushPermission } from "@/hooks/useNotifications"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageSquare,
}

export default function NotificationsPage() {
  const { profile } = useAuth()
  const { branches, defaultBranchId } = useBranches()
  const queryClient = useQueryClient()
  const [pushState, setPushState] = React.useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  )
  const [form, setForm] = React.useState({
    audience: "all_customers",
    branch_id: defaultBranchId || "",
    title: "",
    message: "",
    channels: { email: true, sms: false, whatsapp: false },
  })

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["notification-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, recipient:profiles!notifications_recipient_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(100)
      if (error) throw error
      return data as unknown as {
        id: string
        type: string
        title: string
        message: string | null
        is_read: boolean
        created_at: string
        recipient: { full_name: string } | null
      }[]
    },
  })

  const { data: deliveryLog = [], isLoading: logLoading } = useQuery({
    queryKey: ["communications-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communications_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)
      if (error) throw error
      return data as {
        id: string
        channel: string
        recipient: string
        status: string
        created_at: string
      }[]
    },
  })

  const broadcast = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.message.trim()) throw new Error("Title and message are required")
      const channels = Object.entries(form.channels)
        .filter(([, on]) => on)
        .map(([c]) => c)
      const { data, error } = await supabase.rpc("send_broadcast_notification", {
        p_audience: form.audience,
        p_branch_id: form.branch_id || null,
        p_title: form.title,
        p_message: form.message,
        p_channels: channels.length ? channels : ["email"],
      })
      if (error) throw error
      return data as number
    },
    onSuccess: (count) => {
      toast.success(`Sent to ${count} recipient${count === 1 ? "" : "s"}`)
      setForm((f) => ({ ...f, title: "", message: "" }))
      queryClient.invalidateQueries({ queryKey: ["notification-history"] })
      queryClient.invalidateQueries({ queryKey: ["communications-log"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canManage = profile && ["admin", "manager"].includes(profile.role)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Notification Hub</h1>
          <p className="text-sm text-muted-foreground">
            In-app alerts, browser push, and SMS/WhatsApp/Email delivery log.
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <Bell className="size-4 text-accent" />
            <div className="text-sm">
              Browser push:{" "}
              <span className="font-medium capitalize">
                {pushState === "unsupported" ? "not supported" : pushState}
              </span>
            </div>
            {pushState === "default" && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const perm = await requestBrowserPushPermission()
                  setPushState(perm)
                  if (perm === "granted") toast.success("Browser notifications enabled")
                }}
              >
                Enable
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="delivery">Delivery log</TabsTrigger>
          {canManage && <TabsTrigger value="broadcast">Broadcast</TabsTrigger>}
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent notifications (last 100)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Read</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!historyLoading && history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No notifications yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {history.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {n.type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{n.title}</TableCell>
                      <TableCell>{n.recipient?.full_name ?? "—"}</TableCell>
                      <TableCell>{n.is_read ? "Read" : "Unread"}</TableCell>
                      <TableCell>{format(new Date(n.created_at), "PPp")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SMS / WhatsApp / Email delivery log</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                No SMS/WhatsApp/email provider is connected yet — sends are queued and logged here as "pending",
                ready to wire up to a provider later.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!logLoading && deliveryLog.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No delivery attempts logged yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {deliveryLog.map((l) => {
                    const Icon = CHANNEL_ICON[l.channel] ?? Radio
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="flex items-center gap-2 capitalize">
                          <Icon className="size-4 text-muted-foreground" />
                          {l.channel}
                        </TableCell>
                        <TableCell>{l.recipient}</TableCell>
                        <TableCell>
                          <Badge variant={l.status === "sent" ? "success" : l.status === "failed" ? "destructive" : "outline"}>
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(l.created_at), "PPp")}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="broadcast" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Send a broadcast notification</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>Audience</Label>
                    <Select value={form.audience} onValueChange={(v) => setForm((f) => ({ ...f, audience: v }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_customers">All customers</SelectItem>
                        <SelectItem value="branch_customers">Customers at one branch</SelectItem>
                        <SelectItem value="all_staff">All staff</SelectItem>
                        <SelectItem value="branch_staff">Staff at one branch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(form.audience === "branch_customers" || form.audience === "branch_staff") && (
                    <div className="flex flex-col gap-2">
                      <Label>Branch</Label>
                      <Select value={form.branch_id} onValueChange={(v) => setForm((f) => ({ ...f, branch_id: v }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Message</Label>
                  <Textarea
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Also log for delivery via</Label>
                  <div className="flex gap-4">
                    {(["email", "sms", "whatsapp"] as const).map((c) => (
                      <label key={c} className="flex items-center gap-2 text-sm capitalize">
                        <input
                          type="checkbox"
                          checked={form.channels[c]}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, channels: { ...f.channels, [c]: e.target.checked } }))
                          }
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-fit"
                  disabled={broadcast.isPending}
                  onClick={() => broadcast.mutate()}
                >
                  <Send /> {broadcast.isPending ? "Sending..." : "Send broadcast"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
