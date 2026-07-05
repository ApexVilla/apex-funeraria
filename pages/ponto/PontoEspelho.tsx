import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge, Button, Card, Input, Select } from '../../components/ui/Components';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { useEmpresaContextoAtivo } from '../../lib/EmpresaContextoAtivo';
import { useFilial } from '../../lib/FilialContext';
import { listarColaboradoresPonto, type ColaboradorPonto } from '../../lib/pontoColaboradores';
import { useEmpresaIdsOperacao } from '../../lib/useEmpresaIdsOperacao';
import {
  canEditarFolhaPonto,
  canVerEspelhoPontoTodosColaboradores,
  calcularTrabalhadoMinutosColaborador,
  diaFechadoParaSaldoMensal,
  getUserPontoConfig,
  intervaloAlmocoImplicitoEntradaSaidaMinutos,
  intervaloAlmocoImplicitoMinutosNoDia,
  labelIntervaloAlmocoImplicitoDeclaracao,
  jornadaPontoFinalizada,
  labelRegimePonto,
  normalizarBatidasAfdDia,
  normalizarBatidasEntradaSaida,
  resolverIntervaloEntradaSaidaColaborador,
  usaPontoApenasEntradaSaida,
} from '../../lib/pontoRules';
import {
  diaAntesInicioPonto,
  diaExigeRegistroPonto,
  isDiaExtra12x36,
  isDiaFolga12x36,
  isDiaHoraExtra,
  isDomingoLocal,
  isRegime12x36,
  isSabadoFolgaEscala,
  isSabadoLocal,
  isSabadoTrabalhoEscala,
  metaMinutosNoDia,
  temEscalaSabadoAlternado,
} from '../../lib/pontoEscala';
import {
  carregarFiliaisEmpresas,
  carregarFilialCobradores,
  listarFeriadosColaborador,
  montarFeriadosPorColaborador,
  isDiaFeriado,
} from '../../lib/pontoFeriados';
import {
  isDiaFerias,
  listarFeriasColaborador,
  type FeriasPeriodo,
} from '../../lib/pontoFerias';
import {
  type BatidaPonto,
  type TipoBatida,
  batidaEhAjusteManual,
  batidaEmDiaPosterior,
  batidasDoTipo,
  consolidarEPrepararBatidasEspelho,
  diaLocalFromTimestamp,
  formatarDuracaoPonto,
  formatarHoraPontoExibicao,
  getDataLocalISO,
  intervaloMesComMargemJornada,
  mergeBatidasPorId,
  normalizarOrigemBatidaPonto,
} from '../../lib/pontoUtils';
import { EditarDiaPontoModal } from './EditarDiaPontoModal';
import { ConfigurarIntervaloColaboradorModal } from './ConfigurarIntervaloColaboradorModal';
import {
  isDiaAtestado,
  isDiaFolgaManual,
  isDiaBonificado,
  isDiaJustificadoPorOcorrencia,
  mapaOcorrenciasPorDia,
  type PontoDiaOcorrencia,
} from '../../lib/pontoDiaOcorrencia';
import { listarOcorrenciasDiaPonto } from '../../lib/pontoAdminService';
import { opcoesConsolidacaoJornadaMultidia } from '../../lib/ponto12x36Catalao';
import { ordenarCargosPorHierarquia } from '../../lib/userRoles';
import { baixarPdfFolhaPonto, slugArquivoFolhaPonto, tituloJanelaFolhaPonto } from '../../lib/folhaPontoPdf';
import { resolveLogoUrl } from '../../lib/fenixLogo';
import { APEX_PLAN_NAME, APEX_PLAN_TAGLINE } from '../../lib/apexBranding';
import { Calendar, ChevronLeft, ChevronRight, Coffee, Download, LogIn, LogOut, Pencil, Printer, RefreshCw, User, Camera, Search, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '../../lib/ToastStore';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const nomeTipo: Record<TipoBatida, string> = {
  entrada: 'Entrada',
  inicio_intervalo: 'Início Intervalo',
  fim_intervalo: 'Fim Intervalo',
  saida: 'Saída',
};

const calcularIntervaloMinutos = (batidas: BatidaPonto[]) => {
  const inicio = batidas.find(b => b.tipo === 'inicio_intervalo');
  const fim = batidas.find(b => b.tipo === 'fim_intervalo');
  if (!inicio || !fim) return 0;
  return Math.max(0, Math.round((new Date(fim.timestamp).getTime() - new Date(inicio.timestamp).getTime()) / 60000));
};

const getDiasNoMes = (ano: number, mes: number): string[] => {
  const dias: string[] = [];
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  for (let d = 1; d <= ultimoDia; d++) {
    dias.push(`${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dias;
};

const diaSemanaAbrev = (dataISO: string) => {
  const d = new Date(`${dataISO}T12:00:00`);
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
};

const isFimDeSemana = (dataISO: string) => {
  const d = new Date(`${dataISO}T12:00:00`).getDay();
  return d === 0 || d === 6;
};

interface PontoEspelhoProps {
  modoRH?: boolean;
}

const DEFAULT_ROLE_OPTIONS = [
  { value: 'atendente', label: 'Atendente' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'cobrador', label: 'Cobrador' },
  { value: 'motorista', label: 'Motorista' },
  { value: 'agente_funerario', label: 'Agente Funerário' },
  { value: 'estoquista', label: 'Estoquista' },
  { value: 'recepcao', label: 'Recepção' },
  { value: 'auxiliar_servicos_gerais', label: 'Auxiliar de Serviços Gerais' },
  { value: 'rh', label: 'Recursos Humanos (RH)' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'supervisao', label: 'Supervisor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'diretoria', label: 'Diretoria' },
  { value: 'gestao_executiva', label: 'Gestão Executiva' },
  { value: 'admin', label: 'Administrador' },
];

function labelCargoColaborador(
  role: string | undefined | null,
  roleOptions: ReadonlyArray<{ value: string; label: string }>,
): string {
  const codigo = (role || '').trim();
  if (!codigo) return '—';
  const encontrado = roleOptions.find((o) => o.value === codigo)?.label;
  if (encontrado) return encontrado;
  return codigo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const PontoEspelho: React.FC<PontoEspelhoProps> = ({ modoRH = false }) => {
  const { user, empresa } = useAuth();
  const { showToast } = useToast();
  const { empresaIdsFiltro, empresaIdOperacao, aguardandoContexto, dataRevisionEmpresa, empresaNomePorId } =
    useEmpresaIdsOperacao();
  const {
    visaoTodasEmpresasGrupo,
    empresasDoGrupo,
    podeAlternarEmpresa,
    dataRevisionEmpresa: revEmpresaCtx,
  } = useEmpresaContextoAtivo();
  const { filialId, isTodasFiliais, dataRevision: dataRevisionFilial } = useFilial();
  const podeVerEspelhoTodos = modoRH && canVerEspelhoPontoTodosColaboradores(user?.role, user?.permissoes);
  const podeEditarFolha = modoRH && canEditarFolhaPonto(user?.role, user?.permissoes);
  const hoje = new Date();

  const [activeTab, setActiveTab] = useState<'espelho' | 'graficos'>('espelho');
  const [mesRef, setMesRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [colaboradores, setColaboradores] = useState<ColaboradorPonto[]>([]);
  const [colabSelecionado, setColabSelecionado] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [buscaColab, setBuscaColab] = useState('');
  const [showColabDropdown, setShowColabDropdown] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [logoUrlEmpresaFolha, setLogoUrlEmpresaFolha] = useState<string | null>(null);
  const [roleOptions, setRoleOptions] = useState(DEFAULT_ROLE_OPTIONS);

  useEffect(() => {
    const loadCargos = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('codigo, nome, ativo')
          .eq('ativo', true);
        if (error) throw error;
        if (data && data.length > 0) {
          const formatted = data.map((d) => ({ value: d.codigo, label: d.nome }));
          setRoleOptions(ordenarCargosPorHierarquia(formatted));
        }
      } catch (e) {
        console.error('[PontoEspelho] erro cargos', e);
      }
    };
    void loadCargos();
  }, []);

  const lastColabRequestId = useRef(0);
  const lastRequestId = useRef(0);

  useEffect(() => {
    if (!podeVerEspelhoTodos) {
      if (user?.id) setColabSelecionado(user.id);
      return;
    }
    if (aguardandoContexto) {
      setLoading(true);
      return;
    }

    const ids = empresaIdsFiltro;
    if (ids.length === 0) {
      setColaboradores([]);
      return;
    }

    const load = async () => {
      const requestId = ++lastColabRequestId.current;
      setLoading(true);
      try {
        const lista = await listarColaboradoresPonto({
          empresaIdsFiltro: ids,
          empresaIdOperacao,
          empresasDoGrupo,
          visaoTodasEmpresasGrupo,
          podeAlternarEmpresa,
          filialId,
          isTodasFiliais,
        });
        if (requestId !== lastColabRequestId.current) return;

        setColaboradores(lista);
        const idsValidos = new Set(lista.map((c) => c.id));
        
        // Tenta obter o colabId dos parâmetros de busca da URL (HashRouter)
        const hash = window.location.hash;
        const queryIndex = hash.indexOf('?');
        let urlColabId = '';
        if (queryIndex !== -1) {
          const params = new URLSearchParams(hash.substring(queryIndex));
          urlColabId = params.get('colabId') || '';
        }

        if (urlColabId && idsValidos.has(urlColabId)) {
          setColabSelecionado(urlColabId);
        } else {
          const preferido = lista.find((c) => c.id === user?.id)?.id || lista[0]?.id || '';
          setColabSelecionado(preferido);
        }
      } catch (e) {
        if (requestId !== lastColabRequestId.current) return;
        console.error('[PontoEspelho] colaboradores', e);
        showToast('Não foi possível carregar a lista de colaboradores.', 'error');
        setColaboradores([]);
      } finally {
        if (requestId === lastColabRequestId.current) setLoading(false);
      }
    };
    void load();
  }, [
    podeVerEspelhoTodos,
    aguardandoContexto,
    empresaIdsFiltro.join(','),
    dataRevisionEmpresa,
    revEmpresaCtx,
    dataRevisionFilial,
    empresaIdOperacao,
    visaoTodasEmpresasGrupo,
    empresasDoGrupo,
    podeAlternarEmpresa,
    filialId,
    isTodasFiliais,
    user?.id,
    showToast,
  ]);

  const colaboradorAtual = useMemo(() => {
    if (colaboradores.length > 0) return colaboradores.find(c => c.id === colabSelecionado);
    if (!user) return undefined;
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      permissoes: user.permissoes,
      empresa_id: user.empresa_id,
    } as ColaboradorPonto;
  }, [colabSelecionado, colaboradores, user]);

  const cargoColaboradorLabel = useMemo(
    () => labelCargoColaborador(colaboradorAtual?.role, roleOptions),
    [colaboradorAtual?.role, roleOptions],
  );

  useEffect(() => {
    if (colaboradorAtual) {
      setBuscaColab(colaboradorAtual.nome || colaboradorAtual.email || '');
    } else {
      setBuscaColab('');
    }
  }, [colaboradorAtual]);

  const colaboradoresFiltrados = useMemo(() => {
    const term = buscaColab.toLowerCase().trim();
    const nomeAtual = (colaboradorAtual?.nome || '').toLowerCase().trim();
    const emailAtual = (colaboradorAtual?.email || '').toLowerCase().trim();

    if (!term || term === nomeAtual || term === emailAtual) {
      return colaboradores;
    }

    return colaboradores.filter((c) =>
      (c.nome || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term)
    );
  }, [colaboradores, buscaColab, colaboradorAtual]);

  const pontoConfig = getUserPontoConfig(colaboradorAtual?.permissoes);
  const empresaColaborador = (colaboradorAtual?.empresa_id || empresaIdOperacao || '').trim();
  const opcoesConsolidacao = opcoesConsolidacaoJornadaMultidia(empresaColaborador, pontoConfig);
  const margemDiasMes = opcoesConsolidacao?.multidiaMaxDias ?? 1;
  const cargaMetaMinutos = pontoConfig.carga_horaria_minutos;
  const espelhoEntradaSaida = usaPontoApenasEntradaSaida(colaboradorAtual?.role);

  useEffect(() => {
    let cancelado = false;
    if (!empresaColaborador) {
      setLogoUrlEmpresaFolha(null);
      return;
    }
    void supabase
      .from('empresas')
      .select('logo_url')
      .eq('id', empresaColaborador)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) setLogoUrlEmpresaFolha(data?.logo_url ?? null);
      })
      .catch(() => {
        if (!cancelado) setLogoUrlEmpresaFolha(null);
      });
    return () => {
      cancelado = true;
    };
  }, [empresaColaborador]);

  const diasDoMes = useMemo(() => getDiasNoMes(mesRef.ano, mesRef.mes), [mesRef]);

  const [registrosPorDia, setRegistrosPorDia] = useState<Record<string, BatidaPonto[]>>({});
  const [ocorrenciasPorDia, setOcorrenciasPorDia] = useState<Record<string, PontoDiaOcorrencia>>({});
  const [loadingBatidas, setLoadingBatidas] = useState(false);
  const [feriadosColaborador, setFeriadosColaborador] = useState<ReadonlySet<string>>(new Set());
  const [feriasColaborador, setFeriasColaborador] = useState<FeriasPeriodo[]>([]);

  useEffect(() => {
    if (!colaboradorAtual?.id) {
      setFeriadosColaborador(new Set());
      setFeriasColaborador([]);
      return;
    }

    const loadFeriados = async () => {
      try {
        const empresaId = (colaboradorAtual.empresa_id || empresaIdOperacao || '').trim();
        const empresaIds = empresaId ? [empresaId] : empresaIdsFiltro;
        const [filiais, cobFilial] = await Promise.all([
          carregarFiliaisEmpresas(empresaIds),
          carregarFilialCobradores([colaboradorAtual.id]),
        ]);
        const inicio = `${mesRef.ano}-${String(mesRef.mes + 1).padStart(2, '0')}-01`;
        const fim = `${mesRef.ano}-${String(mesRef.mes + 1).padStart(2, '0')}-${String(new Date(mesRef.ano, mesRef.mes + 1, 0).getDate()).padStart(2, '0')}`;
        const [feriados, ferias] = await Promise.all([
          listarFeriadosColaborador(
            colaboradorAtual,
            filiais,
            cobFilial,
            empresaNomePorId,
            inicio,
            fim,
          ),
          listarFeriasColaborador(colaboradorAtual.id, empresaIds, inicio, fim),
        ]);
        setFeriadosColaborador(feriados);
        setFeriasColaborador(ferias);
      } catch (e) {
        console.warn('[PontoEspelho] feriados/ferias', e);
        setFeriadosColaborador(new Set());
        setFeriasColaborador([]);
      }
    };

    void loadFeriados();
  }, [
    colaboradorAtual?.id,
    colaboradorAtual?.empresa_id,
    mesRef.ano,
    mesRef.mes,
    empresaIdOperacao,
    empresaIdsFiltro.join(','),
    empresaNomePorId,
  ]);

  const [refreshTick, setRefreshTick] = useState(0);

  const loadBatidas = useCallback(async () => {
    if (!empresaColaborador || !colabSelecionado) {
      setRegistrosPorDia({});
      setOcorrenciasPorDia({});
      return;
    }

    const requestId = ++lastRequestId.current;
    setLoadingBatidas(true);
    const { inicio: startStr, fim: endStr } = intervaloMesComMargemJornada(mesRef.ano, mesRef.mes, margemDiasMes);

    try {
      let query = supabase
        .from('ponto_registros')
        .select('*')
        .eq('user_id', colabSelecionado)
        .eq('empresa_id', empresaColaborador)
        .gte('timestamp', startStr)
        .lte('timestamp', endStr)
        .order('timestamp');

      const primeiroDiaMes = `${mesRef.ano}-${String(mesRef.mes + 1).padStart(2, '0')}-01`;
      const ultimoDiaNum = new Date(mesRef.ano, mesRef.mes + 1, 0).getDate();
      const ultimoDiaMes = `${mesRef.ano}-${String(mesRef.mes + 1).padStart(2, '0')}-${String(ultimoDiaNum).padStart(2, '0')}`;

      const [{ data, error }, ocorrencias] = await Promise.all([
        query,
        listarOcorrenciasDiaPonto({
          empresaId: empresaColaborador,
          userId: colabSelecionado,
          dataInicio: primeiroDiaMes,
          dataFim: ultimoDiaMes,
        }).catch((err) => {
          console.warn('[PontoEspelho] ocorrencias', err);
          return [] as PontoDiaOcorrencia[];
        }),
      ]);
      if (error) throw error;

      if (requestId !== lastRequestId.current) return;

      const mapa: Record<string, BatidaPonto[]> = {};
      for (const row of data || []) {
        const batida: BatidaPonto = {
          id: row.id,
          tipo: row.tipo as TipoBatida,
          timestamp: row.timestamp,
          observacao: row.observacao || undefined,
          foto: row.foto || undefined,
          origem: normalizarOrigemBatidaPonto(row.origem),
          ajustado_por: row.ajustado_por || undefined,
          motivo_ajuste: row.motivo_ajuste || undefined,
        };
        const dia = diaLocalFromTimestamp(batida.timestamp);
        if (!dia) continue;
        mapa[dia] = mergeBatidasPorId(mapa[dia] || [], [batida]);
      }

      for (const dia of Object.keys(mapa)) {
        mapa[dia] = normalizarBatidasAfdDia(mapa[dia]);
      }

      if (requestId !== lastRequestId.current) return;
      setRegistrosPorDia(mapa);
      setOcorrenciasPorDia(mapaOcorrenciasPorDia(ocorrencias));
    } catch (err) {
      if (requestId !== lastRequestId.current) return;
      console.warn('Erro ao buscar registros de ponto do Supabase:', err);
      setRegistrosPorDia({});
      setOcorrenciasPorDia({});
    } finally {
      if (requestId === lastRequestId.current) {
        setLoadingBatidas(false);
      }
    }
  }, [colabSelecionado, mesRef.ano, mesRef.mes, diasDoMes, empresaColaborador, margemDiasMes]);

  useEffect(() => {
    void loadBatidas();
  }, [loadBatidas, refreshTick]);

  useEffect(() => {
    const onFocus = () => setRefreshTick((n) => n + 1);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const [visualizarFoto, setVisualizarFoto] = useState<{ url: string; tipo: string; dia: string } | null>(null);
  const [diaEmEdicao, setDiaEmEdicao] = useState<string | null>(null);
  const [intervaloModalAberto, setIntervaloModalAberto] = useState(false);

  const registrosConsolidados = useMemo(
    () => consolidarEPrepararBatidasEspelho(registrosPorDia, diasDoMes, opcoesConsolidacao),
    [registrosPorDia, diasDoMes, opcoesConsolidacao],
  );

  const temAjusteManualNoMes = useMemo(
    () => Object.values(registrosConsolidados).some((batidas) => batidas.some(batidaEhAjusteManual)),
    [registrosConsolidados],
  );

  const renderTimeCell = (batida?: BatidaPonto, diaLinha?: string) => {
    if (!batida) return <span className="text-gray-300">--:--</span>;
    const manual = batidaEhAjusteManual(batida);
    return (
      <span
        className={`inline-flex items-center gap-1.5 justify-center ${manual ? 'text-amber-800 font-semibold' : ''}`}
        title={manual ? (batida.motivo_ajuste || 'Horário ajustado manualmente') : undefined}
      >
        {formatarHoraPontoExibicao(batida)}
        {diaLinha && batida.tipo === 'saida' && batidaEmDiaPosterior(batida, diaLinha) && (
          <span className="text-[10px] text-indigo-600 font-sans" title="Saída no dia civil seguinte">
            +1
          </span>
        )}
        {batida.foto && (
          <button
            onClick={() => setVisualizarFoto({
              url: batida.foto!,
              tipo: nomeTipo[batida.tipo],
              dia: new Date(batida.timestamp).toLocaleDateString('pt-BR')
            })}
            className="text-indigo-600 hover:text-indigo-800 transition-colors p-0.5 rounded hover:bg-indigo-50 print:hidden"
            title="Ver foto registrada"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    );
  };

  const renderBatidasTipoCell = (batidasDia: BatidaPonto[], tipo: TipoBatida, diaLinha?: string) => {
    const lista = batidasDoTipo(batidasDia, tipo);
    if (!lista.length) return <span className="text-gray-300">--:--</span>;
    return (
      <div className="flex flex-col items-center gap-0.5 print:flex-row print:flex-wrap print:justify-center print:gap-x-0.5 print:gap-y-0">
        {lista.map((batida) => (
          <span key={batida.id} className="print:leading-none">{renderTimeCell(batida, diaLinha)}</span>
        ))}
      </div>
    );
  };

  const resumoMensal = useMemo(() => {
    let totalTrabalhado = 0;
    let totalMeta = 0;
    let diasTrabalhados = 0;
    let diasFalta = 0;
    let diasFolga = 0;
    let diasAtestado = 0;
    let diasExtra = 0;
    let minutosExtra = 0;

    const hojeStr = getDataLocalISO(hoje);

    for (const dia of diasDoMes) {
      if (dia > hojeStr) break;
      if (diaAntesInicioPonto(pontoConfig, dia)) continue;

      const batidas = registrosConsolidados[dia] || [];
      const ocorrencia = ocorrenciasPorDia[dia];
      const folgaManual = isDiaFolgaManual(ocorrencia);
      const bonificacaoManual = isDiaBonificado(ocorrencia);
      const atestado = isDiaAtestado(ocorrencia);
      const feriadoManual = ocorrencia?.tipo === 'feriado';
      const jornadaNormalManual = ocorrencia?.tipo === 'jornada_normal';
      const horaExtraManual = ocorrencia?.tipo === 'hora_extra';

      const justificado = folgaManual || bonificacaoManual || atestado || feriadoManual || horaExtraManual;
      const minutosTrabalhadosDia = calcularTrabalhadoMinutosColaborador(
        batidas,
        colaboradorAtual?.role,
        dia,
        colaboradorAtual?.permissoes,
      );
      const temBatida = batidas.length > 0;
      
      let metaDia = metaMinutosNoDia(pontoConfig, dia, temBatida, feriadosColaborador, feriasColaborador);
      if (jornadaNormalManual) {
        metaDia = pontoConfig.carga_horaria_minutos;
      } else if (justificado) {
        metaDia = 0;
      }

      const extraDia = isDiaExtra12x36(pontoConfig, dia, temBatida) || horaExtraManual || (isDiaHoraExtra(pontoConfig, dia, temBatida) && !jornadaNormalManual);
      const contaNoSaldo = diaFechadoParaSaldoMensal(
        dia,
        hojeStr,
        batidas,
        colaboradorAtual?.role,
      );

      if (contaNoSaldo) {
        totalMeta += metaDia;
      }

      if (justificado) {
        if (folgaManual) diasFolga++;
        if (bonificacaoManual) diasFolga++;
        if (atestado) diasAtestado++;
        if (feriadoManual) diasFolga++;
        if (horaExtraManual && temBatida) {
          if (contaNoSaldo) {
            totalTrabalhado += minutosTrabalhadosDia;
          }
          diasTrabalhados++;
          if (contaNoSaldo) {
            diasExtra++;
            minutosExtra += minutosTrabalhadosDia;
          }
        }
      } else if (temBatida) {
        if (contaNoSaldo) {
          totalTrabalhado += minutosTrabalhadosDia;
        }
        diasTrabalhados++;
        if (extraDia && contaNoSaldo) {
          diasExtra++;
          minutosExtra += minutosTrabalhadosDia;
        }
      } else if (contaNoSaldo && (jornadaNormalManual || diaExigeRegistroPonto(pontoConfig, dia, temBatida, feriadosColaborador, feriasColaborador))) {
        diasFalta++;
      } else if (isDiaFerias(dia, feriasColaborador)) {
        diasFolga++;
      } else if (isDiaFeriado(dia, feriadosColaborador) || isDiaFolga12x36(pontoConfig, dia, temBatida)) {
        diasFolga++;
      }
    }

    return {
      totalTrabalhado,
      totalMeta,
      saldo: totalTrabalhado - totalMeta,
      diasTrabalhados,
      diasFalta,
      diasFolga,
      diasAtestado,
      diasExtra,
      minutosExtra,
    };
  }, [diasDoMes, registrosConsolidados, ocorrenciasPorDia, pontoConfig, feriadosColaborador, feriasColaborador, colaboradorAtual?.role]);

  const dadosGraficoDiario = useMemo(() => {
    if (!colaboradorAtual) return [];

    return diasDoMes.map((dia) => {
      const batidas = registrosConsolidados[dia] || [];
      const temBatida = batidas.length > 0;
      const trabalhadoMinutos = calcularTrabalhadoMinutosColaborador(
        batidas,
        colaboradorAtual?.role,
        dia,
        colaboradorAtual?.permissoes,
      );
      const metaMinutos = metaMinutosNoDia(pontoConfig, dia, temBatida, feriadosColaborador, feriasColaborador);
      const diaFormatado = dia.slice(8);

      return {
        dia: diaFormatado,
        dataCompleta: dia,
        "Horas Trabalhadas": Number((trabalhadoMinutos / 60).toFixed(1)),
        "Meta de Horas": Number((metaMinutos / 60).toFixed(1)),
      };
    });
  }, [diasDoMes, registrosConsolidados, pontoConfig, feriadosColaborador, feriasColaborador, colaboradorAtual]);

  const colSpanTotalFolha = espelhoEntradaSaida ? 5 : 7;

  const navegarMes = (dir: -1 | 1) => {
    setMesRef(prev => {
      let novoMes = prev.mes + dir;
      let novoAno = prev.ano;
      if (novoMes < 0) { novoMes = 11; novoAno--; }
      if (novoMes > 11) { novoMes = 0; novoAno++; }
      return { ano: novoAno, mes: novoMes };
    });
  };

  const nomeMes = new Date(mesRef.ano, mesRef.mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const carregandoEspelho = aguardandoContexto || loading || loadingBatidas;

  const nomeEmpresaFolha = useMemo(() => {
    const id = (colaboradorAtual?.empresa_id || empresaIdOperacao || '').trim();
    if (id && empresaNomePorId[id]) return empresaNomePorId[id];
    return empresasDoGrupo.find((e) => e.id === id)?.nome || empresasDoGrupo[0]?.nome || 'Empresa';
  }, [colaboradorAtual?.empresa_id, empresaIdOperacao, empresaNomePorId, empresasDoGrupo]);

  const dataImpressaoFolha = useMemo(
    () =>
      new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  const logoUrlFolha = useMemo(
    () => resolveLogoUrl(logoUrlEmpresaFolha ?? empresa?.logo_url),
    [logoUrlEmpresaFolha, empresa?.logo_url],
  );

  const nomeArquivoFolhaPonto = useMemo(
    () => slugArquivoFolhaPonto(colaboradorAtual?.nome || 'colaborador', mesRef.ano, mesRef.mes),
    [colaboradorAtual?.nome, mesRef.ano, mesRef.mes],
  );

  const tituloImpressaoFolha = useMemo(
    () => tituloJanelaFolhaPonto(colaboradorAtual?.nome || 'Colaborador', nomeMes),
    [colaboradorAtual?.nome, nomeMes],
  );

  const blocoAssinaturasFolhaImpressao = useMemo(() => {
    if (!colaboradorAtual) return null;
    return (
      <div className="ponto-espelho-assinaturas-impressao hidden print:block border-t border-slate-400 bg-white">
        {/* Local e Data */}
        <div className="ponto-espelho-local-data mx-3 mt-2.5 mb-2.5 flex items-end gap-2">
          <span className="text-[10px] font-bold text-gray-800 whitespace-nowrap">Local e Data:</span>
          <span className="flex-1 border-b border-slate-600">&nbsp;</span>
          <span className="text-[10px] font-semibold text-gray-600 whitespace-nowrap">, _____ / _____ / _________</span>
        </div>
        {/* Assinaturas — linhas simples */}
        <div className="ponto-espelho-assinaturas-container mx-3 mb-3 flex gap-10">
          <div className="flex-1 min-w-0 text-center">
            <div className="ponto-espelho-linha-assinatura border-b-2 border-slate-700 mb-0.5" style={{ height: '28px' }}>&nbsp;</div>
            <p className="ponto-espelho-dados-assinatura text-[10.5px] font-bold text-gray-900 leading-tight">{colaboradorAtual.nome || '—'}</p>
            <p className="ponto-espelho-dados-assinatura text-[9px] font-semibold text-gray-500 leading-tight uppercase tracking-wide">Colaborador(a) • {cargoColaboradorLabel}</p>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <div className="ponto-espelho-linha-assinatura border-b-2 border-slate-700 mb-0.5" style={{ height: '28px' }}>&nbsp;</div>
            <p className="ponto-espelho-dados-assinatura text-[10.5px] font-bold text-gray-900 leading-tight">{nomeEmpresaFolha}</p>
            <p className="ponto-espelho-dados-assinatura text-[9px] font-semibold text-gray-500 leading-tight uppercase tracking-wide">Responsável da Empresa</p>
          </div>
        </div>
      </div>
    );
  }, [colaboradorAtual, cargoColaboradorLabel, nomeEmpresaFolha]);

  const linhasTabelaFolha = useMemo(
    () =>
      diasDoMes.map((dia) => {
                const batidas = registrosConsolidados[dia] || [];
                const ocorrencia = ocorrenciasPorDia[dia];
                const folgaManual = isDiaFolgaManual(ocorrencia);
                const bonificacaoManual = isDiaBonificado(ocorrencia);
                const atestado = isDiaAtestado(ocorrencia);
                const feriadoManual = ocorrencia?.tipo === 'feriado';
                const jornadaNormalManual = ocorrencia?.tipo === 'jornada_normal';
                const horaExtraManual = ocorrencia?.tipo === 'hora_extra';

                const justificado = folgaManual || bonificacaoManual || atestado || feriadoManual || horaExtraManual;
                const fds = isFimDeSemana(dia);
                const futuro = dia > getDataLocalISO(hoje);
                const diaNum = dia.slice(8);
                const diaSem = diaSemanaAbrev(dia);

                const minutostrab = calcularTrabalhadoMinutosColaborador(
                  batidas,
                  colaboradorAtual?.role,
                  dia,
                  colaboradorAtual?.permissoes,
                );
                const intervaloMin = calcularIntervaloMinutos(batidas);
                const intervaloImplicitoMin = intervaloAlmocoImplicitoMinutosNoDia(
                  batidas,
                  colaboradorAtual?.role,
                  dia,
                  colaboradorAtual?.permissoes,
                );
                const sabadoDia = isSabadoLocal(dia);
                const temBatida = batidas.length > 0;
                
                let metaDia = metaMinutosNoDia(pontoConfig, dia, temBatida, feriadosColaborador, feriasColaborador);
                if (jornadaNormalManual) {
                  metaDia = pontoConfig.carga_horaria_minutos;
                } else if (justificado) {
                  metaDia = 0;
                }

                const saldoDia = minutostrab - metaDia;
                const hojeStr = getDataLocalISO(hoje);
                const jornadaFechada = jornadaPontoFinalizada(batidas, colaboradorAtual?.role);
                const diaEmAberto = dia === hojeStr && !jornadaFechada;
                const antesInicio = diaAntesInicioPonto(pontoConfig, dia);
                const folga12x36 = isDiaFolga12x36(pontoConfig, dia, temBatida) && !futuro;
                const extra12x36 = isDiaExtra12x36(pontoConfig, dia, temBatida) && !futuro;
                const horaExtra = (isDiaHoraExtra(pontoConfig, dia, temBatida) || horaExtraManual) && !jornadaNormalManual && !futuro;
                const sabadoPlantao = isSabadoTrabalhoEscala(pontoConfig, dia);
                const sabadoFolgaEscala = isSabadoFolgaEscala(pontoConfig, dia);
                const feriado = isDiaFeriado(dia, feriadosColaborador) && !futuro;
                const ferias = isDiaFerias(dia, feriasColaborador) && !futuro && !temBatida;
                
                const ocultarSaldo = futuro || antesInicio || feriado || ferias || (justificado && !horaExtraManual) || folga12x36
                  || diaEmAberto
                  || (metaDia === 0 && !temBatida);
                const rowBg = fds ? 'bg-slate-50/80' : 'bg-white';

                let statusBadge: React.ReactNode = null;
                if (pontoConfig.regime === 'cargo_confianca') {
                  statusBadge = <Badge variant="info" className="bg-slate-50 border-slate-200 text-slate-500">Isento</Badge>;
                } else if (antesInicio) {
                  statusBadge = <span className="text-xs text-gray-400">—</span>;
                } else if (futuro) {
                  statusBadge = <span className="text-xs text-gray-400">—</span>;
                } else if (feriado) {
                  statusBadge = <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">Feriado</Badge>;
                } else if (ferias) {
                  statusBadge = <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-700">Férias</Badge>;
                } else if (atestado) {
                  statusBadge = (
                    <span title={ocorrencia?.motivo}>
                      <Badge variant="outline" className="bg-sky-50 border-sky-200 text-sky-700">
                        Atestado
                      </Badge>
                    </span>
                  );
                } else if (bonificacaoManual) {
                  statusBadge = (
                    <span title={ocorrencia?.motivo}>
                      <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
                        Bonificado
                      </Badge>
                    </span>
                  );
                } else if (folgaManual) {
                  statusBadge = (
                    <span title={ocorrencia?.motivo}>
                      <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700">
                        Folga
                      </Badge>
                    </span>
                  );
                } else if (feriadoManual) {
                  statusBadge = (
                    <span title={ocorrencia?.motivo}>
                      <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                        Feriado
                      </Badge>
                    </span>
                  );
                } else if (horaExtraManual) {
                  statusBadge = (
                    <span title={ocorrencia?.motivo}>
                      <Badge variant="outline" className="bg-pink-50 border-pink-200 text-pink-700">
                        Hora Extra
                      </Badge>
                    </span>
                  );
                } else if (jornadaNormalManual) {
                  if (temBatida) {
                    if (jornadaFechada && saldoDia >= 0) {
                      statusBadge = <Badge variant="success">OK</Badge>;
                    } else if (jornadaFechada) {
                      statusBadge = <Badge variant="warning">Incompleto</Badge>;
                    } else {
                      statusBadge = <Badge variant="info">Parcial</Badge>;
                    }
                  } else {
                    statusBadge = <Badge variant="danger">Falta</Badge>;
                  }
                } else if (
                  folga12x36
                  || (sabadoFolgaEscala && !temBatida)
                  || (isDomingoLocal(dia) && !temBatida && (temEscalaSabadoAlternado(pontoConfig) || !isRegime12x36(pontoConfig)))
                  || (fds && !temBatida && !isRegime12x36(pontoConfig) && !temEscalaSabadoAlternado(pontoConfig))
                ) {
                  statusBadge = <Badge variant="outline">Folga</Badge>;
                } else if (temEscalaSabadoAlternado(pontoConfig) && isSabadoLocal(dia) && temBatida) {
                  if (jornadaFechada && saldoDia >= 0) {
                    statusBadge = <Badge variant="success">OK</Badge>;
                  } else if (jornadaFechada) {
                    statusBadge = <Badge variant="warning">Incompleto</Badge>;
                  } else {
                    statusBadge = <Badge variant="info">Parcial</Badge>;
                  }
                } else if (sabadoPlantao && temBatida) {
                  if (jornadaFechada && saldoDia >= 0) {
                    statusBadge = <Badge variant="success">OK</Badge>;
                  } else if (jornadaFechada) {
                    statusBadge = <Badge variant="warning">Incompleto</Badge>;
                  } else {
                    statusBadge = <Badge variant="info">Parcial</Badge>;
                  }
                } else if (extra12x36 || horaExtra) {
                  statusBadge = <Badge variant="info">Extra</Badge>;
                } else if (!justificado && (jornadaNormalManual || diaExigeRegistroPonto(pontoConfig, dia, temBatida, feriadosColaborador, feriasColaborador))) {
                  statusBadge = <Badge variant="danger">Falta</Badge>;
                } else if (jornadaFechada && saldoDia >= 0) {
                  statusBadge = <Badge variant="success">OK</Badge>;
                } else if (jornadaFechada) {
                  statusBadge = <Badge variant="warning">Incompleto</Badge>;
                } else if (temBatida) {
                  statusBadge = <Badge variant="info">Parcial</Badge>;
                } else {
                  statusBadge = <Badge variant="info">Aberto</Badge>;
                }

                const batidasLinha = espelhoEntradaSaida
                  ? normalizarBatidasEntradaSaida(batidas)
                  : batidas;

                return (
                  <tr
                    key={dia}
                    className={`border-b border-slate-200 ${rowBg} ${futuro || antesInicio ? 'opacity-40 print:opacity-100' : ''} hover:bg-indigo-50/40 transition-colors print:hover:bg-transparent`}
                  >
                    <td className={`px-3 py-2 font-semibold text-gray-900 border border-slate-200 sticky left-0 z-10 print:static print:px-1.5 print:py-0.5 print:leading-none ${rowBg}`}>
                      <span className="print:hidden">{diaNum}/{String(mesRef.mes + 1).padStart(2, '0')}</span>
                      <span className="hidden print:inline whitespace-nowrap">{diaNum}/{String(mesRef.mes + 1).padStart(2, '0')} {diaSem}</span>
                    </td>
                    <td className={`px-3 py-2 text-[10px] uppercase font-bold border border-slate-200 sticky left-20 z-10 print:static print:hidden ${fds ? 'text-red-500' : 'text-gray-500'} ${rowBg}`}>{diaSem}</td>
                    <td className="px-2 py-2 text-center font-mono text-gray-700 border border-slate-200 tabular-nums print:px-1.5 print:py-0.5 print:leading-none">{renderBatidasTipoCell(batidasLinha, 'entrada', dia)}</td>
                    {!espelhoEntradaSaida && (
                      <>
                        <td className="px-2 py-2 text-center font-mono text-gray-700 border border-slate-200 tabular-nums print:px-1.5 print:py-0.5 print:leading-none">{renderBatidasTipoCell(batidas, 'inicio_intervalo', dia)}</td>
                        <td className="px-2 py-2 text-center font-mono text-gray-700 border border-slate-200 tabular-nums print:px-1.5 print:py-0.5 print:leading-none">{renderBatidasTipoCell(batidas, 'fim_intervalo', dia)}</td>
                      </>
                    )}
                    <td className="px-2 py-2 text-center font-mono text-gray-700 border border-slate-200 tabular-nums print:px-1.5 print:py-0.5 print:leading-none">{renderBatidasTipoCell(batidasLinha, 'saida', dia)}</td>
                    {espelhoEntradaSaida && (
                      <td className="px-2 py-2 text-center font-mono text-gray-600 border border-slate-200 tabular-nums print:px-1.5 print:py-0.5 print:leading-none">
                        {intervaloMin > 0 ? (
                          <span
                            className="text-slate-700 font-semibold"
                            title="Intervalo informado no ajuste manual"
                          >
                            {formatarDuracaoPonto(intervaloMin)}
                          </span>
                        ) : intervaloImplicitoMin > 0 ? (
                          <span
                            className="text-amber-800 font-semibold"
                            title={`Intervalo de ${formatarDuracaoPonto(intervaloImplicitoMin)} descontado do total trabalhado (dias úteis)`}
                          >
                            {formatarDuracaoPonto(intervaloImplicitoMin)}†
                          </span>
                        ) : sabadoDia && temBatida && jornadaFechada ? (
                          <span className="text-slate-600 font-semibold text-[10px] print:text-[8px]" title="Sábado sem intervalo de almoço">
                            s/ int.
                          </span>
                        ) : (
                          <span className="text-gray-300">--:--</span>
                        )}
                      </td>
                    )}
                    {!espelhoEntradaSaida && (
                      <td className="px-2 py-2 text-center font-mono text-gray-500 border border-slate-200 tabular-nums print:px-1.5 print:py-0.5 print:leading-none">
                        {temBatida && intervaloMin > 0 ? (
                          formatarDuracaoPonto(intervaloMin)
                        ) : sabadoDia && temBatida && jornadaFechada ? (
                          <span className="text-slate-600 font-semibold text-[10px] print:text-[8px]" title="Sábado sem intervalo de almoço">
                            s/ int.
                          </span>
                        ) : (
                          <span className="text-gray-300">--:--</span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-2 text-center font-mono font-medium text-gray-900 border border-slate-200 tabular-nums print:px-1.5 print:py-0.5 print:leading-none">{temBatida ? formatarDuracaoPonto(minutostrab) : <span className="text-gray-300">--:--</span>}</td>
                    <td className={`ponto-espelho-col-saldo px-2 py-2 text-center font-mono font-medium border border-slate-200 tabular-nums print:px-2 print:py-0.5 print:leading-none ${
                      ocultarSaldo && !diaEmAberto ? 'text-gray-300' :
                      !ocultarSaldo && saldoDia >= 0 ? 'text-green-600' : !ocultarSaldo ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {diaEmAberto && temBatida ? (
                        <span className="text-[10px] italic font-sans print:text-[6px]">Aberto</span>
                      ) : ocultarSaldo ? (
                        <span className="text-gray-300">--:--</span>
                      ) : (
                        <>{saldoDia > 0 ? '+' : ''}{formatarDuracaoPonto(saldoDia)}</>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center border border-slate-200 print:hidden">{statusBadge}</td>
                    {podeEditarFolha && (
                      <td className="px-2 py-2 text-center border border-slate-200 print:hidden">
                        {!futuro && empresaColaborador && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDiaEmEdicao(dia)}
                              className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Editar horários do dia"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );

      }),
    [
    diasDoMes,
    registrosConsolidados,
    ocorrenciasPorDia,
    colaboradorAtual,
    pontoConfig,
    feriadosColaborador,
    feriasColaborador,
    hoje,
    mesRef.mes,
    espelhoEntradaSaida,
    podeEditarFolha,
    empresaColaborador,
  ],
  );

  const handleImprimir = async () => {
    if (!colaboradorAtual) {
      showToast('Selecione um colaborador para imprimir a folha de ponto.', 'warning');
      return;
    }
    if (activeTab !== 'espelho') {
      setActiveTab('espelho');
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    const tituloAnterior = document.title;
    document.title = tituloImpressaoFolha;
    const restaurarTitulo = () => {
      document.title = tituloAnterior;
      window.removeEventListener('afterprint', restaurarTitulo);
    };
    window.addEventListener('afterprint', restaurarTitulo);
    window.print();
  };

  const handleBaixarPdf = async () => {
    if (!colaboradorAtual) {
      showToast('Selecione um colaborador para baixar a folha de ponto.', 'warning');
      return;
    }
    const root = document.getElementById('ponto-espelho-print-root');
    if (!root) {
      showToast('Não foi possível localizar o conteúdo da folha de ponto.', 'error');
      return;
    }
    if (activeTab !== 'espelho') {
      setActiveTab('espelho');
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    setGerandoPdf(true);
    try {
      await baixarPdfFolhaPonto(root, nomeArquivoFolhaPonto);
      showToast(`PDF salvo como ${nomeArquivoFolhaPonto}`, 'success');
    } catch (err) {
      console.error('[PontoEspelho] baixar PDF', err);
      showToast('Não foi possível gerar o PDF da folha de ponto.', 'error');
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <div className="space-y-6 print:space-y-0 print:m-0 print:p-0">
      <div className="print:hidden">
      <PageHeader
        title={podeVerEspelhoTodos ? 'Espelho de Ponto' : 'Meu espelho de ponto'}
        subtitle={
          podeVerEspelhoTodos
            ? 'Relatório consolidado de horas trabalhadas por colaborador'
            : 'Suas horas no período — você não vê a folha de outros colaboradores'
        }
        actionButton={
          <div className="flex gap-2 print:hidden">
            <Button
              variant="outline"
              onClick={() => setRefreshTick((n) => n + 1)}
              disabled={loadingBatidas}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingBatidas ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleImprimir} disabled={!colaboradorAtual || gerandoPdf}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={() => void handleBaixarPdf()} disabled={!colaboradorAtual || gerandoPdf}>
              <Download className={`h-4 w-4 mr-2 ${gerandoPdf ? 'animate-pulse' : ''}`} />
              {gerandoPdf ? 'Gerando PDF…' : 'Baixar PDF'}
            </Button>
          </div>
        }
      />
      </div>

      {/* Filtros */}
      <Card className="p-4 print:hidden !overflow-visible">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          {podeVerEspelhoTodos && colaboradores.length > 0 && (
            <div className="w-full sm:w-80 relative z-30">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider ml-1 mb-1.5">
                Colaborador
              </label>
              <div className="relative group">
                <Search className="absolute left-3.5 top-3 h-5 w-5 text-gray-400 dark:text-slate-500 group-hover:text-gray-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Pesquise por nome ou e-mail..."
                  value={buscaColab}
                  onChange={(e) => {
                    setBuscaColab(e.target.value);
                    setShowColabDropdown(true);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                    setShowColabDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowColabDropdown(false), 200)}
                  className="pl-11 pr-10 h-11 w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950 px-4 py-2 text-sm text-gray-900 dark:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent focus:bg-white dark:focus:bg-slate-900 group-hover:border-gray-300 dark:group-hover:border-slate-700 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowColabDropdown((prev) => !prev)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <ChevronsUpDown className="h-5 w-5" />
                </button>
              </div>

              {/* Dropdown de Resultados */}
              {showColabDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 divide-y divide-gray-50 dark:divide-slate-800/50 custom-scrollbar">
                  {colaboradoresFiltrados.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500 italic">
                      Nenhum colaborador encontrado.
                    </div>
                  ) : (
                    colaboradoresFiltrados.map((c) => {
                      const isSelected = colabSelecionado === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setColabSelecionado(c.id);
                            setBuscaColab(c.nome || c.email);
                            setShowColabDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50 ${
                            isSelected
                              ? 'bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-semibold'
                              : 'text-gray-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{c.nome || 'Sem nome'}</span>
                            <span className="text-xs text-gray-400 dark:text-slate-500">{c.email}</span>
                          </div>
                          {isSelected && <Check className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navegarMes(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 py-2 bg-gray-50 rounded-lg border text-sm font-medium text-gray-700 capitalize min-w-[160px] text-center">
              <Calendar className="h-4 w-4 inline mr-2 text-gray-400" />
              {nomeMes}
            </div>
            <Button variant="outline" size="sm" onClick={() => navegarMes(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div id="ponto-espelho-print-root" className="ponto-espelho-pagina-a4 space-y-4 print:space-y-0 print:mt-0 print:block print:border print:border-slate-500">
      {/* Header do colaborador na tela */}
      {colaboradorAtual && (
        <Card className="p-0 overflow-hidden print:hidden">
          <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-white/80" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg truncate">{colaboradorAtual.nome || 'Colaborador'}</h2>
                  <p className="text-sm text-white/70">
                    {colaboradorAtual.role || 'Sem cargo'} &middot; {labelRegimePonto(pontoConfig.regime)}
                    {espelhoEntradaSaida && (() => {
                      const iv = resolverIntervaloEntradaSaidaColaborador(
                        colaboradorAtual?.role,
                        colaboradorAtual?.permissoes,
                      );
                      return ` · Intervalo: ${iv.ativo ? formatarDuracaoPonto(iv.minutos) : 'desativado'}`;
                    })()}
                    {isRegime12x36(pontoConfig)
                      ? ' · Meta 12h nos dias com batida de ponto'
                      : temEscalaSabadoAlternado(pontoConfig)
                        ? ` · Meta ${formatarDuracaoPonto(pontoConfig.carga_horaria_minutos)}/dia útil · ${formatarDuracaoPonto(pontoConfig.meta_sabado_minutos ?? 4 * 60)} no sábado de plantão`
                        : pontoConfig.regime === 'cargo_confianca'
                          ? ' · Isento de registro de ponto'
                          : ` · Meta: ${formatarDuracaoPonto(cargaMetaMinutos)}/dia útil`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {espelhoEntradaSaida && podeEditarFolha && (
                  <button
                    type="button"
                    onClick={() => setIntervaloModalAberto(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors print:hidden"
                  >
                    <Coffee className="h-3.5 w-3.5" />
                    Intervalo de almoço
                  </button>
                )}
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-white/60">Período</p>
                  <p className="font-semibold capitalize">{nomeMes}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo mensal */}
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-gray-100">
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-semibold">Trabalhado</p>
              <p className="text-xl font-bold text-gray-900 font-mono mt-1">{formatarDuracaoPonto(resumoMensal.totalTrabalhado)}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-semibold">Meta</p>
              <p className="text-xl font-bold text-gray-900 font-mono mt-1">{formatarDuracaoPonto(resumoMensal.totalMeta)}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-semibold">Saldo</p>
              <p className={`text-xl font-bold font-mono mt-1 ${resumoMensal.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {resumoMensal.saldo > 0 ? '+' : ''}{formatarDuracaoPonto(resumoMensal.saldo)}
              </p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-semibold">Dias Trab.</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{resumoMensal.diasTrabalhados}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-semibold">Faltas</p>
              <p className={`text-xl font-bold mt-1 ${resumoMensal.diasFalta > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {resumoMensal.diasFalta}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-250 flex gap-4 print:hidden my-4">
        <button
          onClick={() => setActiveTab('espelho')}
          className={`py-3 px-1 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'espelho'
              ? 'border-indigo-650 text-indigo-750'
              : 'border-transparent text-gray-450 hover:text-gray-700'
          }`}
        >
          Espelho de Ponto
        </button>
        <button
          onClick={() => setActiveTab('graficos')}
          className={`py-3 px-1 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'graficos'
              ? 'border-indigo-650 text-indigo-750'
              : 'border-transparent text-gray-450 hover:text-gray-700'
          }`}
        >
          Gráficos de Horas
        </button>
      </div>

      {/* Cabeçalho oficial — somente impressão / PDF */}
      {colaboradorAtual && (
        <div className="ponto-espelho-somente-impressao border border-slate-400 border-b-0">
          <div className="ponto-espelho-cabecalho-top border-b border-slate-400 px-2 py-1 bg-slate-50 flex items-center gap-2">
            <img
              src={logoUrlFolha}
              alt="Logo"
              className="ponto-espelho-logo h-8 w-auto max-w-[96px] object-contain shrink-0"
            />
            <div className="flex-1 min-w-0 text-center">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-800 font-bold">{nomeEmpresaFolha}</p>
              <h1 className="text-[15px] font-black uppercase tracking-wide text-gray-900 mt-0.5">
                Folha de Ponto — Espelho de Horário
              </h1>
              <p className="text-[11px] capitalize text-gray-700 font-semibold mt-0.5">Período de referência: {nomeMes}</p>
            </div>
            <div className="ponto-espelho-marca-sistema shrink-0 text-right leading-tight">
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-700">{APEX_PLAN_NAME}</p>
              <p className="text-[7px] font-semibold text-slate-500 mt-0.5">{APEX_PLAN_TAGLINE}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0 px-2 py-1 text-[10px] font-semibold border-b border-slate-300 bg-white leading-tight">
            <p><span className="font-bold text-gray-800">Colaborador:</span> {colaboradorAtual.nome || '—'}</p>
            <p><span className="font-bold text-gray-800">Cargo:</span> {cargoColaboradorLabel}</p>
            <p className="truncate"><span className="font-bold text-gray-800">E-mail:</span> {colaboradorAtual.email || '—'}</p>
            <p><span className="font-bold text-gray-800">Regime:</span> {labelRegimePonto(pontoConfig.regime)}</p>
          </div>
          <div className="grid grid-cols-5 divide-x divide-slate-300 border-b border-slate-300 text-center bg-white">
            <div className="py-1 px-1">
              <p className="text-[9px] uppercase font-bold text-gray-600 leading-none">Trabalhado</p>
              <p className="text-[13px] font-mono font-black text-gray-900 leading-none mt-0.5">{formatarDuracaoPonto(resumoMensal.totalTrabalhado)}</p>
            </div>
            <div className="py-1 px-1">
              <p className="text-[9px] uppercase font-bold text-gray-600 leading-none">Meta</p>
              <p className="text-[13px] font-mono font-black text-gray-900 leading-none mt-0.5">{formatarDuracaoPonto(resumoMensal.totalMeta)}</p>
            </div>
            <div className="py-1 px-1">
              <p className="text-[9px] uppercase font-bold text-gray-600 leading-none">Saldo</p>
              <p className={`text-[13px] font-mono font-black leading-none mt-0.5 ${resumoMensal.saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {resumoMensal.saldo > 0 ? '+' : ''}{formatarDuracaoPonto(resumoMensal.saldo)}
              </p>
            </div>
            <div className="py-1 px-1">
              <p className="text-[9px] uppercase font-bold text-gray-600 leading-none">Dias Trab.</p>
              <p className="text-[13px] font-mono font-black text-gray-900 leading-none mt-0.5">{resumoMensal.diasTrabalhados}</p>
            </div>
            <div className="py-1 px-1">
              <p className="text-[9px] uppercase font-bold text-gray-600 leading-none">Faltas</p>
              <p className={`text-[13px] font-mono font-black leading-none mt-0.5 ${resumoMensal.diasFalta > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {resumoMensal.diasFalta}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`ponto-espelho-secao-tabela ${activeTab === 'espelho' ? 'block' : 'hidden print:block'}`}>
            {(podeEditarFolha || temAjusteManualNoMes || espelhoEntradaSaida) && (
            <div className="space-y-1 print:hidden">
            {(podeEditarFolha || temAjusteManualNoMes) && (
            <p className="text-xs text-gray-600 print:hidden">
              <span className="font-semibold text-amber-800">*</span> = horário lançado ou corrigido manualmente pelo
              administrador/gestor.
              {podeEditarFolha && (
                <span> Clique no lápis na linha do dia para ajustar.</span>
              )}
            </p>
            )}
            {espelhoEntradaSaida && (
              <p className="text-xs text-slate-600 print:text-[7px] print:text-gray-800 print:leading-snug print:mb-1">
                <span className="font-semibold text-slate-800">†</span> = intervalo intrajornada de{' '}
                {formatarDuracaoPonto(
                  intervaloAlmocoImplicitoEntradaSaidaMinutos(
                    colaboradorAtual?.role,
                    colaboradorAtual?.permissoes,
                  ),
                )}{' '}
                pré-assinalado no sistema.
                Este cargo registra apenas entrada e saída; o intervalo não é batido no ponto eletrônico.
                Configure 1h, 2h ou desative na aba <strong>Intervalo</strong> do ajuste manual (lápis).
              </p>
            )}
            </div>
          )}

          {/* Tabela detalhada por dia */}
          <Card className="p-0 overflow-hidden relative min-h-[280px] print:min-h-0 print:border-0 print:shadow-none print:rounded-none print:overflow-visible">
        {carregandoEspelho && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20 print:hidden">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-gray-600">
                {aguardandoContexto ? 'Preparando contexto da unidade...' : 'Buscando batidas de ponto...'}
              </span>
            </div>
          </div>
        )}
        <div className="ponto-espelho-tabela-scroll overflow-x-auto max-h-[min(720px,calc(100vh-220px))] print:max-h-none print:overflow-visible print:border-x print:border-slate-400">
          <table className="w-full text-xs border-collapse print:text-[11px] print:table-fixed print:leading-snug print:font-semibold">
            <thead className="sticky top-0 z-20 print:static">
              <tr className="bg-slate-800 text-white uppercase text-[10px] font-black tracking-wider print:bg-slate-100 print:text-black print:text-[10px] print:leading-snug print:font-extrabold">
                <th className="text-left px-3 py-2.5 border border-slate-600 w-20 sticky left-0 z-30 bg-slate-800 print:static print:w-[13%] print:px-1.5 print:py-0.5">Data</th>
                <th className="text-left px-3 py-2.5 border border-slate-600 w-12 sticky left-20 z-30 bg-slate-800 print:static print:hidden">Dia</th>
                <th className="text-center px-2 py-2.5 border border-slate-600 min-w-[72px] print:min-w-0 print:w-[17%] print:px-1.5 print:py-0.5">
                  <span className="inline-flex items-center justify-center gap-1 print:hidden"><LogIn className="h-3 w-3 shrink-0" /> Entrada</span>
                  <span className="hidden print:inline">Entrada</span>
                </th>
                {!espelhoEntradaSaida && (
                  <>
                    <th className="text-center px-2 py-2.5 border border-slate-600 min-w-[80px] print:min-w-0 print:px-1.5 print:py-0.5">
                      <span className="inline-flex items-center justify-center gap-1 print:hidden"><Coffee className="h-3 w-3 shrink-0" /> Ini. Intervalo</span>
                      <span className="hidden print:inline">Int. Início</span>
                    </th>
                    <th className="text-center px-2 py-2.5 border border-slate-600 min-w-[80px] print:min-w-0 print:px-1.5 print:py-0.5">
                      <span className="inline-flex items-center justify-center gap-1 print:hidden"><LogIn className="h-3 w-3 shrink-0" /> Fim Intervalo</span>
                      <span className="hidden print:inline">Int. Fim</span>
                    </th>
                  </>
                )}
                <th className="text-center px-2 py-2.5 border border-slate-600 min-w-[72px] print:min-w-0 print:w-[17%] print:px-1.5 print:py-0.5">
                  <span className="inline-flex items-center justify-center gap-1 print:hidden"><LogOut className="h-3 w-3 shrink-0" /> Saída</span>
                  <span className="hidden print:inline">Saída</span>
                </th>
                {espelhoEntradaSaida && (
                  <th className="text-center px-2 py-2.5 border border-slate-600 min-w-[64px] print:min-w-0 print:w-[11%] print:px-1.5 print:py-0.5">
                    <span className="print:hidden">Int. alm. †</span>
                    <span className="hidden print:inline">Int. alm. †</span>
                  </th>
                )}
                {!espelhoEntradaSaida && (
                  <th className="text-center px-2 py-2.5 border border-slate-600 min-w-[64px] print:min-w-0 print:px-1.5 print:py-0.5">Intervalo</th>
                )}
                <th className="text-center px-2 py-2.5 border border-slate-600 min-w-[72px] print:min-w-0 print:w-[16%] print:px-1.5 print:py-0.5">Trabalhado</th>
                <th className="ponto-espelho-col-saldo text-center px-2 py-2.5 border border-slate-600 min-w-[64px] print:min-w-0 print:w-[16%] print:px-2 print:py-0.5">Saldo</th>
                <th className="text-center px-2 py-2.5 border border-slate-600 min-w-[88px] print:hidden">Status</th>
                {podeEditarFolha && (
                  <th className="text-center px-2 py-2.5 border border-slate-600 w-12 print:hidden">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {linhasTabelaFolha}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 print:static">
              <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-[11px] print:text-[11px] print:leading-snug print:font-extrabold">
                <td colSpan={colSpanTotalFolha} className="px-3 py-2.5 text-right text-gray-700 border border-slate-300 sticky left-0 bg-slate-100 print:static print:px-1.5 print:py-0.5">Total do Mês:</td>
                <td className="px-2 py-2.5 text-center font-mono text-gray-900 border border-slate-300 tabular-nums print:px-1.5 print:py-0.5">{formatarDuracaoPonto(resumoMensal.totalTrabalhado)}</td>
                <td className={`ponto-espelho-col-saldo px-2 py-2.5 text-center font-mono border border-slate-300 tabular-nums print:px-2 print:py-0.5 ${resumoMensal.saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {resumoMensal.saldo > 0 ? '+' : ''}{formatarDuracaoPonto(resumoMensal.saldo)}
                </td>
                <td className="px-2 py-2.5 text-center border border-slate-300 print:hidden">
                  <Badge variant={resumoMensal.saldo >= 0 ? 'success' : 'danger'}>
                    {resumoMensal.saldo >= 0 ? 'Positivo' : 'Negativo'}
                  </Badge>
                </td>
                {podeEditarFolha && <td className="border border-slate-300 print:hidden" />}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      </div>

      {/* Rodapé com declarações — impressão / PDF */}
      {colaboradorAtual && (
        <div
          id="ponto-espelho-print-footer"
          className="ponto-espelho-rodape-impressao ponto-espelho-rodape-pagina border border-slate-400 border-t-0 bg-white print:text-[10.5px] print:font-semibold"
        >
          {temAjusteManualNoMes && (
            <p className="text-[10px] font-semibold text-gray-700 leading-relaxed px-3 pt-2.5 pb-0">
              <span className="font-bold">*</span> Horários marcados com asterisco foram lançados ou corrigidos manualmente pelo administrador/gestor.
            </p>
          )}
          {espelhoEntradaSaida && (
            <div className="ponto-espelho-declaracao mx-3 mt-1 mb-1 p-2 border border-slate-400 bg-slate-50 text-[10px] font-semibold text-gray-900 leading-relaxed text-justify">
              <p className="font-extrabold uppercase tracking-wide text-[11px] mb-1 text-center">
                Declaração — Intervalo Intrajornada Pré-Assinalado (Art. 74, § 2º da CLT)
              </p>
              <p>
                O(A) colaborador(a) <strong>{colaboradorAtual.nome}</strong>, portador(a) do cargo de{' '}
                <strong>{cargoColaboradorLabel}</strong>, vinculado(a) à empresa <strong>{nomeEmpresaFolha}</strong>,
                declara que o controle de frequência é realizado mediante registro exclusivo dos horários de entrada
                e saída da jornada de trabalho, sendo o intervalo intrajornada de{' '}
                <strong>
                  {labelIntervaloAlmocoImplicitoDeclaracao(
                    colaboradorAtual?.role,
                    colaboradorAtual?.permissoes,
                  )}
                </strong>{' '}
                previamente assinalado no sistema eletrônico de ponto, na forma
                autorizada pela legislação trabalhista vigente.
              </p>
              <p className="mt-1">
                Declara, ainda, que durante o período de referência usufruiu integralmente o intervalo
                intrajornada pré-assinalado, salvo se houver comunicado formal à empresa ou registro em
                contrário devidamente formalizado junto ao setor de Recursos Humanos.
              </p>
              <p className="mt-1">
                Declara, por fim, que os horários constantes nesta folha de ponto referente ao período de{' '}
                <span className="capitalize font-semibold">{nomeMes}</span> correspondem à jornada de trabalho
                efetivamente cumprida, comprometendo-se a comunicar imediatamente ao setor de Recursos Humanos
                qualquer divergência identificada, para os devidos fins de registro e controle.
              </p>
            </div>
          )}

          {!espelhoEntradaSaida && (
          <div className="ponto-espelho-declaracao mx-3 mt-1 mb-1 border border-slate-400 bg-slate-50 px-3 py-2">
            <p className="font-extrabold uppercase tracking-wide text-[10.5px] mb-1 text-center">Declaração do Colaborador</p>
            <p className="text-[10px] font-semibold text-gray-900 leading-relaxed text-justify">
              O(A) colaborador(a) <strong>{colaboradorAtual?.nome}</strong>, portador(a) do cargo de{' '}
              <strong>{cargoColaboradorLabel}</strong>, declara ter conferido os registros de ponto constantes
              nesta folha referente ao período de{' '}
              <span className="capitalize font-semibold">{nomeMes}</span>, confirmando que os horários
              de entrada, intervalo intrajornada e saída correspondem à jornada efetivamente cumprida,
              salvo se houver comunicado formal à empresa ou registro em contrário. Eventuais divergências
              devem ser comunicadas ao setor de Recursos Humanos no prazo legal, nos termos da Consolidação
              das Leis do Trabalho.
            </p>
          </div>
          )}

          {/* Bloco de assinaturas — aparece após as declarações */}
          {blocoAssinaturasFolhaImpressao}

          <div className="ponto-espelho-rodape-documento border-t border-slate-400 px-3 py-1.5 flex items-center justify-between gap-3 bg-slate-50">
            <p className="text-[8px] font-medium text-gray-600 leading-snug text-left">
              Documento gerado em {dataImpressaoFolha}
            </p>
            <p className="text-[8px] font-semibold text-gray-700 text-center flex-1 truncate uppercase tracking-wide">
              {nomeEmpresaFolha}
            </p>
            <p className="text-[8px] font-extrabold uppercase tracking-wide text-slate-700 text-right shrink-0">
              {APEX_PLAN_NAME}
            </p>
          </div>
        </div>
      )}

      </div>

      {activeTab === 'graficos' && (
        <Card className="p-5 border border-gray-200/80 shadow-sm bg-white dark:bg-slate-900 print:hidden">
          <div className="mb-4">
            <h3 className="font-bold text-gray-800 dark:text-white text-base">Acompanhamento Diário de Horas</h3>
            <p className="text-xs text-gray-450 mt-0.5">Gráfico diário de horas trabalhadas vs meta de horas requerida no mês</p>
          </div>
          <div className="h-80 w-full">
            {dadosGraficoDiario.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-450 italic text-sm">
                Nenhum dado registrado para gerar o gráfico.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosGraficoDiario} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTrabalhadoColab" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMetaColab" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dia" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} unit="h" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="Horas Trabalhadas" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTrabalhadoColab)" />
                  <Area type="monotone" dataKey="Meta de Horas" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorMetaColab)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      )}

      {podeEditarFolha && empresaColaborador && colaboradorAtual && diaEmEdicao && (
        <EditarDiaPontoModal
          open={Boolean(diaEmEdicao)}
          onClose={() => setDiaEmEdicao(null)}
          onSaved={() => setRefreshTick((n) => n + 1)}
          onPermissoesColaboradorAtualizadas={(perm) => {
            setColaboradores((prev) =>
              prev.map((c) => (c.id === colabSelecionado ? { ...c, permissoes: perm } : c)),
            );
            setRefreshTick((n) => n + 1);
          }}
          empresaId={empresaColaborador}
          adminUserId={user.id}
          colaboradorNome={colaboradorAtual.nome || colaboradorAtual.email}
          colaboradorId={colabSelecionado}
          colaboradorRole={colaboradorAtual?.role}
          colaboradorPermissoes={colaboradorAtual?.permissoes}
          dataISO={diaEmEdicao}
          batidasDia={registrosConsolidados[diaEmEdicao] || []}
          ocorrenciaDia={ocorrenciasPorDia[diaEmEdicao] || null}
        />
      )}

      {podeEditarFolha && colaboradorAtual && (
        <ConfigurarIntervaloColaboradorModal
          open={intervaloModalAberto}
          onClose={() => setIntervaloModalAberto(false)}
          onSaved={(perm) => {
            setColaboradores((prev) =>
              prev.map((c) => (c.id === colabSelecionado ? { ...c, permissoes: perm } : c)),
            );
            setRefreshTick((n) => n + 1);
          }}
          colaboradorId={colabSelecionado}
          colaboradorNome={colaboradorAtual.nome || colaboradorAtual.email}
          colaboradorRole={colaboradorAtual?.role}
          colaboradorPermissoes={colaboradorAtual?.permissoes}
        />
      )}

      {/* Modal para Visualização de Foto */}
      <Modal
        isOpen={!!visualizarFoto}
        onClose={() => setVisualizarFoto(null)}
        title={`Foto do Registro - ${visualizarFoto?.tipo || ''}`}
        size="sm"
      >
        {visualizarFoto && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-500 font-medium">
              Data do Registro: {visualizarFoto.dia}
            </p>
            <div className="relative aspect-square w-full max-w-[320px] mx-auto rounded-xl overflow-hidden bg-gray-950 border border-gray-200 shadow-inner">
              <img
                src={visualizarFoto.url}
                alt="Foto do colaborador no registro"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
            <div className="pt-2">
              <Button onClick={() => setVisualizarFoto(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-white">
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        #ponto-espelho-print-root .ponto-espelho-somente-impressao,
        #ponto-espelho-print-root .ponto-espelho-rodape-impressao,
        #ponto-espelho-print-root .ponto-espelho-assinaturas-impressao {
          display: none;
        }
        body.captura-folha-ponto-ativa {
          background: white !important;
          overflow: hidden !important;
        }
        @page {
          size: A4 portrait;
          margin: 2mm 5mm 4mm;
        }
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body > * {
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden,
          .no-print {
            display: none !important;
          }
          #ponto-espelho-print-root {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            display: block !important;
            overflow: visible !important;
            page-break-after: avoid !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #ponto-espelho-print-root .ponto-espelho-somente-impressao,
          #ponto-espelho-print-root .ponto-espelho-rodape-impressao,
          #ponto-espelho-print-footer .ponto-espelho-assinaturas-impressao,
          #ponto-espelho-print-root .ponto-espelho-assinaturas-impressao,
          #ponto-espelho-print-footer {
            display: block !important;
            visibility: visible !important;
            page-break-before: avoid !important;
            break-before: avoid-page !important;
          }
          #ponto-espelho-print-root .ponto-espelho-assinaturas-impressao,
          #ponto-espelho-print-footer .ponto-espelho-assinaturas-impressao {
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            margin-top: 14px !important;
            padding-top: 4px !important;
          }
          #ponto-espelho-print-root > .hidden.print\\:block {
            display: block !important;
            visibility: visible !important;
          }
          #ponto-espelho-print-root .ponto-espelho-cabecalho-top {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 2px 6px !important;
          }
          #ponto-espelho-print-root .ponto-espelho-logo {
            display: block !important;
            height: 30px !important;
            max-width: 96px !important;
            width: auto !important;
            object-fit: contain !important;
          }
          #ponto-espelho-print-root .ponto-espelho-marca-sistema {
            display: block !important;
            min-width: 64px !important;
          }
          #ponto-espelho-print-root .ponto-espelho-marca-sistema p:first-child {
            font-size: 9px !important;
            font-weight: 800 !important;
          }
          #ponto-espelho-print-root .ponto-espelho-marca-sistema p:last-child {
            font-size: 7.5px !important;
            font-weight: 600 !important;
          }
          #ponto-espelho-print-root .ponto-espelho-somente-impressao h1 {
            font-size: 13px !important;
            margin-top: 0 !important;
            line-height: 1.15 !important;
          }
          #ponto-espelho-print-root .ponto-espelho-somente-impressao .grid {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
            gap: 0 8px !important;
            font-size: 9.5px !important;
            line-height: 1.2 !important;
          }
          #ponto-espelho-print-root .ponto-espelho-somente-impressao .grid.grid-cols-5 > div {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }
          #ponto-espelho-print-root .ponto-espelho-somente-impressao .grid.grid-cols-5 p:first-child {
            font-size: 8.5px !important;
          }
          #ponto-espelho-print-root .ponto-espelho-somente-impressao .grid.grid-cols-5 p:last-child {
            font-size: 13px !important;
          }
          #ponto-espelho-print-root table:not(#ponto-espelho-assinaturas):not(.ponto-espelho-assinaturas-tabela) {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            box-sizing: border-box !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            page-break-inside: auto !important;
          }
          #ponto-espelho-print-root .ponto-espelho-col-saldo {
            min-width: 3.2rem !important;
            padding-right: 6px !important;
            padding-left: 4px !important;
            white-space: nowrap !important;
            overflow: visible !important;
          }
          #ponto-espelho-print-root .ponto-espelho-tabela-scroll {
            overflow: visible !important;
            max-width: 100% !important;
          }
          #ponto-espelho-print-root thead th {
            font-size: 10px !important;
            font-weight: 800 !important;
            padding: 2px 4px !important;
            line-height: 1.15 !important;
            background: #f1f5f9 !important;
            color: #0f172a !important;
            border: 1px solid #94a3b8 !important;
          }
          #ponto-espelho-print-root tbody td,
          #ponto-espelho-print-root tfoot td {
            padding: 1px 4px !important;
            line-height: 1.2 !important;
            vertical-align: middle !important;
            border: 1px solid #cbd5e1 !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            color: #0f172a !important;
          }
          #ponto-espelho-print-root tfoot td {
            font-weight: 800 !important;
            font-size: 11px !important;
          }
          #ponto-espelho-print-root tbody td.font-mono,
          #ponto-espelho-print-root tfoot td.font-mono {
            font-weight: 700 !important;
          }
          .ponto-espelho-assinaturas-container {
            display: flex !important;
            flex-direction: row !important;
            gap: 2.5rem !important;
            margin-bottom: 8px !important;
          }
          .ponto-espelho-assinaturas-container > div {
            flex: 1 1 0% !important;
            min-width: 0 !important;
            text-align: center !important;
          }
          .ponto-espelho-linha-assinatura {
            border-bottom: 2px solid #1e293b !important;
            height: 28px !important;
            margin-bottom: 2px !important;
          }
          .ponto-espelho-dados-assinatura {
            font-size: 10px !important;
            font-weight: 700 !important;
            line-height: 1.3 !important;
            color: #0f172a !important;
          }
          #ponto-espelho-print-footer {
            margin-top: 0 !important;
            padding-top: 4px !important;
            display: block !important;
            visibility: visible !important;
            page-break-before: auto !important;
            break-before: auto !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
            font-size: 10.5px !important;
            font-weight: 600 !important;
            color: #0f172a !important;
          }
          #ponto-espelho-print-footer .ponto-espelho-declaracao {
            margin-left: 0.4rem !important;
            margin-right: 0.4rem !important;
            margin-top: 2px !important;
            margin-bottom: 2px !important;
            padding: 4px 6px !important;
            font-size: 9px !important;
            line-height: 1.28 !important;
            flex: 0 0 auto !important;
          }
          #ponto-espelho-print-footer .ponto-espelho-declaracao p {
            font-size: 9px !important;
            line-height: 1.28 !important;
          }
          #ponto-espelho-print-footer .ponto-espelho-local-data {
            margin-left: 0.4rem !important;
            margin-right: 0.4rem !important;
            margin-top: 6px !important;
            margin-bottom: 6px !important;
            font-size: 10px !important;
            flex: 0 0 auto !important;
          }
          #ponto-espelho-print-footer .ponto-espelho-local-data span {
            font-weight: 700 !important;
          }
          #ponto-espelho-print-footer .ponto-espelho-rodape-documento {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 6px !important;
            margin: 0 !important;
            padding: 4px 8px !important;
            background: #f8fafc !important;
            border-top: 1px solid #94a3b8 !important;
            flex: 0 0 auto !important;
          }
          #ponto-espelho-print-footer .ponto-espelho-rodape-documento p {
            font-size: 8.5px !important;
            line-height: 1.25 !important;
            margin: 0 !important;
          }
          #ponto-espelho-print-footer .ponto-espelho-rodape-documento p:last-child {
            font-weight: 800 !important;
            letter-spacing: 0.04em !important;
          }
          #ponto-espelho-print-footer strong,
          #ponto-espelho-print-footer .font-bold,
          #ponto-espelho-print-footer .font-extrabold {
            font-weight: 800 !important;
          }
          #ponto-espelho-print-root .print\\:hidden,
          .no-print { display: none !important; }
        }
        #ponto-espelho-print-root.captura-pdf-ativa {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 794px !important;
          min-height: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 2px 10px 4px !important;
          background: white !important;
          border: none !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          z-index: 99999 !important;
          display: block !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa > * + * {
          margin-top: 0 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-somente-impressao,
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-rodape-impressao,
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-assinaturas-impressao,
        #ponto-espelho-print-root.captura-pdf-ativa #ponto-espelho-print-footer .ponto-espelho-assinaturas-impressao,
        #ponto-espelho-print-root.captura-pdf-ativa #ponto-espelho-print-footer {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .overflow-hidden {
          overflow: visible !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .print\\:hidden {
          display: none !important;
        }
        /* Pares "hidden / print:inline" (rótulos só de impressão) só ativam dentro de
           @media print de verdade — durante a captura do PDF (fora do @media print) os
           dois lados ficavam escondidos e a célula saía em branco. Reaplica aqui. */
        #ponto-espelho-print-root.captura-pdf-ativa .hidden.print\\:inline {
          display: inline !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .hidden.print\\:block {
          display: block !important;
        }
        /* thead/tfoot "sticky" (para rolagem em tela) ficava ativo durante a captura
           e o cabeçalho era desenhado por cima das linhas da tabela (texto sobre texto). */
        #ponto-espelho-print-root.captura-pdf-ativa thead,
        #ponto-espelho-print-root.captura-pdf-ativa tfoot,
        #ponto-espelho-print-root.captura-pdf-ativa th,
        #ponto-espelho-print-root.captura-pdf-ativa td {
          position: static !important;
          top: auto !important;
          left: auto !important;
          bottom: auto !important;
          z-index: auto !important;
        }
        /* O wrapper com scroll/altura máxima da tabela (uso em tela) recortava o
           conteúdo durante a captura, deixando a folha apertada/cortada. */
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-tabela-scroll {
          max-height: none !important;
          overflow: visible !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-cabecalho-top {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          padding: 2px 6px !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-logo {
          display: block !important;
          height: 30px !important;
          max-width: 96px !important;
          width: auto !important;
          object-fit: contain !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-marca-sistema {
          display: block !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-marca-sistema p:first-child {
          font-size: 9px !important;
          font-weight: 800 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-marca-sistema p:last-child {
          font-size: 7.5px !important;
          font-weight: 600 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-somente-impressao h1 {
          font-size: 13px !important;
          line-height: 1.15 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-somente-impressao .grid {
          font-size: 9.5px !important;
          padding-top: 2px !important;
          padding-bottom: 2px !important;
          line-height: 1.2 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-somente-impressao .grid.grid-cols-5 p:last-child {
          font-size: 13px !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-rodape-documento {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 4px 8px !important;
          background: #f8fafc !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-rodape-documento p {
          font-size: 8.5px !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa table:not(#ponto-espelho-assinaturas) {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          box-sizing: border-box !important;
          font-size: 11px !important;
          font-weight: 600 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-col-saldo {
          min-width: 3.2rem !important;
          padding-right: 6px !important;
          padding-left: 4px !important;
          white-space: nowrap !important;
          overflow: visible !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa thead th {
          font-size: 10px !important;
          font-weight: 800 !important;
          padding: 2px 4px !important;
          line-height: 1.15 !important;
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border: 1px solid #94a3b8 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa tbody td,
        #ponto-espelho-print-root.captura-pdf-ativa tfoot td {
          padding: 1px 4px !important;
          line-height: 1.2 !important;
          vertical-align: middle !important;
          border: 1px solid #cbd5e1 !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa tfoot td {
          font-size: 11px !important;
          font-weight: 800 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa #ponto-espelho-print-footer {
          font-size: 10.5px !important;
          font-weight: 600 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa #ponto-espelho-print-footer .ponto-espelho-declaracao,
        #ponto-espelho-print-root.captura-pdf-ativa #ponto-espelho-print-footer .ponto-espelho-declaracao p {
          font-size: 9px !important;
          line-height: 1.28 !important;
          padding: 4px 6px !important;
          margin-top: 2px !important;
          margin-bottom: 2px !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-assinaturas-impressao,
        #ponto-espelho-print-root.captura-pdf-ativa #ponto-espelho-print-footer .ponto-espelho-assinaturas-impressao {
          margin-top: 14px !important;
          padding-top: 4px !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa #ponto-espelho-print-footer .ponto-espelho-local-data {
          margin-top: 6px !important;
          margin-bottom: 6px !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-assinaturas-container {
          display: flex !important;
          flex-direction: row !important;
          gap: 2.5rem !important;
          margin-bottom: 8px !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-assinaturas-container > div {
          flex: 1 1 0% !important;
          text-align: center !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-linha-assinatura {
          border-bottom: 2px solid #1e293b !important;
          height: 28px !important;
          margin-bottom: 2px !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa .ponto-espelho-dados-assinatura {
          font-size: 10px !important;
          font-weight: 700 !important;
          line-height: 1.3 !important;
        }
        #ponto-espelho-print-root.captura-pdf-ativa table tbody tr:nth-child(even) {
          background: #f8fafc !important;
        }
      ` }} />
    </div>
  );
};
