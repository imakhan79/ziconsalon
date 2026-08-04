import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { CalendarDays, Clock, Plus, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AttendanceStatus, Profile, ShiftType, Staff } from "@/types"

type StaffRow = Staff & { profile: Profile }

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "half_day", "overtime", "leave"]
const STATUS_VARIANT: Record<AttendanceStatus, "success" | "destructive" | "warning" | "outline" | "default"> = {
  present: "success",
  absent: "destructive",
  late: "warning",
  half_day: "outline",
  overtime: "default",
  leave: "outline",
}

export default function StaffHRPage() {
  const queryClient = useQueryClient()
  const today = format(new Date(), "yyyy-MM-dd")

  const [correctStaffId, setCorrectStaffId] = React.useState("")
  const [correctStatus, setCorrectStatus] = React.useState<AttendanceStatus>("absent")
  const [correctDate, setCorrectDate] = React.useState(today)

  const [holidayName, setHolidayName] = React.useState("")
  const [holidayDate, setHolidayDate] = React.useState("")

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*, profile:profiles(*)").order("hired_at")
      if (error) throw error
      return data as unknown as StaffRow[]
    },
  })

  const { data: attendance = [] } = useQuery({
    queryKey: ["hr-attendance", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, staff:profiles!attendance_records_staff_id_fkey(full_name)")
        .eq("work_date", today)
        .order("check_in_time")
      if (error) throw error
      return data as unknown as { id: string; staff_id: string; check_in_time: string | null; check_out_time: string | null; status: AttendanceStatus; staff: { full_name: string } | null }[]
    },
  })

  const { data: shifts = [] } = useQuery({
    queryKey: ["hr-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, staff:profiles!shifts_staff_id_fkey(full_name)")
        .order("start_time")
      if (error) throw error
      return data as unknown as { id: string; staff_id: string; shift_type: ShiftType; start_time: string; end_time: string; days_of_week: number[]; staff: { full_name: string } | null }[]
    },
  })

  const { data: holidays = [] } = useQuery({
    queryKey: ["hr-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("holidays").select("*").order("date")
      if (error) throw error
      return data
    },
  })

  const correctAttendance = useMutation({
    mutationFn: async () => {
      if (!correctStaffId) throw new Error("Select a staff member")
      const staffProfile = staff.find((s) => s.id === correctStaffId)
      const { error } = await supabase
        .from("attendance_records")
        .upsert(
          { staff_id: correctStaffId, branch_id: staffProfile?.profile.branch_id ?? null, work_date: correctDate, status: correctStatus },
          { onConflict: "staff_id,work_date" }
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-attendance"] })
      toast.success("Attendance recorded")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const [shiftStaffId, setShiftStaffId] = React.useState("")
  const [shiftType, setShiftType] = React.useState<ShiftType>("morning")
  const [shiftStart, setShiftStart] = React.useState("09:00")
  const [shiftEnd, setShiftEnd] = React.useState("17:00")

  const assignShift = useMutation({
    mutationFn: async () => {
      if (!shiftStaffId) throw new Error("Select a staff member")
      const staffProfile = staff.find((s) => s.id === shiftStaffId)
      const { error } = await supabase.from("shifts").upsert(
        {
          staff_id: shiftStaffId,
          branch_id: staffProfile?.profile.branch_id ?? null,
          shift_type: shiftType,
          start_time: shiftStart,
          end_time: shiftEnd,
        },
        { onConflict: "staff_id" }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-shifts"] })
      toast.success("Shift assigned")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const addHoliday = useMutation({
    mutationFn: async () => {
      if (!holidayName || !holidayDate) throw new Error("Name and date required")
      const { error } = await supabase.from("holidays").insert({ name: holidayName, date: holidayDate })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-holidays"] })
      setHolidayName("")
      setHolidayDate("")
      toast.success("Holiday added")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-holidays"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Staff HR</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-accent" />
            <CardTitle className="text-base">Attendance — today</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No attendance recorded today.
                  </TableCell>
                </TableRow>
              )}
              {attendance.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.staff?.full_name ?? "—"}</TableCell>
                  <TableCell>{r.check_in_time ? format(new Date(r.check_in_time), "p") : "—"}</TableCell>
                  <TableCell>{r.check_out_time ? format(new Date(r.check_out_time), "p") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                      {r.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <form
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              correctAttendance.mutate()
            }}
          >
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Staff</Label>
              <Select value={correctStaffId} onValueChange={setCorrectStaffId}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={correctDate} onChange={(e) => setCorrectDate(e.target.value)} className="h-8 w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Status</Label>
              <Select value={correctStatus} onValueChange={(v) => setCorrectStatus(v as AttendanceStatus)}>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={correctAttendance.isPending}>
              Record
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shift schedule</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {shifts.length === 0 && <p className="text-sm text-muted-foreground">No shifts assigned yet.</p>}
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span>{s.staff?.full_name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {s.shift_type} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
            <form
              className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                assignShift.mutate()
              }}
            >
              <Select value={shiftStaffId} onValueChange={setShiftStaffId}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue placeholder="Staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={shiftType} onValueChange={(v) => setShiftType(v as ShiftType)}>
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="rotational">Rotational</SelectItem>
                </SelectContent>
              </Select>
              <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="h-8 w-24" />
              <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="h-8 w-24" />
              <Button type="submit" size="sm" disabled={assignShift.isPending}>
                Assign
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              <CardTitle className="text-base">Holiday calendar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {holidays.length === 0 && <p className="text-sm text-muted-foreground">No holidays added yet.</p>}
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span>{h.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{format(new Date(h.date), "PP")}</span>
                    <Button size="sm" variant="ghost" onClick={() => deleteHoliday.mutate(h.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                addHoliday.mutate()
              }}
            >
              <Input
                placeholder="Holiday name"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                className="h-8 w-40"
              />
              <Input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className="h-8 w-36" />
              <Button type="submit" size="sm" disabled={addHoliday.isPending}>
                <Plus className="size-3.5" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
