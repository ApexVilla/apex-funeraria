import React, { useEffect, useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ComposedChart, Line, Area, Cell, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, Gauge, Droplets, Car } from 'lucide-react';
import { Card, Select } from '../../components/ui/Components';
import { useFrotaEmpresaContext } from '../../lib/useFrotaEmpresaContext';
import { useToast } from '../../lib/ToastStore';
import { frotaListAbastecimentos } from '../../lib/frotaSupabase';

interface AbastecimentoRow {
    veiculo_id: string;
    placa: string;
    modelo: string;
    data: string;            // yyyy-mm-dd
    km_atual: number;
    km_anterior: number;
    litros: number;
    valor_total: number;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtBRLCompacto = (v: number) =>
    v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const CORES_BARRAS = ['#be123c', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#84cc16'];

/** Regressão linear simples sobre os últimos pontos: retorna projeção para o próximo x. */
function preverProximo(valores: number[]): number {
    const pts = valores.filter(v => Number.isFinite(v));
    if (pts.length === 0) return 0;
    if (pts.length === 1) return pts[0];
    const n = pts.length;
    const somaX = (n * (n - 1)) / 2;
    const somaY = pts.reduce((s, v) => s + v, 0);
    const somaXY = pts.reduce((s, v, i) => s + i * v, 0);
    const somaX2 = pts.reduce((s, _, i) => s + i * i, 0);
    const denom = n * somaX2 - somaX * somaX;
    if (denom === 0) return somaY / n;
    const b = (n * somaXY - somaX * somaY) / denom;
    const a = (somaY - b * somaX) / n;
    return Math.max(0, a + b * n);
}

const tooltipStyle: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.3)',
    background: 'var(--tooltip-bg, #fff)',
    fontSize: 12,
};

export const AbastecimentoAnaliseTab: React.FC = () => {
    const { empresaIdEfetivo, dataRevisionEmpresa, frotaOpts, skipUntilGrupoCarrega } = useFrotaEmpresaContext();
    const { showToast } = useToast();
    const [rows, setRows] = useState<AbastecimentoRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [mesesJanela, setMesesJanela] = useState('12');
    const [veiculoFiltro, setVeiculoFiltro] = useState('');

    useEffect(() => {
        if (!empresaIdEfetivo || skipUntilGrupoCarrega) return;
        let cancel = false;
        (async () => {
            setLoading(true);
            try {
                const data = await frotaListAbastecimentos(empresaIdEfetivo, {}, frotaOpts);
                if (cancel) return;
                setRows((data || []).map((a: any) => ({
                    veiculo_id: a.veiculo_id,
                    placa: a.placa || '—',
                    modelo: a.modelo || '',
                    data: a.data_abastecimento || '',
                    km_atual: Number(a.km_atual || 0),
                    km_anterior: Number(a.km_anterior || 0),
                    litros: Number(a.litros || 0),
                    valor_total: Number(a.valor_total || 0),
                })));
            } catch (err) {
                if (!cancel) showToast(err instanceof Error ? err.message : 'Erro ao carregar dados de análise.', 'error');
            } finally {
                if (!cancel) setLoading(false);
            }
        })();
        return () => { cancel = true; };
    }, [empresaIdEfetivo, dataRevisionEmpresa, frotaOpts, skipUntilGrupoCarrega]);

    const veiculosDisponiveis = useMemo(() => {
        const m = new Map<string, string>();
        rows.forEach(r => { if (r.placa !== '—') m.set(r.placa, `${r.placa} — ${r.modelo}`); });
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [rows]);

    // Janela de meses considerada (inclui o mês atual)
    const chavesMeses = useMemo(() => {
        const n = parseInt(mesesJanela, 10) || 12;
        const out: string[] = [];
        const base = new Date();
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
            out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return out;
    }, [mesesJanela]);

    const dadosJanela = useMemo(() => {
        const inicio = chavesMeses[0];
        return rows.filter(r =>
            r.data && r.data.slice(0, 7) >= inicio &&
            (!veiculoFiltro || r.placa === veiculoFiltro),
        );
    }, [rows, chavesMeses, veiculoFiltro]);

    // Série mensal: gasto, litros, preço médio do litro + previsão do próximo mês
    const serieMensal = useMemo(() => {
        const porMes = new Map<string, { gasto: number; litros: number }>();
        chavesMeses.forEach(k => porMes.set(k, { gasto: 0, litros: 0 }));
        dadosJanela.forEach(r => {
            const k = r.data.slice(0, 7);
            const alvo = porMes.get(k);
            if (alvo) {
                alvo.gasto += r.valor_total;
                alvo.litros += r.litros;
            }
        });
        const serie = chavesMeses.map(k => {
            const [ano, mes] = k.split('-');
            const v = porMes.get(k)!;
            return {
                mes: `${MESES[parseInt(mes, 10) - 1]}/${ano.slice(2)}`,
                gasto: Number(v.gasto.toFixed(2)),
                litros: Number(v.litros.toFixed(1)),
                precoMedio: v.litros > 0 ? Number((v.gasto / v.litros).toFixed(2)) : null,
                previsao: null as number | null,
            };
        });

        // Previsão: regressão linear sobre os meses com movimento
        const gastosComMovimento = serie.map(s => s.gasto);
        const previsaoGasto = preverProximo(gastosComMovimento);
        const proximo = new Date();
        proximo.setMonth(proximo.getMonth() + 1);
        serie.push({
            mes: `${MESES[proximo.getMonth()]}/${String(proximo.getFullYear()).slice(2)} *`,
            gasto: 0,
            litros: 0,
            precoMedio: null,
            previsao: Number(previsaoGasto.toFixed(2)),
        });
        // Liga a linha de previsão ao último mês real
        if (serie.length >= 2) serie[serie.length - 2].previsao = serie[serie.length - 2].gasto;
        return { serie, previsaoGasto };
    }, [dadosJanela, chavesMeses]);

    // Consumo e gasto por veículo
    const porVeiculo = useMemo(() => {
        const grupos = new Map<string, { placa: string; modelo: string; litros: number; gasto: number; km: number; registros: number }>();
        dadosJanela.forEach(r => {
            if (!grupos.has(r.placa)) {
                grupos.set(r.placa, { placa: r.placa, modelo: r.modelo, litros: 0, gasto: 0, km: 0, registros: 0 });
            }
            const g = grupos.get(r.placa)!;
            g.litros += r.litros;
            g.gasto += r.valor_total;
            g.km += Math.max(0, r.km_atual - r.km_anterior);
            g.registros += 1;
        });
        return [...grupos.values()].map(g => ({
            ...g,
            consumo: g.litros > 0 ? Number((g.km / g.litros).toFixed(2)) : 0,
            custoKm: g.km > 0 ? Number((g.gasto / g.km).toFixed(2)) : 0,
            gasto: Number(g.gasto.toFixed(2)),
        })).sort((a, b) => b.gasto - a.gasto);
    }, [dadosJanela]);

    const indicadores = useMemo(() => {
        const totalGasto = dadosJanela.reduce((s, r) => s + r.valor_total, 0);
        const totalLitros = dadosJanela.reduce((s, r) => s + r.litros, 0);
        const totalKm = dadosJanela.reduce((s, r) => s + Math.max(0, r.km_atual - r.km_anterior), 0);
        const mesesComMovimento = new Set(dadosJanela.map(r => r.data.slice(0, 7))).size || 1;
        return {
            gastoMedioMensal: totalGasto / mesesComMovimento,
            previsaoProximoMes: serieMensal.previsaoGasto,
            consumoGeral: totalLitros > 0 ? totalKm / totalLitros : 0,
            custoPorKm: totalKm > 0 ? totalGasto / totalKm : 0,
            precoMedioLitro: totalLitros > 0 ? totalGasto / totalLitros : 0,
        };
    }, [dadosJanela, serieMensal.previsaoGasto]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="p-5 animate-pulse">
                        <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-slate-800 mb-4" />
                        <div className="h-56 rounded bg-gray-50 dark:bg-slate-800/60" />
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filtros da análise */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                    Análise baseada em <strong className="text-gray-800 dark:text-slate-200">{dadosJanela.length}</strong> abastecimentos no período.
                </p>
                <div className="flex gap-3">
                    <div className="w-44">
                        <Select value={veiculoFiltro} onChange={e => setVeiculoFiltro(e.target.value)}>
                            <option value="">Todos os veículos</option>
                            {veiculosDisponiveis.map(([placa, label]) => (
                                <option key={placa} value={placa}>{label}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="w-44">
                        <Select value={mesesJanela} onChange={e => setMesesJanela(e.target.value)}>
                            <option value="6">Últimos 6 meses</option>
                            <option value="12">Últimos 12 meses</option>
                            <option value="24">Últimos 24 meses</option>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Indicadores */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 mb-1">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Gasto Médio / Mês</span>
                    </div>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white">{fmtBRL(indicadores.gastoMedioMensal)}</p>
                </Card>
                <Card className="p-4 border-rose-200 dark:border-rose-900/60">
                    <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Previsão Próx. Mês</span>
                    </div>
                    <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400">{fmtBRL(indicadores.previsaoProximoMes)}</p>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 mb-1">
                        <Gauge className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Consumo Geral</span>
                    </div>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white">{indicadores.consumoGeral.toFixed(1)} km/L</p>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 mb-1">
                        <Car className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Custo por KM</span>
                    </div>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white">{fmtBRL(indicadores.custoPorKm)}</p>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 mb-1">
                        <Droplets className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Preço Médio / Litro</span>
                    </div>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white">{fmtBRL(indicadores.precoMedioLitro)}</p>
                </Card>
            </div>

            {/* Gasto mensal + previsão */}
            <Card className="p-5">
                <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                    Gasto Mensal com Combustível
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
                    * O último ponto (tracejado) é a previsão do próximo mês, projetada por tendência linear do período.
                </p>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={serieMensal.serie} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                            <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <YAxis tickFormatter={fmtBRLCompacto} tick={{ fontSize: 11 }} stroke="#94a3b8" width={70} />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={(value: any, name: any) => {
                                    if (name === 'Litros') return [`${Number(value).toLocaleString('pt-BR')} L`, name];
                                    return [fmtBRL(Number(value)), name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Area type="monotone" dataKey="gasto" name="Gasto (R$)" fill="rgba(190,18,60,0.12)" stroke="#be123c" strokeWidth={2} />
                            <Line
                                type="monotone" dataKey="previsao" name="Previsão (R$)"
                                stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="6 4"
                                dot={{ r: 4, fill: '#f59e0b' }} connectNulls
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Consumo médio por veículo */}
                <Card className="p-5">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wider mb-4">
                        Consumo Médio por Veículo (km/L)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={porVeiculo} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <YAxis type="category" dataKey="placa" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    formatter={(value: any) => [`${Number(value).toFixed(2)} km/L`, 'Consumo médio']}
                                    labelFormatter={(placa: any) => {
                                        const v = porVeiculo.find(x => x.placa === placa);
                                        return v ? `${v.placa} — ${v.modelo}` : placa;
                                    }}
                                />
                                <Bar dataKey="consumo" radius={[0, 6, 6, 0]} barSize={18}>
                                    {porVeiculo.map((_, i) => (
                                        <Cell key={i} fill={CORES_BARRAS[i % CORES_BARRAS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Gasto por veículo */}
                <Card className="p-5">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wider mb-4">
                        Gasto Total por Veículo (R$)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={porVeiculo} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                                <XAxis type="number" tickFormatter={fmtBRLCompacto} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <YAxis type="category" dataKey="placa" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    formatter={(value: any) => [fmtBRL(Number(value)), 'Gasto total']}
                                    labelFormatter={(placa: any) => {
                                        const v = porVeiculo.find(x => x.placa === placa);
                                        return v ? `${v.placa} — ${v.modelo}` : placa;
                                    }}
                                />
                                <Bar dataKey="gasto" radius={[0, 6, 6, 0]} barSize={18}>
                                    {porVeiculo.map((_, i) => (
                                        <Cell key={i} fill={CORES_BARRAS[i % CORES_BARRAS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Litros e preço médio por mês */}
            <Card className="p-5">
                <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wider mb-4">
                    Litros Abastecidos e Preço Médio do Litro por Mês
                </h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={serieMensal.serie.slice(0, -1)} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                            <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <YAxis yAxisId="litros" tick={{ fontSize: 11 }} stroke="#94a3b8" width={50} />
                            <YAxis yAxisId="preco" orientation="right" tickFormatter={(v: number) => `R$ ${v}`} tick={{ fontSize: 11 }} stroke="#94a3b8" width={60} />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={(value: any, name: any) => {
                                    if (name === 'Litros') return [`${Number(value).toLocaleString('pt-BR')} L`, name];
                                    return [fmtBRL(Number(value)), name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar yAxisId="litros" dataKey="litros" name="Litros" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={22} />
                            <Line yAxisId="preco" type="monotone" dataKey="precoMedio" name="Preço médio/L" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Tabela resumo custo/km */}
            <Card className="overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wider">
                        Resumo por Veículo — Custo e Eficiência
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/60 border-y border-gray-100 dark:border-slate-800 font-semibold text-gray-600 dark:text-slate-300">
                                <th className="py-2.5 px-4 text-left">Veículo</th>
                                <th className="py-2.5 px-4 text-center">Abastecimentos</th>
                                <th className="py-2.5 px-4 text-center">KM Percorrido</th>
                                <th className="py-2.5 px-4 text-center">Litros</th>
                                <th className="py-2.5 px-4 text-center">Consumo Médio</th>
                                <th className="py-2.5 px-4 text-center">Custo por KM</th>
                                <th className="py-2.5 px-4 text-right">Gasto Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {porVeiculo.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-6 text-center text-gray-400 dark:text-slate-500 italic">
                                        Nenhum abastecimento no período selecionado.
                                    </td>
                                </tr>
                            ) : porVeiculo.map(v => (
                                <tr key={v.placa} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                                    <td className="py-2.5 px-4 font-semibold text-gray-800 dark:text-slate-200">
                                        {v.placa} <span className="font-normal text-gray-500 dark:text-slate-400">({v.modelo})</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-center text-gray-600 dark:text-slate-300">{v.registros}</td>
                                    <td className="py-2.5 px-4 text-center text-gray-600 dark:text-slate-300">{v.km.toLocaleString('pt-BR')} km</td>
                                    <td className="py-2.5 px-4 text-center text-gray-600 dark:text-slate-300">{v.litros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</td>
                                    <td className="py-2.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                        {v.consumo > 0 ? `${v.consumo.toFixed(2)} km/L` : '—'}
                                    </td>
                                    <td className="py-2.5 px-4 text-center font-semibold text-gray-700 dark:text-slate-200">
                                        {v.custoKm > 0 ? fmtBRL(v.custoKm) : '—'}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-bold text-gray-900 dark:text-white">{fmtBRL(v.gasto)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
