import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, CreditCard, X, QrCode, ClipboardCheck, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { fetchPagamentosAnos, fetchPagamentosData, fetchPlanoData, Pagamento, Plano } from "../lib/api/db";
import { PIX_CHAVE, PIX_DESTINATARIO, LINK_WHATSAPP_COMPROVANTE } from "../lib/contato";
import { toast } from "sonner";

export const Route = createFileRoute("/app/pagamentos")({
  component: PagamentosPage,
});

function PagamentosPage() {
  const [payments, setPayments] = useState<Pagamento[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [plano, setPlano] = useState<Plano | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [years, planObj] = await Promise.all([
          fetchPagamentosAnos(),
          fetchPlanoData(),
        ]);

        const initialYear = years[0] ?? new Date().getFullYear();
        setAvailableYears(years.length > 0 ? years : [initialYear]);
        setSelectedYear(initialYear);
        setPlano(planObj);
      } catch (err) {
        console.error("Erro ao carregar dados financeiros:", err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (loading) return;

    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const payList = await fetchPagamentosData(selectedYear);
        setPayments(payList);
      } catch (err) {
        console.error("Erro ao carregar histórico do ano:", err);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadHistory();
  }, [selectedYear, loading]);

  const currentYearIndex = availableYears.indexOf(selectedYear);
  const canGoPrev = currentYearIndex >= 0 && currentYearIndex < availableYears.length - 1;
  const canGoNext = currentYearIndex > 0;

  const goToPreviousYear = () => {
    if (!canGoPrev) return;
    setSelectedYear(availableYears[currentYearIndex + 1]);
  };

  const goToNextYear = () => {
    if (!canGoNext) return;
    setSelectedYear(availableYears[currentYearIndex - 1]);
  };

  const formatPrice = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground animate-pulse">
          Carregando histórico financeiro...
        </p>
      </div>
    );
  }

  const activePlan = plano || {
    valorMensal: 0,
    proximoVencimento: "N/A",
    proximoMesTitulo: "Sem referência",
    proximoMesReferencia: "—",
    proximoParcela: null,
  };

  return (
    <div className="px-5 pt-safe-page pb-6 relative min-h-screen">
      <header className="flex items-center justify-between">
        <Link
          to="/app"
          className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-card border border-border/20 tap-scale"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-sm font-bold uppercase tracking-wider text-foreground">Pagamentos</h1>
        <div className="h-10 w-10" />
      </header>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 overflow-hidden rounded-3xl bg-card p-5 shadow-card border border-border/20"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Próxima parcela</p>
        <p className="mt-1 text-sm font-bold text-foreground">{activePlan.proximoMesTitulo}</p>
        <p className="text-[11px] text-primary/90 mt-0.5 font-semibold">
          Ref. {activePlan.proximoMesReferencia}
          {activePlan.proximoParcela ? ` · Parcela ${activePlan.proximoParcela}` : ""}
        </p>
        <div className="mt-2 flex items-end justify-between">
          <p className="text-3xl font-black text-foreground">
            {formatPrice(activePlan.valorMensal)}
          </p>
          <span className="rounded-full bg-warning/10 px-3 py-1 text-[10px] font-bold text-warning border border-warning/20 uppercase tracking-wide">
            Vence {activePlan.proximoVencimento}
          </span>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -1 }}
          onClick={() => setIsPayModalOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow transition-all duration-300"
        >
          <CreditCard className="h-4 w-4" /> Pagar Agora
        </motion.button>
      </motion.div>

      <div className="mt-7 mb-3.5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Histórico de Pagamentos
          </h3>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
            12 mensalidades por ano · mês de referência da competência
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-2xl bg-card border border-border/20 p-1 shadow-card">
          <button
            type="button"
            onClick={goToPreviousYear}
            disabled={!canGoPrev || loadingHistory}
            className="grid h-8 w-8 place-items-center rounded-xl text-foreground transition-colors disabled:opacity-30"
            aria-label="Ano anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-[84px] items-center justify-center gap-1.5 px-1">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-black text-foreground">{selectedYear}</span>
          </div>
          <button
            type="button"
            onClick={goToNextYear}
            disabled={!canGoNext || loadingHistory}
            className="grid h-8 w-8 place-items-center rounded-xl text-foreground transition-colors disabled:opacity-30"
            aria-label="Próximo ano"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center py-10 text-center bg-card rounded-2xl border border-border/20 p-4">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
            <p className="mt-3 text-xs font-semibold text-muted-foreground">
              Carregando mensalidades de {selectedYear}...
            </p>
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center bg-card rounded-2xl border border-dashed border-border p-4">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-semibold text-foreground">
              Nenhuma mensalidade paga em {selectedYear}
            </p>
          </div>
        ) : (
          payments.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}
              className="flex items-center gap-3.5 rounded-2xl bg-card p-3.5 shadow-card border border-border/20"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{p.mes}</p>
                <p className="text-[11px] text-primary/90 mt-0.5 font-semibold">
                  Ref. {p.mesReferencia}
                  {p.parcela ? ` · Parcela ${p.parcela}` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {p.status === "Pago"
                    ? `Pago em ${p.data}${p.vencimento ? ` · Venc. ${p.vencimento}` : ""}`
                    : "Aguardando compensação"}
                  {p.metodo ? ` · ${p.metodo}` : ""}
                </p>
              </div>
              <p className="text-sm font-black text-foreground shrink-0">
                {formatPrice(p.valor)}
              </p>
            </motion.div>
          ))
        )}
      </div>

      {/* Premium Payment Modal */}
      <AnimatePresence>
        {isPayModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPayModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed inset-x-4 bottom-safe-modal z-50 mx-auto max-w-sm rounded-3xl bg-card border border-border/40 p-6 shadow-glow overflow-y-auto max-h-[85vh]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border/30">
                <div className="flex items-center gap-2 text-primary">
                  <QrCode className="h-5 w-5" />
                  <h3 className="text-base font-bold text-foreground">Métodos de Pagamento</h3>
                </div>
                <button
                  onClick={() => setIsPayModalOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Escolha um canal para pagamento do plano Fênix. O comprovante deve ser enviado ao suporte.
                </p>

                {/* Option 1: Pix (For BRL users) */}
                <div className="rounded-2xl border border-border/50 bg-background/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary uppercase">Chave PIX (BRL)</span>
                    <button
                      onClick={() => copyToClipboard(PIX_CHAVE, "PIX CNPJ")}
                      className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      <ClipboardCheck className="h-3 w-3" /> Copiar
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-foreground bg-muted p-2 rounded-lg font-mono">
                    {PIX_CHAVE}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Destinatário: {PIX_DESTINATARIO}
                  </p>
                </div>


                <a
                  href={LINK_WHATSAPP_COMPROVANTE}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsPayModalOpen(false)}
                  className="block w-full rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-soft text-center"
                >
                  Enviar Comprovante de Pagamento
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
