import { supabase } from './supabase';

export function normalizarDocumentoFornecedor(raw?: string | null): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export type FornecedorDuplicadoMotivo = 'documento' | 'nome';

export type FornecedorDuplicadoInfo = {
  id: string;
  nome: string;
  codigo?: string | null;
  cnpj_cpf?: string | null;
  motivo: FornecedorDuplicadoMotivo;
};

export function mensagemFornecedorDuplicado(info: FornecedorDuplicadoInfo): string {
  const cod = info.codigo ? ` (código ${info.codigo})` : '';
  if (info.motivo === 'documento') {
    return `Já existe o fornecedor "${info.nome}"${cod} com este CPF/CNPJ. Use o cadastro existente em vez de criar outro.`;
  }
  return `Já existe o fornecedor "${info.nome}"${cod} com o mesmo nome nesta unidade. Confira o cadastro existente antes de continuar.`;
}

/**
 * Busca fornecedor ativo com mesmo CPF/CNPJ ou nome (case insensitive) na empresa.
 */
export async function buscarFornecedorDuplicado(params: {
  documento?: string | null;
  nome?: string | null;
  empresaId?: string | null;
  excluirFornecedorId?: string | null;
}): Promise<FornecedorDuplicadoInfo | null> {
  const empresaId = params.empresaId?.trim() || '';
  if (!empresaId) return null;

  const excluir = params.excluirFornecedorId?.trim() || null;
  const documentoDigits = normalizarDocumentoFornecedor(params.documento);
  const nomeNorm = String(params.nome ?? '').trim().toLowerCase();

  if (documentoDigits.length === 11 || documentoDigits.length === 14) {
    let q = supabase
      .from('fornecedores')
      .select('id, nome, codigo, cnpj_cpf')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .not('cnpj_cpf', 'is', null);
    if (excluir) q = q.neq('id', excluir);

    const { data, error } = await q;
    if (error) {
      console.warn('[buscarFornecedorDuplicado] documento:', error.message);
    } else {
      const match = (data || []).find(
        (row) => normalizarDocumentoFornecedor(row.cnpj_cpf) === documentoDigits,
      );
      if (match?.id) {
        return {
          id: match.id,
          nome: match.nome,
          codigo: match.codigo,
          cnpj_cpf: match.cnpj_cpf,
          motivo: 'documento',
        };
      }
    }
  }

  if (nomeNorm.length < 3) return null;

  let qNome = supabase
    .from('fornecedores')
    .select('id, nome, codigo, cnpj_cpf')
    .eq('empresa_id', empresaId)
    .is('deleted_at', null)
    .ilike('nome', nomeNorm);
  if (excluir) qNome = qNome.neq('id', excluir);

  const { data: porNome, error: errNome } = await qNome.limit(5);
  if (errNome) {
    console.warn('[buscarFornecedorDuplicado] nome:', errNome.message);
    return null;
  }

  const matchNome = (porNome || []).find(
    (row) => String(row.nome || '').trim().toLowerCase() === nomeNorm,
  );
  if (!matchNome?.id) return null;

  return {
    id: matchNome.id,
    nome: matchNome.nome,
    codigo: matchNome.codigo,
    cnpj_cpf: matchNome.cnpj_cpf,
    motivo: 'nome',
  };
}
