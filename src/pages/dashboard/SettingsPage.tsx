import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface BusinessSettings {
  id: number
  business_name: string
  address: string | null
  phone: string | null
  currency: string
}

export default function SettingsPage() {
  const { profile } = useAuth()
  const canManage = profile && ["admin", "manager"].includes(profile.role)
  const queryClient = useQueryClient()
  const [form, setForm] = React.useState({ business_name: "", address: "", phone: "", currency: "USD" })

  const { data, isLoading } = useQuery({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_settings").select("*").eq("id", 1).single()
      if (error) throw error
      return data as BusinessSettings
    },
  })

  React.useEffect(() => {
    if (data) {
      setForm({
        business_name: data.business_name,
        address: data.address ?? "",
        phone: data.phone ?? "",
        currency: data.currency,
      })
    }
  }, [data])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("business_settings")
        .update({
          business_name: form.business_name,
          address: form.address || null,
          phone: form.phone || null,
          currency: form.currency,
        })
        .eq("id", 1)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-settings"] })
      toast.success("Business settings updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!canManage) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Business settings are managed by administrators. Head to{" "}
            <span className="font-medium text-foreground">Profile</span> to update your own details.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      <Card className="max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="gradient-luxury rounded-xl p-2.5">
              <Building2 className="size-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Business details</CardTitle>
              <CardDescription>Shown on invoices and the public site.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="biz-name">Business name</Label>
              <Input
                id="biz-name"
                required
                disabled={isLoading}
                value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="biz-address">Address</Label>
              <Input
                id="biz-address"
                disabled={isLoading}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="biz-phone">Phone</Label>
                <Input
                  id="biz-phone"
                  disabled={isLoading}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="biz-currency">Currency</Label>
                <Input
                  id="biz-currency"
                  disabled={isLoading}
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  maxLength={3}
                />
              </div>
            </div>
            <Button type="submit" disabled={save.isPending || isLoading} className="self-start">
              {save.isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
