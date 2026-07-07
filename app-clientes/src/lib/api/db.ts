import { supabase, isSupabaseConfigured } from "../supabase";
import { resolveClienteId } from "../resolve-cliente-id";
import { buscarAssinaturaPortal } from "../buscar-assinatura";
import {
  buscarHistoricoPagamentosPortal,
  buscarProximaParcelaPortal,
  formatMesReferencia,
  listarAnosPagamentosPortal,
  parseDateOnly,
} from "../buscar-pagamentos";
import { formatCpfDisplay, resolveClienteEmail } from "../format-cliente";
import {
  cliente as mockCliente,
  plano as mockPlano,
  beneficiarios as mockBeneficiarios,
  pagamentos as mockPagamentos,
} from "../mock-data";

export interface Cliente {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  fotoIniciais: string;
  desde: string;
  city?: string;
}

export interface Plano {
  nome: string;
  numero: string;
  status: string;
  valorMensal: number;
  proximoVencimento: string;
  proximoMesTitulo: string;
  proximoMesReferencia: string;
  proximoParcela?: number | null;
  cobertura: number;
  beneficios: string[];
}

export interface Beneficiario {
  id: string | number;
  nome: string;
  parentesco: string;
  idade: number;
  iniciais: string;
  ci?: string;
}

export interface Pagamento {
  id: string | number;
  mes: string;
  mesReferencia: string;
  anoReferencia: number;
  parcela?: number | null;
  valor: number;
  status: string;
  data: string;
  vencimento?: string;
  metodo?: string;
  codigo?: string;
}

// Cache por sessão: evita refetch (e tela de loading) a cada troca de aba.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearPortalCache(key?: string) {
  if (key) {
    for (const k of cache.keys()) {
      if (k.startsWith(key)) cache.delete(k);
    }
    return;
  }
  cache.clear();
}

const getInitials = (name: string): string => {
  if (!name) return "FN";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export function fetchClienteData(): Promise<Cliente> {
  return cached("cliente", loadClienteData);
}

async function loadClienteData(): Promise<Cliente> {
  if (!isSupabaseConfigured || !supabase) {
    return mockCliente;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {
      nome: "Cliente Fênix",
      cpf: "N/A",
      telefone: "N/A",
      email: "",
      fotoIniciais: "FN",
      desde: "",
    };

    // Try finding by auth link, legacy id match, or email
    let { data: profile, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error || !profile) {
      const resolvedId = await resolveClienteId();
      if (resolvedId) {
        const { data: resolvedProfile, error: resolvedError } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", resolvedId)
          .maybeSingle();

        if (!resolvedError && resolvedProfile) {
          profile = resolvedProfile;
          error = null;
        }
      }
    }

    if ((error || !profile) && user.email) {
      const { data: emailProfile, error: emailError } = await supabase
        .from("clientes")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();
      
      if (!emailError && emailProfile) {
        profile = emailProfile;
      }
    }

    if (error || !profile) {
      return {
        nome: user.user_metadata?.full_name || "Cliente Fênix",
        cpf: user.user_metadata?.ci ? user.user_metadata.ci : "N/A",
        telefone: user.user_metadata?.phone || "N/A",
        email: user.email || "",
        fotoIniciais: getInitials(user.user_metadata?.full_name || user.email || ""),
        desde: new Date(user.created_at).toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        }),
      };
    }

    return {
      nome: profile.nome || "Cliente Fênix",
      cpf: formatCpfDisplay(profile.cpf),
      telefone: profile.celular || profile.whatsapp || "N/A",
      email: resolveClienteEmail(profile.email, user.email),
      fotoIniciais: getInitials(profile.nome),
      desde: new Date(profile.created_at || user.created_at).toLocaleDateString(
        "pt-BR",
        { month: "short", year: "numeric" }
      ),
    };
  } catch (err) {
    console.error("Erro ao buscar dados do cliente do Supabase:", err);
    return {
      nome: "Cliente Fênix",
      cpf: "N/A",
      telefone: "N/A",
      email: "",
      fotoIniciais: "FN",
      desde: "",
    };
  }
}

const defaultBenefits = [
  "Assistência funeral 24h",
  "Translado nacional completo",
  "Preparação e vestimenta",
  "Cerimônia de despedida",
  "Documentação e trâmites legais",
  "Suporte familiar emergencial",
];

function parseBeneficios(raw: unknown): string[] {
  if (!Array.isArray(raw)) return defaultBenefits;

  const items = raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "nome" in item) {
        const benefit = item as { nome?: string; incluido?: boolean };
        if (benefit.incluido === false) return null;
        return benefit.nome?.trim() || null;
      }
      return null;
    })
    .filter((name): name is string => Boolean(name));

  return items.length > 0 ? items : defaultBenefits;
}

function mapAssinaturaStatus(status?: string | null): string {
  const normalized = (status || "").toLowerCase();
  if (["ativo", "active", "approved", "aprovado"].includes(normalized)) return "Ativo";
  if (["pendente", "pending"].includes(normalized)) return "Pendente";
  if (["suspenso", "suspended"].includes(normalized)) return "Suspenso";
  if (["cancelado", "cancelled", "canceled"].includes(normalized)) return "Cancelado";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pendente";
}

function computeProximaParcelaFallback(
  diaVencimento?: number | null,
  dataPrimeiroVencimento?: string | null
) {
  const now = new Date();
  let due: Date | null = null;

  if (diaVencimento && diaVencimento >= 1 && diaVencimento <= 31) {
    due = new Date(now.getFullYear(), now.getMonth(), diaVencimento);
    if (due < now) {
      due = new Date(now.getFullYear(), now.getMonth() + 1, diaVencimento);
    }
  } else if (dataPrimeiroVencimento) {
    due = parseDateOnly(dataPrimeiroVencimento) || new Date(dataPrimeiroVencimento);
  }

  if (!due || Number.isNaN(due.getTime())) {
    return {
      proximoVencimento: "A definir",
      proximoMesTitulo: "Sem referência",
      proximoMesReferencia: "—",
      proximoParcela: null as number | null,
    };
  }

  const isoDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  const referencia = formatMesReferencia(isoDate);

  return {
    proximoVencimento: due.toLocaleDateString("pt-BR"),
    proximoMesTitulo: referencia.titulo,
    proximoMesReferencia: referencia.referencia,
    proximoParcela: null as number | null,
  };
}

function mapProximaParcela(
  proxima: Awaited<ReturnType<typeof buscarProximaParcelaPortal>>,
  assinatura: Awaited<ReturnType<typeof buscarAssinaturaPortal>>
) {
  if (proxima) {
    const referencia = formatMesReferencia(proxima.data_competencia || proxima.data_vencimento);
    const dueDate = parseDateOnly(proxima.data_vencimento);

    return {
      valorMensal:
        (proxima.valor_total_centavos || assinatura?.valor_mensal_centavos || 0) / 100,
      proximoVencimento: dueDate ? dueDate.toLocaleDateString("pt-BR") : "A definir",
      proximoMesTitulo: referencia.titulo,
      proximoMesReferencia: referencia.referencia,
      proximoParcela: proxima.parcela_numero,
    };
  }

  return {
    valorMensal: (assinatura?.valor_mensal_centavos || 0) / 100,
    ...computeProximaParcelaFallback(
      assinatura?.dia_vencimento,
      assinatura?.data_primeiro_vencimento
    ),
  };
}

export function fetchPlanoData(): Promise<Plano> {
  return cached("plano", loadPlanoData);
}

async function loadPlanoData(): Promise<Plano> {
  if (!isSupabaseConfigured || !supabase) {
    return mockPlano;
  }

  const emptyPlan: Plano = {
    nome: "Sem Plano Vinculado",
    numero: "N/A",
    status: "Pendente",
    valorMensal: 0,
    proximoVencimento: "N/A",
    proximoMesTitulo: "Sem referência",
    proximoMesReferencia: "—",
    proximoParcela: null,
    cobertura: 0,
    beneficios: [],
  };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return emptyPlan;

    const assinatura = await buscarAssinaturaPortal();
    if (!assinatura) return emptyPlan;

    const proxima = await buscarProximaParcelaPortal();
    const parcela = mapProximaParcela(proxima, assinatura);

    return {
      nome: assinatura.plano_nome || "Plano Fênix",
      numero: assinatura.codigo || "N/A",
      status: mapAssinaturaStatus(assinatura.status),
      valorMensal: parcela.valorMensal,
      proximoVencimento: parcela.proximoVencimento,
      proximoMesTitulo: parcela.proximoMesTitulo,
      proximoMesReferencia: parcela.proximoMesReferencia,
      proximoParcela: parcela.proximoParcela,
      cobertura: 100,
      beneficios: parseBeneficios(assinatura.beneficios),
    };
  } catch (err) {
    console.error("Erro ao buscar dados do plano do Supabase:", err);
    return emptyPlan;
  }
}

export function fetchBeneficiariosData(): Promise<Beneficiario[]> {
  return cached("beneficiarios", loadBeneficiariosData);
}

async function loadBeneficiariosData(): Promise<Beneficiario[]> {
  if (!isSupabaseConfigured || !supabase) {
    return mockBeneficiarios;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const clienteId = await resolveClienteId();
    if (!clienteId) return [];

    const { data: dbBeneficiarios, error } = await supabase
      .from("beneficiarios")
      .select("*")
      .eq("cliente_id", clienteId);

    if (error || !dbBeneficiarios) {
      return [];
    }

    return dbBeneficiarios.map((b, idx) => {
      const nome = b.nome || "Beneficiário";
      const birthDate = b.data_nascimento ? new Date(b.data_nascimento) : null;
      const age = birthDate ? new Date().getFullYear() - birthDate.getFullYear() : 0;
      return {
        id: b.id,
        nome,
        parentesco: b.parentesco || "Outro",
        idade: age,
        iniciais: getInitials(nome),
        ci: b.cpf || "",
      };
    });
  } catch (err) {
    console.error("Erro ao buscar beneficiários do Supabase:", err);
    return [];
  }
}

function mapPagamentoPortal(p: Awaited<ReturnType<typeof buscarHistoricoPagamentosPortal>>[number]): Pagamento {
  const referenciaBase = p.data_competencia || p.data_vencimento;
  const referencia = formatMesReferencia(referenciaBase);
  const paymentDate = parseDateOnly(p.data_pagamento);
  const dueDate = parseDateOnly(p.data_vencimento);

  return {
    id: p.id,
    mes: referencia.titulo,
    mesReferencia: referencia.referencia,
    anoReferencia: referencia.ano,
    parcela: p.parcela_numero,
    valor: (p.valor_pago_centavos || 0) / 100,
    status: "Pago",
    data: paymentDate ? paymentDate.toLocaleDateString("pt-BR") : "—",
    vencimento: dueDate ? dueDate.toLocaleDateString("pt-BR") : undefined,
    metodo: p.forma_pagamento || undefined,
    codigo: p.codigo || undefined,
  };
}

export function fetchPagamentosAnos(): Promise<number[]> {
  return cached("pagamentos-anos", loadPagamentosAnos);
}

async function loadPagamentosAnos(): Promise<number[]> {
  if (!isSupabaseConfigured || !supabase) {
    const years = new Set((mockPagamentos as Pagamento[]).map((p) => p.anoReferencia));
    return Array.from(years).sort((a, b) => b - a);
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const anos = await listarAnosPagamentosPortal();
    return anos.map((item) => item.ano);
  } catch (err) {
    console.error("Erro ao listar anos de pagamentos:", err);
    return [];
  }
}

export function fetchPagamentosData(ano?: number): Promise<Pagamento[]> {
  return cached(`pagamentos-${ano ?? "atual"}`, () => loadPagamentosData(ano));
}

async function loadPagamentosData(ano?: number): Promise<Pagamento[]> {
  if (!isSupabaseConfigured || !supabase) {
    const targetYear = ano ?? new Date().getFullYear();
    return (mockPagamentos as Pagamento[]).filter((p) => p.anoReferencia === targetYear);
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const targetYear = ano ?? new Date().getFullYear();
    const historico = await buscarHistoricoPagamentosPortal(targetYear);
    if (historico.length === 0) return [];

    return historico.map(mapPagamentoPortal);
  } catch (err) {
    console.error("Erro ao buscar pagamentos do Supabase:", err);
    return [];
  }
}

export async function addBeneficiario(b: Omit<Beneficiario, "id" | "iniciais">): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    const name = b.nome;
    const initials = getInitials(name);
    mockBeneficiarios.push({
      id: Math.floor(Math.random() * 900000) + 100000,
      nome: name,
      parentesco: b.parentesco,
      idade: b.idade,
      iniciais: initials,
      ci: b.ci || "",
    });
    clearPortalCache("beneficiarios");
    return true;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const clienteId = await resolveClienteId();
    if (!clienteId) return false;

    const birthYear = new Date().getFullYear() - Number(b.idade || 0);
    const birthDateStr = `${birthYear}-01-01`;

    const { error: insertError } = await supabase
      .from("beneficiarios")
      .insert({
        cliente_id: clienteId,
        nome: b.nome,
        cpf: b.ci || "",
        parentesco: b.parentesco,
        data_nascimento: birthDateStr,
      });

    if (!insertError) clearPortalCache("beneficiarios");
    return !insertError;
  } catch (err) {
    console.error("Erro ao adicionar beneficiário:", err);
    return false;
  }
}

export async function createPlano(_nome: string, _codigo: string): Promise<boolean> {
  // Contratos reais vêm de assinaturas cadastradas pela Fênix; o portal não cria planos.
  if (!isSupabaseConfigured || !supabase) {
    return true;
  }

  return false;
}
