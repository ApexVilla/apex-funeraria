import { supabase } from './supabase';
import { dataHojeIsoLocal, dataIsoLocalFromDate } from './contratoDatas';

const LOTE_MENSALIDADES = 12;
const MAX_LOTES_SINCRONIZACAO = 24;

const STATUS_EM_ABERTO = ['aberto', 'vencido', 'pago_parcial'] as const;

/** Último dia do mês corrente (YYYY-MM-DD) no fuso local. */
function fimMesAtualIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const mm = String(m + 1).padStart(2, '0');
    return `${y}-${mm}-${String(last).padStart(2, '0')}`;
}

/** YYYY-MM a partir de data ISO (competência ou vencimento). */
export function mesReferenciaYm(iso?: string | null): string {
    const s = String(iso || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(0, 7) : '';
}

/**
 * Vencimento no mês (YYYY-MM) com o dia fixo da assinatura,
 * travado no último dia do mês quando o dia não existe (ex.: 31 → 28/29 fev).
 */
export function vencimentoMensalidadeNoMes(ym: string, diaVencimento: number): string {
    const m = String(ym || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return dataHojeIsoLocal();
    const [yStr, mStr] = m.split('-');
    const y = parseInt(yStr, 10);
    const monthIndex = parseInt(mStr, 10) - 1;
    const alvo = Math.max(1, Math.min(31, Math.floor(diaVencimento) || 5));
    const last = new Date(y, monthIndex + 1, 0).getDate();
    return dataIsoLocalFromDate(new Date(y, monthIndex, Math.min(alvo, last), 12, 0, 0, 0));
}

/** Meses (YYYY-MM) já ocupados por mensalidades ativas da assinatura. */
export async function listarMesesMensalidadeOcupados(assinaturaId: string): Promise<Set<string>> {
    const { data, error } = await supabase
        .from('fin_contas_receber')
        .select('data_competencia, data_vencimento')
        .eq('assinatura_id', assinaturaId)
        .eq('tipo_documento', 'mensalidade')
        .is('deleted_at', null);
    if (error) throw error;

    const meses = new Set<string>();
    for (const row of data || []) {
        // Mês canônico = vencimento (competência desalinhada não deve liberar duplicata).
        const ym =
            mesReferenciaYm(row.data_vencimento as string) ||
            mesReferenciaYm(row.data_competencia as string);
        if (ym) meses.add(ym);
    }
    return meses;
}

/** Primeiro buraco (mês faltante) entre o menor e o maior mês ocupado; senão o mês atual se livre. */
export function sugerirMesMensalidadeFaltante(ocupados: Set<string>, hojeYm?: string): string {
    const atual = hojeYm || dataHojeIsoLocal().slice(0, 7);
    if (ocupados.size === 0) return atual;

    const ordenados = [...ocupados].sort();
    const primeiro = ordenados[0];
    const ultimo = ordenados[ordenados.length - 1];

    let cur = primeiro;
    while (cur <= ultimo) {
        if (!ocupados.has(cur)) return cur;
        const [y, m] = cur.split('-').map(Number);
        const d = new Date(y, m, 1); // avança 1 mês (m já é 1-based → Date usa m como próximo)
        cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!ocupados.has(atual)) return atual;
    return atual;
}

/** Garante que o mês ainda não tem mensalidade (para create manual / RPC). */
export async function assertMesMensalidadeLivre(
    assinaturaId: string,
    mesYm: string,
): Promise<void> {
    const ym = String(mesYm || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) {
        throw new Error('Mês de competência inválido.');
    }
    const ocupados = await listarMesesMensalidadeOcupados(assinaturaId);
    if (ocupados.has(ym)) {
        const [y, m] = ym.split('-');
        const label = `${m}/${y}`;
        throw new Error(
            `Já existe mensalidade para ${label} neste contrato. Exclua a parcela desse mês para recriá-la — não é permitido duplicar o mesmo mês.`,
        );
    }
}

async function contarParcelasEmAberto(assinaturaId: string): Promise<number> {
    const { count, error } = await supabase
        .from('fin_contas_receber')
        .select('*', { count: 'exact', head: true })
        .eq('assinatura_id', assinaturaId)
        .in('status', [...STATUS_EM_ABERTO])
        .is('deleted_at', null);
    if (error) throw error;
    return count ?? 0;
}

async function ultimoVencimentoAssinatura(assinaturaId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('fin_contas_receber')
        .select('data_vencimento')
        .eq('assinatura_id', assinaturaId)
        .eq('tipo_documento', 'mensalidade')
        .is('deleted_at', null)
        .order('data_vencimento', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    const iso = (data?.data_vencimento as string | undefined)?.slice(0, 10);
    return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/** Parcelas geradas cobrem o mês atual (último vencimento >= fim do mês). */
export function parcelasCobremMesAtual(ultimoVencimentoIso: string | null): boolean {
    if (!ultimoVencimentoIso) return false;
    return ultimoVencimentoIso >= fimMesAtualIso();
}

/**
 * Gera lotes de 12 mensalidades enquanto não houver parcelas em aberto e o último
 * vencimento ainda não alcançou o mês atual (continuidade após baixa em massa).
 */
export async function sincronizarParcelasAssinatura(
    assinaturaId: string,
    gerarLote: (id: string, meses: number) => Promise<number>,
): Promise<number> {
    let totalGeradas = 0;

    for (let iter = 0; iter < MAX_LOTES_SINCRONIZACAO; iter++) {
        const emAberto = await contarParcelasEmAberto(assinaturaId);
        if (emAberto > 0) break;

        const ultimoVenc = await ultimoVencimentoAssinatura(assinaturaId);
        if (ultimoVenc && parcelasCobremMesAtual(ultimoVenc)) break;

        const geradas = await gerarLote(assinaturaId, LOTE_MENSALIDADES);
        if (geradas <= 0) break;
        totalGeradas += geradas;
    }

    return totalGeradas;
}

/** Sincroniza todas as assinaturas ativas do cliente (ex.: ao abrir Financeiro). */
export async function sincronizarParcelasCliente(
    clienteId: string,
    gerarLote: (assinaturaId: string, meses: number) => Promise<number>,
): Promise<number> {
    const { data: assinaturas, error } = await supabase
        .from('assinaturas')
        .select('id, status, em_inercia')
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .in('status', ['ativo', 'suspenso']);

    if (error) throw error;

    let total = 0;
    for (const a of assinaturas || []) {
        if ((a as { em_inercia?: boolean }).em_inercia) continue;
        total += await sincronizarParcelasAssinatura(a.id, gerarLote);
    }
    return total;
}

export { LOTE_MENSALIDADES, dataHojeIsoLocal };
