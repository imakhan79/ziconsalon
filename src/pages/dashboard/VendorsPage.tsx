import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useBranches } from "@/hooks/useBranches"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Vendor } from "@/types"

const emptyForm = {
  id: "",
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  branch_id: "",
  is_active: true,
}

export default function VendorsPage() {
  const queryClient = useQueryClient()
  const { branches, defaultBranchId } = useBranches()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("name")
      if (error) throw error
      return data as Vendor[]
    },
  })

  const saveVendor = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        name: values.name,
        contact_name: values.contact_name || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        branch_id: values.branch_id || null,
        is_active: values.is_active,
      }
      if (values.id) {
        const { error } = await supabase.from("vendors").update(payload).eq("id", values.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("vendors").insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] })
      setDialogOpen(false)
      setForm(emptyForm)
      toast.success("Vendor saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setForm({ ...emptyForm, branch_id: defaultBranchId })
    setDialogOpen(true)
  }

  const openEdit = (v: Vendor) => {
    setForm({
      id: v.id,
      name: v.name,
      contact_name: v.contact_name ?? "",
      phone: v.phone ?? "",
      email: v.email ?? "",
      address: v.address ?? "",
      branch_id: v.branch_id ?? "",
      is_active: v.is_active,
    })
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Vendors</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus /> New vendor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit vendor" : "New vendor"}</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                saveVendor.mutate(form)
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="vendor-name">Name</Label>
                <Input
                  id="vendor-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vendor-contact">Contact name</Label>
                  <Input
                    id="vendor-contact"
                    value={form.contact_name}
                    onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vendor-phone">Phone</Label>
                  <Input
                    id="vendor-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="vendor-address">Address</Label>
                <Input
                  id="vendor-address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
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
              <div className="flex items-center gap-2">
                <Switch
                  id="vendor-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="vendor-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saveVendor.isPending}>
                  {saveVendor.isPending ? "Saving..." : "Save"}
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
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
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
              {!isLoading && vendors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No vendors yet.
                  </TableCell>
                </TableRow>
              )}
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.contact_name ?? "—"}</TableCell>
                  <TableCell>{v.phone ?? "—"}</TableCell>
                  <TableCell>{v.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={v.is_active ? "success" : "outline"}>
                      {v.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                      <Pencil className="size-4" />
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
