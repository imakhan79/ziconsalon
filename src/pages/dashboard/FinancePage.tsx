import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, startOfMonth } from "date-fns"
import { Plus, Trash2, Wallet, TrendingDown, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Expense } from "@/types"

const emptyForm = {
  category: "",
  description: "",
  branch_id: "",
  amount: "0",
  expense_date: format(new Date(), "yyyy-MM-dd"),
}

export default function FinancePage() {
  const queryClient = useQueryClient()
  const { branches, defaultBranchId } = useBranches()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
      if (error) throw error
      return data as Expense[]
    },
  })

  const { data: revenueThisMonth = 0 } = useQuery({
    queryKey: ["finance-revenue-month"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString()
      const { data, error } = await supabase
        .from("invoices")
        .select("total, status, created_at")
        .gte("created_at", monthStart)
      if (error) throw error
      return (data ?? [])
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + Number(i.total), 0)
    },
  })

  const monthStart = startOfMonth(new Date())
  const expensesThisMonth = expenses
    .filter((e) => new Date(e.expense_date) >= monthStart)
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const netThisMonth = revenueThisMonth - expensesThisMonth

  const createExpense = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from("expenses").insert({
        category: values.category,
        description: values.description || null,
        branch_id: values.branch_id || null,
        amount: Number(values.amount),
        expense_date: values.expense_date,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      setDialogOpen(false)
      setForm(emptyForm)
      toast.success("Expense recorded")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      toast.success("Expense deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Finance</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ ...emptyForm, branch_id: defaultBranchId })}>
              <Plus /> New expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New expense</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                createExpense.mutate(form)
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="exp-category">Category</Label>
                <Input
                  id="exp-category"
                  required
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Rent, supplies, utilities..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="exp-desc">Description</Label>
                <Input
                  id="exp-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
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
                  <Label htmlFor="exp-amount">Amount</Label>
                  <Input
                    id="exp-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="exp-date">Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    required
                    value={form.expense_date}
                    onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createExpense.isPending}>
                  {createExpense.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="gradient-gold rounded-xl p-3">
              <TrendingUp className="size-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revenue this month</p>
              <p className="font-display text-xl font-semibold">${revenueThisMonth.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="gradient-luxury rounded-xl p-3">
              <TrendingDown className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expenses this month</p>
              <p className="font-display text-xl font-semibold">${expensesThisMonth.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="gradient-luxury rounded-xl p-3">
              <Wallet className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net this month</p>
              <p className={`font-display text-xl font-semibold ${netThisMonth < 0 ? "text-destructive" : ""}`}>
                ${netThisMonth.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16">Delete</TableHead>
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
              {!isLoading && expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No expenses recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.category}</TableCell>
                  <TableCell>{e.description ?? "—"}</TableCell>
                  <TableCell>${Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell>{format(new Date(e.expense_date), "PP")}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteExpense.mutate(e.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
