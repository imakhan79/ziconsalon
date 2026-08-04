import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Plus,
  Minus,
  Trash2,
  Printer,
  Mail,
  MessageCircle,
  Undo2,
  Gift,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useBranches"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import type {
  CustomerMembership,
  Invoice,
  MembershipPlan,
  PaymentMethod,
  Product,
  Profile,
  Promotion,
  RefundMethod,
  RefundType,
  Service,
  ServicePackage,
} from "@/types"

const WALK_IN = "__walk_in__"

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  debit_card: "Debit card",
  credit_card: "Credit card",
  online: "Online",
  bank_transfer: "Bank transfer",
  wallet: "Wallet",
  gift_card: "Gift card",
  store_credit: "Store credit",
  other: "Other",
}

interface CartLine {
  key: string
  kind: "service" | "product" | "package" | "membership" | "giftcard"
  refId: string
  name: string
  qty: number
  unitPrice: number
  taxRate: number
}

interface PaymentRow {
  key: string
  method: PaymentMethod
  amount: string
  reference: string
}

const newPaymentRow = (): PaymentRow => ({
  key: crypto.randomUUID(),
  method: "cash",
  amount: "",
  reference: "",
})

export default function POSPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const { branches, defaultBranchId } = useBranches()
  const isManager = profile?.role === "admin" || profile?.role === "manager"

  const [branchId, setBranchId] = React.useState("")
  React.useEffect(() => {
    if (!branchId && defaultBranchId) setBranchId(defaultBranchId)
  }, [branchId, defaultBranchId])

  const [customerId, setCustomerId] = React.useState("")
  const [walkInName, setWalkInName] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [cart, setCart] = React.useState<CartLine[]>([])
  const [giftCardAmount, setGiftCardAmount] = React.useState("50")

  const [discount, setDiscount] = React.useState("0")
  const [serviceCharge, setServiceCharge] = React.useState("0")
  const [couponCode, setCouponCode] = React.useState("")
  const [appliedPromotion, setAppliedPromotion] = React.useState<Promotion | null>(null)

  const [paymentRows, setPaymentRows] = React.useState<PaymentRow[]>([newPaymentRow()])
  const [tip, setTip] = React.useState("0")

  const [receiptInvoiceId, setReceiptInvoiceId] = React.useState<string | null>(null)
  const [emailRecipient, setEmailRecipient] = React.useState("")
  const [whatsappRecipient, setWhatsappRecipient] = React.useState("")

  const [refundInvoice, setRefundInvoice] = React.useState<Invoice | null>(null)
  const [refundAmount, setRefundAmount] = React.useState("")
  const [refundType, setRefundType] = React.useState<RefundType>("partial")
  const [refundMethod, setRefundMethod] = React.useState<RefundMethod>("original_payment")
  const [refundReason, setRefundReason] = React.useState("")

  const { data: services = [] } = useQuery({
    queryKey: ["pos-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as Service[]
    },
  })

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as Product[]
    },
  })

  const { data: packages = [] } = useQuery({
    queryKey: ["pos-packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_packages").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as ServicePackage[]
    },
  })

  const { data: membershipPlans = [] } = useQuery({
    queryKey: ["pos-membership-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membership_plans").select("*").eq("is_active", true).order("price")
      if (error) throw error
      return data as MembershipPlan[]
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ["pos-customers"],
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

  const { data: activeMembership } = useQuery({
    queryKey: ["pos-membership", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_memberships")
        .select("*, plan:membership_plans(*)")
        .eq("customer_id", customerId)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as unknown as (CustomerMembership & { plan: MembershipPlan }) | null
    },
  })

  const { data: storeCreditBalance = 0 } = useQuery({
    queryKey: ["pos-store-credit", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_credit_balances")
        .select("balance")
        .eq("customer_id", customerId)
        .maybeSingle()
      if (error) throw error
      return Number(data?.balance ?? 0)
    },
  })

  const { data: recentInvoices = [] } = useQuery({
    queryKey: ["pos-recent-invoices", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customer:profiles!invoices_customer_id_fkey(*)")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(10)
      if (error) throw error
      return data as unknown as Invoice[]
    },
  })

  const branchServices = services.filter((s) => (s.branch_id === branchId || s.branch_id === null) && s.name.toLowerCase().includes(search.toLowerCase()))
  const branchProducts = products.filter((p) => (p.branch_id === branchId || p.branch_id === null) && p.name.toLowerCase().includes(search.toLowerCase()))
  const branchPackages = packages.filter((p) => p.branch_id === branchId || p.branch_id === null)

  const addLine = (line: Omit<CartLine, "key">) => {
    setCart((c) => {
      if (line.kind === "service" || line.kind === "product") {
        const existing = c.find((l) => l.kind === line.kind && l.refId === line.refId)
        if (existing) {
          return c.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
        }
      }
      return [...c, { ...line, key: crypto.randomUUID() }]
    })
  }

  const updateQty = (key: string, delta: number) => {
    setCart((c) =>
      c
        .map((l) => (l.key === key ? { ...l, qty: Math.max(1, l.qty + delta) } : l))
        .filter((l) => l.qty > 0)
    )
  }

  const removeLine = (key: string) => setCart((c) => c.filter((l) => l.key !== key))

  const cartSubtotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const cartTax = cart.reduce((s, l) => s + l.qty * l.unitPrice * (l.taxRate / 100), 0)
  const membershipDiscount = activeMembership ? cartSubtotal * (Number(activeMembership.plan.discount_percent) / 100) : 0
  const couponDiscount = appliedPromotion
    ? appliedPromotion.discount_type === "percent"
      ? (cartSubtotal - membershipDiscount) * (Number(appliedPromotion.discount_value) / 100)
      : Number(appliedPromotion.discount_value)
    : 0
  const manualDiscount = Number(discount || 0)
  const totalDiscount = membershipDiscount + couponDiscount + manualDiscount
  const serviceChargeAmount = Number(serviceCharge || 0)
  const total = Math.max(0, cartSubtotal - totalDiscount + cartTax + serviceChargeAmount)
  const tendered = paymentRows.reduce((s, p) => s + Number(p.amount || 0), 0)
  const remaining = total - tendered

  const resetSale = () => {
    setCart([])
    setCustomerId("")
    setWalkInName("")
    setDiscount("0")
    setServiceCharge("0")
    setCouponCode("")
    setAppliedPromotion(null)
    setPaymentRows([newPaymentRow()])
    setTip("0")
  }

  const applyCoupon = useMutation({
    mutationFn: async () => {
      if (!couponCode.trim()) throw new Error("Enter a coupon code")
      const { data, error } = await supabase.rpc("redeem_promotion_code", {
        p_code: couponCode.trim(),
      })
      if (error) throw error
      return data as Promotion
    },
    onSuccess: (promo) => {
      setAppliedPromotion(promo)
      toast.success(`Applied ${promo.name}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const checkout = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty")
      if (!customerId && !walkInName.trim()) throw new Error("Select a customer or enter a walk-in name")
      const validPayments = paymentRows.filter((p) => Number(p.amount) > 0)
      if (validPayments.length === 0) throw new Error("Add at least one payment")

      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          customer_id: customerId || null,
          walk_in_name: customerId ? null : walkInName.trim(),
          branch_id: branchId || null,
          subtotal: cartSubtotal,
          discount: totalDiscount,
          tax: cartTax,
          service_charge: serviceChargeAmount,
          total,
        })
        .select()
        .single()
      if (invErr) throw invErr

      const items = cart.map((l) => ({
        invoice_id: invoice.id,
        description: l.name,
        service_id: l.kind === "service" ? l.refId : null,
        product_id: l.kind === "product" ? l.refId : null,
        package_id: l.kind === "package" ? l.refId : null,
        quantity: l.qty,
        unit_price: l.unitPrice,
        line_total: l.qty * l.unitPrice,
      }))
      const { error: itemsErr } = await supabase.from("invoice_items").insert(items)
      if (itemsErr) throw itemsErr

      for (const l of cart.filter((l) => l.kind === "product")) {
        const { error: stockErr } = await supabase.rpc("adjust_stock", {
          p_product_id: l.refId,
          p_qty_delta: -l.qty,
          p_type: "sale",
          p_note: `POS sale ${invoice.invoice_number}`,
        })
        if (stockErr) throw stockErr
      }

      for (const l of cart.filter((l) => l.kind === "giftcard")) {
        const { data: gc, error: gcErr } = await supabase
          .from("gift_cards")
          .insert({
            branch_id: branchId || null,
            initial_value: l.unitPrice,
            balance: l.unitPrice,
            issued_to: customerId || null,
            issued_by: profile?.id,
          })
          .select()
          .single()
        if (gcErr) throw gcErr
        const { error: gctErr } = await supabase.from("gift_card_transactions").insert({
          gift_card_id: gc.id,
          invoice_id: invoice.id,
          amount: l.unitPrice,
          type: "issue",
          created_by: profile?.id,
        })
        if (gctErr) throw gctErr
      }

      for (const l of cart.filter((l) => l.kind === "membership")) {
        if (!customerId) continue
        const plan = membershipPlans.find((p) => p.id === l.refId)
        if (!plan) continue
        const expires = new Date()
        expires.setMonth(expires.getMonth() + plan.duration_months)
        const { error: memErr } = await supabase.from("customer_memberships").insert({
          customer_id: customerId,
          plan_id: plan.id,
          expires_at: expires.toISOString(),
          invoice_id: invoice.id,
        })
        if (memErr) throw memErr
      }

      let paidTotal = 0
      for (let i = 0; i < validPayments.length; i++) {
        const p = validPayments[i]
        const amount = Number(p.amount)
        if (p.method === "gift_card") {
          const { error } = await supabase.rpc("redeem_gift_card", {
            p_code: p.reference.trim(),
            p_amount: amount,
            p_invoice_id: invoice.id,
          })
          if (error) throw error
        } else if (p.method === "store_credit") {
          if (!customerId) throw new Error("Store credit requires a customer account")
          const { error } = await supabase.rpc("redeem_store_credit", {
            p_customer_id: customerId,
            p_amount: amount,
            p_invoice_id: invoice.id,
          })
          if (error) throw error
        }
        const { error: payErr } = await supabase.from("payments").insert({
          invoice_id: invoice.id,
          amount,
          tip_amount: i === 0 ? Number(tip || 0) : 0,
          method: p.method,
          reference: p.reference || null,
        })
        if (payErr) throw payErr
        paidTotal += amount
      }

      const status = paidTotal >= total ? "paid" : paidTotal > 0 ? "partial" : "unpaid"
      const { error: statusErr } = await supabase.from("invoices").update({ status }).eq("id", invoice.id)
      if (statusErr) throw statusErr

      if (customerId) {
        const points = Math.floor(paidTotal)
        if (points > 0) {
          await supabase.from("loyalty_transactions").insert({
            customer_id: customerId,
            points,
            type: "earn",
            reason: `POS sale ${invoice.invoice_number}`,
            invoice_id: invoice.id,
          })
        }
      }

      return invoice.id as string
    },
    onSuccess: (invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ["pos-products"] })
      queryClient.invalidateQueries({ queryKey: ["pos-recent-invoices"] })
      resetSale()
      setReceiptInvoiceId(invoiceId)
      toast.success("Sale completed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { data: receiptInvoice } = useQuery({
    queryKey: ["pos-receipt", receiptInvoiceId],
    enabled: !!receiptInvoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customer:profiles!invoices_customer_id_fkey(*), items:invoice_items(*), payments:payments(*)")
        .eq("id", receiptInvoiceId!)
        .single()
      if (error) throw error
      return data as unknown as Invoice
    },
  })

  React.useEffect(() => {
    if (receiptInvoice) {
      setWhatsappRecipient(receiptInvoice.customer?.phone ?? "")
      setEmailRecipient("")
    }
  }, [receiptInvoice])

  const sendReceipt = useMutation({
    mutationFn: async (vars: { channel: "email" | "whatsapp"; recipient: string }) => {
      if (!vars.recipient.trim()) throw new Error("Enter a recipient")
      const { error } = await supabase.from("communications_log").insert({
        invoice_id: receiptInvoiceId,
        channel: vars.channel,
        recipient: vars.recipient.trim(),
        created_by: profile?.id,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) =>
      toast.success(`Receipt queued for ${vars.channel === "email" ? "email" : "WhatsApp"} — delivery isn't connected yet`),
    onError: (e: Error) => toast.error(e.message),
  })

  const printReceipt = () => {
    if (!receiptInvoice) return
    const w = window.open("", "_blank")
    if (!w) return
    const itemsHtml = (receiptInvoice.items ?? [])
      .map((i) => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>$${Number(i.unit_price).toFixed(2)}</td><td>$${Number(i.line_total).toFixed(2)}</td></tr>`)
      .join("")
    const paymentsHtml = (receiptInvoice.payments ?? [])
      .map((p) => `<tr><td>${PAYMENT_METHOD_LABEL[p.method]}</td><td>$${Number(p.amount).toFixed(2)}</td></tr>`)
      .join("")
    w.document.write(`
      <html><head><title>${receiptInvoice.invoice_number}</title></head>
      <body style="font-family: sans-serif; padding: 40px;">
        <h1>Ziconsalon</h1>
        <h2>Receipt ${receiptInvoice.invoice_number}</h2>
        <p>${receiptInvoice.customer?.full_name ?? receiptInvoice.walk_in_name ?? "Walk-in"}</p>
        <p>Date: ${format(new Date(receiptInvoice.created_at), "PPP p")}</p>
        <table width="100%" cellpadding="4"><thead><tr><th align="left">Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
        <hr />
        <p>Subtotal: $${Number(receiptInvoice.subtotal).toFixed(2)}</p>
        <p>Discount: -$${Number(receiptInvoice.discount).toFixed(2)}</p>
        <p>Tax: +$${Number(receiptInvoice.tax).toFixed(2)}</p>
        <p>Service charge: +$${Number(receiptInvoice.service_charge).toFixed(2)}</p>
        <h3>Total: $${Number(receiptInvoice.total).toFixed(2)}</h3>
        <table width="100%" cellpadding="4"><thead><tr><th align="left">Payment</th><th>Amount</th></tr></thead><tbody>${paymentsHtml}</tbody></table>
      </body></html>
    `)
    w.document.close()
    w.print()
  }

  const requestRefund = useMutation({
    mutationFn: async () => {
      if (!refundInvoice) return
      const amount = Number(refundAmount)
      if (!amount || amount <= 0) throw new Error("Enter a valid amount")
      const { error } = await supabase.rpc("request_refund", {
        p_invoice_id: refundInvoice.id,
        p_amount: amount,
        p_type: refundType,
        p_reason: refundReason || null,
        p_refund_method: refundMethod,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-recent-invoices"] })
      setRefundInvoice(null)
      setRefundAmount("")
      setRefundReason("")
      toast.success(isManager ? "Refund approved" : "Refund submitted for manager approval")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Point of Sale</h1>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Branch" />
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Customer</Label>
                  <Select
                    value={customerId || WALK_IN}
                    onValueChange={(v) => setCustomerId(v === WALK_IN ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Walk-in" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WALK_IN}>Walk-in customer</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!customerId && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Walk-in name</Label>
                    <Input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} placeholder="Name" />
                  </div>
                )}
              </div>
              {activeMembership && (
                <Badge variant="success" className="w-fit">
                  {activeMembership.plan.name} member — {Number(activeMembership.plan.discount_percent)}% off applied
                </Badge>
              )}
              {customerId && storeCreditBalance > 0 && (
                <p className="text-xs text-muted-foreground">
                  Store credit available: ${storeCreditBalance.toFixed(2)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Tabs defaultValue="services">
                <TabsList>
                  <TabsTrigger value="services">Services</TabsTrigger>
                  <TabsTrigger value="products">Products</TabsTrigger>
                  <TabsTrigger value="packages">Packages</TabsTrigger>
                  <TabsTrigger value="memberships">Memberships</TabsTrigger>
                  <TabsTrigger value="giftcard">Gift card</TabsTrigger>
                </TabsList>

                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="my-3"
                />

                <TabsContent value="services" className="flex flex-col gap-1">
                  {branchServices.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        addLine({ kind: "service", refId: s.id, name: s.name, qty: 1, unitPrice: Number(s.price), taxRate: Number(s.tax_rate) })
                      }
                      className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-left text-sm hover:bg-accent/10"
                    >
                      <span>{s.name}</span>
                      <span className="text-muted-foreground">${Number(s.price).toFixed(2)}</span>
                    </button>
                  ))}
                  {branchServices.length === 0 && <p className="text-sm text-muted-foreground">No services found.</p>}
                </TabsContent>

                <TabsContent value="products" className="flex flex-col gap-1">
                  {branchProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={Number(p.stock_qty) <= 0}
                      onClick={() =>
                        addLine({ kind: "product", refId: p.id, name: p.name, qty: 1, unitPrice: Number(p.sell_price), taxRate: 0 })
                      }
                      className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-left text-sm hover:bg-accent/10 disabled:opacity-40"
                    >
                      <span>
                        {p.name} <span className="text-xs text-muted-foreground">({p.stock_qty} in stock)</span>
                      </span>
                      <span className="text-muted-foreground">${Number(p.sell_price).toFixed(2)}</span>
                    </button>
                  ))}
                  {branchProducts.length === 0 && <p className="text-sm text-muted-foreground">No products found.</p>}
                </TabsContent>

                <TabsContent value="packages" className="flex flex-col gap-1">
                  {branchPackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => addLine({ kind: "package", refId: pkg.id, name: pkg.name, qty: 1, unitPrice: Number(pkg.price), taxRate: 0 })}
                      className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-left text-sm hover:bg-accent/10"
                    >
                      <span>{pkg.name}</span>
                      <span className="text-muted-foreground">${Number(pkg.price).toFixed(2)}</span>
                    </button>
                  ))}
                  {branchPackages.length === 0 && <p className="text-sm text-muted-foreground">No packages set up yet.</p>}
                </TabsContent>

                <TabsContent value="memberships" className="flex flex-col gap-1">
                  {membershipPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => addLine({ kind: "membership", refId: plan.id, name: `${plan.name} membership`, qty: 1, unitPrice: Number(plan.price), taxRate: 0 })}
                      className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-left text-sm hover:bg-accent/10"
                    >
                      <span>{plan.name} ({plan.duration_months}mo, {Number(plan.discount_percent)}% off)</span>
                      <span className="text-muted-foreground">${Number(plan.price).toFixed(2)}</span>
                    </button>
                  ))}
                </TabsContent>

                <TabsContent value="giftcard" className="flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Gift card value</Label>
                    <Input type="number" min={1} step="0.01" value={giftCardAmount} onChange={(e) => setGiftCardAmount(e.target.value)} className="w-32" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const amount = Number(giftCardAmount)
                      if (!amount || amount <= 0) return toast.error("Enter a valid amount")
                      addLine({ kind: "giftcard", refId: "new", name: "Gift card", qty: 1, unitPrice: amount, taxRate: 0 })
                    }}
                  >
                    <Gift /> Add gift card
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent sales</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Refund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No sales yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.customer?.full_name ?? inv.walk_in_name ?? "—"}</TableCell>
                      <TableCell>${Number(inv.total).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "paid" ? "success" : inv.status === "refunded" ? "outline" : "warning"} className="capitalize">
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={inv.status === "void" || inv.status === "refunded"}
                          onClick={() => {
                            setRefundInvoice(inv)
                            setRefundAmount(String(inv.total))
                          }}
                        >
                          <Undo2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cart</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {cart.length === 0 && <p className="text-sm text-muted-foreground">Cart is empty.</p>}
              {cart.map((l) => (
                <div key={l.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1">{l.name}</span>
                  {(l.kind === "service" || l.kind === "product") && (
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => updateQty(l.key, -1)}>
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-4 text-center">{l.qty}</span>
                      <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => updateQty(l.key, 1)}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  )}
                  <span className="w-16 text-right">${(l.qty * l.unitPrice).toFixed(2)}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => removeLine(l.key)}>
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              ))}

              <Separator />

              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <Label className="text-xs">Coupon code</Label>
                  <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Optional" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => applyCoupon.mutate()} disabled={applyCoupon.isPending}>
                  Apply
                </Button>
              </div>
              {appliedPromotion && (
                <Badge variant="outline" className="w-fit">
                  {appliedPromotion.name}
                  <button type="button" className="ml-2" onClick={() => setAppliedPromotion(null)}>
                    ×
                  </button>
                </Badge>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Discount</Label>
                  <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Service charge</Label>
                  <Input type="number" min={0} step="0.01" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${cartSubtotal.toFixed(2)}</span></div>
                {membershipDiscount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Membership discount</span><span>-${membershipDiscount.toFixed(2)}</span></div>}
                {couponDiscount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Coupon</span><span>-${couponDiscount.toFixed(2)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>${cartTax.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold text-base"><span>Total</span><span>${total.toFixed(2)}</span></div>
              </div>

              <Separator />

              <Label className="text-xs">Payment</Label>
              {paymentRows.map((p, idx) => (
                <div key={p.key} className="flex items-center gap-1">
                  <Select value={p.method} onValueChange={(v) => setPaymentRows((rows) => rows.map((r) => (r.key === p.key ? { ...r, method: v as PaymentMethod } : r)))}>
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    value={p.amount}
                    onChange={(e) => setPaymentRows((rows) => rows.map((r) => (r.key === p.key ? { ...r, amount: e.target.value } : r)))}
                    className="w-20"
                  />
                  <Input
                    placeholder={p.method === "gift_card" ? "Code" : "Ref"}
                    value={p.reference}
                    onChange={(e) => setPaymentRows((rows) => rows.map((r) => (r.key === p.key ? { ...r, reference: e.target.value } : r)))}
                    className="w-20"
                  />
                  {paymentRows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setPaymentRows((rows) => rows.filter((_, i) => i !== idx))}>
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setPaymentRows((rows) => [...rows, newPaymentRow()])}>
                <Plus /> Split payment
              </Button>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tip</Label>
                <Input type="number" min={0} step="0.01" value={tip} onChange={(e) => setTip(e.target.value)} />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{remaining > 0 ? "Remaining" : "Change due"}</span>
                <span className={remaining > 0 ? "text-destructive" : ""}>${Math.abs(remaining).toFixed(2)}</span>
              </div>

              <Button type="button" disabled={checkout.isPending} onClick={() => checkout.mutate()}>
                {checkout.isPending ? "Processing..." : "Complete sale"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!receiptInvoiceId} onOpenChange={(open) => !open && setReceiptInvoiceId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{receiptInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {receiptInvoice && (
            <div className="flex flex-col gap-4">
              <p className="text-sm">{receiptInvoice.customer?.full_name ?? receiptInvoice.walk_in_name}</p>
              <div className="flex flex-col gap-1 text-sm">
                {(receiptInvoice.items ?? []).map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span>{i.description} × {i.quantity}</span>
                    <span>${Number(i.line_total).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>${Number(receiptInvoice.total).toFixed(2)}</span>
              </div>

              <Button type="button" variant="outline" onClick={printReceipt}>
                <Printer /> Print receipt
              </Button>

              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} placeholder="customer@email.com" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => sendReceipt.mutate({ channel: "email", recipient: emailRecipient })}>
                  <Mail className="size-4" />
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <Label className="text-xs">WhatsApp</Label>
                  <Input value={whatsappRecipient} onChange={(e) => setWhatsappRecipient(e.target.value)} placeholder="+1..." />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => sendReceipt.mutate({ channel: "whatsapp", recipient: whatsappRecipient })}>
                  <MessageCircle className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!refundInvoice} onOpenChange={(open) => !open && setRefundInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund {refundInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              requestRefund.mutate()
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select value={refundType} onValueChange={(v) => setRefundType(v as RefundType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full refund</SelectItem>
                    <SelectItem value="partial">Partial refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Amount</Label>
                <Input type="number" min={0.01} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Refund method</Label>
              <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as RefundMethod)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original_payment">Original payment method</SelectItem>
                  <SelectItem value="store_credit">Store credit / credit note</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Reason</Label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {isManager ? "As a manager, this refund will be approved immediately." : "This will be sent to a manager for approval."}
            </p>
            <DialogFooter>
              <Button type="submit" disabled={requestRefund.isPending}>
                {requestRefund.isPending ? "Submitting..." : "Submit refund"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
