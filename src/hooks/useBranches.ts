import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Branch } from "@/types"

/** Branches selectable by the current user: all active branches for admin,
 *  otherwise just their own assigned branch (RLS would reject anything else). */
export function useBranches() {
  const { profile } = useAuth()
  // Admins manage every branch; customers pick their preferred branch when
  // booking. Managers/staff are locked to their own branch (RLS would
  // reject writes to any other branch for their operational records).
  const unrestricted = profile?.role === "admin" || profile?.role === "customer"

  const { data: allBranches = [], isLoading } = useQuery({
    queryKey: ["branches-selectable"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("is_active", true).order("name")
      if (error) throw error
      return data as Branch[]
    },
  })

  const branches = unrestricted ? allBranches : allBranches.filter((b) => b.id === profile?.branch_id)
  const defaultBranchId = profile?.branch_id ?? branches[0]?.id ?? ""

  return { branches, defaultBranchId, isLoading }
}
