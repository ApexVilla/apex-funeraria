import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Users,
  CreditCard,
  FileText,
  HeartHandshake,
  ChevronRight,
  Database,
  Sparkles,
} from "lucide-react";
import {
  fetchClienteData,
  fetchPlanoData,
  fetchPagamentosData,
  createPlano,
  Cliente,
  Plano,
  Pagamento,
} from "../lib/api/db";
import { isSupabaseConfigured } from "../lib/supabase";
import { TELEFONE_EMERGENCIA } from "../lib/contato";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

const stagger = {
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
} as const;

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

function Dashboard() {
  const [client, setClient] = useState<Cliente | null>(null);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [pagamentosRecentes, setPagamentosRecentes] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanType, setSelectedPlanType] = useState<"Individual" | "Familiar">("Individual");
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [c, p, pays] = await Promise.all([
          fetchClienteData(),
          fetchPlanoData(),
          fetchPagamentosData(),
        ]);
        setClient(c);
        setPlano(p);
        setPagamentosRecentes(pays.slice(0, 3));
      } catch (err) {
        console.error("Erro ao carregar dados do dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleActivatePlan = async () => {
    setActivating(true);
    const actToast = toast.loading("Ativando seu plano Fênix...");
    
    const randomCode = `F-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const planName = selectedPlanType === "Individual" ? "Plano Fênix Individual" : "Plano Fênix Familiar";
    
    const success = await createPlano(planName, randomCode);
    toast.dismiss(actToast);
    
    if (success) {
      toast.success("Plano ativado com sucesso! Seja bem-vindo à Fênix.");
      try {
        const p = await fetchPlanoData();
        setPlano(p);
      } catch (err) {
        console.error("Erro ao recarregar plano:", err);
      }
    } else {
      toast.error("Erro ao ativar plano no banco de dados. Tente novamente.");
    }
    setActivating(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground animate-pulse">
          Carregando informações...
        </p>
      </div>
    );
  }

  const activeClient = client || { nome: "Cliente", desde: "", fotoIniciais: "FN" };
  const activePlan: Plano = plano || {
    nome: "Nenhum plano ativo",
    numero: "N/A",
    status: "Pendente",
    valorMensal: 0,
    proximoVencimento: "A definir",
    proximoMesTitulo: "Sem referência",
    proximoMesReferencia: "—",
    proximoParcela: null,
    cobertura: 100,
    beneficios: [],
  };

  const formatPrice = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="px-5 pt-safe-page pb-6">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Greeting & Header */}
        <motion.header
          variants={item}
          className="flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">Olá,</p>
              {!isSupabaseConfigured && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
                  <Database className="h-2 w-2" />
                  Demonstração
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground mt-1">
              {activeClient.nome.split(" ")[0]} 👋
            </h1>
          </div>
          <Link
            to="/app/perfil"
            className="relative grid h-11 w-11 place-items-center rounded-2xl bg-card shadow-card tap-scale border border-border/40 overflow-hidden"
            aria-label="Abrir perfil"
          >
            <span className="text-sm font-black text-primary">{activeClient.fotoIniciais}</span>
          </Link>
        </motion.header>

        {/* Plan card or Selection */}
        {activePlan.nome === "Sem Plano Vinculado" ? (
          <motion.div variants={item} className="rounded-3xl bg-card border border-border p-5 shadow-card backdrop-blur relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl pointer-events-none" />

            <div className="relative">
              {isSupabaseConfigured ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[10px] font-bold text-muted-foreground border border-border/40">
                    <ShieldCheck className="h-3 w-3" /> Contrato não encontrado
                  </span>
                  <h2 className="mt-3 text-lg font-black tracking-tight text-foreground">
                    Nenhum plano ativo no portal
                  </h2>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Seu cadastro foi localizado, mas ainda não há contrato ativo vinculado para exibição aqui. Fale com a equipe Fênix para regularizar seu acesso.
                  </p>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary border border-primary/20">
                    <Sparkles className="h-3 w-3" /> Escolha seu Plano Fênix
                  </span>
                  <h2 className="mt-3 text-lg font-black tracking-tight text-foreground">
                    Proteção completa para você e sua família
                  </h2>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Você ainda não possui um plano ativo associado ao seu cadastro. Escolha o melhor plano Fênix abaixo e ative-o instantaneamente.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-muted p-1">
                    {(["Individual", "Familiar"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedPlanType(type)}
                        className={`rounded-xl py-2.5 text-xs font-bold transition-all duration-300 ${
                          selectedPlanType === type
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {type === "Individual" ? "Individual" : "Familiar"}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl bg-muted/50 p-4 border border-border/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-foreground">
                          {selectedPlanType === "Individual" ? "Plano Fênix Individual" : "Plano Fênix Familiar"}
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {selectedPlanType === "Individual" ? "Cobertura completa para o titular" : "Titular + até 5 beneficiários inclusos"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground font-medium block">Mensalidade</span>
                        <span className="text-lg font-black text-foreground">
                          {formatPrice(selectedPlanType === "Individual" ? 10.0 : 15.0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleActivatePlan}
                    disabled={activating}
                    className="mt-4 w-full rounded-2xl bg-gradient-primary py-3.5 text-xs font-bold text-primary-foreground shadow-glow hover:shadow-glow/90 transition-all duration-300 disabled:opacity-85"
                  >
                    {activating ? "Ativando Plano..." : "Ativar Plano Agora"}
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div variants={item}>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute -right-4 -bottom-12 h-32 w-32 rounded-full bg-accent/40 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                    {activePlan.numero !== "N/A" ? activePlan.numero : "Plano Fênix"}
                  </p>
                  <p className="mt-1 text-lg font-extrabold leading-tight">
                    {activePlan.nome}
                  </p>
                </div>
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                  {activePlan.status}
                </span>
              </div>
              <div className="relative mt-6 flex items-end justify-between">
                <div>
                  <p className="text-[10px] opacity-85">Próxima parcela</p>
                  <p className="text-sm font-semibold">{activePlan.proximoMesTitulo}</p>
                  <p className="text-[10px] opacity-80">
                    Ref. {activePlan.proximoMesReferencia}
                    {activePlan.proximoParcela ? ` · Parcela ${activePlan.proximoParcela}` : ""}
                    {" · "}Vence {activePlan.proximoVencimento}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] opacity-85">Valor da parcela</p>
                  <p className="text-xl font-black">{formatPrice(activePlan.valorMensal)}</p>
                </div>
              </div>
              <div className="relative mt-5">
                <div className="flex items-center justify-between text-[10px] font-bold opacity-90">
                  <span>Cobertura contratada</span>
                  <span>{activePlan.cobertura}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${activePlan.cobertura}%` }}
                    transition={{ duration: 1.1, delay: 0.4, ease: "easeOut" }}
                    className="h-full rounded-full bg-white"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick actions */}
        <motion.div variants={item}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ações rápidas
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { label: "Plano", icon: ShieldCheck, to: "/app/plano" },
              { label: "Família", icon: Users, to: "/app/beneficiarios" },
              { label: "Pagar", icon: CreditCard, to: "/app/pagamentos" },
              { label: "Contrato", icon: FileText, to: "/app/plano" },
            ].map((a) => (
              <Link key={a.label} to={a.to} className="tap-scale">
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 shadow-card border border-border/30 hover:border-primary/20 transition-all duration-300">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <a.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold text-foreground">
                    {a.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Help banner */}
        <motion.div variants={item}>
          <a
            href={`tel:${TELEFONE_EMERGENCIA}`}
            className="flex items-center gap-3 rounded-3xl border border-primary/10 bg-card p-4 shadow-card hover:border-primary/25 transition-all duration-300"
          >
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-sm">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                Precisa de apoio agora?
              </p>
              <p className="text-xs text-muted-foreground">
                Nossa equipe de plantão atende 24h por dia.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </a>
        </motion.div>

        {/* Recent activity */}
        <motion.div variants={item} className="pb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Atividade recente
            </h2>
            <Link
              to="/app/pagamentos"
              className="text-xs font-bold text-primary hover:underline"
            >
              Ver histórico
            </Link>
          </div>
          <div className="space-y-2.5">
            {pagamentosRecentes.length === 0 ? (
              <div className="flex items-center gap-3.5 rounded-2xl bg-card p-3.5 shadow-card border border-border/20">
                <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">Nenhum pagamento registrado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Seus pagamentos aparecerão aqui assim que forem confirmados.
                  </p>
                </div>
              </div>
            ) : (
              pagamentosRecentes.map((p) => (
                <Link
                  key={p.id}
                  to="/app/pagamentos"
                  className="flex items-center gap-3.5 rounded-2xl bg-card p-3.5 shadow-card border border-border/20 tap-scale"
                >
                  <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-success" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      Mensalidade de {p.mes}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.status === "Pago" ? `Pago em ${p.data}` : "Aguardando compensação"}
                      {p.metodo ? ` · ${p.metodo}` : ""}
                    </p>
                  </div>
                  <p className="text-xs font-black text-foreground shrink-0">
                    {formatPrice(p.valor)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
