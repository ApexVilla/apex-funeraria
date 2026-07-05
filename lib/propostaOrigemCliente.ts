import { supabase } from './supabase';

export type PropostaOrigemCliente = {
  id: string;
  sequencial: number;
  status: string;
  contrato_gerado_em?: string | null;
  data_pedido?: string | null;
  created_at?: string | null;
};

export function formatarNumeroProposta(sequencial?: number | null): string {
  if (sequencial == null || Number.isNaN(Number(sequencial))) return '—';
  return String(sequencial).padStart(3, '0');
}

const SELECT_PROPOSTA =
  'id, sequencial, status, contrato_gerado_em, data_pedido, created_at';

/** Proposta que originou o cadastro/contrato do cliente (mais recente com contrato gerado). */
export async function buscarPropostaOrigemCliente(
  clienteId: string,
  assinaturaIds?: string[],
): Promise<PropostaOrigemCliente | null> {
  if (!clienteId?.trim()) return null;

  const { data: porCliente, error: errCliente } = await supabase
    .from('propostas_venda')
    .select(SELECT_PROPOSTA)
    .eq('cliente_id', clienteId)
    .order('contrato_gerado_em', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errCliente) {
    console.warn('[buscarPropostaOrigemCliente]', errCliente.message);
  }
  if (porCliente?.id) return porCliente as PropostaOrigemCliente;

  const ids = [...new Set((assinaturaIds || []).filter(Boolean))];
  if (ids.length === 0) return null;

  const { data: porAssinatura, error: errAss } = await supabase
    .from('propostas_venda')
    .select(SELECT_PROPOSTA)
    .in('assinatura_id', ids)
    .order('contrato_gerado_em', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errAss) {
    console.warn('[buscarPropostaOrigemCliente] assinatura', errAss.message);
  }
  return (porAssinatura as PropostaOrigemCliente) || null;
}
