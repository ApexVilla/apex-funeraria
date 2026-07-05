import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarDays,
  Clock,
  Coffee,
  FileText,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button, Input, Textarea } from '../../components/ui/Components';
import { useToast } from '../../lib/ToastStore';
import {
  removerOcorrenciaDiaPonto,
  salvarAjusteManualDiaPonto,
  salvarIntervaloEntradaSaidaColaborador,
  salvarOcorrenciaDiaPonto,
} from '../../lib/pontoAdminService';
import {
  LABEL_OCORRENCIA_PONTO,
  type PontoDiaOcorrencia,
  type PontoDiaOcorrenciaTipo,
} from '../../lib/pontoDiaOcorrencia';
import {
  calcularTrabalhadoMinutosColaborador,
  intervaloAlmocoImplicitoEntradaSaidaMinutos,
  intervaloEntradaSaidaPadraoCargoMinutos,
  resolverIntervaloEntradaSaidaColaborador,
  getUserPontoConfig,
  temIntervaloExplicitoEntradaSaida,
  usaPontoApenasEntradaSaida,
} from '../../lib/pontoRules';
import {
  type BatidaPonto,
  formatarDuracaoPonto,
  horaFromTimestamp,
  normalizarHoraHHmm,
  timestampFromDiaEHora,
  type TipoBatida,
} from '../../lib/pontoUtils';

type AbaEdicao = 'horarios' | 'intervalo' | 'situacao';
type SituacaoDia = 'normal' | PontoDiaOcorrenciaTipo;
type DuracaoIntervaloColaborador = 60 | 120;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onPermissoesColaboradorAtualizadas?: (permissoes: Record<string, unknown>) => void;
  empresaId: string;
  adminUserId: string;
  colaboradorNome: string;
  colaboradorId: string;
  colaboradorRole?: string;
  colaboradorPermissoes?: Record<string, unknown> | null;
  dataISO: string;
  batidasDia: BatidaPonto[];
  ocorrenciaDia?: PontoDiaOcorrencia | null;
};

const SITUACOES: Array<{
  value: SituacaoDia;
  titulo: string;
  descricao: string;
  corAtiva: string;
}> = [
  {
    value: 'normal',
    titulo: 'Dia com batidas',
    descricao: 'Jornada registrada normalmente. Edite entrada, saída e intervalo abaixo.',
    corAtiva: 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200',
  },
  {
    value: 'jornada_normal',
    titulo: 'Jornada normal (forçada)',
    descricao: 'Exige batidas no dia mesmo em folga de escala. Mantém os horários informados.',
    corAtiva: 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200',
  },
  {
    value: 'bonificacao',
    titulo: 'Bonificação',
    descricao: 'Liberação antecipada ou compensação. Mantém batidas; saldo negativo não é cobrado.',
    corAtiva: 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200',
  },
  {
    value: 'hora_extra',
    titulo: 'Hora extra',
    descricao: 'Dia tratado como hora extra. Mantém as batidas do dia.',
    corAtiva: 'border-pink-400 bg-pink-50 ring-1 ring-pink-200',
  },
  {
    value: 'feriado',
    titulo: 'Feriado (manual)',
    descricao: 'Marca o dia como feriado no espelho. Mantém batidas se houver.',
    corAtiva: 'border-amber-400 bg-amber-50 ring-1 ring-amber-200',
  },
  {
    value: 'folga',
    titulo: 'Folga',
    descricao: 'Remove todas as batidas do dia. Não conta como falta.',
    corAtiva: 'border-violet-400 bg-violet-50 ring-1 ring-violet-200',
  },
  {
    value: 'atestado',
    titulo: 'Atestado',
    descricao: 'Remove batidas do dia. Justifica ausência com atestado médico.',
    corAtiva: 'border-sky-400 bg-sky-50 ring-1 ring-sky-200',
  },
];

const SITUACOES_PERMITEM_HORARIOS = new Set<SituacaoDia>([
  'normal',
  'jornada_normal',
  'bonificacao',
  'hora_extra',
  'feriado',
]);

function abaBtnCls(ativa: boolean) {
  return `flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
    ativa
      ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
  }`;
}

function secaoCardCls() {
  return 'rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3';
}

export const EditarDiaPontoModal: React.FC<Props> = ({
  open,
  onClose,
  onSaved,
  onPermissoesColaboradorAtualizadas,
  empresaId,
  adminUserId,
  colaboradorNome,
  colaboradorId,
  colaboradorRole,
  colaboradorPermissoes,
  dataISO,
  batidasDia,
  ocorrenciaDia,
}) => {
  const apenasEntradaSaida = usaPontoApenasEntradaSaida(colaboradorRole);
  const { showToast } = useToast();

  const [aba, setAba] = useState<AbaEdicao>('horarios');
  const [situacao, setSituacao] = useState<SituacaoDia>('normal');
  const [intervaloAtivo, setIntervaloAtivo] = useState(true);
  const [intervaloMinutos, setIntervaloMinutos] = useState<DuracaoIntervaloColaborador>(60);
  const [entrada, setEntrada] = useState('');
  const [saida, setSaida] = useState('');
  const [inicioIntervalo, setInicioIntervalo] = useState('');
  const [fimIntervalo, setFimIntervalo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingIntervalo, setSavingIntervalo] = useState(false);

  useEffect(() => {
    if (!open) return;
    const pick = (tipo: TipoBatida) => horaFromTimestamp(batidasDia.find((b) => b.tipo === tipo)?.timestamp);
    const resolvido = resolverIntervaloEntradaSaidaColaborador(colaboradorRole, colaboradorPermissoes);
    const padraoMin = intervaloEntradaSaidaPadraoCargoMinutos(colaboradorRole);

    setEntrada(pick('entrada'));
    setSaida(pick('saida'));
    setInicioIntervalo(pick('inicio_intervalo'));
    setFimIntervalo(pick('fim_intervalo'));
    setSituacao(ocorrenciaDia?.tipo || 'normal');
    setIntervaloAtivo(resolvido.ativo);
    setIntervaloMinutos(
      (resolvido.minutos === 120 ? 120 : 60) as DuracaoIntervaloColaborador,
    );
    if (!resolvido.ativo) {
      setIntervaloMinutos((padraoMin === 120 ? 120 : 60) as DuracaoIntervaloColaborador);
    }
    setMotivo(ocorrenciaDia?.motivo || '');
    setAba('horarios');
  }, [open, dataISO, batidasDia, ocorrenciaDia, apenasEntradaSaida, colaboradorRole, colaboradorPermissoes]);

  const dataLabel = new Date(`${dataISO}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const permiteEditarHorarios = SITUACOES_PERMITEM_HORARIOS.has(situacao);

  const permissoesPreview = useMemo(() => {
    if (!apenasEntradaSaida) return colaboradorPermissoes;
    const cfg = getUserPontoConfig(colaboradorPermissoes);
    return {
      ...(colaboradorPermissoes || {}),
      ponto_config: {
        ...cfg,
        intervalo_entrada_saida_ativo: intervaloAtivo,
        intervalo_entrada_saida_minutos: intervaloAtivo ? intervaloMinutos : undefined,
      },
    };
  }, [apenasEntradaSaida, colaboradorPermissoes, intervaloAtivo, intervaloMinutos]);

  const batidasPreview = useMemo((): BatidaPonto[] => {
    if (!permiteEditarHorarios) return [];

    const items: BatidaPonto[] = [];
    const add = (tipo: TipoBatida, hora: string) => {
      const ts = timestampFromDiaEHora(dataISO, hora.trim());
      if (ts) items.push({ id: `prev-${tipo}`, tipo, timestamp: ts });
    };

    if (entrada.trim()) add('entrada', entrada);
    if (!apenasEntradaSaida) {
      if (inicioIntervalo.trim()) add('inicio_intervalo', inicioIntervalo);
      if (fimIntervalo.trim()) add('fim_intervalo', fimIntervalo);
    }
    if (saida.trim()) add('saida', saida);
    return items;
  }, [
    permiteEditarHorarios,
    dataISO,
    entrada,
    saida,
    inicioIntervalo,
    fimIntervalo,
    apenasEntradaSaida,
  ]);

  const minutosTrabalhadosPreview = useMemo(
    () =>
      calcularTrabalhadoMinutosColaborador(
        batidasPreview,
        colaboradorRole,
        dataISO,
        permissoesPreview,
      ),
    [batidasPreview, colaboradorRole, dataISO, permissoesPreview],
  );

  const minutosIntervaloPreview = useMemo(() => {
    if (temIntervaloExplicitoEntradaSaida(batidasPreview)) {
      const ini = batidasPreview.find((b) => b.tipo === 'inicio_intervalo');
      const fim = batidasPreview.find((b) => b.tipo === 'fim_intervalo');
      if (!ini || !fim) return 0;
      return Math.max(
        0,
        Math.round((new Date(fim.timestamp).getTime() - new Date(ini.timestamp).getTime()) / 60000),
      );
    }
    if (apenasEntradaSaida && intervaloAtivo && entrada.trim() && saida.trim()) {
      return intervaloAlmocoImplicitoEntradaSaidaMinutos(colaboradorRole, permissoesPreview);
    }
    return 0;
  }, [
    batidasPreview,
    apenasEntradaSaida,
    intervaloAtivo,
    entrada,
    saida,
    colaboradorRole,
    permissoesPreview,
  ]);

  const handleConfirmarIntervaloColaborador = async () => {
    if (!apenasEntradaSaida) return;
    setSavingIntervalo(true);
    try {
      const novasPermissoes = await salvarIntervaloEntradaSaidaColaborador({
        userId: colaboradorId,
        permissoesAtuais: colaboradorPermissoes,
        ativo: intervaloAtivo,
        minutos: intervaloMinutos,
      });
      onPermissoesColaboradorAtualizadas?.(novasPermissoes);
      showToast(
        intervaloAtivo
          ? `Intervalo de ${formatarDuracaoPonto(intervaloMinutos)} aplicado ao colaborador.`
          : 'Intervalo desativado para este colaborador.',
        'success',
      );
      onSaved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar intervalo.', 'error');
    } finally {
      setSavingIntervalo(false);
    }
  };

  const handleSalvar = async () => {
    const exigeMotivoOcorrencia = situacao !== 'normal';
    const iniInt = apenasEntradaSaida ? '' : inicioIntervalo.trim();
    const fimInt = apenasEntradaSaida ? '' : fimIntervalo.trim();
    const pickOriginal = (tipo: TipoBatida) =>
      normalizarHoraHHmm(horaFromTimestamp(batidasDia.find((b) => b.tipo === tipo)?.timestamp));

    const horariosAtuais: Record<TipoBatida, string> = {
      entrada: normalizarHoraHHmm(entrada),
      inicio_intervalo: normalizarHoraHHmm(iniInt),
      fim_intervalo: normalizarHoraHHmm(fimInt),
      saida: normalizarHoraHHmm(saida),
    };
    const horariosOriginais: Record<TipoBatida, string> = {
      entrada: pickOriginal('entrada'),
      inicio_intervalo: pickOriginal('inicio_intervalo'),
      fim_intervalo: pickOriginal('fim_intervalo'),
      saida: pickOriginal('saida'),
    };

    const tiposRelevantes: TipoBatida[] = apenasEntradaSaida
      ? ['entrada', 'saida']
      : ['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'];

    const alterouHorarios = tiposRelevantes.some(
      (tipo) => horariosAtuais[tipo] !== horariosOriginais[tipo],
    );
    const temHorarios = tiposRelevantes.some((tipo) => horariosAtuais[tipo]);
    const limpandoDia = batidasDia.length > 0 && !temHorarios;

    if (exigeMotivoOcorrencia && !motivo.trim()) {
      showToast(`Informe o motivo para "${labelSituacao(situacao)}".`, 'error');
      setAba('situacao');
      return;
    }

    if (permiteEditarHorarios && alterouHorarios && !motivo.trim()) {
      showToast('Informe o motivo do ajuste de horários.', 'error');
      if (aba !== 'situacao') setAba('horarios');
      return;
    }

    if (permiteEditarHorarios && (iniInt || fimInt) && (!iniInt || !fimInt)) {
      showToast('Preencha início e fim do intervalo, ou deixe ambos em branco.', 'error');
      setAba('intervalo');
      return;
    }

    if (
      permiteEditarHorarios &&
      limpandoDia &&
      situacao === 'normal' &&
      !motivo.trim()
    ) {
      if (!window.confirm('Limpar todas as batidas deste dia? Esta ação não pode ser desfeita automaticamente.')) {
        return;
      }
    }

    setSaving(true);
    try {
      if (permiteEditarHorarios && (alterouHorarios || limpandoDia)) {
        await salvarAjusteManualDiaPonto({
          empresaId,
          userIdColaborador: colaboradorId,
          adminUserId,
          dataISO,
          horarios: {
            entrada: horariosAtuais.entrada,
            inicio_intervalo: apenasEntradaSaida
              ? horariosOriginais.inicio_intervalo
              : horariosAtuais.inicio_intervalo,
            fim_intervalo: apenasEntradaSaida
              ? horariosOriginais.fim_intervalo
              : horariosAtuais.fim_intervalo,
            saida: horariosAtuais.saida,
          },
          motivo: motivo.trim() || 'Limpeza manual do dia',
        });
      }

      if (situacao !== 'normal') {
        await salvarOcorrenciaDiaPonto({
          empresaId,
          userIdColaborador: colaboradorId,
          adminUserId,
          dataISO,
          tipo: situacao,
          motivo: motivo.trim(),
        });
      } else if (ocorrenciaDia && !alterouHorarios) {
        await removerOcorrenciaDiaPonto({
          empresaId,
          userId: colaboradorId,
          dataISO,
        });
      }

      const msg =
        situacao !== 'normal'
          ? `Dia atualizado: ${labelSituacao(situacao).toLowerCase()}.`
          : 'Horários atualizados. Ajustes aparecem com * no espelho.';
      showToast(msg, 'success');
      onSaved();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Editar dia na folha de ponto" size="lg">
      <div className="space-y-5">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{colaboradorNome}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 capitalize mt-0.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {dataLabel}
            </p>
            {apenasEntradaSaida && (
              <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1 mt-2 inline-block">
                Cargo com registro apenas de entrada e saída
              </p>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-2">
          <button type="button" className={abaBtnCls(aba === 'horarios')} onClick={() => setAba('horarios')}>
            <Clock className="h-4 w-4" />
            Horários
          </button>
          <button type="button" className={abaBtnCls(aba === 'intervalo')} onClick={() => setAba('intervalo')}>
            <Coffee className="h-4 w-4" />
            Intervalo
          </button>
          <button type="button" className={abaBtnCls(aba === 'situacao')} onClick={() => setAba('situacao')}>
            <Briefcase className="h-4 w-4" />
            Situação
          </button>
        </div>

        {/* Aba Horários */}
        {aba === 'horarios' && (
          <div className={secaoCardCls()}>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                Horários da jornada
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Entrada e saída do expediente. Horários salvos pelo gestor aparecem com{' '}
                <strong className="text-amber-700">*</strong> no espelho.
              </p>
            </div>

            {!permiteEditarHorarios ? (
              <p className="text-sm text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                Com a situação <strong>{labelSituacao(situacao)}</strong> as batidas são removidas automaticamente.
                Altere a situação para editar horários.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-emerald-700 flex items-center gap-1.5">
                      <LogIn className="h-3.5 w-3.5" />
                      Entrada
                    </label>
                    <Input
                      type="time"
                      value={entrada}
                      onChange={(e) => setEntrada(e.target.value)}
                      aria-label="Horário de entrada"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-rose-700 flex items-center gap-1.5">
                      <LogOut className="h-3.5 w-3.5" />
                      Saída
                    </label>
                    <Input
                      type="time"
                      value={saida}
                      onChange={(e) => setSaida(e.target.value)}
                      aria-label="Horário de saída"
                    />
                  </div>
                </div>

                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Apenas os horários que você alterar serão marcados com * (ajuste manual); os demais permanecem como estavam no relógio ou na importação.
                </p>
              </>
            )}
          </div>
        )}

        {/* Aba Intervalo */}
        {aba === 'intervalo' && (
          <div className={secaoCardCls()}>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Coffee className="h-4 w-4 text-amber-600" />
                Intervalo de almoço / descanso
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {apenasEntradaSaida
                  ? 'Configuração do colaborador — vale para todos os dias úteis do espelho.'
                  : 'Horários de início e fim do intervalo neste dia.'}
              </p>
            </div>

            {apenasEntradaSaida ? (
              <div className="space-y-4">
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

                <Button
                  className="w-full"
                  onClick={() => void handleConfirmarIntervaloColaborador()}
                  disabled={savingIntervalo || saving}
                >
                  {savingIntervalo ? 'Salvando…' : 'Confirmar intervalo do colaborador'}
                </Button>

                <p className="text-xs text-slate-500 text-center">
                  Padrão do cargo:{' '}
                  {formatarDuracaoPonto(intervaloEntradaSaidaPadraoCargoMinutos(colaboradorRole))}
                  {' '}(cobrador 1h · vendedor 2h)
                </p>
              </div>
            ) : !permiteEditarHorarios ? (
              <p className="text-sm text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                Intervalo não se aplica quando o dia está como <strong>{labelSituacao(situacao)}</strong>.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-amber-700">
                    Início do intervalo
                  </label>
                  <Input
                    type="time"
                    value={inicioIntervalo}
                    onChange={(e) => setInicioIntervalo(e.target.value)}
                    aria-label="Início do intervalo"
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-blue-700">
                    Fim do intervalo
                  </label>
                  <Input
                    type="time"
                    value={fimIntervalo}
                    onChange={(e) => setFimIntervalo(e.target.value)}
                    aria-label="Fim do intervalo"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aba Situação */}
        {aba === 'situacao' && (
          <div className={secaoCardCls()}>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-violet-600" />
                Situação do dia
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Classificação do dia no espelho (folga, atestado, bonificação, etc.).
              </p>
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {SITUACOES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSituacao(opt.value)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    situacao === opt.value ? opt.corAtiva : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">{opt.titulo}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{opt.descricao}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prévia do cálculo */}
        {permiteEditarHorarios && (entrada.trim() || saida.trim()) && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-800 mb-2">Prévia do cálculo</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-indigo-600">Horas trabalhadas</p>
                <p className="font-mono font-bold text-indigo-900 text-lg">
                  {formatarDuracaoPonto(minutosTrabalhadosPreview)}
                </p>
              </div>
              <div>
                <p className="text-xs text-indigo-600">Intervalo</p>
                <p className="font-mono font-bold text-indigo-900 text-lg">
                  {minutosIntervaloPreview > 0 ? formatarDuracaoPonto(minutosIntervaloPreview) : '—'}
                  {apenasEntradaSaida && intervaloAtivo && minutosIntervaloPreview > 0 && (
                    <span className="text-xs font-sans text-amber-700 ml-1">(config.)</span>
                  )}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-indigo-600">Situação selecionada</p>
                <p className="font-semibold text-indigo-900">{labelSituacao(situacao)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Motivo */}
        <div className={secaoCardCls()}>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <label className="text-sm font-bold text-slate-800">
              Motivo {situacao !== 'normal' ? `(obrigatório — ${labelSituacao(situacao)})` : 'do ajuste'}
            </label>
          </div>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder={
              situacao === 'bonificacao'
                ? 'Ex.: liberação 13h — evento externo (horas bonificadas)'
                : situacao === 'folga'
                  ? 'Ex.: folga compensada, plantão trocado'
                  : situacao === 'atestado'
                    ? 'Ex.: atestado médico 1 dia, CID informado'
                    : 'Ex.: esqueceu de bater saída; correção aprovada pela RH'
            }
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => void handleSalvar()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

function labelSituacao(situacao: SituacaoDia): string {
  if (situacao === 'normal') return 'Dia com batidas';
  return LABEL_OCORRENCIA_PONTO[situacao];
}
