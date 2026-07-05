import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Search, RefreshCw } from 'lucide-react';
import { normalizeSearchText } from '../../lib/textUtils';

export interface ComboItem {
    id: string;
    primary: string;
    secondary?: string;
}

export interface ComboboxProps {
    placeholder: string;
    items: ComboItem[];
    selected: ComboItem | null;
    onSelect: (item: ComboItem | null) => void;
    loading?: boolean;
    emptyHint?: React.ReactNode;
    permitirLimpar?: boolean;
    icone?: React.ReactNode;
}

export const Combobox: React.FC<ComboboxProps> = ({
    placeholder,
    items,
    selected,
    onSelect,
    loading,
    emptyHint,
    permitirLimpar = true,
    icone,
}) => {
    const [open, setOpen] = useState(false);
    const [busca, setBusca] = useState('');
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = useMemo(() => {
        const t = normalizeSearchText(busca);
        if (!t) return items;
        return items.filter(
            (it) =>
                normalizeSearchText(it.primary).includes(t) ||
                normalizeSearchText(it.secondary).includes(t)
        );
    }, [items, busca]);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full h-10 flex items-center justify-between gap-2 px-3 border border-slate-200 rounded-md bg-white text-sm hover:border-slate-300 transition focus:border-slate-800 focus:ring-2 focus:ring-slate-100 outline-none"
            >
                <span className="truncate text-left flex items-center gap-2 min-w-0">
                    {icone && <span className="text-gray-400 shrink-0">{icone}</span>}
                    {selected ? (
                        <span className="min-w-0 truncate">
                            <span className="font-semibold text-gray-900">{selected.primary}</span>
                            {selected.secondary && (
                                <span className="text-gray-500 ml-2 text-xs">{selected.secondary}</span>
                            )}
                        </span>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            </button>
            {open && (
                <div className="absolute left-0 right-0 mt-1 z-35 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                    <div className="px-2 py-2 border-b border-gray-100 flex items-center gap-2">
                        <Search className="h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            autoFocus
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Pesquisar…"
                            className="flex-1 text-sm outline-none bg-transparent"
                        />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {permitirLimpar && selected && (
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect(null);
                                    setOpen(false);
                                    setBusca('');
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 border-b border-amber-100 font-semibold"
                            >
                                ✕ Limpar seleção
                            </button>
                        )}
                        {loading ? (
                            <div className="px-3 py-6 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin" /> Carregando…
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="px-3 py-6 text-center text-sm text-gray-500">
                                {busca.trim() ? 'Nenhum resultado.' : emptyHint || 'Nenhum item disponível.'}
                            </div>
                        ) : (
                            filtered.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        onSelect(item);
                                        setOpen(false);
                                        setBusca('');
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm transition ${
                                        selected?.id === item.id
                                            ? 'bg-slate-100 font-semibold text-slate-900'
                                            : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <div className="font-medium truncate">{item.primary}</div>
                                    {item.secondary && (
                                        <div className="text-xs text-slate-400 truncate">{item.secondary}</div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
