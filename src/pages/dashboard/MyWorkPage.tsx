import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, startOfDay, addDays, subDays } from "date-fns"
import {
  Clock,
  LogIn,
  LogOut,
  CalendarDays,
  DollarSign,
  Users,
  CheckCircle2,
  Scissors,
  Plane,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AppointmentStatus, LeaveStatus, Service, Staff } from "@/types"

const APPT_VARIANT: Record<AppointmentStatus, "default" | "success" | "warning" | "destructive" | "outline"> = {
  pending: "warning",
  confirmed: "default",
  completed: "success",
  cancelled: "outline",
  no_show: "destructive",
}

const LEAVE_VARIANT: Record<LeaveStatus, "success" | "warning" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
}

export default function MyWorkPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [leaveForm, setLeaveForm] = React.useState({ start_date: "", end_date: "", reason: "" })

  const { data: staffRow, isLoading: staffLoading } = useQuery({
    queryKey: ["my-staff-row", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").eq("id", profile!.id).maybeSingle()
      if (error) throw error
      return data as Staff | null
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ["my-work", profile?.id],
    enabled: !!profile && !!staffRow,
    queryFn: async () => {
      const todayStart = startOfDay(new Date())
      const todayIso = format(todayStart, "yyyy-MM-dd")
      const tomorrowIso = addDays(todayStart, 1).toISOString()
      const weekAgoIso = subDays(todayStart, 6).toISOString()

      const [
        { data: todayAttendance },
        { data: recentAttendance },
        { data: todaySchedule },
        { count: weekApptCount },
        { data: myServiceLinks },
        { data: allServices },
        { data: completedHistory },
        { data: leaveRequests },
        { data: todayCompletedItems },
      ] = await Promise.all([
        supabase
          .from("attendance_records")
          .select("*")
          .eq("staff_id", profile!.id)
          .eq("work_date", todayIso)
          .maybeSingle(),
        supabase
          .from("attendance_records")
          .select("*")
          .eq("staff_id", profile!.id)
          .order("work_date", { ascending: false })
          .limit(7),
        supabase
          .from("appointments")
          .select("id, start_time, status, customer:profiles!appointments_customer_id_fkey(full_name)")
          .eq("staff_id", profile!.id)
          .gte("start_time", todayStart.toISOString())
          .lt("start_time", tomorrowIso)
          .order("start_time", { ascending: true }),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("staff_id", profile!.id)
          .gte("start_time", weekAgoIso),
        supabase.from("staff_services").select("service_id"),
        supabase.from("services").select("*").eq("is_active", true).order("name"),
        supabase
          .from("appointments")
          .select("customer_id, start_time, customer:profiles!appointments_customer_id_fkey(full_name)")
          .eq("staff_id", profile!.id)
          .eq("status", "completed")
          .order("start_time", { ascending: false })
          .limit(50),
        supabase
          .from("leave_requests")
          .select("*")
          .eq("staff_id", profile!.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("appointments")
          .select("id, items:appointment_items(price)")
          .eq("staff_id", profile!.id)
          .eq("status", "completed")
          .gte("start_time", todayStart.toISOString())
          .lt("start_time", tomorrowIso),
      ])

      const myServiceIds = new Set((myServiceLinks ?? []).map((l) => l.service_id))

      const customerMap = new Map<string, { name: string; lastVisit: string }>()
      for (const a of completedHistory ?? []) {
        const name = (a.customer as unknown as { full_name: string } | null)?.full_name ?? "—"
        if (!customerMap.has(a.customer_id)) {
          customerMap.set(a.customer_id, { name, lastVisit: a.start_time })
        }
      }

      const grossToday = (todayCompletedItems ?? []).reduce(
        (sum, appt) => sum + (appt.items ?? []).reduce((s, i) => s + Number(i.price), 0),
        0
      )
      const commission = staffRow ? Number(staffRow.commission_rate) : 0
      const dailyEarnings = grossToday * (commission / 100)

      return {
        todayAttendance,
        recentAttendance: recentAttendance ?? [],
        todaySchedule: todaySchedule ?? [],
        weekApptCount: weekApptCount ?? 0,
        myServiceIds,
        allServices: (allServices ?? []) as Service[],
        customerHistory: Array.from(customerMap.values()).slice(0, 10),
        leaveRequests: leaveRequests ?? [],
        dailyEarnings,
      }
    },
  })

  const clockIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance_records").insert({
        staff_id: profile!.id,
        branch_id: profile!.branch_id,
        work_date: format(new Date(), "yyyy-MM-dd"),
        check_in_time: new Date().toISOString(),
        status: "present",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-work"] })
      toast.success("Clocked in")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clockOut = useMutation({
    mutationFn: async () => {
      if (!data?.todayAttendance) return
      const { error } = await supabase
        .from("attendance_records")
        .update({ check_out_time: new Date().toISOString() })
        .eq("id", data.todayAttendance.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-work"] })
      toast.success("Clocked out")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "completed" }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-work"] })
      toast.success("Marked complete")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleService = useMutation({
    mutationFn: async ({ serviceId, assigned }: { serviceId: string; assigned: boolean }) => {
      if (assigned) {
        const { error } = await supabase
          .from("staff_services")
          .delete()
          .eq("staff_id", profile!.id)
          .eq("service_id", serviceId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("staff_services")
          .insert({ staff_id: profile!.id, service_id: serviceId })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-work"] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const submitLeave = useMutation({
    mutationFn: async () => {
      if (!leaveForm.start_date || !leaveForm.end_date) throw new Error("Select a date range")
      const { error } = await supabase.from("leave_requests").insert({
        staff_id: profile!.id,
        branch_id: profile!.branch_id,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-work"] })
      setLeaveForm({ start_date: "", end_date: "", reason: "" })
      toast.success("Leave request submitted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (staffLoading) return <p className="text-sm text-muted-foreground">Loading...</p>

  if (!staffRow) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-semibold">My Work</h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You're not currently registered as a service provider. Ask your branch administrator to add
            you from the Staff page.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading...</p>

  const clockedIn = !!data.todayAttendance?.check_in_time
  const clockedOut = !!data.todayAttendance?.check_out_time

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="gradient-luxury rounded-xl p-3">
            <Scissors className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">My Work</h1>
            <p className="text-sm text-muted-foreground">
              {staffRow.title ?? "Service Provider"} · {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!clockedIn && (
            <Button size="sm" onClick={() => clockIn.mutate()} disabled={clockIn.isPending}>
              <LogIn className="size-4" /> Clock in
            </Button>
          )}
          {clockedIn && !clockedOut && (
            <Button size="sm" variant="outline" onClick={() => clockOut.mutate()} disabled={clockOut.isPending}>
              <LogOut className="size-4" /> Clock out
            </Button>
          )}
          {clockedIn && (
            <Badge variant={clockedOut ? "outline" : "success"}>
              <Clock className="size-3" />
              {clockedOut
                ? `Checked out ${format(new Date(data.todayAttendance!.check_out_time!), "p")}`
                : `Checked in ${format(new Date(data.todayAttendance!.check_in_time!), "p")}`}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today's schedule" value={data.todaySchedule.length} />
        <StatCard icon={CalendarDays} label="This week" value={data.weekApptCount} />
        <StatCard icon={DollarSign} label="Today's earnings" value={`Rs ${data.dailyEarnings.toFixed(2)}`} accent="gold" />
        <StatCard icon={Users} label="Customers served" value={data.customerHistory.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My schedule — today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.todaySchedule.length === 0 && (
              <p className="text-sm text-muted-foreground">No appointments assigned today.</p>
            )}
            {data.todaySchedule.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{format(new Date(a.start_time), "p")}</span>
                  <span className="text-xs text-muted-foreground">
                    {(a.customer as unknown as { full_name: string } | null)?.full_name ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={APPT_VARIANT[a.status as AppointmentStatus]} className="capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                  {a.status === "confirmed" && (
                    <Button size="sm" variant="outline" onClick={() => markComplete.mutate(a.id)}>
                      <CheckCircle2 className="size-4" /> Complete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentAttendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No attendance recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {data.recentAttendance.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.work_date), "PP")}</TableCell>
                    <TableCell>{r.check_in_time ? format(new Date(r.check_in_time), "p") : "—"}</TableCell>
                    <TableCell>{r.check_out_time ? format(new Date(r.check_out_time), "p") : "—"}</TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My assigned services</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {data.allServices.length === 0 && (
              <p className="text-sm text-muted-foreground">No active services in the catalog yet.</p>
            )}
            {data.allServices.map((s) => {
              const assigned = data.myServiceIds.has(s.id)
              return (
                <label
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/10"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={assigned}
                      onChange={() => toggleService.mutate({ serviceId: s.id, assigned })}
                    />
                    {s.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.duration_minutes}min · Rs {Number(s.price).toFixed(2)}</span>
                </label>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.customerHistory.length === 0 && (
              <p className="text-sm text-muted-foreground">No completed visits yet.</p>
            )}
            {data.customerHistory.map((c, idx) => (
              <div key={c.name + idx} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(c.lastVisit), "PP")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="gradient-gold rounded-xl p-2.5">
              <Plane className="size-4 text-accent-foreground" />
            </div>
            <CardTitle className="text-base">Leave requests</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="grid gap-3 sm:grid-cols-4 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              submitLeave.mutate()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="leave-start">Start date</Label>
              <Input
                id="leave-start"
                type="date"
                required
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="leave-end">End date</Label>
              <Input
                id="leave-end"
                type="date"
                required
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="leave-reason">Reason (optional)</Label>
              <Textarea
                id="leave-reason"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={submitLeave.isPending} className="sm:col-span-4 sm:w-fit">
              Submit request
            </Button>
          </form>

          <div className="flex flex-col gap-2">
            {data.leaveRequests.length === 0 && (
              <p className="text-sm text-muted-foreground">No leave requests yet.</p>
            )}
            {data.leaveRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>
                  {format(new Date(r.start_date), "PP")} → {format(new Date(r.end_date), "PP")}
                </span>
                <Badge variant={LEAVE_VARIANT[r.status as LeaveStatus]} className="capitalize">
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  accent?: "primary" | "gold"
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={accent === "gold" ? "gradient-gold rounded-xl p-3" : "gradient-luxury rounded-xl p-3"}>
          <Icon className={accent === "gold" ? "size-5 text-accent-foreground" : "size-5 text-primary-foreground"} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
