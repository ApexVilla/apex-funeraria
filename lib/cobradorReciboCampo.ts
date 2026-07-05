import { supabase } from './supabase';
import { buscarRecebimentoCampo } from './cobRecebimentosSupabase';
import {
  contarReimpressoesRecebimentosCampo,
  registrarReimpressoesRecebimentosCampo,
  validarReimpressaoRecebimento,
} from './cobradorReciboReimpressao';
import {
  imprimirReciboBaixaCobrador,
  labelFormaPagamentoRecibo,
  type ModoReciboBaixaCobrador,
} from './ReciboTermicoService';

export type ControleReimpressaoReciboOpts = {
  cobradorRestrito?: boolean;
  exigirMotivoAdmin?: boolean;
  motivoAdmin?: string;
  usuarioId?: string | null;
};

type RecebimentoMeta = {
  id: string;
  data: string;
  empresa_id: string;
};

async function carregarMetasRecebimentos(
  recebimentoIds: string[],
  empresaIds: string[],
): Promise<Map<string, RecebimentoMeta>> {
  const ids = [...new Set(recebimentoIds.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, RecebimentoMeta>();
  if (ids.length === 0) return map;

  const empresaSet = [...new Set(empresaIds.map((id) => id.trim()).filter(Boolean))];
  let q = supabase
    .from('cob_recebimentos_campo')
    .select('id, data, empresa_id')
    .in('id', ids);
  q = empresaSet.length === 1 ? q.eq('empresa_id', empresaSet[0]) : q.in('empresa_id', empresaSet);

  const { data, error } = await q;
  if (error) throw error;

  for (const row of data || []) {
    const id = String(row.id || '');
    if (!id) continue;
    map.set(id, {
      id,
      data: String(row.data || '').slice(0, 10),
      empresa_id: String(row.empresa_id || ''),
    });
  }
  return map;
}

async function validarReimpressoesAntes(
  recebimentoIds: string[],
  empresaIds: string[],
  opts?: ControleReimpressaoReciboOpts,
): Promise<Map<string, RecebimentoMeta>> {
  const metas = await carregarMetasRecebimentos(recebimentoIds, empresaIds);
  const counts = await contarReimpressoesRecebimentosCampo(recebimentoIds);

  for (const id of recebimentoIds) {
    const meta = metas.get(id);
    if (!meta) throw new Error('Recebimento não encontrado.');
    validarReimpressaoRecebimento({
      data_recebimento: meta.data,
      reimpressoes_count: counts.get(id) || 0,
      cobrador_restrito: opts?.cobradorRestrito === true,
      exigir_motivo_admin: opts?.exigirMotivoAdmin === true,
      motivo_admin: opts?.motivoAdmin,
    });
  }
  return metas;
}

async function registrarLogsReimpressao(
  recebimentoIds: string[],
  metas: Map<string, RecebimentoMeta>,
  modo: ModoReciboBaixaCobrador,
  opts?: ControleReimpressaoReciboOpts,
): Promise<void> {
  await registrarReimpressoesRecebimentosCampo(
    recebimentoIds.map((id) => {
      const meta = metas.get(id);
      if (!meta?.empresa_id) throw new Error('Recebimento sem empresa vinculada.');
      return {
        recebimento_id: id,
        empresa_id: meta.empresa_id,
        modo,
        reimpresso_por: opts?.usuarioId || null,
        motivo: opts?.exigirMotivoAdmin ? opts?.motivoAdmin?.trim() || null : null,
        admin_override: opts?.exigirMotivoAdmin === true,
      };
    }),
  );
}

export async function montarInputReciboRecebimentoCampo(
  recebimentoId: string,
  empresaIds: string[],
): Promise<Parameters<typeof imprimirReciboBaixaCobrador>[0] | null> {
  const rec = await buscarRecebimentoCampo(recebimentoId, empresaIds);
  if (!rec) return null;

  let parcelaNumero = 1;
  let totalParcelas: number | undefined;
  let dataVencimento = rec.data;
  let planoNome = '';
  let parcelaCodigo = '';

  if (rec.cobranca_pendente_id) {
    const { data: pend } = await supabase
      .from('cob_cobrancas_pendentes')
      .select(
        `
        fin_contas_receber (
          codigo, parcela_numero, total_parcelas, data_vencimento, descricao,
          assinaturas ( codigo, planos ( nome ) )
        )
      `,
      )
      .eq('id', rec.cobranca_pendente_id)
      .maybeSingle();
    const fr = pend?.fin_contas_receber as Record<string, unknown> | Record<string, unknown>[] | null;
    const conta = Array.isArray(fr) ? fr[0] : fr;
    if (conta) {
      parcelaNumero = Number(conta.parcela_numero || 1) || 1;
      totalParcelas = Number(conta.total_parcelas) || undefined;
      dataVencimento = String(conta.data_vencimento || rec.data).slice(0, 10);
      parcelaCodigo = String(conta.codigo || '');
      const ass = conta.assinaturas as { planos?: { nome?: string } | { nome?: string }[] } | null;
      const plano = Array.isArray(ass?.planos) ? ass?.planos[0] : ass?.planos;
      planoNome = String(plano?.nome || '');
    }
  } else if (rec.conta_receber_id) {
    const { data: cr } = await supabase
      .from('fin_contas_receber')
      .select(
        'codigo, parcela_numero, total_parcelas, data_vencimento, descricao, assinaturas ( planos ( nome ) )',
      )
      .eq('id', rec.conta_receber_id)
      .maybeSingle();
    if (cr) {
      parcelaNumero = Number(cr.parcela_numero || 1) || 1;
      totalParcelas = Number(cr.total_parcelas) || undefined;
      dataVencimento = String(cr.data_vencimento || rec.data).slice(0, 10);
      parcelaCodigo = String(cr.codigo || '');
      const ass = cr.assinaturas as { planos?: { nome?: string } } | null;
      planoNome = String(ass?.planos?.nome || '');
    }
  }

  return {
    clienteId: rec.cliente_id,
    clienteNome: rec.cliente_nome,
    nomeCobrador: rec.cobrador_nome,
    parcelas: [
      {
        parcela_numero: parcelaNumero,
        total_parcelas: totalParcelas,
        data_vencimento: dataVencimento,
        valorCentavos: rec.valor_centavos,
        descricao: planoNome || 'MENSALIDADE',
        codigo: parcelaCodigo || undefined,
      },
    ],
    totalCentavos: rec.valor_centavos,
    formaPagamento: labelFormaPagamentoRecibo(rec.forma_pagamento),
    planoNome: planoNome || undefined,
    parcelaCodigo: parcelaCodigo || undefined,
    dataVencimento,
    modo: 'termica' as ModoReciboBaixaCobrador,
  };
}

export async function reimprimirReciboRecebimentoCampo(
  recebimentoId: string,
  empresaIds: string[],
  modo: ModoReciboBaixaCobrador = 'termica',
  janelaPdf?: Window | null,
  controle?: ControleReimpressaoReciboOpts,
): Promise<'bluetooth' | 'pdf' | 'navegador'> {
  const id = recebimentoId.trim();
  const metas = await validarReimpressoesAntes([id], empresaIds, controle);
  const input = await montarInputReciboRecebimentoCampo(id, empresaIds);
  if (!input) throw new Error('Recebimento não encontrado.');
  const resultado = await imprimirReciboBaixaCobrador({ ...input, modo, janelaPdf });
  await registrarLogsReimpressao([id], metas, modo, controle);
  return resultado;
}

/** Reimprime um ou vários recebimentos de campo no mesmo comprovante térmico. */
export async function reimprimirRecibosRecebimentosCampo(
  recebimentoIds: string[],
  empresaIds: string[],
  modo: ModoReciboBaixaCobrador = 'termica',
  janelaPdf?: Window | null,
  controle?: ControleReimpressaoReciboOpts,
): Promise<'bluetooth' | 'pdf' | 'navegador'> {
  const ids = [...new Set(recebimentoIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error('Selecione ao menos um recebimento.');

  const metas = await validarReimpressoesAntes(ids, empresaIds, controle);

  if (ids.length === 1) {
    const input = await montarInputReciboRecebimentoCampo(ids[0], empresaIds);
    if (!input) throw new Error('Recebimento não encontrado.');
    const resultado = await imprimirReciboBaixaCobrador({ ...input, modo, janelaPdf });
    await registrarLogsReimpressao(ids, metas, modo, controle);
    return resultado;
  }

  const inputs = (
    await Promise.all(ids.map((id) => montarInputReciboRecebimentoCampo(id, empresaIds)))
  ).filter((x): x is NonNullable<typeof x> => x != null);

  if (inputs.length === 0) throw new Error('Nenhum recebimento encontrado para reimprimir.');

  const clienteId = inputs[0].clienteId;
  if (!inputs.every((i) => i.clienteId === clienteId)) {
    throw new Error('Selecione recebimentos do mesmo cliente.');
  }

  const formas = new Set(inputs.map((i) => i.formaPagamento).filter(Boolean));
  const formaPagamento =
    formas.size === 1 ? [...formas][0] : 'PAGAMENTO';

  const parcelas = inputs.flatMap((i) => i.parcelas);
  const totalCentavos = inputs.reduce((s, i) => s + i.totalCentavos, 0);
  const parcelaCodigo = inputs
    .map((i) => i.parcelaCodigo)
    .filter(Boolean)
    .join(', ');

  const resultado = await imprimirReciboBaixaCobrador({
    ...inputs[0],
    parcelas,
    totalCentavos,
    formaPagamento,
    parcelaCodigo: parcelaCodigo || inputs[0].parcelaCodigo,
    dataVencimento: inputs[0].dataVencimento,
    modo,
    janelaPdf,
  });
  await registrarLogsReimpressao(ids, metas, modo, controle);
  return resultado;
}
