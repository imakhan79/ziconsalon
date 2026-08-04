import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Star } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import type { Review } from "@/types"

export default function ReviewsPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [replyDrafts, setReplyDrafts] = React.useState<Record<string, string>>({})

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, customer:profiles!reviews_customer_id_fkey(*), staff:staff(*, profile:profiles(*))")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as (Review & { staff: { profile: { full_name: string } } | null })[]
    },
  })

  const reply = useMutation({
    mutationFn: async (review: Review) => {
      const text = replyDrafts[review.id]?.trim()
      if (!text) throw new Error("Enter a reply")
      const { error } = await supabase
        .from("reviews")
        .update({ reply: text, replied_by: profile?.id, replied_at: new Date().toISOString() })
        .eq("id", review.id)
      if (error) throw error
    },
    onSuccess: (_data, review) => {
      queryClient.invalidateQueries({ queryKey: ["reviews-all"] })
      setReplyDrafts((d) => ({ ...d, [review.id]: "" }))
      toast.success("Reply posted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Reviews</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}

      {reviews.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{r.customer?.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.staff?.profile?.full_name ? `Reviewed ${r.staff.profile.full_name} · ` : ""}
                  {format(new Date(r.created_at), "PP")}
                </p>
              </div>
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`size-4 ${i < r.rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`} />
                ))}
              </div>
            </div>
            {r.comment && <p className="text-sm">{r.comment}</p>}

            {r.reply ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Your reply</p>
                <p>{r.reply}</p>
              </div>
            ) : (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  reply.mutate(r)
                }}
              >
                <Input
                  placeholder="Write a reply..."
                  value={replyDrafts[r.id] ?? ""}
                  onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={reply.isPending}>
                  Reply
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
