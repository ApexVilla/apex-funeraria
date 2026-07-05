import { supabase } from './supabase';
import { getUserPontoConfig } from './pontoRules';
import {
  type BatidaPonto,
  batidasMesmoHorarioMinuto,
  diaPosteriorLocal,
  intervaloDiaLocal,
  montarChaveStoragePonto,
  timestampFromDiaEHora,
  normalizarOrigemBatidaPonto,
  type TipoBatida,
} from './pontoUtils';
import { gravarBatidasLocal } from './pontoSyncService';
import type { PontoDiaOcorrencia, PontoDiaOcorrenciaTipo } from './pontoDiaOcorrencia';

export type HorariosAjusteDia = Partial<
  Record<'entrada' | 'inicio_intervalo' | 'fim_intervalo' | 'saida', string>
>;

const TIPOS_ORDEM: TipoBatida[] = [
  'entrada',
  'inicio_intervalo',
  'fim_intervalo',
  'saida',
];

function montarHorariosDesejados(
  dataISO: string,
  horarios: HorariosAjusteDia,
): Array<{ tipo: TipoBatida; timestamp: string }> {
  const inserir: Array<{ tipo: TipoBatida; timestamp: string }> = [];
  for (const tipo of TIPOS_ORDEM) {
    const hora = (horarios[tipo] || '').trim();
    if (!hora) continue;
    const ts = timestampFromDiaEHora(dataISO, hora);
    if (!ts) throw new Error(`Horário inválido: ${hora} (${tipo})`);
    inserir.push({ tipo, timestamp: ts });
  }

  const entradaH = (horarios.entrada || '').trim();
  const saidaH = (horarios.saida || '').trim();
  if (entradaH && saidaH) {
    const saidaItem = inserir.find((i) => i.tipo === 'saida');
    if (saidaItem && saidaH <= entradaH) {
      const tsSaida = timestampFromDiaEHora(diaPosteriorLocal(dataISO), saidaH);
      if (!tsSaida) throw new Error(`Horário inválido: ${saidaH} (saida)`);
      saidaItem.timestamp = tsSaida;
    }
  }
  return inserir;
}

function mapRowToBatida(row: Record<string, unknown>): BatidaPonto {
  return {
    id: String(row.id),
    tipo: row.tipo as TipoBatida,
    timestamp: String(row.timestamp),
    observacao: typeof row.observacao === 'string' ? row.observacao : undefined,
    foto: typeof row.foto === 'string' ? row.foto : undefined,
    origem: normalizarOrigemBatidaPonto(row.origem),
    ajustado_por: typeof row.ajustado_por === 'string' ? row.ajustado_por : undefined,
    motivo_ajuste: typeof row.motivo_ajuste === 'string' ? row.motivo_ajuste : undefined,
  };
}

/** Remove batidas do dia no servidor e no aparelho (cache local do colaborador). */
export async function excluirBatidasDiaPonto(params: {
  empresaId: string;
  userId: string;
  dataISO: string;
}): Promise<void> {
  const { inicio, fim } = intervaloDiaLocal(params.dataISO);
  const { error } = await supabase
    .from('ponto_registros')
    .delete()
    .eq('empresa_id', params.empresaId)
    .eq('user_id', params.userId)
    .gte('timestamp', inicio)
    .lte('timestamp', fim);

  if (error) throw error;

  const storageKey = montarChaveStoragePonto(params.empresaId, params.userId, params.dataISO);
  gravarBatidasLocal(storageKey, []);
}

/** Batidas do dia no banco (+ saída noturna no dia seguinte, se houver). */
async function carregarBatidasExistentesEdicao(params: {
  empresaId: string;
  userId: string;
  dataISO: string;
}): Promise<Map<TipoBatida, BatidaPonto>> {
  const { inicio, fim } = intervaloDiaLocal(params.dataISO);
  const { data, error } = await supabase
    .from('ponto_registros')
    .select('*')
    .eq('empresa_id', params.empresaId)
    .eq('user_id', params.userId)
    .gte('timestamp', inicio)
    .lte('timestamp', fim);

  if (error) throw error;

  const porTipo = new Map<TipoBatida, BatidaPonto>();
  for (const row of data || []) {
    const batida = mapRowToBatida(row as Record<string, unknown>);
    if (!porTipo.has(batida.tipo)) porTipo.set(batida.tipo, batida);
  }

  if (!porTipo.has('saida') && porTipo.has('entrada')) {
    const diaSeg = diaPosteriorLocal(params.dataISO);
    const { inicio: i2, fim: f2 } = intervaloDiaLocal(diaSeg);
    const { data: saidas, error: err2 } = await supabase
      .from('ponto_registros')
      .select('*')
      .eq('empresa_id', params.empresaId)
      .eq('user_id', params.userId)
      .eq('tipo', 'saida')
      .gte('timestamp', i2)
      .lte('timestamp', f2)
      .order('timestamp');

    if (err2) throw err2;
    const saidaNoturna = (saidas || [])[0];
    if (saidaNoturna) {
      porTipo.set('saida', mapRowToBatida(saidaNoturna as Record<string, unknown>));
    }
  }

  return porTipo;
}

async function recarregarBatidasDiaStorage(params: {
  empresaId: string;
  userId: string;
  dataISO: string;
}): Promise<BatidaPonto[]> {
  const { inicio, fim } = intervaloDiaLocal(params.dataISO);
  const { data, error } = await supabase
    .from('ponto_registros')
    .select('*')
    .eq('empresa_id', params.empresaId)
    .eq('user_id', params.userId)
    .gte('timestamp', inicio)
    .lte('timestamp', fim)
    .order('timestamp');

  if (error) throw error;
  const batidas = (data || []).map((row) => mapRowToBatida(row as Record<string, unknown>));
  const storageKey = montarChaveStoragePonto(params.empresaId, params.userId, params.dataISO);
  gravarBatidasLocal(storageKey, batidas);
  return batidas;
}

/**
 * Ajusta horários do dia: só batidas alteradas recebem origem `ajuste_manual` (* no espelho).
 * Batidas iguais permanecem intactas no banco (sem apagar/recriar o dia inteiro).
 */
export async function salvarAjusteManualDiaPonto(params: {
  empresaId: string;
  userIdColaborador: string;
  adminUserId: string;
  dataISO: string;
  horarios: HorariosAjusteDia;
  motivo: string;
  /** Batidas antes da edição — preserva origem das que não mudaram. */
  batidasAnteriores?: BatidaPonto[];
}): Promise<BatidaPonto[]> {
  const motivo = params.motivo.trim();
  if (!motivo) throw new Error('Informe o motivo do ajuste.');

  const desejados = montarHorariosDesejados(params.dataISO, params.horarios);
  const existentesPorTipo = await carregarBatidasExistentesEdicao({
    empresaId: params.empresaId,
    userId: params.userIdColaborador,
    dataISO: params.dataISO,
  });

  const desejadosPorTipo = new Map(desejados.map((d) => [d.tipo, d]));

  if (desejados.length === 0) {
    await excluirBatidasDiaPonto({
      empresaId: params.empresaId,
      userId: params.userIdColaborador,
      dataISO: params.dataISO,
    });
    await removerOcorrenciaDiaPonto({
      empresaId: params.empresaId,
      userId: params.userIdColaborador,
      dataISO: params.dataISO,
    });
    return [];
  }

  for (const tipo of TIPOS_ORDEM) {
    const desejado = desejadosPorTipo.get(tipo);
    const atual = existentesPorTipo.get(tipo);

    if (!desejado && !atual) continue;

    if (!desejado && atual) {
      const { error } = await supabase.from('ponto_registros').delete().eq('id', atual.id);
      if (error) throw error;
      continue;
    }

    if (desejado && !atual) {
      const { error } = await supabase.from('ponto_registros').insert({
        empresa_id: params.empresaId,
        user_id: params.userIdColaborador,
        tipo: desejado.tipo,
        timestamp: desejado.timestamp,
        origem: 'ajuste_manual',
        ajustado_por: params.adminUserId,
        motivo_ajuste: motivo,
        observacao: `[Ajuste manual] ${motivo}`,
      });
      if (error) throw error;
      continue;
    }

    if (desejado && atual) {
      if (batidasMesmoHorarioMinuto(atual.timestamp, desejado.timestamp)) {
        continue;
      }

      const { error } = await supabase
        .from('ponto_registros')
        .update({
          timestamp: desejado.timestamp,
          origem: 'ajuste_manual',
          ajustado_por: params.adminUserId,
          motivo_ajuste: motivo,
          observacao: `[Ajuste manual] ${motivo}`,
        })
        .eq('id', atual.id);

      if (error) throw error;
    }
  }

  const batidas = await recarregarBatidasDiaStorage({
    empresaId: params.empresaId,
    userId: params.userIdColaborador,
    dataISO: params.dataISO,
  });

  await removerOcorrenciaDiaPonto({
    empresaId: params.empresaId,
    userId: params.userIdColaborador,
    dataISO: params.dataISO,
  });

  return batidas;
}

function mapRowOcorrencia(row: Record<string, unknown>): PontoDiaOcorrencia {
  return {
    id: String(row.id),
    data: String(row.data).slice(0, 10),
    tipo: row.tipo as PontoDiaOcorrenciaTipo,
    motivo: typeof row.motivo === 'string' ? row.motivo : undefined,
  };
}

export async function listarOcorrenciasDiaPonto(params: {
  empresaId: string;
  userId: string;
  dataInicio: string;
  dataFim: string;
}): Promise<PontoDiaOcorrencia[]> {
  const { data, error } = await supabase
    .from('ponto_dia_ocorrencias')
    .select('id, data, tipo, motivo')
    .eq('empresa_id', params.empresaId)
    .eq('user_id', params.userId)
    .gte('data', params.dataInicio.slice(0, 10))
    .lte('data', params.dataFim.slice(0, 10))
    .order('data');

  if (error) throw error;
  return (data || []).map((row) => mapRowOcorrencia(row as Record<string, unknown>));
}

export async function removerOcorrenciaDiaPonto(params: {
  empresaId: string;
  userId: string;
  dataISO: string;
}): Promise<void> {
  const { error } = await supabase
    .from('ponto_dia_ocorrencias')
    .delete()
    .eq('empresa_id', params.empresaId)
    .eq('user_id', params.userId)
    .eq('data', params.dataISO.slice(0, 10));

  if (error) throw error;
}

/** Marca o dia com ocorrência do RH. Folga/atestado removem batidas; bonificação preserva. */
export async function salvarOcorrenciaDiaPonto(params: {
  empresaId: string;
  userIdColaborador: string;
  adminUserId: string;
  dataISO: string;
  tipo: PontoDiaOcorrenciaTipo;
  motivo: string;
}): Promise<PontoDiaOcorrencia> {
  const motivo = params.motivo.trim();
  if (!motivo) throw new Error('Informe o motivo da ocorrência.');

  if (params.tipo === 'folga' || params.tipo === 'atestado') {
    await excluirBatidasDiaPonto({
      empresaId: params.empresaId,
      userId: params.userIdColaborador,
      dataISO: params.dataISO,
    });
  }

  const payload = {
    empresa_id: params.empresaId,
    user_id: params.userIdColaborador,
    data: params.dataISO.slice(0, 10),
    tipo: params.tipo,
    motivo,
    registrado_por: params.adminUserId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ponto_dia_ocorrencias')
    .upsert(payload, { onConflict: 'user_id,data' })
    .select('id, data, tipo, motivo')
    .single();

  if (error) throw error;
  return mapRowOcorrencia(data as Record<string, unknown>);
}

/** Salva intervalo implícito (1h/2h ou desativado) no perfil do colaborador. */
export async function salvarIntervaloEntradaSaidaColaborador(params: {
  userId: string;
  permissoesAtuais?: Record<string, unknown> | null;
  ativo: boolean;
  minutos: 60 | 120;
}): Promise<Record<string, unknown>> {
  const atual = getUserPontoConfig(params.permissoesAtuais);
  const novoPermissoes = {
    ...(params.permissoesAtuais || {}),
    ponto_config: {
      ...atual,
      intervalo_entrada_saida_ativo: params.ativo,
      intervalo_entrada_saida_minutos: params.ativo ? params.minutos : undefined,
    },
  };

  const { error } = await supabase
    .from('users')
    .update({ permissoes: novoPermissoes, updated_at: new Date().toISOString() })
    .eq('id', params.userId);

  if (error) throw error;
  return novoPermissoes;
}
