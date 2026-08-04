import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { KeyRound, User, Camera, HeartPulse, Phone, ShieldAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CommunicationPreferences, Profile, Staff } from "@/types"

const emptyForm = {
  full_name: "",
  phone: "",
  gender: "",
  date_of_birth: "",
  preferred_staff_id: "",
  allergies: "",
  beauty_preferences: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
}

const emptyPrefs: CommunicationPreferences = { email: true, sms: true, whatsapp: true }

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const isCustomer = profile?.role === "customer"
  const [form, setForm] = React.useState(emptyForm)
  const [prefs, setPrefs] = React.useState<CommunicationPreferences>(emptyPrefs)
  const [newPassword, setNewPassword] = React.useState("")
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!profile) return
    setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      gender: profile.gender ?? "",
      date_of_birth: profile.date_of_birth ?? "",
      preferred_staff_id: profile.preferred_staff_id ?? "",
      allergies: profile.allergies ?? "",
      beauty_preferences: profile.beauty_preferences ?? "",
      emergency_contact_name: profile.emergency_contact_name ?? "",
      emergency_contact_phone: profile.emergency_contact_phone ?? "",
    })
    setPrefs(profile.communication_preferences ?? emptyPrefs)
  }, [profile])

  const { data: staffOptions = [] } = useQuery({
    queryKey: ["staff-options-profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*, profile:profiles(full_name)")
      if (error) throw error
      return data as unknown as (Staff & { profile: Profile })[]
    },
    enabled: isCustomer,
  })

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!profile) return
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          phone: form.phone || null,
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          preferred_staff_id: form.preferred_staff_id || null,
          allergies: form.allergies || null,
          beauty_preferences: form.beauty_preferences || null,
          emergency_contact_name: form.emergency_contact_name || null,
          emergency_contact_phone: form.emergency_contact_phone || null,
          communication_preferences: prefs,
        })
        .eq("id", profile.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      toast.success("Profile updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters")
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    },
    onSuccess: () => {
      setNewPassword("")
      toast.success("Password updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const path = `${profile.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path)
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: `${pub.publicUrl}?t=${Date.now()}` })
        .eq("id", profile.id)
      if (updateErr) throw updateErr
      await refreshProfile()
      toast.success("Photo updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const completionFields = isCustomer
    ? [
        profile?.avatar_url,
        profile?.phone,
        profile?.gender,
        profile?.date_of_birth,
        profile?.preferred_staff_id,
        profile?.allergies,
        profile?.emergency_contact_name,
      ]
    : []
  const completionPct =
    completionFields.length > 0
      ? Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100)
      : 100

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Profile</h1>

      <Card className="max-w-xl">
        <CardContent className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="size-16 ring-2 ring-accent/40">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="gradient-luxury text-lg text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full gradient-gold text-accent-foreground shadow-sm"
              title="Change photo"
            >
              <Camera className="size-3.5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">{profile?.full_name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {profile?.role}
            </Badge>
          </div>
        </CardContent>
        {isCustomer && (
          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Profile completion</span>
              <span>{completionPct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="gradient-gold h-full transition-all" style={{ width: `${completionPct}%` }} />
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="gradient-luxury rounded-xl p-2.5">
              <User className="size-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Personal details</CardTitle>
              <CardDescription>Visible to staff when they look up your account.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              saveProfile.mutate()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                required
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Gender</Label>
                <Select value={form.gender || "unset"} onValueChange={(v) => setForm((f) => ({ ...f, gender: v === "unset" ? "" : v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Prefer not to say" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Prefer not to say</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isCustomer && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="profile-dob">Date of birth</Label>
                    <Input
                      id="profile-dob"
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Preferred stylist</Label>
                    <Select
                      value={form.preferred_staff_id || "none"}
                      onValueChange={(v) => setForm((f) => ({ ...f, preferred_staff_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No preference" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No preference</SelectItem>
                        {staffOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.profile.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-allergies" className="flex items-center gap-1">
                    <HeartPulse className="size-3.5" /> Allergies
                  </Label>
                  <Input
                    id="profile-allergies"
                    value={form.allergies}
                    onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                    placeholder="e.g. fragrance sensitivity, latex"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-beauty">Beauty preferences</Label>
                  <Textarea
                    id="profile-beauty"
                    value={form.beauty_preferences}
                    onChange={(e) => setForm((f) => ({ ...f, beauty_preferences: e.target.value }))}
                    placeholder="Preferred styles, products to avoid, anything else your stylist should know"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="profile-ec-name" className="flex items-center gap-1">
                      <ShieldAlert className="size-3.5" /> Emergency contact name
                    </Label>
                    <Input
                      id="profile-ec-name"
                      value={form.emergency_contact_name}
                      onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="profile-ec-phone">Emergency contact phone</Label>
                    <Input
                      id="profile-ec-phone"
                      value={form.emergency_contact_phone}
                      onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
                  <Label className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
                    <Phone className="size-3.5" /> Communication preferences
                  </Label>
                  {(["email", "sms", "whatsapp"] as const).map((ch) => (
                    <div key={ch} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{ch}</span>
                      <Switch
                        checked={prefs[ch]}
                        onCheckedChange={(v) => setPrefs((p) => ({ ...p, [ch]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <Button type="submit" disabled={saveProfile.isPending} className="self-start">
              {saveProfile.isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="gradient-gold rounded-xl p-2.5">
              <KeyRound className="size-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Password</CardTitle>
              <CardDescription>Choose a strong, unique password.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              changePassword.mutate()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                minLength={6}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <Button type="submit" variant="outline" disabled={changePassword.isPending} className="self-start">
              {changePassword.isPending ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
