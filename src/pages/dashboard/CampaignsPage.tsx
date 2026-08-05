import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Send, Cake, PartyPopper } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useBranches } from "@/hooks/useBranches"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  Campaign,
  CampaignChannel,
  CampaignStatus,
  CustomerMembership,
  CustomerSegment,
  Profile,
  SegmentType,
} from "@/types"

const SEGMENT_LABEL: Record<SegmentType, string> = {
  all: "All customers",
  birthday_month: "Birthday this month",
  anniversary_month: "Signup anniversary this month",
  inactive: "Inactive (no visit)",
  top_spenders: "Top spenders",
  active_members: "Active members",
  new_customers: "New customers",
}

const STATUS_VARIANT: Record<CampaignStatus, "outline" | "success" | "destructive"> = {
  draft: "outline",
  sent: "success",
  cancelled: "destructive",
}

const emptySegmentForm = { name: "", type: "all" as SegmentType, month: "", days: "", min_spend: "" }
const emptyCampaignForm = {
  name: "",
  channel: "email" as CampaignChannel,
  subject: "",
  message: "",
  segment_id: "",
  budget_cost: "",
}

export default function CampaignsPage() {
  const queryClient = useQueryClient()
  const { defaultBranchId } = useBranches()
  const [segmentDialogOpen, setSegmentDialogOpen] = React.useState(false)
  const [segmentForm, setSegmentForm] = React.useState(emptySegmentForm)
  const [campaignDialogOpen, setCampaignDialogOpen] = React.useState(false)
  const [campaignForm, setCampaignForm] = React.useState(emptyCampaignForm)

  const { data: segments = [] } = useQuery({
    queryKey: ["customer-segments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_segments").select("*").order("created_at", { ascending: false })
      if (error) throw error
      return data as CustomerSegment[]
    },
  })

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, segment:customer_segments(*)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as Campaign[]
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ["crm-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "customer").eq("is_active", true)
      if (error) throw error
      return data as Profile[]
    },
  })

  const { data: activeMemberships = [] } = useQuery({
    queryKey: ["crm-active-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_memberships").select("*").eq("status", "active")
      if (error) throw error
      return data as CustomerMembership[]
    },
  })

  const now = new Date()
  const thisMonth = now.getMonth()

  const audienceSize = (segment: Pick<CustomerSegment, "type" | "params">) => {
    const params = segment.params as { month?: number; days?: number; min_spend?: number }
    switch (segment.type) {
      case "all":
        return customers.length
      case "birthday_month":
        return customers.filter((c) => {
          if (!c.date_of_birth) return false
          const m = params.month ?? thisMonth + 1
          return new Date(c.date_of_birth).getUTCMonth() + 1 === m
        }).length
      case "anniversary_month":
        return customers.filter((c) => {
          const m = params.month ?? thisMonth + 1
          return new Date(c.created_at).getUTCMonth() + 1 === m
        }).length
      case "new_customers": {
        const days = params.days ?? 30
        const cutoff = new Date(now.getTime() - days * 86400000)
        return customers.filter((c) => new Date(c.created_at) > cutoff).length
      }
      case "active_members":
        return new Set(activeMemberships.map((m) => m.customer_id)).size
      default:
        return null
    }
  }

  const birthdayThisMonth = audienceSize({ type: "birthday_month", params: {} }) ?? 0
  const anniversaryThisMonth = audienceSize({ type: "anniversary_month", params: {} }) ?? 0

  const createSegment = useMutation({
    mutationFn: async (values: typeof segmentForm) => {
      const params: Record<string, number> = {}
      if (values.month) params.month = Number(values.month)
      if (values.days) params.days = Number(values.days)
      if (values.min_spend) params.min_spend = Number(values.min_spend)
      const { error } = await supabase.from("customer_segments").insert({
        branch_id: defaultBranchId || null,
        name: values.name,
        type: values.type,
        params,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-segments"] })
      setSegmentDialogOpen(false)
      setSegmentForm(emptySegmentForm)
      toast.success("Segment created")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createCampaign = useMutation({
    mutationFn: async (values: typeof campaignForm) => {
      if (!values.message.trim()) throw new Error("Enter a message")
      const { error } = await supabase.from("campaigns").insert({
        branch_id: defaultBranchId || null,
        name: values.name,
        channel: values.channel,
        subject: values.subject || null,
        message: values.message,
        segment_id: values.segment_id || null,
        budget_cost: values.budget_cost ? Number(values.budget_cost) : null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      setCampaignDialogOpen(false)
      setCampaignForm(emptyCampaignForm)
      toast.success("Campaign created")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const sendCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("send_campaign", { p_campaign_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      toast.success("Campaign sent")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const quickSend = async (type: "birthday_month" | "anniversary_month") => {
    const name = type === "birthday_month" ? "Birthday this month" : "Anniversary this month"
    let segment = segments.find((s) => s.type === type)
    if (!segment) {
      const { data, error } = await supabase
        .from("customer_segments")
        .insert({ branch_id: defaultBranchId || null, name, type, params: {} })
        .select()
        .single()
      if (error) {
        toast.error(error.message)
        return
      }
      segment = data as CustomerSegment
      queryClient.invalidateQueries({ queryKey: ["customer-segments"] })
    }
    setCampaignForm({
      name: type === "birthday_month" ? "Birthday wishes" : "Anniversary wishes",
      channel: "email",
      subject: type === "birthday_month" ? "Happy Birthday!" : "Happy Anniversary!",
      message:
        type === "birthday_month"
          ? "Happy birthday from all of us! Enjoy a special treat on your next visit."
          : "Thank you for being with us this past year — here's to many more!",
      segment_id: segment.id,
      budget_cost: "",
    })
    setCampaignDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Campaigns</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="gradient-gold rounded-xl p-3">
                <Cake className="size-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Birthdays this month</p>
                <p className="font-display text-xl font-semibold">{birthdayThisMonth}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => quickSend("birthday_month")}>
              Send wishes
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="gradient-luxury rounded-xl p-3">
                <PartyPopper className="size-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Anniversaries this month</p>
                <p className="font-display text-xl font-semibold">{anniversaryThisMonth}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => quickSend("anniversary_month")}>
              Send wishes
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Segments</CardTitle>
            <Dialog open={segmentDialogOpen} onOpenChange={setSegmentDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setSegmentForm(emptySegmentForm)}>
                  <Plus /> New segment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New segment</DialogTitle>
                </DialogHeader>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    createSegment.mutate(segmentForm)
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <Label>Name</Label>
                    <Input required value={segmentForm.name} onChange={(e) => setSegmentForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Type</Label>
                    <Select value={segmentForm.type} onValueChange={(v) => setSegmentForm((f) => ({ ...f, type: v as SegmentType }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SEGMENT_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(segmentForm.type === "birthday_month" || segmentForm.type === "anniversary_month") && (
                    <div className="flex flex-col gap-2">
                      <Label>Month (1-12, blank = current month)</Label>
                      <Input type="number" min={1} max={12} value={segmentForm.month} onChange={(e) => setSegmentForm((f) => ({ ...f, month: e.target.value }))} />
                    </div>
                  )}
                  {(segmentForm.type === "inactive" || segmentForm.type === "new_customers") && (
                    <div className="flex flex-col gap-2">
                      <Label>Days</Label>
                      <Input type="number" min={1} value={segmentForm.days} onChange={(e) => setSegmentForm((f) => ({ ...f, days: e.target.value }))} placeholder={segmentForm.type === "inactive" ? "90" : "30"} />
                    </div>
                  )}
                  {segmentForm.type === "top_spenders" && (
                    <div className="flex flex-col gap-2">
                      <Label>Minimum lifetime spend</Label>
                      <Input type="number" min={0} step="0.01" value={segmentForm.min_spend} onChange={(e) => setSegmentForm((f) => ({ ...f, min_spend: e.target.value }))} />
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={createSegment.isPending}>
                      {createSegment.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {segments.length === 0 && <p className="text-sm text-muted-foreground">No segments yet.</p>}
          {segments.map((s) => {
            const size = audienceSize(s)
            return (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  {s.name} <span className="text-xs text-muted-foreground">({SEGMENT_LABEL[s.type]})</span>
                </span>
                <span className="text-muted-foreground">{size !== null ? `~${size} customers` : "computed on send"}</span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Campaigns</CardTitle>
            <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setCampaignForm(emptyCampaignForm)}>
                  <Plus /> New campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>New campaign</DialogTitle>
                </DialogHeader>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    createCampaign.mutate(campaignForm)
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <Label>Name</Label>
                    <Input required value={campaignForm.name} onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Channel</Label>
                      <Select value={campaignForm.channel} onValueChange={(v) => setCampaignForm((f) => ({ ...f, channel: v as CampaignChannel }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Segment</Label>
                      <Select value={campaignForm.segment_id || "__all__"} onValueChange={(v) => setCampaignForm((f) => ({ ...f, segment_id: v === "__all__" ? "" : v }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All customers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All customers</SelectItem>
                          {segments.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {campaignForm.channel === "email" && (
                    <div className="flex flex-col gap-2">
                      <Label>Subject</Label>
                      <Input value={campaignForm.subject} onChange={(e) => setCampaignForm((f) => ({ ...f, subject: e.target.value }))} />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Label>Message</Label>
                    <Textarea required rows={4} value={campaignForm.message} onChange={(e) => setCampaignForm((f) => ({ ...f, message: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Budget cost (Rs, optional — enables ROI tracking)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={campaignForm.budget_cost}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, budget_cost: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createCampaign.isPending}>
                      {createCampaign.isPending ? "Saving..." : "Save draft"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="w-20">Send</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No campaigns yet.
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="capitalize">{c.channel}</TableCell>
                  <TableCell>{c.segment?.name ?? "All customers"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status]} className="capitalize">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.budget_cost != null ? `Rs ${Number(c.budget_cost).toFixed(2)}` : "—"}</TableCell>
                  <TableCell>{c.sent_at ? format(new Date(c.sent_at), "PP") : "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={c.status !== "draft" || sendCampaign.isPending}
                      onClick={() => sendCampaign.mutate(c.id)}
                    >
                      <Send className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
