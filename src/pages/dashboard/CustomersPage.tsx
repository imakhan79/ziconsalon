import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Search } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
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
import type { Profile } from "@/types"

const emptyEdit = { id: "", phone: "", is_active: true }

export default function CustomersPage() {
  const { profile: me } = useAuth()
  const canEdit = me && ["admin", "manager"].includes(me.role)
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [editOpen, setEditOpen] = React.useState(false)
  const [edit, setEdit] = React.useState(emptyEdit)

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "customer")
        .order("full_name")
      if (error) throw error
      return data as Profile[]
    },
  })

  const filtered = customers.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const saveEdit = useMutation({
    mutationFn: async (values: typeof edit) => {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: values.phone || null, is_active: values.is_active })
        .eq("id", values.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      setEditOpen(false)
      toast.success("Customer updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openEdit = (c: Profile) => {
    setEdit({ id: c.id, phone: c.phone ?? "", is_active: c.is_active })
    setEditOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Customers</h1>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {canEdit && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit customer</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                saveEdit.mutate(edit)
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="cust-phone">Phone</Label>
                <Input
                  id="cust-phone"
                  value={edit.phone}
                  onChange={(e) => setEdit((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="cust-active"
                  checked={edit.is_active}
                  onCheckedChange={(v) => setEdit((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="cust-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saveEdit.isPending}>
                  {saveEdit.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-16">Edit</TableHead>}
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
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => {
                const initials = c.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{c.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>{format(new Date(c.created_at), "PP")}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "success" : "outline"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    )}
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
