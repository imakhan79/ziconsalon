import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Trash2, PackageCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useBranches } from "@/hooks/useBranches"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { Product, PurchaseOrder, PurchaseOrderStatus, Vendor } from "@/types"

const STATUS_VARIANT: Record<PurchaseOrderStatus, "outline" | "warning" | "default" | "success" | "destructive"> = {
  draft: "outline",
  ordered: "warning",
  partially_received: "default",
  received: "success",
  cancelled: "destructive",
}

interface Line {
  product_id: string
  qty_ordered: string
  unit_cost: string
}

const emptyLine = (): Line => ({ product_id: "", qty_ordered: "1", unit_cost: "0" })

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient()
  const { branches, defaultBranchId } = useBranches()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [vendorId, setVendorId] = React.useState("")
  const [branchId, setBranchId] = React.useState("")
  const [lines, setLines] = React.useState<Line[]>([emptyLine()])

  const [receiveId, setReceiveId] = React.useState<string | null>(null)
  const [receiveQty, setReceiveQty] = React.useState<Record<string, string>>({})
  const [batchNumber, setBatchNumber] = React.useState<Record<string, string>>({})
  const [expiryDate, setExpiryDate] = React.useState<Record<string, string>>({})

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, vendor:vendors(*)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as PurchaseOrder[]
    },
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-all"],
    enabled: createOpen,
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as Vendor[]
    },
  })

  const { data: products = [] } = useQuery({
    queryKey: ["po-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as Product[]
    },
  })

  const { data: receiveOrder } = useQuery({
    queryKey: ["po-detail", receiveId],
    enabled: !!receiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, vendor:vendors(*), items:purchase_order_items(*, product:products(*))")
        .eq("id", receiveId!)
        .single()
      if (error) throw error
      return data as unknown as PurchaseOrder
    },
  })

  const resetCreate = () => {
    setVendorId("")
    setBranchId(defaultBranchId)
    setLines([emptyLine()])
  }

  const createPO = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter((l) => l.product_id)
      if (validLines.length === 0) throw new Error("Add at least one line item")

      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          vendor_id: vendorId || null,
          branch_id: branchId || null,
          status: "ordered",
          ordered_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (poErr) throw poErr

      const items = validLines.map((l) => ({
        purchase_order_id: po.id,
        product_id: l.product_id,
        qty_ordered: Number(l.qty_ordered),
        unit_cost: Number(l.unit_cost),
      }))
      const { error: itemsErr } = await supabase.from("purchase_order_items").insert(items)
      if (itemsErr) throw itemsErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] })
      setCreateOpen(false)
      resetCreate()
      toast.success("Purchase order created")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const receiveItem = useMutation({
    mutationFn: async (itemId: string) => {
      const qty = Number(receiveQty[itemId])
      if (!qty || qty <= 0) throw new Error("Enter a valid quantity")
      const { error } = await supabase.rpc("receive_po_item", {
        p_po_item_id: itemId,
        p_qty_received: qty,
        p_batch_number: batchNumber[itemId] || null,
        p_expiry_date: expiryDate[itemId] || null,
      })
      if (error) throw error
    },
    onSuccess: (_data, itemId) => {
      queryClient.invalidateQueries({ queryKey: ["po-detail", receiveId] })
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setReceiveQty((q) => ({ ...q, [itemId]: "" }))
      setBatchNumber((b) => ({ ...b, [itemId]: "" }))
      setExpiryDate((e) => ({ ...e, [itemId]: "" }))
      toast.success("Stock received")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Purchase Orders</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setBranchId(defaultBranchId)}>
              <Plus /> New PO
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>New purchase order</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                createPO.mutate()
              }}
            >
              <div className="flex flex-col gap-2">
                <Label>Vendor</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
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

              <div className="flex flex-col gap-2">
                <Label>Line items</Label>
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={line.product_id}
                      onValueChange={(v) =>
                        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, product_id: v } : l)))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={line.qty_ordered}
                      onChange={(e) =>
                        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, qty_ordered: e.target.value } : l)))
                      }
                      className="w-20"
                      placeholder="Qty"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unit_cost}
                      onChange={(e) =>
                        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unit_cost: e.target.value } : l)))
                      }
                      className="w-24"
                      placeholder="Unit cost"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                  <Plus /> Add line
                </Button>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createPO.isPending}>
                  {createPO.isPending ? "Creating..." : "Create PO"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!receiveId} onOpenChange={(open) => !open && setReceiveId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive {receiveOrder?.po_number}</DialogTitle>
          </DialogHeader>
          {receiveOrder && (
            <div className="flex flex-col gap-4">
              {(receiveOrder.items ?? []).map((item) => {
                const remaining = Number(item.qty_ordered) - Number(item.qty_received)
                return (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.product?.name}</span>
                      <span className="text-muted-foreground">
                        {item.qty_received} / {item.qty_ordered} received
                      </span>
                    </div>
                    {remaining > 0 ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Qty now</Label>
                          <Input
                            type="number"
                            min={0.01}
                            step="0.01"
                            max={remaining}
                            value={receiveQty[item.id] ?? ""}
                            onChange={(e) => setReceiveQty((q) => ({ ...q, [item.id]: e.target.value }))}
                            className="w-20"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Batch # (optional)</Label>
                          <Input
                            value={batchNumber[item.id] ?? ""}
                            onChange={(e) => setBatchNumber((b) => ({ ...b, [item.id]: e.target.value }))}
                            className="w-28"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Expiry (optional)</Label>
                          <Input
                            type="date"
                            value={expiryDate[item.id] ?? ""}
                            onChange={(e) => setExpiryDate((ex) => ({ ...ex, [item.id]: e.target.value }))}
                            className="w-36"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={receiveItem.isPending}
                          onClick={() => receiveItem.mutate(item.id)}
                        >
                          Receive
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="success" className="w-fit">
                        Fully received
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-24">Receive</TableHead>
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
              {!isLoading && purchaseOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No purchase orders yet.
                  </TableCell>
                </TableRow>
              )}
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{po.vendor?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[po.status]} className="capitalize">
                      {po.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(po.created_at), "PP")}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={po.status === "received" || po.status === "cancelled"}
                      onClick={() => setReceiveId(po.id)}
                    >
                      <PackageCheck className="size-4" />
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
