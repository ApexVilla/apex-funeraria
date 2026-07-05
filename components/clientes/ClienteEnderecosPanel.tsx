import React from 'react';
import { CreditCard, Home, MapPin } from 'lucide-react';
import type { ClienteSB } from '../../lib/ClienteStore';
import {
  enderecoCobrancaCompletoFromCliente,
  enderecoResidencialCompletoFromCliente,
  rotuloQuadraLote,
} from '../../lib/clienteEndereco';
import { Card } from '../ui/Components';

type Props = {
  cliente: ClienteSB;
  /** Destaque visual para uso na aba de cobrança */
  variant?: 'default' | 'cobranca';
};

function CampoEndereco({
  label,
  valor,
  destaque,
  mostrarVazio,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
  mostrarVazio?: boolean;
}) {
  if (!valor && !mostrarVazio) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <p
        className={`text-sm font-semibold leading-snug ${
          destaque ? 'text-amber-900' : 'text-slate-900'
        }`}
      >
        {valor || '—'}
      </p>
    </div>
  );
}

function BlocoEndereco({
  titulo,
  icone: Icone,
  enderecoCompleto,
  quadra,
  lote,
  bairro,
  cidade,
  uf,
  cep,
  destaqueQuadraLote,
  badge,
}: {
  titulo: string;
  icone: React.ComponentType<{ className?: string }>;
  enderecoCompleto: string;
  quadra?: string | null;
  lote?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  destaqueQuadraLote?: boolean;
  badge?: string;
}) {
  const quadraLote = rotuloQuadraLote(quadra, lote);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Icone className="h-4 w-4 text-indigo-600 shrink-0" />
          {titulo}
        </h4>
        {badge ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shrink-0">
            {badge}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-slate-800 leading-relaxed font-medium mb-3">
        {enderecoCompleto || '—'}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
        <CampoEndereco label="Bairro" valor={(bairro || '').trim()} />
        <CampoEndereco
          label="Quadra / Lote"
          valor={quadraLote}
          destaque={destaqueQuadraLote && !!quadraLote}
          mostrarVazio
        />
        <CampoEndereco
          label="Cidade / UF"
          valor={[cidade, uf].filter(Boolean).join('/')}
        />
        <CampoEndereco label="CEP" valor={(cep || '').trim()} />
      </div>
    </div>
  );
}

export const ClienteEnderecosPanel: React.FC<Props> = ({ cliente, variant = 'default' }) => {
  const usaResidencialCob = cliente.usa_endereco_residencial_cobranca !== false;
  const endRes = enderecoResidencialCompletoFromCliente(cliente);
  const endCob = enderecoCobrancaCompletoFromCliente(cliente);

  const cobQuadra = usaResidencialCob ? cliente.endereco_quadra : cliente.endereco_cob_quadra;
  const cobLote = usaResidencialCob ? cliente.endereco_lote : cliente.endereco_cob_lote;
  const cobBairro = usaResidencialCob ? cliente.endereco_bairro : cliente.endereco_cob_bairro;
  const cobCidade = usaResidencialCob ? cliente.endereco_cidade : cliente.endereco_cob_cidade;
  const cobUf = usaResidencialCob ? cliente.endereco_estado : cliente.endereco_cob_uf;
  const cobCep = usaResidencialCob ? cliente.endereco_cep : cliente.endereco_cob_cep;

  return (
    <Card className={`p-5 space-y-4 ${variant === 'cobranca' ? 'border-amber-200 bg-amber-50/30' : ''}`}>
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <MapPin className="h-5 w-5 text-indigo-600" />
        <div>
          <h3 className="font-bold text-slate-900">Endereços</h3>
          <p className="text-xs text-slate-500">
            {variant === 'cobranca'
              ? 'Local de cobrança e residência do titular'
              : 'Residencial e cobrança do titular'}
          </p>
        </div>
      </div>

      <div className={`grid gap-4 ${usaResidencialCob ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <BlocoEndereco
          titulo="Residencial"
          icone={Home}
          enderecoCompleto={endRes}
          quadra={cliente.endereco_quadra}
          lote={cliente.endereco_lote}
          bairro={cliente.endereco_bairro}
          cidade={cliente.endereco_cidade}
          uf={cliente.endereco_estado}
          cep={cliente.endereco_cep}
        />

        {!usaResidencialCob ? (
          <BlocoEndereco
            titulo="Cobrança"
            icone={CreditCard}
            enderecoCompleto={endCob}
            quadra={cobQuadra}
            lote={cobLote}
            bairro={cobBairro}
            cidade={cobCidade}
            uf={cobUf}
            cep={cobCep}
            destaqueQuadraLote={variant === 'cobranca'}
            badge={variant === 'cobranca' ? 'Cobrador' : undefined}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
            <CreditCard className="h-4 w-4 inline mr-1.5 text-slate-400 align-text-bottom" />
            Cobrança utiliza o mesmo endereço residencial
            {(cliente.endereco_quadra || cliente.endereco_lote) && (
              <span className="font-semibold text-amber-800">
                {' '}
                — {rotuloQuadraLote(cliente.endereco_quadra, cliente.endereco_lote)}
              </span>
            )}
            .
          </div>
        )}
      </div>
    </Card>
  );
};
