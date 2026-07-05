import type { ClienteSB } from './ClienteStore';
import { montarEnderecoResidenciaProposta } from './propostaEndereco';

type EnderecoPartes = {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  quadra?: string | null;
  lote?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
};

function montarEnderecoCompleto(parts: EnderecoPartes): string {
  const base = montarEnderecoResidenciaProposta(parts);
  const complemento = (parts.complemento || '').trim();
  if (!complemento) return base;

  const linhas = base.split(' — ').filter(Boolean);
  if (linhas.length === 0) return complemento;
  const [primeira, ...resto] = linhas;
  return [primeira + (primeira.includes(complemento) ? '' : ` - ${complemento}`), ...resto]
    .filter(Boolean)
    .join(' — ');
}

export function enderecoResidencialCompletoFromCliente(
  c: Pick<
    ClienteSB,
    | 'endereco_logradouro'
    | 'endereco_numero'
    | 'endereco_complemento'
    | 'endereco_bairro'
    | 'endereco_quadra'
    | 'endereco_lote'
    | 'endereco_cidade'
    | 'endereco_estado'
    | 'endereco_cep'
  >,
): string {
  return montarEnderecoCompleto({
    logradouro: c.endereco_logradouro,
    numero: c.endereco_numero,
    complemento: c.endereco_complemento,
    bairro: c.endereco_bairro,
    quadra: c.endereco_quadra,
    lote: c.endereco_lote,
    cidade: c.endereco_cidade,
    uf: c.endereco_estado,
    cep: c.endereco_cep,
  });
}

export function enderecoCobrancaCompletoFromCliente(
  c: Pick<
    ClienteSB,
    | 'usa_endereco_residencial_cobranca'
    | 'endereco_logradouro'
    | 'endereco_numero'
    | 'endereco_complemento'
    | 'endereco_bairro'
    | 'endereco_quadra'
    | 'endereco_lote'
    | 'endereco_cidade'
    | 'endereco_estado'
    | 'endereco_cep'
    | 'endereco_cob_logradouro'
    | 'endereco_cob_numero'
    | 'endereco_cob_complemento'
    | 'endereco_cob_bairro'
    | 'endereco_cob_quadra'
    | 'endereco_cob_lote'
    | 'endereco_cob_cidade'
    | 'endereco_cob_uf'
    | 'endereco_cob_cep'
  >,
): string {
  const usaRes = c.usa_endereco_residencial_cobranca !== false;
  if (usaRes) return enderecoResidencialCompletoFromCliente(c);

  return montarEnderecoCompleto({
    logradouro: c.endereco_cob_logradouro,
    numero: c.endereco_cob_numero,
    complemento: c.endereco_cob_complemento,
    bairro: c.endereco_cob_bairro,
    quadra: c.endereco_cob_quadra,
    lote: c.endereco_cob_lote,
    cidade: c.endereco_cob_cidade,
    uf: c.endereco_cob_uf,
    cep: c.endereco_cob_cep,
  });
}

export function clienteTemQuadraLote(
  c: Pick<ClienteSB, 'endereco_quadra' | 'endereco_lote' | 'endereco_cob_quadra' | 'endereco_cob_lote'>,
): boolean {
  return Boolean(
    (c.endereco_quadra || '').trim() ||
      (c.endereco_lote || '').trim() ||
      (c.endereco_cob_quadra || '').trim() ||
      (c.endereco_cob_lote || '').trim(),
  );
}

export function rotuloQuadraLote(quadra?: string | null, lote?: string | null): string {
  const q = (quadra || '').trim();
  const l = (lote || '').trim();
  if (q && l) return `Quadra ${q} · Lote ${l}`;
  if (q) return `Quadra ${q}`;
  if (l) return `Lote ${l}`;
  return '';
}
