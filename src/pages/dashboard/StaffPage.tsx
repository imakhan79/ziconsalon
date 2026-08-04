import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import type { Profile, Staff, UserRole } from "@/types"

type StaffRow = Staff & { profile: Profile }

const emptyEdit = {
  id: "",
  title: "",
  specialization: "",
  commission_rate: "0",
  hired_at: "",
  bio: "",
  role: "staff" as UserRole,
  is_active: true,
}

export default function StaffPage() {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)
  const [promoteOpen, setPromoteOpen] = React.useState(false)
  const [edit, setEdit] = React.useState(emptyEdit)
  const [promoteProfileId, setPromoteProfileId] = React.useState("")
  const [promoteRole, setPromoteRole] = React.useState<UserRole>("staff")

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("*, profile:profiles(*)")
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
        })
        .eq("id", values.id)
      if (staffErr) throw staffErr

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ role: values.role, is_active: values.is_active })
        .eq("id", values.id)
      if (profileErr) throw profileErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      setEditOpen(false)
      toast.success("Staff member updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openEdit = (row: StaffRow) => {
    setEdit({
      id: row.id,
      title: row.title ?? "",
      specialization: row.specialization ?? "",
      commission_rate: String(row.commission_rate),
      hired_at: row.hired_at ?? "",
      bio: row.bio ?? "",
      role: row.profile.role,
      is_active: row.profile.is_active,
    })
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
        <DialogContent>
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex items-center gap-2">
              <Switch
                id="staff-active"
                checked={edit.is_active}
                onCheckedChange={(v) => setEdit((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="staff-active">Active</Label>
            </div>
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
    </div>
  )
}
