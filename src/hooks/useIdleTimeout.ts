import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const

/** Signs the user out after N minutes of inactivity (business_settings.session_timeout_minutes). */
export function useIdleTimeout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const warnedRef = React.useRef(false)

  const { data: timeoutMinutes = 30 } = useQuery({
    queryKey: ["session-timeout-minutes"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("business_settings").select("session_timeout_minutes").eq("id", 1).single()
      return data?.session_timeout_minutes ?? 30
    },
    staleTime: 5 * 60 * 1000,
  })

  React.useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout>
    let warnTimer: ReturnType<typeof setTimeout>

    const reset = () => {
      warnedRef.current = false
      clearTimeout(timer)
      clearTimeout(warnTimer)
      const ms = timeoutMinutes * 60 * 1000
      warnTimer = setTimeout(() => {
        warnedRef.current = true
        toast.warning("You'll be signed out in 1 minute due to inactivity.")
      }, Math.max(ms - 60_000, 0))
      timer = setTimeout(async () => {
        await signOut()
        navigate("/login")
        toast.info("Signed out due to inactivity.")
      }, ms)
    }

    reset()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset))
    return () => {
      clearTimeout(timer)
      clearTimeout(warnTimer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [user, timeoutMinutes, signOut, navigate])
}
