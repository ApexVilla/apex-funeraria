import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button, Card, Input, Select, Badge, Textarea } from '../../components/ui/Components';
import { useToast } from '../../lib/ToastStore';
import { supabase } from '../../lib/supabase';
import { useEmpresaIdsOperacao, filtrarQueryPorEmpresaIds } from '../../lib/useEmpresaIdsOperacao';
import {
  Gift, Search, Plus, Edit2, Trash2, X, Activity, CreditCard, Heart, Shield,
  DollarSign, Users, AlertTriangle, Utensils, Bus, Smile, Power, Building2
} from 'lucide-react';

interface Beneficio {
  id: string;
  usuario_id: string;
  tipo: 'vale_refeicao' | 'vale_alimentacao' | 'vale_transporte' | 'plano_saude' | 'plano_odontologico' | 'seguro_vida' | 'outro';
  valor: number;
  ativo: boolean;
  observacoes?: string;
  empresa_id: string;

  // Join fields
  usuario_nome?: string;
  usuario_cargo?: string;
  empresa_nome?: string;
}

interface ColaboradorSelect {
  id: string;
  nome: string;
  role: string;
}

type TipoBeneficio = Beneficio['tipo'];

interface TipoConfig {
  value: TipoBeneficio;
  label: string;
  icon: React.ElementType;
  cor: string;        // texto/ícone
  corBg: string;      // fundo do ícone
  corBorda: string;   // borda quando selecionado no modal
}

const tiposBeneficio: TipoConfig[] = [
  { value: 'vale_refeicao', label: 'Vale Refeição', icon: Utensils, cor: 'text-emerald-600 dark:text-emerald-400', corBg: 'bg-emerald-50 dark:bg-emerald-950/40', corBorda: 'border-emerald-500 ring-emerald-500/20' },
  { value: 'vale_alimentacao', label: 'Vale Alimentação', icon: Activity, cor: 'text-green-600 dark:text-green-400', corBg: 'bg-green-50 dark:bg-green-950/40', corBorda: 'border-green-500 ring-green-500/20' },
  { value: 'vale_transporte', label: 'Vale Transporte', icon: Bus, cor: 'text-blue-600 dark:text-blue-400', corBg: 'bg-blue-50 dark:bg-blue-950/40', corBorda: 'border-blue-500 ring-blue-500/20' },
  { value: 'plano_saude', label: 'Plano de Saúde', icon: Heart, cor: 'text-red-600 dark:text-red-400', corBg: 'bg-red-50 dark:bg-red-950/40', corBorda: 'border-red-500 ring-red-500/20' },
  { value: 'plano_odontologico', label: 'Plano Odontológico', icon: Smile, cor: 'text-cyan-600 dark:text-cyan-400', corBg: 'bg-cyan-50 dark:bg-cyan-950/40', corBorda: 'border-cyan-500 ring-cyan-500/20' },
  { value: 'seguro_vida', label: 'Seguro de Vida', icon: Shield, cor: 'text-purple-600 dark:text-purple-400', corBg: 'bg-purple-50 dark:bg-purple-950/40', corBorda: 'border-purple-500 ring-purple-500/20' },
  { value: 'outro', label: 'Outro Benefício', icon: Gift, cor: 'text-gray-600 dark:text-slate-400', corBg: 'bg-gray-100 dark:bg-slate-800', corBorda: 'border-gray-400 ring-gray-400/20' },
];

const tipoConfigPorValor = new Map(tiposBeneficio.map(t => [t.value, t]));
const getTipoConfig = (tipo: TipoBeneficio): TipoConfig => tipoConfigPorValor.get(tipo) || tiposBeneficio[tiposBeneficio.length - 1];

const formatBRL = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const BeneficiosList: React.FC = () => {
  const { showToast } = useToast();
  const { empresaIdsFiltro, empresasDoGrupo, empresaNomePorId, aguardandoContexto } = useEmpresaIdsOperacao();

  // Estados de Listagem
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorSelect[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('ativos');

  // Estados de Modais
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedBeneficio, setSelectedBeneficio] = useState<Beneficio | null>(null);
  const [beneficioParaRemover, setBeneficioParaRemover] = useState<Beneficio | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Formulário
  const [form, setForm] = useState({
    usuario_id: '',
    tipo: 'vale_refeicao' as TipoBeneficio,
    valor: '',
    ativo: true,
    observacoes: '',
    empresa_id: ''
  });
  const [formError, setFormError] = useState<{ usuario_id?: string; valor?: string }>({});

  const loadData = useCallback(async () => {
    if (aguardandoContexto) return;
    setLoading(true);
    try {
      // Carrega benefícios e usuários em paralelo (join feito em memória)
      let q = supabase
        .from('rh_beneficios')
        .select('*')
        .order('tipo', { ascending: true });
      q = filtrarQueryPorEmpresaIds(q, empresaIdsFiltro);

      let usersQuery = supabase
        .from('users')
        .select('id, nome, role, empresa_id');
      usersQuery = filtrarQueryPorEmpresaIds(usersQuery, empresaIdsFiltro);

      const [{ data: beneficiosData, error: beneficiosErr }, { data: usersData, error: usersErr }] =
        await Promise.all([q, usersQuery]);
      if (beneficiosErr) throw beneficiosErr;
      if (usersErr) throw usersErr;

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);

      setColaboradores(
        (usersData || []).map(u => ({
          id: u.id,
          nome: u.nome || '',
          role: u.role || ''
        })).sort((a, b) => a.nome.localeCompare(b.nome))
      );

      const mergedBeneficios: Beneficio[] = (beneficiosData || []).map(b => {
        const u = usersMap.get(b.usuario_id);
        return {
          ...b,
          usuario_nome: u?.nome || 'Colaborador não encontrado',
          usuario_cargo: u?.role || '',
          empresa_nome: empresaNomePorId[b.empresa_id] || 'Unidade Desconhecida'
        };
      });

      mergedBeneficios.sort((a, b) => (a.usuario_nome || '').localeCompare(b.usuario_nome || ''));
      setBeneficios(mergedBeneficios);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar benefícios.', 'error');
    } finally {
      setLoading(false);
    }
  }, [aguardandoContexto, empresaIdsFiltro.join(','), empresaNomePorId, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedBeneficio(null);
    setFormError({});
    setForm({
      usuario_id: '',
      tipo: 'vale_refeicao',
      valor: '',
      ativo: true,
      observacoes: '',
      empresa_id: empresaIdsFiltro[0] || empresasDoGrupo[0]?.id || ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (b: Beneficio) => {
    setIsEditing(true);
    setSelectedBeneficio(b);
    setFormError({});
    setForm({
      usuario_id: b.usuario_id,
      tipo: b.tipo,
      valor: b.valor != null ? String(b.valor) : '',
      ativo: b.ativo !== false,
      observacoes: b.observacoes || '',
      empresa_id: b.empresa_id
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const erros: typeof formError = {};
    if (!form.usuario_id) erros.usuario_id = 'Selecione o colaborador.';
    const valorNum = parseFloat(String(form.valor).replace(',', '.'));
    if (form.valor === '' || isNaN(valorNum) || valorNum < 0) erros.valor = 'Informe um valor válido.';
    setFormError(erros);
    if (Object.keys(erros).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        usuario_id: form.usuario_id,
        tipo: form.tipo,
        valor: valorNum,
        ativo: form.ativo,
        observacoes: form.observacoes.trim() || null,
        empresa_id: form.empresa_id
      };

      if (!isEditing) {
        const { error } = await supabase.from('rh_beneficios').insert(payload);
        if (error) throw error;
        showToast('Benefício atribuído com sucesso.', 'success');
      } else {
        if (!selectedBeneficio?.id) throw new Error('ID do benefício inválido.');
        const { error } = await supabase
          .from('rh_beneficios')
          .update(payload)
          .eq('id', selectedBeneficio.id);
        if (error) throw error;
        showToast('Benefício atualizado com sucesso.', 'success');
      }

      setShowModal(false);
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar benefício.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (b: Beneficio) => {
    setTogglingId(b.id);
    try {
      const novoStatus = !(b.ativo !== false);
      const { error } = await supabase
        .from('rh_beneficios')
        .update({ ativo: novoStatus })
        .eq('id', b.id);
      if (error) throw error;
      setBeneficios(prev => prev.map(item => item.id === b.id ? { ...item, ativo: novoStatus } : item));
      showToast(novoStatus ? 'Benefício reativado.' : 'Benefício suspenso.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar status do benefício.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirmado = async () => {
    if (!beneficioParaRemover) return;
    setRemovendo(true);
    try {
      const { error } = await supabase.from('rh_beneficios').delete().eq('id', beneficioParaRemover.id);
      if (error) throw error;
      showToast('Benefício excluído definitivamente.', 'success');
      setBeneficioParaRemover(null);
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir benefício.', 'error');
    } finally {
      setRemovendo(false);
    }
  };

  const handleInativarDoModal = async () => {
    if (!beneficioParaRemover) return;
    await handleToggleAtivo(beneficioParaRemover);
    setBeneficioParaRemover(null);
  };

  // Filtros aplicados em memória
  const filteredBeneficios = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    return beneficios.filter(b => {
      const matchesSearch = !termo || (b.usuario_nome || '').toLowerCase().includes(termo);
      const matchesTipo = tipoFilter === 'todos' || b.tipo === tipoFilter;
      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativos' && b.ativo !== false) ||
        (statusFilter === 'inativos' && b.ativo === false);
      return matchesSearch && matchesTipo && matchesStatus;
    });
  }, [beneficios, searchTerm, tipoFilter, statusFilter]);

  // Contagem por categoria (respeita busca e status, para os chips)
  const contagemPorTipo = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    const base = beneficios.filter(b => {
      const matchesSearch = !termo || (b.usuario_nome || '').toLowerCase().includes(termo);
      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativos' && b.ativo !== false) ||
        (statusFilter === 'inativos' && b.ativo === false);
      return matchesSearch && matchesStatus;
    });
    const mapa = new Map<string, number>();
    base.forEach(b => mapa.set(b.tipo, (mapa.get(b.tipo) || 0) + 1));
    return { mapa, total: base.length };
  }, [beneficios, searchTerm, statusFilter]);

  // Métricas do Dashboard Superior
  const metricas = useMemo(() => {
    const ativos = beneficios.filter(b => b.ativo !== false);
    return {
      custoMensal: ativos.reduce((sum, b) => sum + (b.valor || 0), 0),
      totalAtivos: ativos.length,
      colaboradoresBeneficiados: new Set(ativos.map(b => b.usuario_id)).size
    };
  }, [beneficios]);

  const tipoSelecionadoConfig = getTipoConfig(form.tipo);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Gestão de Benefícios"
          subtitle="Atribuição, valores e controle de planos médicos, alimentação, transporte e seguros dos colaboradores"
        />
        <Button onClick={handleOpenCreate} className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Atribuir Benefício
        </Button>
      </div>

      {/* Resumo Métrico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-gradient-to-br from-teal-500 to-emerald-600 text-white border-0">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-teal-100 text-xs font-semibold uppercase tracking-wider">Custo Mensal Ativo</p>
              <h3 className="text-2xl lg:text-3xl font-extrabold mt-1">{formatBRL(metricas.custoMensal)}</h3>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <DollarSign className="h-7 w-7 text-teal-100" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-indigo-100 text-xs font-semibold uppercase tracking-wider">Benefícios Ativos</p>
              <h3 className="text-2xl lg:text-3xl font-extrabold mt-1">{metricas.totalAtivos}</h3>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <Gift className="h-7 w-7 text-indigo-100" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-sky-500 to-blue-600 text-white border-0">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sky-100 text-xs font-semibold uppercase tracking-wider">Colaboradores Beneficiados</p>
              <h3 className="text-2xl lg:text-3xl font-extrabold mt-1">{metricas.colaboradoresBeneficiados}</h3>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <Users className="h-7 w-7 text-sky-100" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
            <Input
              placeholder="Buscar pelo nome do colaborador..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos os Status</option>
            <option value="ativos">Apenas Ativos</option>
            <option value="inativos">Apenas Inativos</option>
          </Select>
        </div>

        {/* Chips de categoria */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTipoFilter('todos')}
            className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border transition-all ${
              tipoFilter === 'todos'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400'
            }`}
          >
            Todas as Categorias
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tipoFilter === 'todos' ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
              {contagemPorTipo.total}
            </span>
          </button>
          {tiposBeneficio.map(t => {
            const qtd = contagemPorTipo.mapa.get(t.value) || 0;
            const ativo = tipoFilter === t.value;
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipoFilter(ativo ? 'todos' : t.value)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border transition-all ${
                  ativo
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : qtd === 0
                      ? 'bg-white dark:bg-slate-900 text-gray-300 dark:text-slate-600 border-gray-100 dark:border-slate-800'
                      : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${ativo ? 'text-white' : t.cor}`} />
                {t.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${ativo ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                  {qtd}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Lista de Benefícios */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-5 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-2/3 rounded bg-gray-100 dark:bg-slate-800" />
                  <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-slate-800" />
                </div>
              </div>
              <div className="h-8 rounded bg-gray-50 dark:bg-slate-800/60" />
              <div className="h-8 rounded bg-gray-50 dark:bg-slate-800/60" />
            </Card>
          ))}
        </div>
      ) : filteredBeneficios.length === 0 ? (
        <Card className="p-12 text-center">
          <Gift className="mx-auto h-12 w-12 text-gray-300 dark:text-slate-700 mb-3" />
          <p className="text-base font-semibold text-gray-700 dark:text-slate-200">Nenhum benefício encontrado</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
            {beneficios.length === 0
              ? 'Comece atribuindo o primeiro benefício a um colaborador.'
              : 'Nenhum registro correspondente aos filtros atuais.'}
          </p>
          {beneficios.length === 0 && (
            <Button onClick={handleOpenCreate} size="sm" className="mt-4 bg-teal-600 hover:bg-teal-700 text-white inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Atribuir Benefício
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBeneficios.map(b => {
            const cfg = getTipoConfig(b.tipo);
            const Icon = cfg.icon;
            const isAtivo = b.ativo !== false;
            return (
              <Card key={b.id} className={`relative hover:shadow-md transition-all duration-200 flex flex-col justify-between ${!isAtivo ? 'opacity-75' : ''}`}>
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${cfg.corBg}`}>
                        <Icon className={`h-5 w-5 ${cfg.cor}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate" title={b.usuario_nome}>
                          {b.usuario_nome}
                        </h4>
                        <span className="text-[10px] text-gray-500 dark:text-slate-500 uppercase tracking-wider font-semibold">
                          {b.usuario_cargo || 'Cargo indefinido'}
                        </span>
                      </div>
                    </div>
                    {isAtivo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="danger">Suspenso</Badge>
                    )}
                  </div>

                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium uppercase block">Categoria</span>
                      <strong className="text-sm text-gray-700 dark:text-slate-200">{cfg.label}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium uppercase block">Valor Mensal</span>
                      <strong className="text-base text-teal-600 dark:text-teal-400">{formatBRL(b.valor)}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-50 dark:border-slate-800">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{b.empresa_nome}</span>
                  </div>

                  {b.observacoes && (
                    <div className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50/50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-dashed border-gray-200/50 dark:border-slate-700/50 line-clamp-2" title={b.observacoes}>
                      <strong>Obs:</strong> {b.observacoes}
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 bg-gray-50/50 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={togglingId === b.id}
                    onClick={() => handleToggleAtivo(b)}
                    className={`flex items-center gap-1.5 h-8 text-xs ${isAtivo ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}
                    title={isAtivo ? 'Suspender benefício sem excluir o histórico' : 'Reativar benefício'}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {isAtivo ? 'Suspender' : 'Reativar'}
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit(b)} className="flex items-center gap-1.5 h-8">
                      <Edit2 className="h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBeneficioParaRemover(b)}
                      className="flex items-center gap-1.5 h-8 text-red-600 dark:text-red-400 hover:text-red-700 border-red-100 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3 w-3" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Atribuição / Edição */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setShowModal(false); }}
        >
          <Card className="w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${tipoSelecionadoConfig.corBg}`}>
                  <tipoSelecionadoConfig.icon className={`h-5 w-5 ${tipoSelecionadoConfig.cor}`} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {isEditing ? 'Editar Benefício' : 'Atribuir Benefício'}
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {isEditing
                      ? `Alterando benefício de ${selectedBeneficio?.usuario_nome || 'colaborador'}`
                      : 'Selecione a categoria, o colaborador e o valor mensal'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form id="beneficio-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Categoria — grade visual */}
              <div>
                <span className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider ml-1 mb-2">
                  Categoria do Benefício
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {tiposBeneficio.map(t => {
                    const Icon = t.icon;
                    const selecionado = form.tipo === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm({ ...form, tipo: t.value })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                          selecionado
                            ? `${t.corBg} ${t.corBorda} border-2 ring-2 shadow-sm`
                            : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950 hover:border-gray-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${selecionado ? t.cor : 'text-gray-400 dark:text-slate-500'}`} />
                        <span className={`text-[11px] font-semibold leading-tight ${selecionado ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Select
                label="Colaborador"
                disabled={isEditing}
                required
                error={formError.usuario_id}
                value={form.usuario_id}
                onChange={(e: any) => {
                  setForm({ ...form, usuario_id: e.target.value });
                  if (formError.usuario_id) setFormError({ ...formError, usuario_id: undefined });
                }}
              >
                <option value="">Selecione um colaborador...</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}{c.role ? ` (${c.role})` : ''}</option>
                ))}
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Valor Mensal (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                  error={formError.valor}
                  value={form.valor}
                  onChange={(e) => {
                    setForm({ ...form, valor: e.target.value });
                    if (formError.valor) setFormError({ ...formError, valor: undefined });
                  }}
                />
                <Select
                  label="Empresa / Unidade"
                  value={form.empresa_id}
                  onChange={(e: any) => setForm({ ...form, empresa_id: e.target.value })}
                >
                  {empresasDoGrupo.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                  ))}
                </Select>
              </div>

              {/* Status — toggle */}
              <button
                type="button"
                onClick={() => setForm({ ...form, ativo: !form.ativo })}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  form.ativo
                    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950'
                }`}
              >
                <div className="text-left">
                  <span className={`block text-sm font-bold ${form.ativo ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-slate-400'}`}>
                    {form.ativo ? 'Benefício Ativo' : 'Benefício Suspenso'}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-slate-500">
                    {form.ativo ? 'Contabilizado no custo mensal da empresa' : 'Mantido no histórico, mas fora do custo mensal'}
                  </span>
                </div>
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.ativo ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-700'}`}
                  aria-hidden
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${form.ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </span>
              </button>

              <Textarea
                label="Observações / Detalhes"
                placeholder="Insira detalhes como número do cartão, operadora, vigência ou observações de desconto em folha..."
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </form>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-800 shrink-0 bg-gray-50/50 dark:bg-slate-800/40">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" form="beneficio-form" loading={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
                {isEditing ? 'Salvar Alterações' : 'Conceder Benefício'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {beneficioParaRemover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !removendo) setBeneficioParaRemover(null); }}
        >
          <Card className="w-full max-w-md">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Excluir benefício?</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    <strong>{getTipoConfig(beneficioParaRemover.tipo).label}</strong> de{' '}
                    <strong>{beneficioParaRemover.usuario_nome}</strong>{' '}
                    ({formatBRL(beneficioParaRemover.valor)}/mês) será removido permanentemente.
                  </p>
                </div>
              </div>

              {beneficioParaRemover.ativo !== false && (
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-lg p-3">
                  Se a intenção é apenas pausar o benefício, prefira <strong>Suspender</strong> — o registro é mantido no histórico e pode ser reativado depois.
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 py-4 bg-gray-50/50 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setBeneficioParaRemover(null)} disabled={removendo}>
                Cancelar
              </Button>
              {beneficioParaRemover.ativo !== false && (
                <Button
                  variant="outline"
                  onClick={handleInativarDoModal}
                  disabled={removendo}
                  className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Power className="h-4 w-4 mr-1.5" />
                  Apenas Suspender
                </Button>
              )}
              <Button variant="danger" onClick={handleDeleteConfirmado} loading={removendo}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                Excluir Definitivamente
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
