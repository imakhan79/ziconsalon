import { supabase } from "@/lib/supabase"

export async function logAction(
  actorId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    details: details ?? {},
  })
}
