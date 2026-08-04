import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Pencil, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { logAction } from "@/lib/audit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Branch, Profile, UserRole } from "@/types"

const emptyEdit = { id: "", role: "customer" as UserRole, branch_id: "", is_active: true }

export default function UsersPage() {
  const { profile: me } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<UserRole | "all">("all")
  const [editOpen, setEditOpen] = React.useState(false)
  const [edit, setEdit] = React.useState(emptyEdit)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name")
      if (error) throw error
      return data as Profile[]
    },
  })

  const { data: branches = [] } = useQuery({
    queryKey: ["admin-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name")
      if (error) throw error
      return data as Branch[]
    },
  })

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—"

  const filtered = users.filter((u) => {
    const matchesSearch = u.full_name.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === "all" || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const save = useMutation({
    mutationFn: async (values: typeof edit) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: values.role,
          branch_id: values.role === "customer" ? null : values.branch_id || null,
          is_active: values.is_active,
        })
        .eq("id", values.id)
      if (error) throw error
      if (me) await logAction(me.id, "user.updated", "profile", values.id, { role: values.role })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setEditOpen(false)
      toast.success("User updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openEdit = (u: Profile) => {
    setEdit({ id: u.id, role: u.role, branch_id: u.branch_id ?? "", is_active: u.is_active })
    setEditOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">User Management</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | "all")}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate(edit)
            }}
          >
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={edit.role} onValueChange={(v) => setEdit((f) => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Super Administrator)</SelectItem>
                  <SelectItem value="manager">Manager (Branch Administrator)</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {edit.role !== "customer" && (
              <div className="flex flex-col gap-2">
                <Label>Branch</Label>
                <Select value={edit.branch_id || "none"} onValueChange={(v) => setEdit((f) => ({ ...f, branch_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Assign a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="user-active"
                checked={edit.is_active}
                onCheckedChange={(v) => setEdit((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="user-active">Active</Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save"}
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
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((u) => {
                const initials = u.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell>{branchName(u.branch_id)}</TableCell>
                    <TableCell>{format(new Date(u.created_at), "PP")}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "success" : "outline"}>
                        {u.is_active ? "Active" : "Suspended"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
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
