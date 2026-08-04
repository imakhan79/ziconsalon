import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { KeyRound, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const [fullName, setFullName] = React.useState(profile?.full_name ?? "")
  const [phone, setPhone] = React.useState(profile?.phone ?? "")
  const [newPassword, setNewPassword] = React.useState("")

  React.useEffect(() => {
    setFullName(profile?.full_name ?? "")
    setPhone(profile?.phone ?? "")
  }, [profile])

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!profile) return
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone: phone || null })
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

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Profile</h1>

      <Card className="max-w-xl">
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16 ring-2 ring-accent/40">
            <AvatarFallback className="gradient-luxury text-lg text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-display text-lg font-semibold">{profile?.full_name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {profile?.role}
            </Badge>
          </div>
        </CardContent>
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
              <Input id="profile-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
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
