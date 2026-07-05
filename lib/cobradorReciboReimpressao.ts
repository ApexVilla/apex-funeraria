import { dataHojeIsoLocal } from './contratoDatas';
import { supabase } from './supabase';
import type { ModoReciboBaixaCobrador } from './ReciboTermicoService';

/** Prazo em dias corridos após a baixa em que o cobrador pode reimprimir. */
export const COBRADOR_REIMPRESSAO_DIAS_LIMITE = 7;

/** Máximo de reimpressões por recebimento (não conta a 1ª impressão na baixa). */
export const COBRADOR_REIMPRESSAO_LIMITE = 3;

export const COBRADOR_REIMPRESSAO_MOTIVO_ADMIN_MIN = 8;

export type ReimpressaoRecebimentoResumo = {
  recebimento_id: string;
  reimpressoes_count: number;
};

export type ElegibilidadeReimpressaoCobrador = {
  permitido: boolean;
  reimpressoes_count: number;
  reimpressoes_restantes: number;
  dias_desde_baixa: number;
  dias_restantes: number;
  motivo_bloqueio?: string;
};

export type ValidarReimpressaoParams = {
  data_recebimento: string;
  reimpressoes_count: number;
  cobrador_restrito: boolean;
  exigir_motivo_admin: boolean;
  motivo_admin?: string;
};

function parseDataLocal(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function diasDesdeRecebimento(dataRecebimento: string, referenciaIso = dataHojeIsoLocal()): number {
  const ref = parseDataLocal(referenciaIso);
  const data = parseDataLocal(dataRecebimento);
  return Math.floor((ref.getTime() - data.getTime()) / 86_400_000);
}

export function diasRestantesReimpressaoCobrador(
  dataRecebimento: string,
  referenciaIso = dataHojeIsoLocal(),
): number {
  return Math.max(0, COBRADOR_REIMPRESSAO_DIAS_LIMITE - diasDesdeRecebimento(dataRecebimento, referenciaIso));
}

export function avaliarElegibilidadeReimpressaoCobrador(
  dataRecebimento: string,
  reimpressoesCount: number,
  referenciaIso = dataHojeIsoLocal(),
): ElegibilidadeReimpressaoCobrador {
  const dias = diasDesdeRecebimento(dataRecebimento, referenciaIso);
  const restantes = Math.max(0, COBRADOR_REIMPRESSAO_LIMITE - reimpressoesCount);
  const diasRestantes = diasRestantesReimpressaoCobrador(dataRecebimento, referenciaIso);

  if (dias >= COBRADOR_REIMPRESSAO_DIAS_LIMITE) {
    return {
      permitido: false,
      reimpressoes_count: reimpressoesCount,
      reimpressoes_restantes: restantes,
      dias_desde_baixa: dias,
      dias_restantes: 0,
      motivo_bloqueio: `Prazo de ${COBRADOR_REIMPRESSAO_DIAS_LIMITE} dias expirado. Peça ao escritório.`,
    };
  }

  if (reimpressoesCount >= COBRADOR_REIMPRESSAO_LIMITE) {
    return {
      permitido: false,
      reimpressoes_count: reimpressoesCount,
      reimpressoes_restantes: 0,
      dias_desde_baixa: dias,
      dias_restantes: diasRestantes,
      motivo_bloqueio: `Limite de ${COBRADOR_REIMPRESSAO_LIMITE} reimpressões atingido. Peça ao escritório.`,
    };
  }

  return {
    permitido: true,
    reimpressoes_count: reimpressoesCount,
    reimpressoes_restantes: restantes,
    dias_desde_baixa: dias,
    dias_restantes: diasRestantes,
  };
}

export function validarMotivoAdminReimpressao(motivo?: string): string | null {
  const texto = (motivo || '').trim();
  if (texto.length < COBRADOR_REIMPRESSAO_MOTIVO_ADMIN_MIN) {
    return `Informe o motivo da reimpressão (mín. ${COBRADOR_REIMPRESSAO_MOTIVO_ADMIN_MIN} caracteres).`;
  }
  return null;
}

export function validarReimpressaoRecebimento(params: ValidarReimpressaoParams): void {
  if (params.cobrador_restrito) {
    const eleg = avaliarElegibilidadeReimpressaoCobrador(
      params.data_recebimento,
      params.reimpressoes_count,
    );
    if (!eleg.permitido) {
      throw new Error(eleg.motivo_bloqueio || 'Reimpressão não permitida para cobrador.');
    }
    return;
  }

  if (params.exigir_motivo_admin) {
    const erroMotivo = validarMotivoAdminReimpressao(params.motivo_admin);
    if (erroMotivo) throw new Error(erroMotivo);
  }
}

export function dataMinimaReimpressaoCobrador(referenciaIso = dataHojeIsoLocal()): string {
  const ref = parseDataLocal(referenciaIso);
  ref.setDate(ref.getDate() - COBRADOR_REIMPRESSAO_DIAS_LIMITE);
  return ref.toISOString().slice(0, 10);
}

export async function contarReimpressoesRecebimentosCampo(
  recebimentoIds: string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(recebimentoIds.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('cob_recebimentos_campo_reimpressoes')
    .select('recebimento_campo_id')
    .in('recebimento_campo_id', ids);

  if (error) throw error;

  for (const id of ids) map.set(id, 0);
  for (const row of data || []) {
    const rid = String(row.recebimento_campo_id || '');
    if (!rid) continue;
    map.set(rid, (map.get(rid) || 0) + 1);
  }
  return map;
}

export async function registrarReimpressoesRecebimentosCampo(
  entradas: Array<{
    recebimento_id: string;
    empresa_id: string;
    modo: ModoReciboBaixaCobrador;
    reimpresso_por?: string | null;
    motivo?: string | null;
    admin_override?: boolean;
  }>,
): Promise<void> {
  if (entradas.length === 0) return;

  const rows = entradas.map((e) => ({
    empresa_id: e.empresa_id,
    recebimento_campo_id: e.recebimento_id,
    reimpresso_por: e.reimpresso_por || null,
    modo: e.modo,
    motivo: e.motivo?.trim() || null,
    admin_override: e.admin_override === true,
  }));

  const { error } = await supabase.from('cob_recebimentos_campo_reimpressoes').insert(rows);
  if (error) throw error;
}
