import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil, Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { logAction } from "@/lib/audit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import type { Branch, Profile } from "@/types"

const emptyForm = {
  id: "",
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  timezone: "UTC",
  is_active: true,
}

export default function BranchesPage() {
  const { profile: me } = useAuth()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["admin-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name")
      if (error) throw error
      return data as Branch[]
    },
  })

  const { data: managers = [] } = useQuery({
    queryKey: ["branch-managers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "manager")
      if (error) throw error
      return data as Profile[]
    },
  })

  const save = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        name: values.name,
        code: values.code || null,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        timezone: values.timezone,
        is_active: values.is_active,
      }
      if (values.id) {
        const { error } = await supabase.from("branches").update(payload).eq("id", values.id)
        if (error) throw error
        if (me) await logAction(me.id, "branch.updated", "branch", values.id, { name: values.name })
      } else {
        const { data, error } = await supabase.from("branches").insert(payload).select().single()
        if (error) throw error
        if (me) await logAction(me.id, "branch.created", "branch", data.id, { name: values.name })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-branches"] })
      setDialogOpen(false)
      setForm(emptyForm)
      toast.success("Branch saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (b: Branch) => {
    setForm({
      id: b.id,
      name: b.name,
      code: b.code ?? "",
      address: b.address ?? "",
      phone: b.phone ?? "",
      email: b.email ?? "",
      timezone: b.timezone,
      is_active: b.is_active,
    })
    setDialogOpen(true)
  }

  const managerNames = (branchId: string) =>
    managers.filter((m) => m.branch_id === branchId).map((m) => m.full_name)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Branch Management</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus /> New branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit branch" : "New branch"}</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate(form)
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="br-name">Name</Label>
                  <Input
                    id="br-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="br-code">Code</Label>
                  <Input
                    id="br-code"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="DOWNTOWN"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="br-address">Address</Label>
                <Input
                  id="br-address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="br-phone">Phone</Label>
                  <Input
                    id="br-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="br-email">Email</Label>
                  <Input
                    id="br-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="br-tz">Timezone</Label>
                <Input
                  id="br-tz"
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  placeholder="America/New_York"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="br-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="br-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving..." : "Save"}
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
                <TableHead>Branch</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Manager(s)</TableHead>
                <TableHead>Timezone</TableHead>
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
              {!isLoading && branches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2 py-6">
                      <Building2 className="size-8 text-muted-foreground/50" />
                      No branches yet.
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {branches.map((b) => {
                const names = managerNames(b.id)
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.code ?? "—"}</TableCell>
                    <TableCell>{names.length ? names.join(", ") : "Unassigned"}</TableCell>
                    <TableCell>{b.timezone}</TableCell>
                    <TableCell>
                      <Badge variant={b.is_active ? "success" : "outline"}>
                        {b.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
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
