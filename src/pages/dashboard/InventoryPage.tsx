import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Pencil, PackagePlus, ScanLine, AlertTriangle, DollarSign, CalendarClock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useBranches } from "@/hooks/useBranches"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
import type { InventoryTxnType, Product, ProductBatch } from "@/types"

const emptyForm = {
  id: "",
  sku: "",
  barcode: "",
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
  const [scanCode, setScanCode] = React.useState("")

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name")
      if (error) throw error
      return data as Product[]
    },
  })

  const { data: lowStock = [] } = useQuery({
    queryKey: ["low-stock-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("low_stock_products").select("*").order("name")
      if (error) throw error
      return data as Product[]
    },
  })

  const { data: valuation = [] } = useQuery({
    queryKey: ["inventory-valuation"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_valuation").select("*")
      if (error) throw error
      return data as { branch_id: string | null; category: string | null; total_value: number; total_qty: number }[]
    },
  })
  const totalValue = valuation.reduce((s, v) => s + Number(v.total_value), 0)

  const { data: expiringBatches = [] } = useQuery({
    queryKey: ["expiring-batches"],
    queryFn: async () => {
      const in30Days = new Date()
      in30Days.setDate(in30Days.getDate() + 30)
      const { data, error } = await supabase
        .from("product_batches")
        .select("*, product:products(*)")
        .not("expiry_date", "is", null)
        .lte("expiry_date", in30Days.toISOString().slice(0, 10))
        .gt("qty", 0)
        .order("expiry_date")
      if (error) throw error
      return data as unknown as ProductBatch[]
    },
  })
  const [writeOffQty, setWriteOffQty] = React.useState<Record<string, string>>({})

  const saveProduct = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        sku: values.sku || null,
        barcode: values.barcode || null,
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
      queryClient.invalidateQueries({ queryKey: ["low-stock-products"] })
      queryClient.invalidateQueries({ queryKey: ["inventory-valuation"] })
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

      const { error } = await supabase.rpc("adjust_stock", {
        p_product_id: adjustProduct.id,
        p_qty_delta: delta,
        p_type: adjustType,
        p_note: adjustNote || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["low-stock-products"] })
      queryClient.invalidateQueries({ queryKey: ["inventory-valuation"] })
      setAdjustProduct(null)
      setAdjustQty("")
      setAdjustNote("")
      toast.success("Stock updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const writeOff = useMutation({
    mutationFn: async (batch: ProductBatch) => {
      const qty = Number(writeOffQty[batch.id] ?? batch.qty)
      if (!qty || qty <= 0) throw new Error("Enter a valid quantity")
      const { error } = await supabase.rpc("write_off_batch", {
        p_batch_id: batch.id,
        p_qty: qty,
        p_reason: "Expired stock write-off",
      })
      if (error) throw error
    },
    onSuccess: (_data, batch) => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["expiring-batches"] })
      queryClient.invalidateQueries({ queryKey: ["low-stock-products"] })
      setWriteOffQty((q) => ({ ...q, [batch.id]: "" }))
      toast.success("Stock written off")
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
      barcode: p.barcode ?? "",
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

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    const code = scanCode.trim()
    setScanCode("")
    if (!code) return
    const match = products.find((p) => p.barcode === code)
    if (!match) {
      toast.error("No product found for that barcode")
      return
    }
    setAdjustProduct(match)
    setAdjustType("purchase")
    setAdjustQty("")
    setAdjustNote("")
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
                <Label htmlFor="prod-barcode">Barcode</Label>
                <Input
                  id="prod-barcode"
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                />
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="gradient-luxury rounded-xl p-3">
              <DollarSign className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inventory value</p>
              <p className="font-display text-xl font-semibold">${totalValue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="gradient-gold rounded-xl p-3">
              <AlertTriangle className="size-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Low stock items</p>
              <p className="font-display text-xl font-semibold">{lowStock.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="gradient-luxury rounded-xl p-3">
              <ScanLine className="size-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Scan barcode</p>
              <Input
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={handleScan}
                placeholder="Scan or type barcode, press Enter"
                className="h-8"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <CardTitle className="text-base">Low stock</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="text-destructive font-medium">
                  {p.stock_qty} left (reorder at {p.reorder_level})
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {expiringBatches.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-accent" />
              <CardTitle className="text-base">Expiring soon</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {expiringBatches.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {b.product?.name} {b.batch_number ? `(#${b.batch_number})` : ""} —{" "}
                  {b.expiry_date ? format(new Date(b.expiry_date), "PP") : "no expiry"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{b.qty} remaining</span>
                  <Input
                    type="number"
                    min={0.01}
                    max={b.qty}
                    step="0.01"
                    placeholder={String(b.qty)}
                    value={writeOffQty[b.id] ?? ""}
                    onChange={(e) => setWriteOffQty((q) => ({ ...q, [b.id]: e.target.value }))}
                    className="h-8 w-20"
                  />
                  <Button size="sm" variant="outline" disabled={writeOff.isPending} onClick={() => writeOff.mutate(b)}>
                    Write off
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
