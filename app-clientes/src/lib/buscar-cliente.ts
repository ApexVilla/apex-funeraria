import { supabase } from "./supabase";

export interface ClientePortalLookup {
  id: string;
  email: string;
  nome: string;
  cpf: string;
}

export async function buscarClientePortal(
  identificador: string
): Promise<ClientePortalLookup | null> {
  if (!supabase) return null;

  const inputVal = identificador.trim();
  if (!inputVal) return null;

  const { data, error } = await supabase.rpc("buscar_cliente_portal", {
    identificador: inputVal,
  });

  if (error || !data?.length) return null;
  return data[0] as ClientePortalLookup;
}
