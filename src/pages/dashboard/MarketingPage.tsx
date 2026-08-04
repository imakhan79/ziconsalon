import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { Promotion } from "@/types"

const emptyForm = {
  id: "",
  code: "",
  name: "",
  branch_id: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: "0",
  starts_at: "",
  ends_at: "",
  usage_limit: "",
  is_active: true,
}

export default function MarketingPage() {
  const queryClient = useQueryClient()
  const { branches } = useBranches()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as Promotion[]
    },
  })

  const save = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        code: values.code || null,
        name: values.name,
        branch_id: values.branch_id || null,
        discount_type: values.discount_type,
        discount_value: Number(values.discount_value),
        starts_at: values.starts_at ? new Date(values.starts_at).toISOString() : null,
        ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
        usage_limit: values.usage_limit ? Number(values.usage_limit) : null,
        is_active: values.is_active,
      }
      if (values.id) {
        const { error } = await supabase.from("promotions").update(payload).eq("id", values.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("promotions").insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] })
      setDialogOpen(false)
      setForm(emptyForm)
      toast.success("Promotion saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] })
      toast.success("Promotion deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (p: Promotion) => {
    setForm({
      id: p.id,
      code: p.code ?? "",
      name: p.name,
      branch_id: p.branch_id ?? "",
      discount_type: p.discount_type,
      discount_value: String(p.discount_value),
      starts_at: p.starts_at ? p.starts_at.slice(0, 10) : "",
      ends_at: p.ends_at ? p.ends_at.slice(0, 10) : "",
      usage_limit: p.usage_limit != null ? String(p.usage_limit) : "",
      is_active: p.is_active,
    })
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Marketing</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus /> New promotion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit promotion" : "New promotion"}</DialogTitle>
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
                  <Label htmlFor="promo-name">Name</Label>
                  <Input
                    id="promo-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="promo-code">Code</Label>
                  <Input
                    id="promo-code"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="SUMMER10"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Branch</Label>
                <Select
                  value={form.branch_id || "all"}
                  onValueChange={(v) => setForm((f) => ({ ...f, branch_id: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Discount type</Label>
                  <Select
                    value={form.discount_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v as "percent" | "fixed" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="promo-value">
                    {form.discount_type === "percent" ? "Discount %" : "Discount amount"}
                  </Label>
                  <Input
                    id="promo-value"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="promo-start">Starts</Label>
                  <Input
                    id="promo-start"
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="promo-end">Ends</Label>
                  <Input
                    id="promo-end"
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="promo-usage-limit">Usage limit (optional)</Label>
                <Input
                  id="promo-usage-limit"
                  type="number"
                  min={1}
                  value={form.usage_limit}
                  onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="promo-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="promo-active">Active</Label>
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
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
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
              {!isLoading && promotions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2 py-6">
                      <Megaphone className="size-8 text-muted-foreground/50" />
                      No promotions yet.
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {promotions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.code ?? "—"}</TableCell>
                  <TableCell>
                    {p.discount_type === "percent"
                      ? `${Number(p.discount_value)}%`
                      : `$${Number(p.discount_value).toFixed(2)}`}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.starts_at ? format(new Date(p.starts_at), "PP") : "—"} →{" "}
                    {p.ends_at ? format(new Date(p.ends_at), "PP") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.usage_limit != null ? `${p.usage_count} / ${p.usage_limit}` : `${p.usage_count} / ∞`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "success" : "outline"}>
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete promotion?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(p.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
