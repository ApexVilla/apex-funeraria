import React, { useEffect, useState } from 'react';
import { Coffee, User } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Components';
import { useToast } from '../../lib/ToastStore';
import { salvarIntervaloEntradaSaidaColaborador } from '../../lib/pontoAdminService';
import {
  intervaloEntradaSaidaPadraoCargoMinutos,
  resolverIntervaloEntradaSaidaColaborador,
} from '../../lib/pontoRules';
import { formatarDuracaoPonto } from '../../lib/pontoUtils';

type DuracaoIntervaloColaborador = 60 | 120;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (permissoes: Record<string, unknown>) => void;
  colaboradorId: string;
  colaboradorNome: string;
  colaboradorRole?: string;
  colaboradorPermissoes?: Record<string, unknown> | null;
};

/**
 * Define de uma vez o intervalo de almoço (1h/2h ou desativado) do colaborador,
 * aplicado a toda a folha do mês — sem precisar abrir a edição dia a dia.
 */
export const ConfigurarIntervaloColaboradorModal: React.FC<Props> = ({
  open,
  onClose,
  onSaved,
  colaboradorId,
  colaboradorNome,
  colaboradorRole,
  colaboradorPermissoes,
}) => {
  const { showToast } = useToast();
  const [intervaloAtivo, setIntervaloAtivo] = useState(true);
  const [intervaloMinutos, setIntervaloMinutos] = useState<DuracaoIntervaloColaborador>(60);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const resolvido = resolverIntervaloEntradaSaidaColaborador(colaboradorRole, colaboradorPermissoes);
    const padraoMin = intervaloEntradaSaidaPadraoCargoMinutos(colaboradorRole);
    setIntervaloAtivo(resolvido.ativo);
    setIntervaloMinutos((resolvido.minutos === 120 ? 120 : 60) as DuracaoIntervaloColaborador);
    if (!resolvido.ativo) {
      setIntervaloMinutos((padraoMin === 120 ? 120 : 60) as DuracaoIntervaloColaborador);
    }
  }, [open, colaboradorRole, colaboradorPermissoes]);

  const handleConfirmar = async () => {
    setSaving(true);
    try {
      const novasPermissoes = await salvarIntervaloEntradaSaidaColaborador({
        userId: colaboradorId,
        permissoesAtuais: colaboradorPermissoes,
        ativo: intervaloAtivo,
        minutos: intervaloMinutos,
      });
      onSaved(novasPermissoes);
      showToast(
        intervaloAtivo
          ? `Intervalo de ${formatarDuracaoPonto(intervaloMinutos)} aplicado em toda a folha de ${colaboradorNome}.`
          : `Intervalo desativado em toda a folha de ${colaboradorNome}.`,
        'success',
      );
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar intervalo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Intervalo de almoço do colaborador" size="md">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{colaboradorNome}</p>
            <p className="text-xs text-gray-500">
              Vale para todos os dias úteis do mês — não precisa ajustar dia a dia.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Coffee className="h-4 w-4 text-amber-600" />
              Desconto de intervalo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIntervaloAtivo(true)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  intervaloAtivo
                    ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-bold text-slate-900">Intervalo ativo</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Desconta o tempo de almoço do total trabalhado nos dias úteis.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setIntervaloAtivo(false)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  !intervaloAtivo
                    ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-bold text-slate-900">Sem intervalo</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Não desconta almoço — conta o tempo total entre entrada e saída.
                </p>
              </button>
            </div>
          </div>

          {intervaloAtivo && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
                Duração do intervalo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIntervaloMinutos(60)}
                  className={`rounded-xl border-2 py-5 text-center transition-colors ${
                    intervaloMinutos === 60
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200'
                  }`}
                >
                  <p className="text-2xl font-bold font-mono">01:00</p>
                  <p className="text-xs font-semibold mt-1">1 hora</p>
                </button>
                <button
                  type="button"
                  onClick={() => setIntervaloMinutos(120)}
                  className={`rounded-xl border-2 py-5 text-center transition-colors ${
                    intervaloMinutos === 120
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200'
                  }`}
                >
                  <p className="text-2xl font-bold font-mono">02:00</p>
                  <p className="text-xs font-semibold mt-1">2 horas</p>
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
            <span className="font-semibold">Configuração atual: </span>
            {intervaloAtivo
              ? `${formatarDuracaoPonto(intervaloMinutos)} de intervalo nos dias úteis`
              : 'sem desconto de intervalo'}
          </div>

          <p className="text-xs text-slate-500 text-center">
            Padrão do cargo: {formatarDuracaoPonto(intervaloEntradaSaidaPadraoCargoMinutos(colaboradorRole))}
            {' '}(cobrador 1h · vendedor 2h)
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => void handleConfirmar()} disabled={saving}>
            {saving ? 'Salvando…' : 'Aplicar em toda a folha'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
