import * as React from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Scissors, Megaphone, Percent } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Profile, Staff } from "@/types"

type StaffRow = Staff & { profile: Profile }

export default function AdminPricingPage() {
  const queryClient = useQueryClient()
  const [rates, setRates] = React.useState<Record<string, string>>({})

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["admin-staff-commission"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*, profile:profiles!staff_id_fkey(*)")
      if (error) throw error
      return data as unknown as StaffRow[]
    },
  })

  const saveRate = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: string }) => {
      const { error } = await supabase.from("staff").update({ commission_rate: Number(rate) }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff-commission"] })
      toast.success("Commission rate updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Pricing Management</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="gradient-luxury rounded-xl p-2.5">
                <Scissors className="size-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Service &amp; package pricing</CardTitle>
                <CardDescription>Manage prices and durations per service.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/services">Open Services</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="gradient-gold rounded-xl p-2.5">
                <Megaphone className="size-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Promotions, coupons &amp; discounts</CardTitle>
                <CardDescription>Manage promotional pricing campaigns.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/marketing">Open Marketing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="gradient-luxury rounded-xl p-2.5">
              <Percent className="size-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Commission rules</CardTitle>
              <CardDescription>Per-staff commission percentage on services rendered.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Commission %</TableHead>
                <TableHead className="w-24">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No staff yet.
                  </TableCell>
                </TableRow>
              )}
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.profile.full_name}</TableCell>
                  <TableCell>{s.title ?? "—"}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="w-24"
                      value={rates[s.id] ?? String(s.commission_rate)}
                      onChange={(e) => setRates((r) => ({ ...r, [s.id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveRate.mutate({ id: s.id, rate: rates[s.id] ?? String(s.commission_rate) })}
                      disabled={saveRate.isPending}
                    >
                      Save
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
