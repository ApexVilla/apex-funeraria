import { supabase } from "./supabase";

export async function resolveClienteId(): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("resolver_cliente_id_portal");
  if (error || !data) return null;
  return data as string;
}
