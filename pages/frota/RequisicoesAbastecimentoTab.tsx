import React, { useEffect, useMemo, useState } from 'react';
import {
    FileText, Plus, Search, Printer, CheckCircle2, XCircle, Fuel,
    AlertTriangle, X, Clock, Droplets, DollarSign, Ban
} from 'lucide-react';
import { Button, Input, Select, Card, Textarea, Badge } from '../../components/ui/Components';
import { useFrotaEmpresaContext } from '../../lib/useFrotaEmpresaContext';
import { useToast } from '../../lib/ToastStore';
import { supabase } from '../../lib/supabase';
import {
    frotaListRequisicoesAbastecimento,
    frotaInsertRequisicaoAbastecimento,
    frotaCancelarRequisicaoAbastecimento,
    frotaBaixarRequisicaoAbastecimento,
    frotaListVeiculos,
    frotaListMotoristas,
} from '../../lib/frotaSupabase';
import { gerarRequisicaoAbastecimentoPdf } from '../../lib/requisicaoAbastecimentoPdf';

interface Requisicao {
    id: string;
    empresa_id: string;
    numero: number;
    veiculo_id: string;
    motorista_id: string | null;
    data_emissao: string;
    validade: string | null;
    combustivel: string | null;
    tipo_limite: 'valor' | 'litros' | 'completar';
    litros_autorizados: number | null;
    valor_autorizado: number | null;
    posto: string | null;
    observacao: string | null;
    status: 'aberta' | 'utilizada' | 'cancelada';
    abastecimento_id: string | null;
    placa?: string;
    modelo?: string;
    motorista_nome?: string;
}

interface VeiculoOpt { id: string; placa: string; modelo: string; km_atual?: number; }
interface MotoristaOpt { id: string; nome: string; }

const combustivelOptions = [
    { value: 'gasolina', label: 'Gasolina' },
    { value: 'diesel', label: 'Diesel' },
    { value: 'etanol', label: 'Etanol' },
    { value: 'flex', label: 'Flex' },
    { value: 'gnv', label: 'GNV' },
];

const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const fmtData = (iso: string | null | undefined) =>
    iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

const numeroFmt = (n: number) => `REQ-${String(n).padStart(6, '0')}`;

const hojeISO = () => new Date().toISOString().slice(0, 10);

const limiteLabel = (r: Requisicao) => {
    if (r.tipo_limite === 'valor' && r.valor_autorizado) return formatCurrency(Number(r.valor_autorizado));
    if (r.tipo_limite === 'litros' && r.litros_autorizados) return `${Number(r.litros_autorizados).toLocaleString('pt-BR')} L`;
    return 'Tanque cheio';
};

export const RequisicoesAbastecimentoTab: React.FC<{ onBaixaRealizada?: () => void }> = ({ onBaixaRealizada }) => {
    const { empresaIdEfetivo, dataRevisionEmpresa, frotaOpts, skipUntilGrupoCarrega } = useFrotaEmpresaContext();
    const { showToast } = useToast();

    const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
    const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
    const [motoristas, setMotoristas] = useState<MotoristaOpt[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Modal de emissão
    const [showEmitir, setShowEmitir] = useState(false);
    const [salvandoEmissao, setSalvandoEmissao] = useState(false);
    const [emitirForm, setEmitirForm] = useState({
        veiculo_id: '',
        motorista_id: '',
        combustivel: 'diesel',
        tipo_limite: 'valor' as Requisicao['tipo_limite'],
        valor_autorizado: '',
        litros_autorizados: '',
        posto: '',
        validade: '',
        observacao: '',
        imprimir: true,
    });

    // Modal de baixa (registrar abastecimento da requisição)
    const [reqBaixa, setReqBaixa] = useState<Requisicao | null>(null);
    const [salvandoBaixa, setSalvandoBaixa] = useState(false);
    const [baixaForm, setBaixaForm] = useState({
        data_abastecimento: hojeISO(),
        km_atual: '',
        km_anterior: '',
        litros: '',
        valor_litro: '',
        posto: '',
        nota_fiscal: '',
    });

    // Modal de cancelamento
    const [reqCancelar, setReqCancelar] = useState<Requisicao | null>(null);
    const [cancelando, setCancelando] = useState(false);
    const [imprimindoId, setImprimindoId] = useState<string | null>(null);

    const loadData = async () => {
        if (!empresaIdEfetivo || skipUntilGrupoCarrega) return;
        setLoading(true);
        try {
            const [reqs, veics, mots] = await Promise.all([
                frotaListRequisicoesAbastecimento(empresaIdEfetivo, {}, frotaOpts),
                frotaListVeiculos(empresaIdEfetivo, {}, frotaOpts),
                frotaListMotoristas(empresaIdEfetivo, {}, frotaOpts),
            ]);
            setRequisicoes(reqs as Requisicao[]);
            setVeiculos((veics || []).map((v: any) => ({
                id: v.id, placa: v.placa, modelo: v.modelo, km_atual: Number(v.km_atual || 0),
            })).sort((a: VeiculoOpt, b: VeiculoOpt) => a.placa.localeCompare(b.placa)));
            setMotoristas((mots || []).map((m: any) => ({ id: m.id, nome: m.nome }))
                .sort((a: MotoristaOpt, b: MotoristaOpt) => a.nome.localeCompare(b.nome)));
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Erro ao carregar requisições.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [empresaIdEfetivo, dataRevisionEmpresa, frotaOpts, skipUntilGrupoCarrega]);

    const requisicaoVencida = (r: Requisicao) =>
        r.status === 'aberta' && !!r.validade && r.validade < hojeISO();

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return requisicoes.filter(r => {
            const matchSearch = !term ||
                (r.placa || '').toLowerCase().includes(term) ||
                (r.motorista_nome || '').toLowerCase().includes(term) ||
                (r.posto || '').toLowerCase().includes(term) ||
                numeroFmt(r.numero).toLowerCase().includes(term) ||
                String(r.numero).includes(term);
            const matchStatus = !statusFilter ||
                (statusFilter === 'vencida' ? requisicaoVencida(r) : r.status === statusFilter);
            return matchSearch && matchStatus;
        });
    }, [requisicoes, searchTerm, statusFilter]);

    const stats = useMemo(() => {
        const abertas = requisicoes.filter(r => r.status === 'aberta');
        const mesAtual = hojeISO().slice(0, 7);
        return {
            abertas: abertas.length,
            vencidas: abertas.filter(requisicaoVencida).length,
            valorEmAberto: abertas.reduce((s, r) => s + Number(r.valor_autorizado || 0), 0),
            utilizadasMes: requisicoes.filter(r => r.status === 'utilizada' && (r.data_emissao || '').startsWith(mesAtual)).length,
        };
    }, [requisicoes]);

    const handleOpenEmitir = () => {
        setEmitirForm({
            veiculo_id: '',
            motorista_id: '',
            combustivel: 'diesel',
            tipo_limite: 'valor',
            valor_autorizado: '',
            litros_autorizados: '',
            posto: '',
            validade: '',
            observacao: '',
            imprimir: true,
        });
        setShowEmitir(true);
    };

    const imprimirRequisicao = async (r: Requisicao) => {
        setImprimindoId(r.id);
        try {
            const { data: emp } = await supabase
                .from('empresas')
                .select('nome, razao_social, cnpj')
                .eq('id', r.empresa_id)
                .maybeSingle();
            await gerarRequisicaoAbastecimentoPdf({
                numero: r.numero,
                empresaNome: emp?.razao_social || emp?.nome || 'Empresa',
                empresaCnpj: emp?.cnpj || null,
                dataEmissao: r.data_emissao,
                validade: r.validade,
                veiculoPlaca: r.placa || '—',
                veiculoModelo: r.modelo,
                motoristaNome: r.motorista_nome,
                posto: r.posto,
                combustivel: r.combustivel,
                tipoLimite: r.tipo_limite,
                valorAutorizado: r.valor_autorizado != null ? Number(r.valor_autorizado) : null,
                litrosAutorizados: r.litros_autorizados != null ? Number(r.litros_autorizados) : null,
                observacao: r.observacao,
            });
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Erro ao gerar PDF da requisição.', 'error');
        } finally {
            setImprimindoId(null);
        }
    };

    const handleEmitir = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empresaIdEfetivo) return;
        if (!emitirForm.veiculo_id) {
            showToast('Selecione o veículo.', 'error');
            return;
        }
        if (emitirForm.tipo_limite === 'valor' && !(parseFloat(emitirForm.valor_autorizado) > 0)) {
            showToast('Informe o valor autorizado.', 'error');
            return;
        }
        if (emitirForm.tipo_limite === 'litros' && !(parseFloat(emitirForm.litros_autorizados) > 0)) {
            showToast('Informe a quantidade de litros autorizada.', 'error');
            return;
        }
        setSalvandoEmissao(true);
        try {
            const { id, numero } = await frotaInsertRequisicaoAbastecimento(empresaIdEfetivo, {
                veiculo_id: emitirForm.veiculo_id,
                motorista_id: emitirForm.motorista_id || null,
                combustivel: emitirForm.combustivel || null,
                tipo_limite: emitirForm.tipo_limite,
                valor_autorizado: emitirForm.valor_autorizado,
                litros_autorizados: emitirForm.litros_autorizados,
                posto: emitirForm.posto,
                validade: emitirForm.validade || null,
                observacao: emitirForm.observacao,
            });
            showToast(`Requisição ${numeroFmt(numero)} emitida com sucesso.`, 'success');
            setShowEmitir(false);
            await loadData();
            if (emitirForm.imprimir) {
                const veic = veiculos.find(v => v.id === emitirForm.veiculo_id);
                const mot = motoristas.find(m => m.id === emitirForm.motorista_id);
                await imprimirRequisicao({
                    id,
                    empresa_id: empresaIdEfetivo,
                    numero,
                    veiculo_id: emitirForm.veiculo_id,
                    motorista_id: emitirForm.motorista_id || null,
                    data_emissao: hojeISO(),
                    validade: emitirForm.validade || null,
                    combustivel: emitirForm.combustivel || null,
                    tipo_limite: emitirForm.tipo_limite,
                    litros_autorizados: emitirForm.litros_autorizados ? Number(emitirForm.litros_autorizados) : null,
                    valor_autorizado: emitirForm.valor_autorizado ? Number(emitirForm.valor_autorizado) : null,
                    posto: emitirForm.posto || null,
                    observacao: emitirForm.observacao || null,
                    status: 'aberta',
                    abastecimento_id: null,
                    placa: veic?.placa,
                    modelo: veic?.modelo,
                    motorista_nome: mot?.nome,
                });
            }
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Erro ao emitir requisição.', 'error');
        } finally {
            setSalvandoEmissao(false);
        }
    };

    const handleOpenBaixa = (r: Requisicao) => {
        const veic = veiculos.find(v => v.id === r.veiculo_id);
        setBaixaForm({
            data_abastecimento: hojeISO(),
            km_atual: '',
            km_anterior: veic?.km_atual ? String(veic.km_atual) : '',
            litros: r.litros_autorizados ? String(r.litros_autorizados) : '',
            valor_litro: '',
            posto: r.posto || '',
            nota_fiscal: '',
        });
        setReqBaixa(r);
    };

    const handleBaixar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reqBaixa) return;
        const litros = parseFloat(baixaForm.litros);
        const valorLitro = parseFloat(baixaForm.valor_litro);
        if (!(litros > 0) || !(valorLitro > 0)) {
            showToast('Informe litros e valor por litro do abastecimento realizado.', 'error');
            return;
        }
        setSalvandoBaixa(true);
        try {
            await frotaBaixarRequisicaoAbastecimento(reqBaixa.empresa_id, reqBaixa.id, {
                veiculo_id: reqBaixa.veiculo_id,
                motorista_id: reqBaixa.motorista_id,
                data_abastecimento: baixaForm.data_abastecimento,
                km_atual: baixaForm.km_atual,
                km_anterior: baixaForm.km_anterior || null,
                litros,
                valor_litro: valorLitro,
                combustivel: reqBaixa.combustivel,
                posto: baixaForm.posto,
                nota_fiscal: baixaForm.nota_fiscal,
                observacao: `Requisição ${numeroFmt(reqBaixa.numero)}`,
            });
            showToast(`Requisição ${numeroFmt(reqBaixa.numero)} baixada — abastecimento registrado.`, 'success');
            setReqBaixa(null);
            await loadData();
            onBaixaRealizada?.();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Erro ao baixar requisição.', 'error');
        } finally {
            setSalvandoBaixa(false);
        }
    };

    const handleCancelar = async () => {
        if (!reqCancelar) return;
        setCancelando(true);
        try {
            await frotaCancelarRequisicaoAbastecimento(reqCancelar.empresa_id, reqCancelar.id);
            showToast(`Requisição ${numeroFmt(reqCancelar.numero)} cancelada.`, 'success');
            setReqCancelar(null);
            await loadData();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Erro ao cancelar requisição.', 'error');
        } finally {
            setCancelando(false);
        }
    };

    const statusBadge = (r: Requisicao) => {
        if (r.status === 'utilizada') return <Badge variant="success">Utilizada</Badge>;
        if (r.status === 'cancelada') return <Badge variant="secondary">Cancelada</Badge>;
        if (requisicaoVencida(r)) return <Badge variant="warning">Vencida</Badge>;
        return <Badge variant="info">Em Aberto</Badge>;
    };

    const valorPrevistoBaixa = (() => {
        const l = parseFloat(baixaForm.litros);
        const v = parseFloat(baixaForm.valor_litro);
        return l > 0 && v > 0 ? l * v : 0;
    })();

    const excedeLimite = reqBaixa && (
        (reqBaixa.tipo_limite === 'valor' && reqBaixa.valor_autorizado && valorPrevistoBaixa > Number(reqBaixa.valor_autorizado)) ||
        (reqBaixa.tipo_limite === 'litros' && reqBaixa.litros_autorizados && parseFloat(baixaForm.litros) > Number(reqBaixa.litros_autorizados))
    );

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.abertas}</p>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Em Aberto</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.utilizadasMes}</p>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Utilizadas no Mês</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                            <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.valorEmAberto)}</p>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Valor Autorizado em Aberto</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-50 dark:bg-red-950/30 rounded-lg">
                            <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.vencidas}</p>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Vencidas</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filtros + ação */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                    <Input
                        placeholder="Buscar por número, placa, motorista ou posto..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-52">
                    <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">Status: Todos</option>
                        <option value="aberta">Em Aberto</option>
                        <option value="vencida">Vencidas</option>
                        <option value="utilizada">Utilizadas</option>
                        <option value="cancelada">Canceladas</option>
                    </Select>
                </div>
                <Button onClick={handleOpenEmitir} className="whitespace-nowrap">
                    <Plus className="h-4 w-4 mr-2" /> Emitir Requisição
                </Button>
            </div>

            {/* Tabela */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800">
                                <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wide">Nº</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wide">Emissão / Validade</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wide">Veículo</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wide">Motorista</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wide">Posto</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wide">Limite Autorizado</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wide">Status</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wide">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={8} className="py-10 text-center text-gray-400 dark:text-slate-500">Carregando requisições...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center">
                                        <FileText className="mx-auto h-10 w-10 text-gray-300 dark:text-slate-700 mb-2" />
                                        <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">Nenhuma requisição encontrada</p>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                            Emita uma requisição para autorizar o abastecimento de um veículo.
                                        </p>
                                    </td>
                                </tr>
                            ) : filtered.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="py-3 px-4">
                                        <span className="font-mono font-bold text-gray-900 dark:text-white">{numeroFmt(r.numero)}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <p className="text-gray-700 dark:text-slate-300">{fmtData(r.data_emissao)}</p>
                                        <p className={`text-xs ${requisicaoVencida(r) ? 'text-red-500 font-semibold' : 'text-gray-400 dark:text-slate-500'}`}>
                                            {r.validade ? `Válida até ${fmtData(r.validade)}` : 'Sem validade'}
                                        </p>
                                    </td>
                                    <td className="py-3 px-4">
                                        <p className="font-semibold text-gray-900 dark:text-white">{r.placa || '—'}</p>
                                        <p className="text-xs text-gray-500 dark:text-slate-400">{r.modelo || ''}</p>
                                    </td>
                                    <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{r.motorista_nome || '—'}</td>
                                    <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{r.posto || 'Livre escolha'}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-semibold text-gray-900 dark:text-white">{limiteLabel(r)}</span>
                                        {r.combustivel && (
                                            <p className="text-xs text-gray-400 dark:text-slate-500 capitalize">{r.combustivel}</p>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-center">{statusBadge(r)}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex justify-end gap-1.5">
                                            <Button
                                                size="sm" variant="ghost"
                                                loading={imprimindoId === r.id}
                                                onClick={() => imprimirRequisicao(r)}
                                                className="h-8 px-2.5"
                                                title="Imprimir requisição (2 vias)"
                                            >
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                            {r.status === 'aberta' && (
                                                <>
                                                    <Button
                                                        size="sm" variant="outline"
                                                        onClick={() => handleOpenBaixa(r)}
                                                        className="h-8 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                                        title="Registrar o abastecimento realizado com esta requisição"
                                                    >
                                                        <Fuel className="h-3.5 w-3.5 mr-1" /> Baixar
                                                    </Button>
                                                    <Button
                                                        size="sm" variant="ghost"
                                                        onClick={() => setReqCancelar(r)}
                                                        className="h-8 px-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        title="Cancelar requisição"
                                                    >
                                                        <Ban className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal Emitir */}
            {showEmitir && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !salvandoEmissao) setShowEmitir(false); }}
                >
                    <Card className="w-full max-w-2xl max-h-[92vh] flex flex-col">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl">
                                    <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Emitir Requisição de Abastecimento</h2>
                                    <p className="text-xs text-gray-400 dark:text-slate-500">
                                        O número sequencial é gerado automaticamente pela empresa
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEmitir(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label="Fechar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form id="emitir-req-form" onSubmit={handleEmitir} className="flex-1 overflow-y-auto p-6 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select
                                    label="Veículo *"
                                    required
                                    value={emitirForm.veiculo_id}
                                    onChange={e => setEmitirForm({ ...emitirForm, veiculo_id: e.target.value })}
                                >
                                    <option value="">Selecione o veículo...</option>
                                    {veiculos.map(v => (
                                        <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>
                                    ))}
                                </Select>
                                <Select
                                    label="Motorista"
                                    value={emitirForm.motorista_id}
                                    onChange={e => setEmitirForm({ ...emitirForm, motorista_id: e.target.value })}
                                >
                                    <option value="">Sem motorista definido</option>
                                    {motoristas.map(m => (
                                        <option key={m.id} value={m.id}>{m.nome}</option>
                                    ))}
                                </Select>
                            </div>

                            {/* Tipo de limite — segmentado */}
                            <div>
                                <span className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider ml-1 mb-2">
                                    Limite da Autorização
                                </span>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { value: 'valor', label: 'Por Valor (R$)', icon: DollarSign },
                                        { value: 'litros', label: 'Por Litros', icon: Droplets },
                                        { value: 'completar', label: 'Tanque Cheio', icon: Fuel },
                                    ] as const).map(opt => {
                                        const Icon = opt.icon;
                                        const sel = emitirForm.tipo_limite === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setEmitirForm({ ...emitirForm, tipo_limite: opt.value })}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                                                    sel
                                                        ? 'border-2 border-rose-500 ring-2 ring-rose-500/20 bg-rose-50 dark:bg-rose-950/30 shadow-sm'
                                                        : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950 hover:border-gray-300 dark:hover:border-slate-600'
                                                }`}
                                            >
                                                <Icon className={`h-5 w-5 ${sel ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400 dark:text-slate-500'}`} />
                                                <span className={`text-[11px] font-semibold ${sel ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>
                                                    {opt.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {emitirForm.tipo_limite === 'valor' && (
                                    <Input
                                        label="Valor Autorizado (R$) *"
                                        type="number" step="0.01" min="0.01" required
                                        placeholder="0,00"
                                        value={emitirForm.valor_autorizado}
                                        onChange={e => setEmitirForm({ ...emitirForm, valor_autorizado: e.target.value })}
                                    />
                                )}
                                {emitirForm.tipo_limite === 'litros' && (
                                    <Input
                                        label="Litros Autorizados *"
                                        type="number" step="0.01" min="0.01" required
                                        placeholder="0"
                                        value={emitirForm.litros_autorizados}
                                        onChange={e => setEmitirForm({ ...emitirForm, litros_autorizados: e.target.value })}
                                    />
                                )}
                                <Select
                                    label="Combustível"
                                    value={emitirForm.combustivel}
                                    onChange={e => setEmitirForm({ ...emitirForm, combustivel: e.target.value })}
                                >
                                    {combustivelOptions.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </Select>
                                <Input
                                    label="Válida até"
                                    type="date"
                                    min={hojeISO()}
                                    value={emitirForm.validade}
                                    onChange={e => setEmitirForm({ ...emitirForm, validade: e.target.value })}
                                />
                            </div>

                            <Input
                                label="Posto Credenciado"
                                placeholder="Deixe vazio para livre escolha do posto"
                                value={emitirForm.posto}
                                onChange={e => setEmitirForm({ ...emitirForm, posto: e.target.value })}
                            />

                            <Textarea
                                label="Observações"
                                placeholder="Instruções adicionais para o frentista ou motorista..."
                                value={emitirForm.observacao}
                                onChange={e => setEmitirForm({ ...emitirForm, observacao: e.target.value })}
                            />

                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4 border-gray-300"
                                    checked={emitirForm.imprimir}
                                    onChange={e => setEmitirForm({ ...emitirForm, imprimir: e.target.checked })}
                                />
                                <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Printer className="h-4 w-4 text-gray-400" /> Imprimir requisição após emitir (2 vias)
                                </span>
                            </label>
                        </form>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-800 shrink-0 bg-gray-50/50 dark:bg-slate-800/40">
                            <Button type="button" variant="outline" onClick={() => setShowEmitir(false)} disabled={salvandoEmissao}>
                                Cancelar
                            </Button>
                            <Button type="submit" form="emitir-req-form" loading={salvandoEmissao}>
                                Emitir Requisição
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Modal Baixa */}
            {reqBaixa && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !salvandoBaixa) setReqBaixa(null); }}
                >
                    <Card className="w-full max-w-xl max-h-[92vh] flex flex-col">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                                    <Fuel className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Baixar Requisição {numeroFmt(reqBaixa.numero)}
                                    </h2>
                                    <p className="text-xs text-gray-400 dark:text-slate-500">
                                        {reqBaixa.placa} — {reqBaixa.modelo} · Limite: {limiteLabel(reqBaixa)}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReqBaixa(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label="Fechar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form id="baixa-req-form" onSubmit={handleBaixar} className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Input
                                    label="Data do Abastecimento *"
                                    type="date" required
                                    value={baixaForm.data_abastecimento}
                                    onChange={e => setBaixaForm({ ...baixaForm, data_abastecimento: e.target.value })}
                                />
                                <Input
                                    label="KM Anterior"
                                    type="number" min="0"
                                    value={baixaForm.km_anterior}
                                    onChange={e => setBaixaForm({ ...baixaForm, km_anterior: e.target.value })}
                                />
                                <Input
                                    label="KM Atual *"
                                    type="number" min="0" required
                                    value={baixaForm.km_atual}
                                    onChange={e => setBaixaForm({ ...baixaForm, km_atual: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Input
                                    label="Litros *"
                                    type="number" step="0.01" min="0.01" required
                                    value={baixaForm.litros}
                                    onChange={e => setBaixaForm({ ...baixaForm, litros: e.target.value })}
                                />
                                <Input
                                    label="Valor por Litro (R$) *"
                                    type="number" step="0.001" min="0.01" required
                                    value={baixaForm.valor_litro}
                                    onChange={e => setBaixaForm({ ...baixaForm, valor_litro: e.target.value })}
                                />
                                <div className="w-full space-y-1.5">
                                    <span className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider ml-1">Valor Total</span>
                                    <div className="flex h-11 items-center px-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/60 text-sm font-bold text-gray-900 dark:text-white">
                                        {valorPrevistoBaixa > 0 ? formatCurrency(valorPrevistoBaixa) : '—'}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label="Posto"
                                    value={baixaForm.posto}
                                    onChange={e => setBaixaForm({ ...baixaForm, posto: e.target.value })}
                                />
                                <Input
                                    label="Nota Fiscal"
                                    value={baixaForm.nota_fiscal}
                                    onChange={e => setBaixaForm({ ...baixaForm, nota_fiscal: e.target.value })}
                                />
                            </div>

                            {excedeLimite && (
                                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-lg p-3">
                                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>
                                        O abastecimento informado <strong>excede o limite autorizado</strong> na requisição
                                        ({limiteLabel(reqBaixa)}). Confira os valores antes de confirmar.
                                    </span>
                                </div>
                            )}
                        </form>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-800 shrink-0 bg-gray-50/50 dark:bg-slate-800/40">
                            <Button type="button" variant="outline" onClick={() => setReqBaixa(null)} disabled={salvandoBaixa}>
                                Cancelar
                            </Button>
                            <Button type="submit" form="baixa-req-form" loading={salvandoBaixa} variant="success">
                                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirmar Baixa
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Modal Cancelar */}
            {reqCancelar && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !cancelando) setReqCancelar(null); }}
                >
                    <Card className="w-full max-w-md">
                        <div className="p-6 flex items-start gap-4">
                            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl shrink-0">
                                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                    Cancelar requisição {numeroFmt(reqCancelar.numero)}?
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                                    A requisição do veículo <strong>{reqCancelar.placa}</strong> deixará de valer no posto
                                    e não poderá mais ser baixada. Esta ação não pode ser desfeita.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50/50 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800">
                            <Button variant="outline" onClick={() => setReqCancelar(null)} disabled={cancelando}>
                                Voltar
                            </Button>
                            <Button variant="danger" onClick={handleCancelar} loading={cancelando}>
                                <Ban className="h-4 w-4 mr-1.5" /> Cancelar Requisição
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
