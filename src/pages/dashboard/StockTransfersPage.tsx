import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Trash2, ArrowRightLeft } from "lucide-react"
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
import type { Branch, Product, StockTransfer, StockTransferStatus } from "@/types"

const STATUS_VARIANT: Record<StockTransferStatus, "outline" | "warning" | "default" | "success" | "destructive"> = {
  pending: "warning",
  in_transit: "default",
  completed: "success",
  cancelled: "destructive",
}

interface Line {
  from_product_id: string
  to_product_id: string
  qty: string
}

const emptyLine = (): Line => ({ from_product_id: "", to_product_id: "", qty: "1" })

export default function StockTransfersPage() {
  const queryClient = useQueryClient()
  const { defaultBranchId } = useBranches()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [fromBranchId, setFromBranchId] = React.useState("")
  const [toBranchId, setToBranchId] = React.useState("")
  const [lines, setLines] = React.useState<Line[]>([emptyLine()])

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["stock-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_transfers")
        .select("*, from_branch:branches!stock_transfers_from_branch_id_fkey(*), to_branch:branches!stock_transfers_to_branch_id_fkey(*)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as StockTransfer[]
    },
  })

  const { data: allBranches = [] } = useQuery({
    queryKey: ["transfer-branches"],
    enabled: createOpen,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as Branch[]
    },
  })

  const { data: products = [] } = useQuery({
    queryKey: ["transfer-products"],
    enabled: createOpen,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as Product[]
    },
  })

  const fromProducts = products.filter((p) => p.branch_id === fromBranchId)
  const toProducts = products.filter((p) => p.branch_id === toBranchId)

  const resetCreate = () => {
    setFromBranchId(defaultBranchId)
    setToBranchId("")
    setLines([emptyLine()])
  }

  const setLineFromProduct = (idx: number, productId: string) => {
    const fromProduct = fromProducts.find((p) => p.id === productId)
    const match = fromProduct ? toProducts.find((p) => p.sku && p.sku === fromProduct.sku) : undefined
    setLines((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, from_product_id: productId, to_product_id: match?.id ?? l.to_product_id } : l))
    )
  }

  const createTransfer = useMutation({
    mutationFn: async () => {
      if (!fromBranchId || !toBranchId) throw new Error("Select both branches")
      if (fromBranchId === toBranchId) throw new Error("Branches must be different")
      const validLines = lines.filter((l) => l.from_product_id && l.to_product_id)
      if (validLines.length === 0) throw new Error("Add at least one line item")

      const { data: transfer, error: trErr } = await supabase
        .from("stock_transfers")
        .insert({ from_branch_id: fromBranchId, to_branch_id: toBranchId })
        .select()
        .single()
      if (trErr) throw trErr

      const items = validLines.map((l) => ({
        transfer_id: transfer.id,
        from_product_id: l.from_product_id,
        to_product_id: l.to_product_id,
        qty: Number(l.qty),
      }))
      const { error: itemsErr } = await supabase.from("stock_transfer_items").insert(items)
      if (itemsErr) throw itemsErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] })
      setCreateOpen(false)
      resetCreate()
      toast.success("Transfer created")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const completeTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("complete_stock_transfer", { p_transfer_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success("Transfer completed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Stock Transfers</h1>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (open) resetCreate()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus /> New transfer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>New stock transfer</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                createTransfer.mutate()
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>From branch</Label>
                  <Select value={fromBranchId} onValueChange={setFromBranchId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Source branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {allBranches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>To branch</Label>
                  <Select value={toBranchId} onValueChange={setToBranchId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Destination branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {allBranches
                        .filter((b) => b.id !== fromBranchId)
                        .map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Line items</Label>
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={line.from_product_id} onValueChange={(v) => setLineFromProduct(idx, v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Source product" />
                      </SelectTrigger>
                      <SelectContent>
                        {fromProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.stock_qty} in stock)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={line.to_product_id}
                      onValueChange={(v) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, to_product_id: v } : l)))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Destination product" />
                      </SelectTrigger>
                      <SelectContent>
                        {toProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l)))}
                      className="w-16"
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
                <p className="text-xs text-muted-foreground">
                  Destination product auto-matches by SKU when available — override if needed.
                </p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createTransfer.isPending}>
                  {createTransfer.isPending ? "Creating..." : "Create transfer"}
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
                <TableHead>Transfer #</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-24">Complete</TableHead>
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
              {!isLoading && transfers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No transfers yet.
                  </TableCell>
                </TableRow>
              )}
              {transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.transfer_number}</TableCell>
                  <TableCell>{t.from_branch?.name ?? "—"}</TableCell>
                  <TableCell>{t.to_branch?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[t.status]} className="capitalize">
                      {t.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(t.created_at), "PP")}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={t.status === "completed" || t.status === "cancelled"}
                      onClick={() => completeTransfer.mutate(t.id)}
                    >
                      <ArrowRightLeft className="size-4" />
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
