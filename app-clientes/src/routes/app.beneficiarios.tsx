import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, ChevronRight, X, Heart, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchBeneficiariosData, addBeneficiario, Beneficiario } from "../lib/api/db";
import { toast } from "sonner";

export const Route = createFileRoute("/app/beneficiarios")({
  component: BeneficiariosPage,
});

function BeneficiariosPage() {
  const [list, setList] = useState<Beneficiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form States
  const [nome, setNome] = useState("");
  const [parentesco, setParentesco] = useState("Cônjuge");
  const [idade, setIdade] = useState("");
  const [ci, setCi] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadBeneficiarios = async () => {
    try {
      const data = await fetchBeneficiariosData();
      setList(data);
    } catch (err) {
      console.error("Erro ao carregar beneficiários:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBeneficiarios();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Por favor, preencha o nome completo.");
      return;
    }
    if (!idade || isNaN(Number(idade)) || Number(idade) <= 0) {
      toast.error("Por favor, preencha uma idade válida.");
      return;
    }

    setSubmitting(true);
    const success = await addBeneficiario({
      nome: nome.trim(),
      parentesco,
      idade: Number(idade),
      ci: ci.trim(),
    });

    setSubmitting(false);

    if (success) {
      toast.success("Beneficiário adicionado ao plano com sucesso!");
      setIsModalOpen(false);
      // Reset form
      setNome("");
      setParentesco("Cônjuge");
      setIdade("");
      setCi("");
      // Reload list
      setLoading(true);
      loadBeneficiarios();
    } else {
      toast.error("Ocorreu um erro ao salvar o beneficiário.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground animate-pulse">
          Carregando beneficiários...
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-safe-page pb-6 relative min-h-screen">
      <header className="flex items-center justify-between">
        <Link
          to="/app"
          className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-card border border-border/20 tap-scale"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-sm font-bold uppercase tracking-wider text-foreground">Beneficiários</h1>
        <div className="h-10 w-10" />
      </header>

      <div className="mt-6 flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl font-black leading-tight tracking-tight text-foreground">
            Sua família
            <br />
            protegida
          </h2>
          <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
            {list.length} {list.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4" /> Novo
        </motion.button>
      </div>

      <div className="mt-6 space-y-3">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-3xl border border-dashed border-border p-6">
            <Heart className="h-10 w-10 text-muted-foreground/60 mb-3" />
            <p className="text-sm font-bold text-foreground">Nenhum familiar cadastrado</p>
            <p className="text-xs text-muted-foreground max-w-[200px] mt-1">
              Adicione beneficiários ao seu plano Fênix para estender a proteção.
            </p>
          </div>
        ) : (
          list.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              whileHover={{ x: 2 }}
              className="flex items-center gap-3.5 rounded-2xl bg-card p-4 shadow-card border border-border/20 tap-scale"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-sm font-bold text-primary-foreground shadow-soft shrink-0">
                {b.iniciais}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{b.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {b.parentesco} · {b.idade} anos {b.ci ? `· CPF: ${b.ci}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success border border-success/20 shrink-0 uppercase tracking-wide">
                Ativo
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </motion.div>
          ))
        )}
      </div>

      {/* Premium Add Beneficiary Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed inset-x-4 bottom-safe-modal z-50 mx-auto max-w-sm rounded-3xl bg-card border border-border/40 p-6 shadow-glow max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border/30">
                <div className="flex items-center gap-2 text-primary">
                  <Heart className="h-5 w-5 fill-current" />
                  <h3 className="text-base font-bold text-foreground">Novo Beneficiário</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/75 uppercase tracking-wide">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Maria Santos Silva"
                    className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/75 uppercase tracking-wide">
                      Parentesco
                    </label>
                    <select
                      value={parentesco}
                      onChange={(e) => setParentesco(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background py-3 px-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      <option>Cônjuge</option>
                      <option>Filho(a)</option>
                      <option>Pai/Mãe</option>
                      <option>Irmão/Irmã</option>
                      <option>Outro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/75 uppercase tracking-wide">
                      Idade (Anos)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="120"
                      value={idade}
                      onChange={(e) => setIdade(e.target.value)}
                      placeholder="Ex: 34"
                      className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/75 uppercase tracking-wide">
                    Documento (CPF)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={ci}
                    onChange={(e) => setCi(e.target.value)}
                    placeholder="Ex: 123.456.789-00"
                    className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 rounded-xl bg-muted py-3.5 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-gradient-primary py-3.5 text-xs font-bold text-primary-foreground shadow-soft hover:shadow-glow transition-all duration-300 disabled:opacity-80"
                  >
                    {submitting ? "Salvando..." : "Confirmar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
