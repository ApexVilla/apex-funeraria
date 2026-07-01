import React, { useEffect, useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
    Map, Car, Users, TrendingUp, Activity,
    Calendar, ChevronLeft, ChevronRight, Route, Flag,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { useFrotaEmpresaContext } from '../../lib/useFrotaEmpresaContext';
import { frotaListViagens } from '../../lib/frotaSupabase';

// ── helpers ────────────────────────────────────────────────────────────────────

const MESES = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const MESES_FULL = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    agendada:     { label: 'Agendada',      color: '#6366f1' },
    em_andamento: { label: 'Em andamento',  color: '#f59e0b' },
    concluida:    { label: 'Concluída',     color: '#10b981' },
    cancelada:    { label: 'Cancelada',     color: '#ef4444' },
};

const TIPO_LABELS: Record<string, string> = {
    servico:     'Serviço',
    translado:   'Translado',
    abastecimento: 'Abastecimento',
    manutencao:  'Manutenção',
    administrativo: 'Administrativo',
    outros:      'Outros',
};

function kmPercorrido(v: any): number {
    const s = Number(v.km_saida ?? 0);
    const r = Number(v.km_retorno ?? 0);
    return r > s ? r - s : 0;
}

function fmtNum(n: number, dec = 0) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
    icon: Icon,
    label,
    value,
    sub,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    color: string;
}) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">{value}</p>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-0.5 truncate">{label}</p>
                {sub && <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">{sub}</p>}
            </div>
        </div>
    );
}

const CustomTooltipBar = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3 text-xs">
            <p className="font-bold text-gray-700 dark:text-slate-200 mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.fill || p.color }} className="font-semibold">
                    {p.name}: <span className="text-gray-800 dark:text-slate-100">{fmtNum(p.value)}</span>
                </p>
            ))}
        </div>
    );
};

const CustomTooltipPie = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    return (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3 text-xs">
            <p className="font-bold" style={{ color: p.payload.fill }}>{p.name}</p>
            <p className="text-gray-700 dark:text-slate-200">{fmtNum(p.value)} viagem(ns)</p>
        </div>
    );
};

// ── main page ──────────────────────────────────────────────────────────────────

export const DashboardViagens: React.FC = () => {
    const { empresaIdEfetivo, frotaOpts, skipUntilGrupoCarrega } = useFrotaEmpresaContext();

    const today = new Date();
    const [mes, setMes] = useState(today.getMonth()); // 0-indexed
    const [ano, setAno] = useState(today.getFullYear());
    const [viagens, setViagens] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!empresaIdEfetivo || skipUntilGrupoCarrega) return;
        let cancelled = false;
        setLoading(true);
        frotaListViagens(empresaIdEfetivo, {}, frotaOpts)
            .then((rows) => { if (!cancelled) setViagens(rows); })
            .catch(console.error)
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [empresaIdEfetivo, frotaOpts, skipUntilGrupoCarrega]);

    // ── navegação de mês ───────────────────────────────────────────────────────
    function navMes(delta: number) {
        let m = mes + delta;
        let a = ano;
        if (m < 0) { m = 11; a--; }
        if (m > 11) { m = 0; a++; }
        setMes(m);
        setAno(a);
    }

    // ── viagens do mês selecionado ─────────────────────────────────────────────
    const viagensMes = useMemo(() => {
        const prefix = `${ano}-${String(mes + 1).padStart(2, '0')}`;
        return viagens.filter((v) => (v.data_saida ?? '').startsWith(prefix));
    }, [viagens, mes, ano]);

    // ── KPIs ───────────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const total = viagensMes.length;
        const concluidas = viagensMes.filter((v) => v.status === 'concluida').length;
        const kmTotal = viagensMes.reduce((acc, v) => acc + kmPercorrido(v), 0);
        const kmMedia = total ? Math.round(kmTotal / total) : 0;
        const passageiros = viagensMes.reduce((acc, v) => acc + Number(v.passageiros ?? 0), 0);
        return { total, concluidas, kmTotal, kmMedia, passageiros };
    }, [viagensMes]);

    // ── gráfico 1: viagens por mês (últimos 12 meses) ─────────────────────────
    const dadosPorMes = useMemo(() => {
        const map: Record<string, { viagens: number; km: number }> = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date(ano, mes - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
            map[key] = { viagens: 0, km: 0 };
            (map as any)[key].__label = label;
        }
        viagens.forEach((v) => {
            const key = (v.data_saida ?? '').slice(0, 7);
            if (map[key]) {
                map[key].viagens++;
                map[key].km += kmPercorrido(v);
            }
        });
        return Object.entries(map).map(([, val]) => ({
            mes: (val as any).__label,
            Viagens: val.viagens,
            'KM Total': Math.round(val.km),
        }));
    }, [viagens, mes, ano]);

    // ── gráfico 2: km por veículo (mês selecionado) ───────────────────────────
    const dadosPorVeiculo = useMemo(() => {
        const map: Record<string, { km: number; viagens: number }> = {};
        viagensMes.forEach((v) => {
            const key = `${v.placa ?? '-'} ${v.modelo ?? ''}`.trim();
            if (!map[key]) map[key] = { km: 0, viagens: 0 };
            map[key].km += kmPercorrido(v);
            map[key].viagens++;
        });
        return Object.entries(map)
            .map(([veiculo, d]) => ({ veiculo, km: Math.round(d.km), Viagens: d.viagens }))
            .sort((a, b) => b.km - a.km)
            .slice(0, 8);
    }, [viagensMes]);

    // ── gráfico 3: status (pizza) ──────────────────────────────────────────────
    const dadosStatus = useMemo(() => {
        const map: Record<string, number> = {};
        viagensMes.forEach((v) => {
            const s = v.status ?? 'outros';
            map[s] = (map[s] ?? 0) + 1;
        });
        return Object.entries(map).map(([status, count]) => ({
            name: STATUS_LABELS[status]?.label ?? status,
            value: count,
            fill: STATUS_LABELS[status]?.color ?? '#94a3b8',
        }));
    }, [viagensMes]);

    // ── gráfico 4: top motoristas (mês) ───────────────────────────────────────
    const dadosMotoristaMes = useMemo(() => {
        const map: Record<string, { km: number; viagens: number }> = {};
        viagensMes.forEach((v) => {
            const nome = v.motorista_nome ?? 'Sem motorista';
            if (!map[nome]) map[nome] = { km: 0, viagens: 0 };
            map[nome].km += kmPercorrido(v);
            map[nome].viagens++;
        });
        return Object.entries(map)
            .map(([motorista, d]) => ({ motorista, km: Math.round(d.km), Viagens: d.viagens }))
            .sort((a, b) => b.Viagens - a.Viagens)
            .slice(0, 8);
    }, [viagensMes]);

    // ── gráfico 5: tipo de viagem (mês) ───────────────────────────────────────
    const dadosTipo = useMemo(() => {
        const map: Record<string, number> = {};
        viagensMes.forEach((v) => {
            const t = TIPO_LABELS[v.tipo ?? ''] ?? (v.tipo ?? 'Outros');
            map[t] = (map[t] ?? 0) + 1;
        });
        return Object.entries(map)
            .map(([tipo, count]) => ({ tipo, Viagens: count }))
            .sort((a, b) => b.Viagens - a.Viagens);
    }, [viagensMes]);

    // ── tabela: viagens recentes do mês ───────────────────────────────────────
    const tabelaViagens = useMemo(() => {
        return [...viagensMes]
            .sort((a, b) => (b.data_saida ?? '').localeCompare(a.data_saida ?? ''))
            .slice(0, 10);
    }, [viagensMes]);

    const COLORS_CHART = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeader title="Dashboard de Viagens" subtitle="Carregando dados..." backTo="/frota" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            <PageHeader
                title="Dashboard de Viagens"
                subtitle="Métricas e gráficos analíticos da operação de frota"
                backTo="/frota"
            />

            {/* ── Seletor de mês ── */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navMes(-1)}
                    className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                    <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm min-w-[180px] justify-center">
                    <Calendar className="h-4 w-4 text-rose-500" />
                    <span className="font-bold text-gray-800 dark:text-slate-100 text-sm">
                        {MESES_FULL[mes]} {ano}
                    </span>
                </div>
                <button
                    onClick={() => navMes(1)}
                    disabled={ano >= today.getFullYear() && mes >= today.getMonth()}
                    className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 transition disabled:opacity-40"
                >
                    <ChevronRight className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">
                    {kpis.total} viagem(ns) neste mês
                </span>
            </div>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    icon={Map}
                    label="Total de Viagens"
                    value={fmtNum(kpis.total)}
                    sub={`${kpis.concluidas} concluída(s)`}
                    color="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                />
                <KpiCard
                    icon={Route}
                    label="KM Total Percorrido"
                    value={`${fmtNum(kpis.kmTotal)} km`}
                    sub={`Média ${fmtNum(kpis.kmMedia)} km/viagem`}
                    color="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                />
                <KpiCard
                    icon={TrendingUp}
                    label="Média KM por Viagem"
                    value={`${fmtNum(kpis.kmMedia)} km`}
                    sub="Média do mês selecionado"
                    color="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                />
                <KpiCard
                    icon={Users}
                    label="Total de Passageiros"
                    value={fmtNum(kpis.passageiros)}
                    sub="Somado do mês"
                    color="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                />
            </div>

            {/* ── Linha 1: Viagens por mês + Status ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Viagens & KM últimos 12 meses */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="h-4 w-4 text-indigo-500" />
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">Viagens por Mês — últimos 12 meses</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={dadosPorMes} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                            <Tooltip content={<CustomTooltipBar />} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="Viagens" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Status pizza */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Flag className="h-4 w-4 text-rose-500" />
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">Status das Viagens</h3>
                    </div>
                    {dadosStatus.length === 0 ? (
                        <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 dark:text-slate-500">
                            Sem dados neste mês
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={dadosStatus}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {dadosStatus.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltipPie />} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: 11 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Linha 2: KM por veículo + KM por mês (linha) ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* KM por veículo */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Car className="h-4 w-4 text-emerald-500" />
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">KM por Veículo — mês atual</h3>
                    </div>
                    {dadosPorVeiculo.length === 0 ? (
                        <div className="flex items-center justify-center h-[200px] text-sm text-gray-400 dark:text-slate-500">
                            Sem dados neste mês
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(200, dadosPorVeiculo.length * 36)}>
                            <BarChart
                                data={dadosPorVeiculo}
                                layout="vertical"
                                margin={{ top: 0, right: 20, bottom: 0, left: 8 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <YAxis dataKey="veiculo" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} width={90} />
                                <Tooltip content={<CustomTooltipBar />} />
                                <Bar dataKey="km" name="KM" fill="#10b981" radius={[0, 4, 4, 0]}>
                                    {dadosPorVeiculo.map((_, i) => (
                                        <Cell key={i} fill={COLORS_CHART[i % COLORS_CHART.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* KM por mês - linha */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-amber-500" />
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">KM Total por Mês — evolução</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={dadosPorMes} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <Tooltip content={<CustomTooltipBar />} />
                            <Line
                                type="monotone"
                                dataKey="KM Total"
                                stroke="#f59e0b"
                                strokeWidth={2.5}
                                dot={{ r: 3, fill: '#f59e0b' }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Linha 3: Motoristas + Tipo ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Top motoristas */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="h-4 w-4 text-violet-500" />
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">Viagens por Motorista — mês atual</h3>
                    </div>
                    {dadosMotoristaMes.length === 0 ? (
                        <div className="flex items-center justify-center h-[200px] text-sm text-gray-400 dark:text-slate-500">
                            Sem dados neste mês
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(200, dadosMotoristaMes.length * 36)}>
                            <BarChart
                                data={dadosMotoristaMes}
                                layout="vertical"
                                margin={{ top: 0, right: 20, bottom: 0, left: 8 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                                <YAxis dataKey="motorista" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} width={110} />
                                <Tooltip content={<CustomTooltipBar />} />
                                <Bar dataKey="Viagens" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                                    {dadosMotoristaMes.map((_, i) => (
                                        <Cell key={i} fill={COLORS_CHART[i % COLORS_CHART.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Tipo de viagem */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Map className="h-4 w-4 text-blue-500" />
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">Viagens por Tipo — mês atual</h3>
                    </div>
                    {dadosTipo.length === 0 ? (
                        <div className="flex items-center justify-center h-[200px] text-sm text-gray-400 dark:text-slate-500">
                            Sem dados neste mês
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={dadosTipo} margin={{ top: 4, right: 4, bottom: 8, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                                <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltipBar />} />
                                <Bar dataKey="Viagens" radius={[4, 4, 0, 0]}>
                                    {dadosTipo.map((_, i) => (
                                        <Cell key={i} fill={COLORS_CHART[i % COLORS_CHART.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Tabela: últimas viagens do mês ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                    <Map className="h-4 w-4 text-indigo-500" />
                    <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">
                        Últimas viagens — {MESES_FULL[mes]} {ano}
                    </h3>
                    <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">
                        Mostrando {tabelaViagens.length} de {kpis.total}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/60">
                                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-slate-400">Código</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-slate-400">Veículo</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-slate-400">Motorista</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-slate-400">Origem → Destino</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-slate-400">KM</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-slate-400">Data Saída</th>
                                <th className="px-4 py-3 text-center font-semibold text-gray-500 dark:text-slate-400">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                            {tabelaViagens.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                                        Nenhuma viagem registrada neste mês.
                                    </td>
                                </tr>
                            )}
                            {tabelaViagens.map((v) => {
                                const km = kmPercorrido(v);
                                const st = STATUS_LABELS[v.status] ?? { label: v.status, color: '#94a3b8' };
                                return (
                                    <tr key={v.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition">
                                        <td className="px-4 py-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                            {v.codigo ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                                            <span className="font-semibold">{v.placa ?? '—'}</span>
                                            {v.modelo && <span className="text-gray-400 dark:text-slate-500 ml-1">· {v.modelo}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{v.motorista_nome ?? '—'}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400 max-w-[220px] truncate">
                                            {v.origem ?? '—'} → {v.destino ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-slate-200">
                                            {km > 0 ? `${fmtNum(km)} km` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                                            {v.data_saida
                                                ? new Date(v.data_saida + 'T00:00:00').toLocaleDateString('pt-BR')
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                                                style={{
                                                    backgroundColor: st.color + '20',
                                                    color: st.color,
                                                }}
                                            >
                                                {st.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
