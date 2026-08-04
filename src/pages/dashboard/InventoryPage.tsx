import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil, PackagePlus } from "lucide-react"
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
import type { InventoryTxnType, Product } from "@/types"

const emptyForm = {
  id: "",
  sku: "",
  name: "",
  category: "",
  branch_id: "",
  cost_price: "0",
  sell_price: "0",
  stock_qty: "0",
  reorder_level: "0",
  is_active: true,
}

export default function InventoryPage() {
  const queryClient = useQueryClient()
  const { branches, defaultBranchId } = useBranches()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  const [adjustProduct, setAdjustProduct] = React.useState<Product | null>(null)
  const [adjustType, setAdjustType] = React.useState<InventoryTxnType>("purchase")
  const [adjustQty, setAdjustQty] = React.useState("")
  const [adjustNote, setAdjustNote] = React.useState("")

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name")
      if (error) throw error
      return data as Product[]
    },
  })

  const saveProduct = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        sku: values.sku || null,
        name: values.name,
        category: values.category || null,
        branch_id: values.branch_id || null,
        cost_price: Number(values.cost_price),
        sell_price: Number(values.sell_price),
        stock_qty: Number(values.stock_qty),
        reorder_level: Number(values.reorder_level),
        is_active: values.is_active,
      }
      if (values.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", values.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("products").insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setDialogOpen(false)
      setForm(emptyForm)
      toast.success("Product saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const adjustStock = useMutation({
    mutationFn: async () => {
      if (!adjustProduct) return
      const qty = Number(adjustQty)
      if (!qty) throw new Error("Enter a quantity")
      const delta = adjustType === "sale" ? -Math.abs(qty) : qty

      const { error: txnErr } = await supabase.from("inventory_transactions").insert({
        product_id: adjustProduct.id,
        type: adjustType,
        qty: delta,
        note: adjustNote || null,
      })
      if (txnErr) throw txnErr

      const { error: prodErr } = await supabase
        .from("products")
        .update({ stock_qty: Number(adjustProduct.stock_qty) + delta })
        .eq("id", adjustProduct.id)
      if (prodErr) throw prodErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setAdjustProduct(null)
      setAdjustQty("")
      setAdjustNote("")
      toast.success("Stock updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setForm({ ...emptyForm, branch_id: defaultBranchId })
    setDialogOpen(true)
  }

  const openEdit = (p: Product) => {
    setForm({
      id: p.id,
      sku: p.sku ?? "",
      name: p.name,
      category: p.category ?? "",
      branch_id: p.branch_id ?? "",
      cost_price: String(p.cost_price),
      sell_price: String(p.sell_price),
      stock_qty: String(p.stock_qty),
      reorder_level: String(p.reorder_level),
      is_active: p.is_active,
    })
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Inventory</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus /> New product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit product" : "New product"}</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                saveProduct.mutate(form)
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prod-name">Name</Label>
                  <Input
                    id="prod-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prod-sku">SKU</Label>
                  <Input
                    id="prod-sku"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="prod-category">Category</Label>
                <Input
                  id="prod-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prod-cost">Cost price</Label>
                  <Input
                    id="prod-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prod-sell">Sell price</Label>
                  <Input
                    id="prod-sell"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.sell_price}
                    onChange={(e) => setForm((f) => ({ ...f, sell_price: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prod-stock">Stock qty</Label>
                  <Input
                    id="prod-stock"
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={!!form.id}
                    value={form.stock_qty}
                    onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prod-reorder">Reorder level</Label>
                  <Input
                    id="prod-reorder"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.reorder_level}
                    onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
                  />
                </div>
              </div>
              {form.id && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Use "Adjust stock" from the table to change quantity on hand.
                </p>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="prod-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="prod-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saveProduct.isPending}>
                  {saveProduct.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!adjustProduct} onOpenChange={(open) => !open && setAdjustProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock — {adjustProduct?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              adjustStock.mutate()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as InventoryTxnType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase (add stock)</SelectItem>
                  <SelectItem value="sale">Sale (remove stock)</SelectItem>
                  <SelectItem value="return">Return (add stock)</SelectItem>
                  <SelectItem value="adjustment">Adjustment (+/-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="adj-qty">Quantity</Label>
              <Input
                id="adj-qty"
                type="number"
                step="0.01"
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder={adjustType === "adjustment" ? "Use negative to subtract" : undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="adj-note">Note</Label>
              <Input id="adj-note" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={adjustStock.isPending}>
                {adjustStock.isPending ? "Saving..." : "Save"}
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
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Sell price</TableHead>
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
              {!isLoading && products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No products yet.
                  </TableCell>
                </TableRow>
              )}
              {products.map((p) => {
                const low = Number(p.stock_qty) <= Number(p.reorder_level)
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku ?? "—"}</TableCell>
                    <TableCell>{p.category ?? "—"}</TableCell>
                    <TableCell>
                      <span className={low ? "text-destructive font-medium" : undefined}>
                        {p.stock_qty}
                      </span>
                    </TableCell>
                    <TableCell>${Number(p.sell_price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "success" : "outline"}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setAdjustProduct(p)}>
                          <PackagePlus className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                      </div>
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
