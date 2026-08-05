import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { startOfMonth } from "date-fns"
import { Plus, Pencil, Star, FileText, Upload } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import type { EmploymentType, Profile, Service, Staff, UserRole } from "@/types"

type StaffRow = Staff & { profile: Profile }

const emptyEdit = {
  id: "",
  title: "",
  specialization: "",
  commission_rate: "0",
  hired_at: "",
  bio: "",
  qualifications: "",
  skills: "",
  employment_type: "full_time" as EmploymentType,
  annual_leave_days: "20",
  salary: "",
  role: "staff" as UserRole,
  is_active: true,
}

export default function StaffPage() {
  const { profile: me } = useAuth()
  const canSeeSalary = me && ["admin", "manager"].includes(me.role)
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)
  const [promoteOpen, setPromoteOpen] = React.useState(false)
  const [edit, setEdit] = React.useState(emptyEdit)
  const [editServiceIds, setEditServiceIds] = React.useState<Set<string>>(new Set())
  const [promoteProfileId, setPromoteProfileId] = React.useState("")
  const [promoteRole, setPromoteRole] = React.useState<UserRole>("staff")
  const [docName, setDocName] = React.useState("")
  const docInputRef = React.useRef<HTMLInputElement>(null)

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("*, profile:profiles!staff_id_fkey(*)")
        .order("hired_at", { ascending: false })
      if (error) throw error
      return data as unknown as StaffRow[]
    },
  })

  const { data: eligibleProfiles = [] } = useQuery({
    queryKey: ["eligible-for-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "customer")
        .order("full_name")
      if (error) throw error
      return data as Profile[]
    },
    enabled: promoteOpen,
  })

  const { data: allServices = [] } = useQuery({
    queryKey: ["all-active-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as Service[]
    },
    enabled: editOpen,
  })

  const { data: editExtras } = useQuery({
    queryKey: ["staff-edit-extras", edit.id],
    enabled: editOpen && !!edit.id,
    queryFn: async () => {
      const [{ data: comp }, { data: links }, { data: docs }] = await Promise.all([
        supabase.from("staff_compensation").select("*").eq("staff_id", edit.id).maybeSingle(),
        supabase.from("staff_services").select("service_id").eq("staff_id", edit.id),
        supabase.from("staff_documents").select("*").eq("staff_id", edit.id).order("created_at", { ascending: false }),
      ])
      return { salary: comp?.salary ?? null, serviceIds: (links ?? []).map((l) => l.service_id), docs: docs ?? [] }
    },
  })

  React.useEffect(() => {
    if (editExtras) {
      setEdit((f) => ({ ...f, salary: editExtras.salary != null ? String(editExtras.salary) : "" }))
      setEditServiceIds(new Set(editExtras.serviceIds))
    }
  }, [editExtras])

  // ============ Performance (this month) ============
  const { data: performance = {} as Record<string, { completed: number; revenue: number; tips: number; ratings: number[] }> } = useQuery({
    queryKey: ["staff-performance"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString()
      const [{ data: appts }, { data: reviews }, { data: payments }] = await Promise.all([
        supabase
          .from("appointments")
          .select("staff_id, status, items:appointment_items(price)")
          .eq("status", "completed")
          .gte("start_time", monthStart),
        supabase.from("reviews").select("staff_id, rating"),
        supabase
          .from("payments")
          .select("tip_amount, invoice:invoices(appointment:appointments(staff_id))")
          .gte("paid_at", monthStart),
      ])

      const byStaff: Record<string, { completed: number; revenue: number; tips: number; ratings: number[] }> = {}
      const ensure = (id: string) => (byStaff[id] ??= { completed: 0, revenue: 0, tips: 0, ratings: [] })

      for (const a of appts ?? []) {
        if (!a.staff_id) continue
        const row = ensure(a.staff_id)
        row.completed += 1
        row.revenue += (a.items ?? []).reduce((s, i) => s + Number(i.price), 0)
      }
      for (const r of reviews ?? []) {
        if (!r.staff_id) continue
        ensure(r.staff_id).ratings.push(r.rating)
      }
      for (const p of payments ?? []) {
        const staffId = (p.invoice as unknown as { appointment: { staff_id: string | null } | null } | null)
          ?.appointment?.staff_id
        if (staffId) ensure(staffId).tips += Number(p.tip_amount)
      }
      return byStaff
    },
  })

  const promote = useMutation({
    mutationFn: async () => {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ role: promoteRole })
        .eq("id", promoteProfileId)
      if (profileErr) throw profileErr
      const { error: staffErr } = await supabase.from("staff").insert({ id: promoteProfileId })
      if (staffErr) throw staffErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      queryClient.invalidateQueries({ queryKey: ["eligible-for-staff"] })
      setPromoteOpen(false)
      setPromoteProfileId("")
      toast.success("Added to staff")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveEdit = useMutation({
    mutationFn: async (values: typeof edit) => {
      const { error: staffErr } = await supabase
        .from("staff")
        .update({
          title: values.title || null,
          specialization: values.specialization || null,
          commission_rate: Number(values.commission_rate),
          hired_at: values.hired_at || null,
          bio: values.bio || null,
          qualifications: values.qualifications || null,
          skills: values.skills || null,
          employment_type: values.employment_type,
          annual_leave_days: Number(values.annual_leave_days),
        })
        .eq("id", values.id)
      if (staffErr) throw staffErr

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ role: values.role, is_active: values.is_active })
        .eq("id", values.id)
      if (profileErr) throw profileErr

      if (canSeeSalary) {
        const { error: compErr } = await supabase
          .from("staff_compensation")
          .upsert({ staff_id: values.id, salary: values.salary ? Number(values.salary) : null })
        if (compErr) throw compErr
      }

      const currentIds = new Set(editExtras?.serviceIds ?? [])
      const toAdd = [...editServiceIds].filter((id) => !currentIds.has(id))
      const toRemove = [...currentIds].filter((id) => !editServiceIds.has(id))
      if (toAdd.length) {
        const { error } = await supabase
          .from("staff_services")
          .insert(toAdd.map((service_id) => ({ staff_id: values.id, service_id })))
        if (error) throw error
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from("staff_services")
          .delete()
          .eq("staff_id", values.id)
          .in("service_id", toRemove)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      queryClient.invalidateQueries({ queryKey: ["staff-edit-extras"] })
      setEditOpen(false)
      toast.success("Staff member updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      const path = `${edit.id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from("staff-documents").upload(path, file)
      if (upErr) throw upErr
      const { error: rowErr } = await supabase.from("staff_documents").insert({
        staff_id: edit.id,
        name: docName || file.name,
        file_url: path,
        uploaded_by: me!.id,
      })
      if (rowErr) throw rowErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-edit-extras", edit.id] })
      setDocName("")
      toast.success("Document uploaded")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleEditService = (id: string) => {
    setEditServiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openEdit = (row: StaffRow) => {
    setEdit({
      id: row.id,
      title: row.title ?? "",
      specialization: row.specialization ?? "",
      commission_rate: String(row.commission_rate),
      hired_at: row.hired_at ?? "",
      bio: row.bio ?? "",
      qualifications: row.qualifications ?? "",
      skills: row.skills ?? "",
      employment_type: row.employment_type,
      annual_leave_days: String(row.annual_leave_days),
      salary: "",
      role: row.profile.role,
      is_active: row.profile.is_active,
    })
    setEditServiceIds(new Set())
    setEditOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Staff</h1>
        <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Add staff member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add staff member</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (promoteProfileId) promote.mutate()
              }}
            >
              <p className="text-sm text-muted-foreground">
                Choose an existing account to promote. New people must sign up first.
              </p>
              <div className="flex flex-col gap-2">
                <Label>Account</Label>
                <Select value={promoteProfileId} onValueChange={setPromoteProfileId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a customer account" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select value={promoteRole} onValueChange={(v) => setPromoteRole(v as UserRole)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={promote.isPending || !promoteProfileId}>
                  {promote.isPending ? "Adding..." : "Add"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              saveEdit.mutate(edit)
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-title">Title</Label>
                <Input
                  id="staff-title"
                  value={edit.title}
                  onChange={(e) => setEdit((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Senior Stylist"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-spec">Specialization</Label>
                <Input
                  id="staff-spec"
                  value={edit.specialization}
                  onChange={(e) => setEdit((f) => ({ ...f, specialization: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-qual">Qualifications</Label>
                <Input
                  id="staff-qual"
                  value={edit.qualifications}
                  onChange={(e) => setEdit((f) => ({ ...f, qualifications: e.target.value }))}
                  placeholder="Certifications, licenses"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-skills">Skills</Label>
                <Input
                  id="staff-skills"
                  value={edit.skills}
                  onChange={(e) => setEdit((f) => ({ ...f, skills: e.target.value }))}
                  placeholder="Balayage, bridal, color correction"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-commission">Commission %</Label>
                <Input
                  id="staff-commission"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={edit.commission_rate}
                  onChange={(e) => setEdit((f) => ({ ...f, commission_rate: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-hired">Hired date</Label>
                <Input
                  id="staff-hired"
                  type="date"
                  value={edit.hired_at}
                  onChange={(e) => setEdit((f) => ({ ...f, hired_at: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-leave">Leave days / yr</Label>
                <Input
                  id="staff-leave"
                  type="number"
                  min={0}
                  value={edit.annual_leave_days}
                  onChange={(e) => setEdit((f) => ({ ...f, annual_leave_days: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Employment type</Label>
                <Select
                  value={edit.employment_type}
                  onValueChange={(v) => setEdit((f) => ({ ...f, employment_type: v as EmploymentType }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full time</SelectItem>
                    <SelectItem value="part_time">Part time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canSeeSalary && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="staff-salary">Salary</Label>
                  <Input
                    id="staff-salary"
                    type="number"
                    min={0}
                    step="0.01"
                    value={edit.salary}
                    onChange={(e) => setEdit((f) => ({ ...f, salary: e.target.value }))}
                    placeholder="Confidential"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="staff-bio">Bio</Label>
              <Textarea
                id="staff-bio"
                value={edit.bio}
                onChange={(e) => setEdit((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Assigned services</Label>
              <div className="flex flex-col gap-1 rounded-md border p-2 max-h-40 overflow-y-auto">
                {allServices.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">No active services.</p>
                )}
                {allServices.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/10"
                  >
                    <input
                      type="checkbox"
                      checked={editServiceIds.has(s.id)}
                      onChange={() => toggleEditService(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select value={edit.role} onValueChange={(v) => setEdit((f) => ({ ...f, role: v as UserRole }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 self-end pb-2">
                <Switch
                  id="staff-active"
                  checked={edit.is_active}
                  onCheckedChange={(v) => setEdit((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="staff-active">Active</Label>
              </div>
            </div>

            {edit.id && (
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
                <Label className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
                  <FileText className="size-3.5" /> Documents
                </Label>
                {(editExtras?.docs ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span>{d.name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const { data, error } = await supabase.storage
                          .from("staff-documents")
                          .createSignedUrl(d.file_url, 60)
                        if (error) return toast.error(error.message)
                        window.open(data.signedUrl, "_blank")
                      }}
                    >
                      View
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Document name"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploadDoc.isPending}
                  >
                    <Upload className="size-3.5" /> Upload
                  </Button>
                  <input
                    ref={docInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadDoc.mutate(file)
                    }}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={saveEdit.isPending}>
                {saveEdit.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Edit</TableHead>
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
              {!isLoading && staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No staff yet.
                  </TableCell>
                </TableRow>
              )}
              {staff.map((row) => {
                const initials = row.profile.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{row.profile.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{row.title ?? "—"}</TableCell>
                    <TableCell>{row.specialization ?? "—"}</TableCell>
                    <TableCell>{Number(row.commission_rate)}%</TableCell>
                    <TableCell className="capitalize">{row.profile.role}</TableCell>
                    <TableCell>
                      <Badge variant={row.profile.is_active ? "success" : "outline"}>
                        {row.profile.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance — this month</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Est. commission</TableHead>
                <TableHead>Tips</TableHead>
                <TableHead>Avg rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((row) => {
                const perf = performance[row.id]
                const avgRating = perf?.ratings.length
                  ? (perf.ratings.reduce((a, b) => a + b, 0) / perf.ratings.length).toFixed(1)
                  : "—"
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.profile.full_name}</TableCell>
                    <TableCell>{perf?.completed ?? 0}</TableCell>
                    <TableCell>Rs {(perf?.revenue ?? 0).toFixed(2)}</TableCell>
                    <TableCell>Rs {(((perf?.revenue ?? 0) * Number(row.commission_rate)) / 100).toFixed(2)}</TableCell>
                    <TableCell>Rs {(perf?.tips ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {avgRating !== "—" && <Star className="mr-1 inline size-3 fill-accent text-accent" />}
                      {avgRating}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
