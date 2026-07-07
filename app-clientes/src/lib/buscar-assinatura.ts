import { supabase } from "./supabase";

export interface AssinaturaPortal {
  id: string;
  codigo: string;
  status: string;
  valor_mensal_centavos: number;
  dia_vencimento: number | null;
  data_contratacao: string | null;
  data_primeiro_vencimento: string | null;
  plano_nome: string | null;
  plano_tipo: string | null;
  plano_categoria: string | null;
  beneficios: unknown;
}

export async function buscarAssinaturaPortal(): Promise<AssinaturaPortal | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("buscar_assinatura_portal");
  if (error || !data) return null;
  return data as AssinaturaPortal;
}
