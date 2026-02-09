import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Plano,
  Cliente,
  Atendimento,
  AtendimentoService,
  AtendimentoProduct,
  Falecido,
} from '../types';
import {
  mockPlanos,
  mockClientes,
  mockAtendimentos,
  mockFalecidos,
  mockServices,
  mockProducts,
} from './mockData';

const STORAGE_KEYS = {
  planos: 'apex_planos',
  clientes: 'apex_clientes',
  atendimentos: 'apex_atendimentos',
  falecidos: 'apex_falecidos',
} as const;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (e) {
    console.warn(`Erro ao carregar ${key}:`, e);
  }
  return fallback;
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Erro ao salvar ${key}:`, e);
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface DataStoreContextValue {
  // Planos
  planos: Plano[];
  addPlano: (plano: Omit<Plano, 'id' | 'codigo' | 'criadoEm'>) => Plano;
  updatePlano: (id: string, data: Partial<Plano>) => void;
  removePlano: (id: string) => void;
  getPlano: (id: string) => Plano | undefined;

  // Clientes
  clientes: Cliente[];
  addCliente: (cliente: Omit<Cliente, 'id' | 'codigo' | 'criadoEm'>) => Cliente;
  updateCliente: (id: string, data: Partial<Cliente>) => void;
  removeCliente: (id: string) => void;
  getCliente: (id: string) => Cliente | undefined;

  // Atendimentos
  atendimentos: Atendimento[];
  addAtendimento: (data: {
    clientId: string;
    deceasedId?: string;
    serviceDate: string;
    notes?: string;
    services: Array<{ serviceId: string; quantity: number }>;
    products: Array<{ productId: string; quantity: number }>;
  }) => Atendimento;
  updateAtendimento: (id: string, data: Partial<Atendimento>) => void;
  getAtendimento: (id: string) => Atendimento | undefined;

  // Falecidos (read-only para o store, mas podemos adicionar depois)
  falecidos: Falecido[];

  // Catálogos estáticos
  services: typeof mockServices;
  products: typeof mockProducts;
}

const DataStoreContext = createContext<DataStoreContextValue | null>(null);

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error('useDataStore deve ser usado dentro de DataStoreProvider');
  return ctx;
}

function nextCodigo(items: { codigo: string }[], prefix: string): string {
  const nums = items
    .map((i) => parseInt(i.codigo.replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(5, '0')}`;
}

export const DataStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [planos, setPlanos] = useState<Plano[]>(() =>
    loadFromStorage(STORAGE_KEYS.planos, mockPlanos)
  );
  const [clientes, setClientes] = useState<Cliente[]>(() =>
    loadFromStorage(STORAGE_KEYS.clientes, mockClientes)
  );
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>(() =>
    loadFromStorage(STORAGE_KEYS.atendimentos, mockAtendimentos)
  );
  const [falecidos] = useState<Falecido[]>(() =>
    loadFromStorage(STORAGE_KEYS.falecidos, mockFalecidos)
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.planos, planos);
  }, [planos]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.clientes, clientes);
  }, [clientes]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.atendimentos, atendimentos);
  }, [atendimentos]);

  const addPlano = useCallback(
    (data: Omit<Plano, 'id' | 'codigo' | 'criadoEm'>) => {
      const codigo = nextCodigo(planos, 'PLN');
      const novo: Plano = {
        ...data,
        id: generateId('plano'),
        codigo,
        criadoEm: new Date().toISOString().split('T')[0],
      };
      setPlanos((prev) => [...prev, novo]);
      return novo;
    },
    [planos]
  );

  const updatePlano = useCallback((id: string, data: Partial<Plano>) => {
    setPlanos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  }, []);

  const removePlano = useCallback((id: string) => {
    setPlanos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const getPlano = useCallback(
    (id: string) => planos.find((p) => p.id === id),
    [planos]
  );

  const addCliente = useCallback(
    (data: Omit<Cliente, 'id' | 'codigo' | 'criadoEm'>) => {
      const codigo = nextCodigo(clientes, 'CLI');
      const novo: Cliente = {
        ...data,
        id: generateId('cliente'),
        codigo,
        criadoEm: new Date().toISOString().split('T')[0],
      };
      setClientes((prev) => [...prev, novo]);
      return novo;
    },
    [clientes]
  );

  const updateCliente = useCallback((id: string, data: Partial<Cliente>) => {
    setClientes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );
  }, []);

  const removeCliente = useCallback((id: string) => {
    setClientes((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const getCliente = useCallback(
    (id: string) => clientes.find((c) => c.id === id),
    [clientes]
  );

  const addAtendimento = useCallback(
    (data: {
      clientId: string;
      deceasedId?: string;
      serviceDate: string;
      notes?: string;
      services: Array<{ serviceId: string; quantity: number }>;
      products: Array<{ productId: string; quantity: number }>;
    }) => {
      const client = clientes.find((c) => c.id === data.clientId);
      const deceased = data.deceasedId
        ? falecidos.find((f) => f.id === data.deceasedId)
        : undefined;

      const services: AtendimentoService[] = data.services
        .filter((s) => s.serviceId)
        .map((s) => {
          const svc = mockServices.find((x) => x.id === s.serviceId);
          const unitPrice = svc?.basePrice ?? 0;
          const subtotal = unitPrice * s.quantity;
          return {
            id: generateId('svc'),
            attendanceId: '',
            serviceId: s.serviceId,
            serviceName: svc?.name ?? '',
            quantity: s.quantity,
            unitPrice,
            subtotal,
          };
        });

      const products: AtendimentoProduct[] = data.products
        .filter((p) => p.productId)
        .map((p) => {
          const prod = mockProducts.find((x) => x.id === p.productId);
          const unitPrice = prod?.price ?? 0;
          const subtotal = unitPrice * p.quantity;
          return {
            id: generateId('prod'),
            attendanceId: '',
            productId: p.productId,
            productName: prod?.name ?? '',
            quantity: p.quantity,
            unitPrice,
            subtotal,
          };
        });

      const totalValue =
        services.reduce((s, x) => s + x.subtotal, 0) +
        products.reduce((s, x) => s + x.subtotal, 0);

      const codigo = nextCodigo(atendimentos, 'ATD');
      const id = generateId('atd');
      const now = new Date().toISOString().split('T')[0];

      const novo: Atendimento = {
        id,
        codigo,
        clientId: data.clientId,
        clientName: client?.nome ?? '',
        deceasedId: data.deceasedId,
        deceasedName: deceased?.nome,
        userId: '1',
        userName: 'Admin',
        serviceDate: data.serviceDate,
        status: 'aguardando',
        totalValue,
        paidValue: 0,
        notes: data.notes,
        services: services.map((s) => ({ ...s, attendanceId: id })),
        products: products.map((p) => ({ ...p, attendanceId: id })),
        criadoEm: now,
        atualizadoEm: now,
      };

      setAtendimentos((prev) => [...prev, novo]);
      return novo;
    },
    [clientes, falecidos, atendimentos]
  );

  const updateAtendimento = useCallback((id: string, data: Partial<Atendimento>) => {
    setAtendimentos((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, ...data, atualizadoEm: new Date().toISOString().split('T')[0] }
          : a
      )
    );
  }, []);

  const getAtendimento = useCallback(
    (id: string) => atendimentos.find((a) => a.id === id),
    [atendimentos]
  );

  const value: DataStoreContextValue = {
    planos,
    addPlano,
    updatePlano,
    removePlano,
    getPlano,
    clientes,
    addCliente,
    updateCliente,
    removeCliente,
    getCliente,
    atendimentos,
    addAtendimento,
    updateAtendimento,
    getAtendimento,
    falecidos,
    services: mockServices,
    products: mockProducts,
  };

  return (
    <DataStoreContext.Provider value={value}>
      {children}
    </DataStoreContext.Provider>
  );
};
