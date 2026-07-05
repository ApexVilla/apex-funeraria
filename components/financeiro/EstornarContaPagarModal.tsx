import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, RefreshCw, Undo2 } from 'lucide-react';
import { Button } from '../ui/Components';
import { ContaPagar, PlanoContaItem } from '../../lib/FinanceiroStore';
import { Combobox } from './Combobox';

interface EstornarContaPagarModalProps {
    conta: ContaPagar;
    onClose: () => void;
    onSuccess: () => void;
    estornarContaPagar: (id: string, motivo: string) => Promise<boolean>;
    updateContaPagar: (id: string, data: Partial<ContaPagar>) => Promise<boolean>;
    planoContas: PlanoContaItem[];
}

export const EstornarContaPagarModal: React.FC<EstornarContaPagarModalProps> = ({
    conta,
    onClose,
    onSuccess,
    estornarContaPagar,
    updateContaPagar,
    planoContas,
}) => {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [motivo, setMotivo] = useState('');
    const [planoContaId, setPlanoContaId] = useState(conta.plano_conta_id || '');

    const planoContasOptions = useMemo(() => {
        return planoContas
            .filter((p) => {
                const t = String(p.tipo || '').toLowerCase();
                const n = String(p.natureza || '').toLowerCase();
                return (
                    Boolean(p.id) &&
                    (t === 'despesa' || n === 'despesa' || t === 'passivo' || n === 'passivo') &&
                    p.aceita_lancamento &&
                    p.ativo !== false
                );
            })
            .sort((a, b) =>
                String(a.codigo ?? '').localeCompare(String(b.codigo ?? ''), undefined, { numeric: true })
            )
            .map((p) => ({
                id: p.id,
                primary: String(p.nome ?? '').trim() || 'Sem nome',
                secondary: p.tipo,
            }));
    }, [planoContas]);

    const planoContasSelecionado = useMemo(() => {
        if (!planoContaId) return null;
        const found = planoContas.find((p) => p.id === planoContaId);
        if (!found) return null;
        return {
            id: found.id,
            primary: String(found.nome ?? '').trim() || 'Sem nome',
            secondary: found.tipo,
        };
    }, [planoContaId, planoContas]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!motivo.trim()) {
            setError('Por favor, informe o motivo do estorno.');
            return;
        }

        if (!planoContaId) {
            setError('Por favor, selecione a natureza financeira.');
            return;
        }

        setSaving(true);
        try {
            // First perform the reversal (estorno)
            const successEstorno = await estornarContaPagar(conta.id, motivo.trim());
            if (!successEstorno) {
                throw new Error('Falha ao processar o estorno da conta.');
            }

            // If the financial nature was modified, update it
            if (planoContaId !== conta.plano_conta_id) {
                const successUpdate = await updateContaPagar(conta.id, {
                    plano_conta_id: planoContaId,
                });
                if (!successUpdate) {
                    throw new Error('Estorno concluído, mas falhou ao atualizar a natureza financeira.');
                }
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao realizar o estorno.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50">
                    <div className="flex items-center gap-3 min-w-0 border-l-4 border-amber-500 pl-3">
                        <div className="min-w-0">
                            <h2 className="text-base font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                <Undo2 className="h-4 w-4" /> Estornar Baixa
                            </h2>
                            <p className="text-xs text-amber-700 mt-0.5">Código do Título: {conta.codigo}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-amber-100 rounded-md transition text-amber-600 hover:text-amber-800"
                        aria-label="Fechar"
                        disabled={saving}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md flex items-center gap-2 text-xs font-semibold">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" /> {error}
                            </div>
                        )}

                        {/* Info banner */}
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2 text-sm text-slate-700">
                            <div className="flex justify-between">
                                <span className="font-medium text-slate-500">Descrição:</span>
                                <span className="font-semibold text-slate-900">{conta.descricao}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium text-slate-500">Valor Original:</span>
                                <span className="font-bold text-slate-900">
                                    R$ {(conta.valor_original_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            {conta.valor_pago_centavos > 0 && (
                                <div className="flex justify-between">
                                    <span className="font-medium text-slate-500">Valor Pago:</span>
                                    <span className="font-bold text-green-700">
                                        R$ {(conta.valor_pago_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Motivo do Estorno */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                Motivo do Estorno *
                            </label>
                            <textarea
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                rows={3}
                                required
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-800 focus:ring-2 focus:ring-slate-100 outline-none resize-none placeholder:text-slate-400"
                                placeholder="Descreva sucintamente o motivo deste estorno..."
                            />
                        </div>

                        {/* Natureza Financeira */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                Natureza Financeira (Plano de Contas) *
                            </label>
                            <Combobox
                                placeholder="Selecione a Natureza Financeira..."
                                items={planoContasOptions}
                                selected={planoContasSelecionado}
                                onSelect={(item) => setPlanoContaId(item ? item.id : '')}
                                loading={false}
                                emptyHint="Nenhuma natureza de despesa encontrada."
                            />
                            <p className="text-[10px] text-slate-500">
                                Permite ajustar a classificação financeira caso tenha ocorrido um erro de lançamento.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={saving}
                            className="h-10 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin" /> Processando...
                                </>
                            ) : (
                                <>Confirmar Estorno</>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
