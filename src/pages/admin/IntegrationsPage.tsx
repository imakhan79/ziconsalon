import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { CreditCard, MessageSquare, CalendarDays, Wallet, ScanLine, KeyRound } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { logAction } from "@/lib/audit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Integration } from "@/types"

const CATEGORY_ICON: Record<string, typeof CreditCard> = {
  payments: CreditCard,
  messaging: MessageSquare,
  calendar: CalendarDays,
  finance: Wallet,
  hardware: ScanLine,
}

export default function IntegrationsPage() {
  const { profile: me } = useAuth()
  const queryClient = useQueryClient()
  const [configuring, setConfiguring] = React.useState<Integration | null>(null)
  const [apiKey, setApiKey] = React.useState("")

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("integrations").select("*").order("category")
      if (error) throw error
      return data as Integration[]
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("integrations").update({ is_enabled: enabled }).eq("id", id)
      if (error) throw error
      if (me) await logAction(me.id, enabled ? "integration.enabled" : "integration.disabled", "integration", id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-integrations"] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!configuring) return
      const { error } = await supabase
        .from("integrations")
        .update({
          config: { api_key: apiKey },
          connected_at: apiKey ? new Date().toISOString() : null,
        })
        .eq("id", configuring.id)
      if (error) throw error
      if (me) await logAction(me.id, "integration.configured", "integration", configuring.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-integrations"] })
      setConfiguring(null)
      setApiKey("")
      toast.success("Configuration saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const grouped = integrations.reduce<Record<string, Integration[]>>((acc, i) => {
    ;(acc[i.category] ??= []).push(i)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Store your own provider credentials here. Saving a key marks the integration as configured —
          it does not run a live connection test against the third-party service.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {Object.entries(grouped).map(([category, items]) => {
        const Icon = CATEGORY_ICON[category] ?? CreditCard
        return (
          <div key={category} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <Card key={i.id}>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="gradient-luxury rounded-xl p-2.5">
                          <Icon className="size-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{i.display_name}</p>
                          <Badge variant={i.connected_at ? "success" : "outline"} className="mt-1">
                            {i.connected_at ? `Configured ${format(new Date(i.connected_at), "PP")}` : "Not configured"}
                          </Badge>
                        </div>
                      </div>
                      <Switch
                        checked={i.is_enabled}
                        onCheckedChange={(v) => toggle.mutate({ id: i.id, enabled: v })}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConfiguring(i)
                        setApiKey((i.config?.api_key as string) ?? "")
                      }}
                    >
                      <KeyRound className="size-4" /> Configure
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}

      <Dialog open={!!configuring} onOpenChange={(open) => !open && setConfiguring(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {configuring?.display_name}</DialogTitle>
            <DialogDescription>
              Stored securely in your database, readable only by Super Administrators via row-level
              security.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              saveConfig.mutate()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="int-key">API key / credential</Label>
              <Input
                id="int-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your provider API key"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveConfig.isPending}>
                {saveConfig.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
