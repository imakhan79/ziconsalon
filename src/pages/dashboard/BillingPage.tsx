import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Trash2, Eye } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useBranches } from "@/hooks/useBranches"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import type { Invoice, InvoiceStatus, PaymentMethod, Profile } from "@/types"

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "success" | "warning" | "destructive" | "outline"> = {
  unpaid: "warning",
  partial: "default",
  paid: "success",
  refunded: "outline",
  void: "destructive",
}

interface LineItem {
  description: string
  quantity: string
  unit_price: string
}

const emptyLine = (): LineItem => ({ description: "", quantity: "1", unit_price: "0" })

export default function BillingPage() {
  const queryClient = useQueryClient()
  const { branches, defaultBranchId } = useBranches()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [customerId, setCustomerId] = React.useState("")
  const [branchId, setBranchId] = React.useState("")
  const [discount, setDiscount] = React.useState("0")
  const [tax, setTax] = React.useState("0")
  const [serviceCharge, setServiceCharge] = React.useState("0")
  const [lines, setLines] = React.useState<LineItem[]>([emptyLine()])

  const [viewId, setViewId] = React.useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [paymentTip, setPaymentTip] = React.useState("")
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash")
  const [paymentRef, setPaymentRef] = React.useState("")

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customer:profiles!invoices_customer_id_fkey(*)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as Invoice[]
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ["all-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name")
      if (error) throw error
      return data as Profile[]
    },
    enabled: createOpen,
  })

  const { data: viewInvoice } = useQuery({
    queryKey: ["invoice-detail", viewId],
    enabled: !!viewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customer:profiles!invoices_customer_id_fkey(*), items:invoice_items(*), payments:payments(*)")
        .eq("id", viewId!)
        .single()
      if (error) throw error
      return data as unknown as Invoice
    },
  })

  const subtotal = lines.reduce(
    (sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0),
    0
  )
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0) + Number(serviceCharge || 0))

  const resetCreate = () => {
    setCustomerId("")
    setBranchId(defaultBranchId)
    setDiscount("0")
    setTax("0")
    setServiceCharge("0")
    setLines([emptyLine()])
  }

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error("Select a customer")
      const validLines = lines.filter((l) => l.description.trim())
      if (validLines.length === 0) throw new Error("Add at least one line item")

      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          customer_id: customerId,
          branch_id: branchId || null,
          subtotal,
          discount: Number(discount || 0),
          tax: Number(tax || 0),
          service_charge: Number(serviceCharge || 0),
          total,
        })
        .select()
        .single()
      if (invErr) throw invErr

      const items = validLines.map((l) => ({
        invoice_id: invoice.id,
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        line_total: Number(l.quantity) * Number(l.unit_price),
      }))
      const { error: itemsErr } = await supabase.from("invoice_items").insert(items)
      if (itemsErr) throw itemsErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      setCreateOpen(false)
      resetCreate()
      toast.success("Invoice created")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const addPayment = useMutation({
    mutationFn: async () => {
      if (!viewInvoice) return
      const amount = Number(paymentAmount)
      if (!amount || amount <= 0) throw new Error("Enter a valid amount")

      if (paymentMethod === "gift_card") {
        const { error } = await supabase.rpc("redeem_gift_card", {
          p_code: paymentRef.trim(),
          p_amount: amount,
          p_invoice_id: viewInvoice.id,
        })
        if (error) throw error
      } else if (paymentMethod === "store_credit") {
        if (!viewInvoice.customer_id) throw new Error("Store credit requires a customer account")
        const { error } = await supabase.rpc("redeem_store_credit", {
          p_customer_id: viewInvoice.customer_id,
          p_amount: amount,
          p_invoice_id: viewInvoice.id,
        })
        if (error) throw error
      }

      const tip = Number(paymentTip || 0)
      const { error: payErr } = await supabase.from("payments").insert({
        invoice_id: viewInvoice.id,
        amount,
        tip_amount: tip,
        method: paymentMethod,
        reference: paymentRef || null,
      })
      if (payErr) throw payErr

      const paidSoFar = (viewInvoice.payments ?? []).reduce((s, p) => s + Number(p.amount), 0) + amount
      const newStatus: InvoiceStatus = paidSoFar >= Number(viewInvoice.total) ? "paid" : "partial"
      const { error: invErr } = await supabase
        .from("invoices")
        .update({ status: newStatus })
        .eq("id", viewInvoice.id)
      if (invErr) throw invErr

      const earnedPoints = Math.floor(amount)
      if (earnedPoints > 0) {
        await supabase.from("loyalty_transactions").insert({
          customer_id: viewInvoice.customer_id,
          points: earnedPoints,
          type: "earn",
          reason: `Payment on ${viewInvoice.invoice_number}`,
          invoice_id: viewInvoice.id,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoice-detail", viewId] })
      setPaymentAmount("")
      setPaymentTip("")
      setPaymentRef("")
      toast.success("Payment recorded")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Billing</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setBranchId(defaultBranchId)}>
              <Plus /> New invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>New invoice</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                createInvoice.mutate()
              }}
            >
              <div className="flex flex-col gap-2">
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
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
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) =>
                        setLines((ls) =>
                          ls.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l))
                        )
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((ls) =>
                          ls.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l))
                        )
                      }
                      className="w-16"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) =>
                        setLines((ls) =>
                          ls.map((l, i) => (i === idx ? { ...l, unit_price: e.target.value } : l))
                        )
                      }
                      className="w-24"
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((ls) => [...ls, emptyLine()])}
                >
                  <Plus /> Add line
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="inv-discount">Discount</Label>
                  <Input
                    id="inv-discount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="inv-tax">Tax</Label>
                  <Input
                    id="inv-tax"
                    type="number"
                    min={0}
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="inv-service-charge">Service charge</Label>
                  <Input
                    id="inv-service-charge"
                    type="number"
                    min={0}
                    step="0.01"
                    value={serviceCharge}
                    onChange={(e) => setServiceCharge(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ${subtotal.toFixed(2)}</span>
                <span className="text-lg font-semibold">Total ${total.toFixed(2)}</span>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createInvoice.isPending}>
                  {createInvoice.isPending ? "Creating..." : "Create invoice"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!viewId} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {viewInvoice && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-sm">
                <span>{viewInvoice.customer?.full_name}</span>
                <Badge variant={STATUS_VARIANT[viewInvoice.status]} className="capitalize">
                  {viewInvoice.status}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(viewInvoice.items ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>${Number(item.unit_price).toFixed(2)}</TableCell>
                      <TableCell>${Number(item.line_total).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col items-end gap-1 text-sm">
                <span>Subtotal: ${Number(viewInvoice.subtotal).toFixed(2)}</span>
                <span>Discount: -${Number(viewInvoice.discount).toFixed(2)}</span>
                <span>Tax: +${Number(viewInvoice.tax).toFixed(2)}</span>
                <span>Service charge: +${Number(viewInvoice.service_charge).toFixed(2)}</span>
                <span className="font-semibold">Total: ${Number(viewInvoice.total).toFixed(2)}</span>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Label className="text-sm">Payments</Label>
                {(viewInvoice.payments ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No payments recorded.</p>
                )}
                {(viewInvoice.payments ?? []).map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="capitalize">{p.method.replace("_", " ")}</span>
                    <span>
                      ${Number(p.amount).toFixed(2)}
                      {Number(p.tip_amount) > 0 && (
                        <span className="ml-1 text-xs text-accent">+${Number(p.tip_amount).toFixed(2)} tip</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {viewInvoice.status !== "paid" && viewInvoice.status !== "void" && (
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addPayment.mutate()
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="pay-amount" className="text-xs">
                      Amount
                    </Label>
                    <Input
                      id="pay-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="pay-tip" className="text-xs">
                      Tip
                    </Label>
                    <Input
                      id="pay-tip"
                      type="number"
                      min={0}
                      step="0.01"
                      value={paymentTip}
                      onChange={(e) => setPaymentTip(e.target.value)}
                      className="w-20"
                    />
                  </div>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="debit_card">Debit card</SelectItem>
                      <SelectItem value="credit_card">Credit card</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="wallet">Wallet</SelectItem>
                      <SelectItem value="gift_card">Gift card</SelectItem>
                      <SelectItem value="store_credit">Store credit</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Reference"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-28"
                  />
                  <Button type="submit" size="sm" disabled={addPayment.isPending}>
                    Add payment
                  </Button>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16">View</TableHead>
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
              {!isLoading && invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No invoices yet.
                  </TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.customer?.full_name ?? "—"}</TableCell>
                  <TableCell>${Number(inv.total).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status]} className="capitalize">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(inv.created_at), "PP")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setViewId(inv.id)}>
                      <Eye className="size-4" />
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
