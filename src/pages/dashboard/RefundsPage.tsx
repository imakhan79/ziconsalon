import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Check, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Refund, RefundStatus } from "@/types"

const STATUS_VARIANT: Record<RefundStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
}

export default function RefundsPage() {
  const queryClient = useQueryClient()
  const [reviewTarget, setReviewTarget] = React.useState<{ refund: Refund; approve: boolean } | null>(null)
  const [notes, setNotes] = React.useState("")

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ["refunds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refunds")
        .select("*, invoice:invoices(*), requester:profiles!refunds_requested_by_fkey(*)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as Refund[]
    },
  })

  const review = useMutation({
    mutationFn: async () => {
      if (!reviewTarget) return
      const { error } = await supabase.rpc("review_refund", {
        p_refund_id: reviewTarget.refund.id,
        p_approve: reviewTarget.approve,
        p_notes: notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] })
      setReviewTarget(null)
      setNotes("")
      toast.success(reviewTarget?.approve ? "Refund approved" : "Refund rejected")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const pending = refunds.filter((r) => r.status === "pending")
  const history = refunds.filter((r) => r.status !== "pending")

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Refunds</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending approval</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-24">Review</TableHead>
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
              {!isLoading && pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No refunds awaiting approval.
                  </TableCell>
                </TableRow>
              )}
              {pending.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.invoice?.invoice_number}</TableCell>
                  <TableCell>Rs {Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{r.type}</TableCell>
                  <TableCell>{r.requester?.full_name ?? "—"}</TableCell>
                  <TableCell className="max-w-48 truncate">{r.reason ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setReviewTarget({ refund: r, approve: true })}>
                        <Check className="size-4 text-accent" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setReviewTarget({ refund: r, approve: false })}>
                        <X className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credit note</TableHead>
                <TableHead>Reviewed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No reviewed refunds yet.
                  </TableCell>
                </TableRow>
              )}
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.invoice?.invoice_number}</TableCell>
                  <TableCell>Rs {Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{r.refund_method.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.credit_note_number ?? "—"}</TableCell>
                  <TableCell>{r.reviewed_at ? format(new Date(r.reviewed_at), "PP") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewTarget?.approve ? "Approve" : "Reject"} refund</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              review.mutate()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={review.isPending}>
                {review.isPending ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
