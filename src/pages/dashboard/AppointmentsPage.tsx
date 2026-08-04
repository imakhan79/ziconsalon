import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, addMinutes } from "date-fns"
import { Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useBranches"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import type { Appointment, AppointmentStatus, Profile, Service, Staff } from "@/types"

const STATUS_VARIANT: Record<AppointmentStatus, "default" | "success" | "warning" | "destructive" | "outline"> = {
  pending: "warning",
  confirmed: "default",
  completed: "success",
  cancelled: "outline",
  no_show: "destructive",
}

type StaffOption = Staff & { profile: Profile }

const emptyForm = {
  customerId: "",
  staffId: "",
  branchId: "",
  date: "",
  time: "",
  notes: "",
  serviceIds: [] as string[],
}

export default function AppointmentsPage() {
  const { profile: me } = useAuth()
  const isStaffOrAbove = me && ["admin", "manager", "staff"].includes(me.role)
  const queryClient = useQueryClient()
  const { branches } = useBranches()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, customer:profiles!appointments_customer_id_fkey(*), staff:staff(*, profile:profiles(*))")
        .order("start_time", { ascending: false })
      if (error) throw error
      return data as unknown as Appointment[]
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ["all-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name")
      if (error) throw error
      return data as Profile[]
    },
    enabled: dialogOpen && !!isStaffOrAbove,
  })

  const { data: staffOptions = [] } = useQuery({
    queryKey: ["staff-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*, profile:profiles(*)")
      if (error) throw error
      return data as unknown as StaffOption[]
    },
    enabled: dialogOpen,
  })

  const { data: services = [] } = useQuery({
    queryKey: ["active-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("name")
      if (error) throw error
      return data as Service[]
    },
    enabled: dialogOpen,
  })

  const create = useMutation({
    mutationFn: async (values: typeof form) => {
      const selected = services.filter((s) => values.serviceIds.includes(s.id))
      if (selected.length === 0) throw new Error("Select at least one service")
      const startTime = new Date(`${values.date}T${values.time}`)
      const totalMinutes = selected.reduce((sum, s) => sum + s.duration_minutes, 0)
      const endTime = addMinutes(startTime, totalMinutes)
      const customerId = isStaffOrAbove ? values.customerId : me!.id

      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .insert({
          customer_id: customerId,
          staff_id: values.staffId || null,
          branch_id: values.branchId || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          notes: values.notes || null,
          created_by: me!.id,
        })
        .select()
        .single()
      if (apptErr) throw apptErr

      const items = selected.map((s) => ({
        appointment_id: appt.id,
        service_id: s.id,
        price: s.price,
        duration_minutes: s.duration_minutes,
      }))
      const { error: itemsErr } = await supabase.from("appointment_items").insert(items)
      if (itemsErr) throw itemsErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      setDialogOpen(false)
      setForm(emptyForm)
      toast.success("Appointment booked")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      toast.success("Status updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleService = (id: string) => {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((s) => s !== id)
        : [...f.serviceIds, id],
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Appointments</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ ...emptyForm, branchId: me?.branch_id ?? branches[0]?.id ?? "" })}>
              <Plus /> New appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Book appointment</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                create.mutate(form)
              }}
            >
              {isStaffOrAbove && (
                <div className="flex flex-col gap-2">
                  <Label>Customer</Label>
                  <Select
                    value={form.customerId}
                    onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}>
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

              <div className="flex flex-col gap-2">
                <Label>Staff (optional)</Label>
                <Select
                  value={form.staffId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, staffId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any available" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preference</SelectItem>
                    {staffOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="appt-date">Date</Label>
                  <Input
                    id="appt-date"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="appt-time">Time</Label>
                  <Input
                    id="appt-time"
                    type="time"
                    required
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Services</Label>
                <div className="flex flex-col gap-1 rounded-md border p-2 max-h-48 overflow-y-auto">
                  {services.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">No active services.</p>
                  )}
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.serviceIds.includes(s.id)}
                          onChange={() => toggleService(s.id)}
                        />
                        {s.name}
                      </span>
                      <span className="text-muted-foreground">
                        {s.duration_minutes}min · ${Number(s.price).toFixed(2)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="appt-notes">Notes</Label>
                <Textarea
                  id="appt-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Booking..." : "Book appointment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & time</TableHead>
                {isStaffOrAbove && <TableHead>Customer</TableHead>}
                <TableHead>Staff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && appointments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No appointments yet.
                  </TableCell>
                </TableRow>
              )}
              {appointments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{format(new Date(a.start_time), "PPp")}</TableCell>
                  {isStaffOrAbove && <TableCell>{a.customer?.full_name ?? "—"}</TableCell>}
                  <TableCell>{a.staff?.profile?.full_name ?? "Unassigned"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[a.status]} className="capitalize">
                      {a.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isStaffOrAbove ? (
                      <Select
                        value={a.status}
                        onValueChange={(v) => updateStatus.mutate({ id: a.id, status: v as AppointmentStatus })}
                      >
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no_show">No show</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      ["pending", "confirmed"].includes(a.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: a.id, status: "cancelled" })}
                        >
                          Cancel
                        </Button>
                      )
                    )}
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
