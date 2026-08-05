import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Lock, Unlock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useBranches"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CashSession, Payment } from "@/types"

export default function CashClosingPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const { branches, defaultBranchId } = useBranches()

  const [branchId, setBranchId] = React.useState("")
  React.useEffect(() => {
    if (!branchId && defaultBranchId) setBranchId(defaultBranchId)
  }, [branchId, defaultBranchId])

  const [openingFloat, setOpeningFloat] = React.useState("0")
  const [countedCash, setCountedCash] = React.useState("")
  const [bankDeposit, setBankDeposit] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const { data: session, isLoading } = useQuery({
    queryKey: ["cash-session", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*")
        .eq("branch_id", branchId)
        .eq("status", "open")
        .maybeSingle()
      if (error) throw error
      return data as CashSession | null
    },
  })

  const { data: recentSessions = [] } = useQuery({
    queryKey: ["cash-sessions-recent", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(10)
      if (error) throw error
      return data as CashSession[]
    },
  })

  const { data: sessionPayments = [] } = useQuery({
    queryKey: ["cash-session-payments", session?.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, invoice:invoices!inner(branch_id)")
        .eq("invoice.branch_id", branchId)
        .gte("paid_at", session!.opened_at)
      if (error) throw error
      return data as unknown as Payment[]
    },
  })

  const cashSales = sessionPayments.filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount), 0)
  const cardSales = sessionPayments
    .filter((p) => p.method === "card" || p.method === "debit_card" || p.method === "credit_card")
    .reduce((s, p) => s + Number(p.amount), 0)
  const totalSales = sessionPayments.reduce((s, p) => s + Number(p.amount), 0)
  const otherSales = totalSales - cashSales - cardSales
  const expectedCash = session ? Number(session.opening_float) + cashSales : 0
  const variance = countedCash ? Number(countedCash) - expectedCash : null

  const openSession = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cash_sessions").insert({
        branch_id: branchId,
        opened_by: profile?.id,
        opening_float: Number(openingFloat || 0),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-session", branchId] })
      queryClient.invalidateQueries({ queryKey: ["cash-sessions-recent", branchId] })
      setOpeningFloat("0")
      toast.success("Register opened")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const closeSession = useMutation({
    mutationFn: async () => {
      if (!session) return
      if (!countedCash) throw new Error("Enter the counted cash amount")
      const { error } = await supabase
        .from("cash_sessions")
        .update({
          status: "closed",
          closed_by: profile?.id,
          closed_at: new Date().toISOString(),
          counted_cash: Number(countedCash),
          bank_deposit_amount: bankDeposit ? Number(bankDeposit) : null,
          notes: notes || null,
        })
        .eq("id", session.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-session", branchId] })
      queryClient.invalidateQueries({ queryKey: ["cash-sessions-recent", branchId] })
      setCountedCash("")
      setBankDeposit("")
      setNotes("")
      toast.success("Register closed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Daily Cash Closing</h1>
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

      {!isLoading && !session && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Unlock className="size-4 text-accent" />
              <CardTitle className="text-base">Open register</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                openSession.mutate()
              }}
            >
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Opening float</Label>
                <Input type="number" min={0} step="0.01" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} className="w-40" />
              </div>
              <Button type="submit" disabled={openSession.isPending || !branchId}>
                {openSession.isPending ? "Opening..." : "Open register"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {session && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-accent" />
              <CardTitle className="text-base">Register open since {format(new Date(session.opened_at), "PP p")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Opening float</p>
                <p className="font-display text-lg font-semibold">Rs {Number(session.opening_float).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cash sales</p>
                <p className="font-display text-lg font-semibold">Rs {cashSales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Card sales</p>
                <p className="font-display text-lg font-semibold">Rs {cardSales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Other</p>
                <p className="font-display text-lg font-semibold">Rs {otherSales.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm">
              Expected drawer balance: <span className="font-semibold">Rs {expectedCash.toFixed(2)}</span>
            </p>

            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                closeSession.mutate()
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="counted-cash">Counted cash</Label>
                  <Input id="counted-cash" type="number" min={0} step="0.01" required value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bank-deposit">Bank deposit amount</Label>
                  <Input id="bank-deposit" type="number" min={0} step="0.01" value={bankDeposit} onChange={(e) => setBankDeposit(e.target.value)} />
                </div>
              </div>
              {variance !== null && (
                <p className={`text-sm ${Math.abs(variance) > 0.01 ? "text-destructive" : "text-accent"}`}>
                  Variance: {variance >= 0 ? "+" : ""}Rs {variance.toFixed(2)}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="close-notes">Notes</Label>
                <Input id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button type="submit" disabled={closeSession.isPending} className="w-fit">
                {closeSession.isPending ? "Closing..." : "Close register"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opened</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead>Opening float</TableHead>
                <TableHead>Counted</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No sessions yet.
                  </TableCell>
                </TableRow>
              )}
              {recentSessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{format(new Date(s.opened_at), "PP p")}</TableCell>
                  <TableCell>{s.closed_at ? format(new Date(s.closed_at), "PP p") : "—"}</TableCell>
                  <TableCell>Rs {Number(s.opening_float).toFixed(2)}</TableCell>
                  <TableCell>{s.counted_cash !== null ? `Rs ${Number(s.counted_cash).toFixed(2)}` : "—"}</TableCell>
                  <TableCell>{s.bank_deposit_amount !== null ? `Rs ${Number(s.bank_deposit_amount).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="capitalize">{s.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
