import { supabase } from "./supabase";

export interface PagamentoPortal {
  id: string;
  codigo: string;
  descricao: string | null;
  status: string;
  valor_pago_centavos: number;
  data_pagamento: string | null;
  data_vencimento: string | null;
  data_competencia: string | null;
  parcela_numero: number | null;
  forma_pagamento: string | null;
}

export interface AnoPagamentoPortal {
  ano: number;
  total: number;
}

export interface ProximaParcelaPortal {
  id: string;
  codigo: string;
  valor_total_centavos: number;
  data_vencimento: string | null;
  data_competencia: string | null;
  parcela_numero: number | null;
  status: string | null;
}

export async function listarAnosPagamentosPortal(): Promise<AnoPagamentoPortal[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("listar_anos_pagamentos_portal");
  if (error || !data) return [];
  return data as AnoPagamentoPortal[];
}

export async function buscarProximaParcelaPortal(): Promise<ProximaParcelaPortal | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("buscar_proxima_parcela_portal");
  if (error || !data) return null;
  return data as ProximaParcelaPortal;
}

export async function buscarHistoricoPagamentosPortal(
  ano: number
): Promise<PagamentoPortal[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("buscar_historico_pagamentos_portal", {
    p_ano: ano,
  });

  if (error || !data) return [];
  return data as PagamentoPortal[];
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatMesReferencia(value: string | null | undefined) {
  const date = parseDateOnly(value);
  if (!date) {
    return {
      titulo: "Sem referência",
      referencia: "—",
      ano: new Date().getFullYear(),
    };
  }

  const titulo = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const referencia = date.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });

  return {
    titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1),
    referencia,
    ano: date.getFullYear(),
  };
}
