import { supabase } from './supabase';

function formatCentavosLocal(centavos: number): string {
    return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface ContaPagarAlteracaoDto {
    id: string;
    empresa_id: string;
    conta_pagar_id: string;
    campo_alterado: string;
    valor_anterior: string | null;
    valor_novo: string | null;
    motivo: string | null;
    usuario_id: string | null;
    created_at: string;
    usuario_nome?: string | null;
}

export const LABEL_CAMPO_CONTA_PAGAR: Record<string, string> = {
    descricao: 'Descrição',
    fornecedor_nome: 'Fornecedor',
    plano_conta_id: 'Natureza financeira',
    numero_nota_fiscal: 'Nº nota fiscal',
    data_vencimento: 'Vencimento',
    data_competencia: 'Competência',
    valor_original_centavos: 'Valor original',
};

type CampoAuditavel =
    | 'descricao'
    | 'fornecedor_nome'
    | 'plano_conta_id'
    | 'numero_nota_fiscal'
    | 'data_vencimento'
    | 'data_competencia'
    | 'valor_original_centavos';

const CAMPOS_AUDITAVEIS: CampoAuditavel[] = [
    'descricao',
    'fornecedor_nome',
    'plano_conta_id',
    'numero_nota_fiscal',
    'data_vencimento',
    'data_competencia',
    'valor_original_centavos',
];

function formatDataBr(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
}

function formatCompetenciaBr(iso?: string | null): string {
    if (!iso) return '—';
    const ym = iso.slice(0, 7);
    const [y, m] = ym.split('-');
    if (!y || !m) return iso;
    return `${m}/${y}`;
}

function normalizarCampo(campo: CampoAuditavel, valor: unknown): string {
    if (valor == null || valor === '') return '—';
    if (campo === 'data_vencimento') return formatDataBr(String(valor));
    if (campo === 'data_competencia') return formatCompetenciaBr(String(valor));
    if (campo === 'valor_original_centavos') {
        const n = Number(valor);
        return Number.isFinite(n) ? formatCentavosLocal(n) : String(valor);
    }
    return String(valor).trim() || '—';
}

function valoresIguais(campo: CampoAuditavel, anterior: unknown, novo: unknown): boolean {
    if (campo === 'data_competencia') {
        return String(anterior ?? '').slice(0, 7) === String(novo ?? '').slice(0, 7);
    }
    if (campo === 'data_vencimento') {
        return String(anterior ?? '').slice(0, 10) === String(novo ?? '').slice(0, 10);
    }
    if (campo === 'valor_original_centavos') {
        return Number(anterior ?? 0) === Number(novo ?? 0);
    }
    return String(anterior ?? '').trim() === String(novo ?? '').trim();
}

export interface AlteracaoDetectada {
    campo: CampoAuditavel;
    valor_anterior: string;
    valor_novo: string;
}

export function detectarAlteracoesContaPagar(
    anterior: Record<string, unknown>,
    novo: Record<string, unknown>,
    formatarPlano?: (id: string | null | undefined) => string,
): AlteracaoDetectada[] {
    const alteracoes: AlteracaoDetectada[] = [];

    for (const campo of CAMPOS_AUDITAVEIS) {
        const valAnt = anterior[campo];
        const valNovo = novo[campo];
        if (valNovo === undefined) continue;
        if (valoresIguais(campo, valAnt, valNovo)) continue;

        if (campo === 'plano_conta_id' && formatarPlano) {
            alteracoes.push({
                campo,
                valor_anterior: formatarPlano(valAnt as string | null | undefined),
                valor_novo: formatarPlano(valNovo as string | null | undefined),
            });
            continue;
        }

        alteracoes.push({
            campo,
            valor_anterior: normalizarCampo(campo, valAnt),
            valor_novo: normalizarCampo(campo, valNovo),
        });
    }

    return alteracoes;
}

export async function registrarAlteracoesContaPagar(params: {
    empresaId: string;
    contaPagarId: string;
    alteracoes: AlteracaoDetectada[];
    usuarioId?: string | null;
    motivo?: string | null;
}): Promise<void> {
    const { empresaId, contaPagarId, alteracoes, usuarioId, motivo } = params;
    if (!empresaId || !contaPagarId || alteracoes.length === 0) return;

    const rows = alteracoes.map((a) => ({
        empresa_id: empresaId,
        conta_pagar_id: contaPagarId,
        campo_alterado: a.campo,
        valor_anterior: a.valor_anterior,
        valor_novo: a.valor_novo,
        motivo: motivo?.trim() || null,
        usuario_id: usuarioId || null,
    }));

    const { error } = await supabase.from('fin_contas_pagar_alteracoes').insert(rows);
    if (error) console.warn('[registrarAlteracoesContaPagar]', error.message);
}

export async function listarAlteracoesContaPagar(
    contaPagarId: string,
    empresaId: string,
): Promise<ContaPagarAlteracaoDto[]> {
    if (!contaPagarId || !empresaId) return [];

    const { data, error } = await supabase
        .from('fin_contas_pagar_alteracoes')
        .select('id, empresa_id, conta_pagar_id, campo_alterado, valor_anterior, valor_novo, motivo, usuario_id, created_at')
        .eq('conta_pagar_id', contaPagarId)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true });

    if (error) {
        console.warn('[listarAlteracoesContaPagar]', error.message);
        return [];
    }

    const rows = (data ?? []) as ContaPagarAlteracaoDto[];
    const userIds = Array.from(new Set(rows.map((r) => r.usuario_id).filter(Boolean))) as string[];
    const userMap = new Map<string, string>();
    if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, nome').in('id', userIds);
        (users ?? []).forEach((u: { id: string; nome: string }) => userMap.set(u.id, u.nome));
    }

    return rows.map((r) => ({
        ...r,
        usuario_nome: r.usuario_id ? userMap.get(r.usuario_id) ?? null : null,
    }));
}
