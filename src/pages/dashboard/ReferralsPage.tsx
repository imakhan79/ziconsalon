import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Referral } from "@/types"

export default function ReferralsPage() {
  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["referrals-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*, referrer:profiles!referrals_referrer_id_fkey(*), referred_customer:profiles!referrals_referred_customer_id_fkey(*)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as Referral[]
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Referrals</h1>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Referred customer</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
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
              {!isLoading && referrals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No referrals yet.
                  </TableCell>
                </TableRow>
              )}
              {referrals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.referrer?.full_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.referral_code}</TableCell>
                  <TableCell>{r.referred_customer?.full_name ?? "—"}</TableCell>
                  <TableCell>{r.reward_points} pts</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "completed" ? "success" : "outline"} className="capitalize">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(r.created_at), "PP")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
