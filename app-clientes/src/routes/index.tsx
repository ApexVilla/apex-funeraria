import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Logo } from "@/components/Logo";
import { Lock, Mail, ArrowRight, Sparkles, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { buscarClientePortal } from "../lib/buscar-cliente";
import { resolvePortalAuthEmail } from "../lib/portal-auth";
import { signInPortalWithPassword } from "../lib/portal-sign-in";
import { clearPortalCache } from "../lib/api/db";
import { SITE_URL } from "../lib/contato";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fênix Funerária — Seu plano de assistência familiar" },
      {
        name: "description",
        content:
          "Acesse seu portal de assistência familiar Fênix: cobertura, beneficiários, pagamentos e assistência emergencial 24h.",
      },
      { name: "theme-color", content: "#0ea5e9" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");

  // Primeiro acesso / Vincular conta states
  const [isFirstAccessOpen, setIsFirstAccessOpen] = useState(false);
  const [firstAccessStep, setFirstAccessStep] = useState(1);
  const [identifierInput, setIdentifierInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [verifiedProfile, setVerifiedProfile] = useState<{ id: string; email: string; full_name: string; ci: string } | null>(null);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate({ to: "/app" });
        }
      });
    }
  }, [navigate]);

  const openFirstAccess = () => {
    setIdentifierInput("");
    setPasswordInput("");
    setConfirmPasswordInput("");
    setFirstAccessStep(1);
    setVerifiedProfile(null);
    setIsFirstAccessOpen(true);
  };

  const handleVerifyContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const linkingToast = toast.loading("Verificando contrato...");

    if (isSupabaseConfigured && supabase) {
      try {
        const profile = await buscarClientePortal(identifierInput);

        toast.dismiss(linkingToast);

        if (!profile) {
          toast.error("Nenhum contrato localizado com este E-mail ou CPF/CNPJ. Entre em contato com a Fênix.");
          setLoading(false);
          return;
        }

        // Save verified profile details and advance to Step 2
        setVerifiedProfile({
          id: profile.id,
          email: profile.email || "",
          full_name: profile.nome || "Cliente Fênix",
          ci: profile.cpf || "",
        });
        setFirstAccessStep(2);
        toast.success("Contrato localizado! Crie sua senha de acesso.");
      } catch (err) {
        console.error(err);
        toast.dismiss(linkingToast);
        toast.error("Erro de conexão ao verificar o contrato.");
      } finally {
        setLoading(false);
      }
    } else {
      // Mock verification
      toast.dismiss(linkingToast);
      setVerifiedProfile({
        id: "mock-id",
        email: "demo@fenix.com",
        full_name: "Cliente Demonstração",
        ci: "12345678900",
      });
      setFirstAccessStep(2);
      toast.success("Contrato localizado (Modo Demonstração)!");
      setLoading(false);
    }
  };

  const handleFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedProfile) return;

    if (passwordInput !== confirmPasswordInput) {
      toast.error("As senhas não coincidem!");
      return;
    }
    if (passwordInput.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    const accessEmail = resolvePortalAuthEmail(
      verifiedProfile.ci,
      verifiedProfile.email
    );

    setLoading(true);
    const registrationToast = toast.loading("Criando credenciais de acesso...");

    if (isSupabaseConfigured && supabase) {
      const vincularContrato = async (authUserId: string) => {
        const { data: vinculado, error: vincularError } = await supabase!.rpc(
          "vincular_cliente_portal_auth",
          {
            p_cliente_id: verifiedProfile.id,
            p_auth_user_id: authUserId,
          }
        );

        if (vincularError || !vinculado) {
          console.error("Erro ao vincular contrato:", vincularError);
          toast.error(
            "Não foi possível vincular o contrato. Entre em contato com a Fênix."
          );
          return false;
        }

        return true;
      };

      const finalizarAcesso = (hasSession: boolean) => {
        clearPortalCache();
        if (hasSession) {
          toast.success("Acesso vinculado com sucesso!");
          setIsFirstAccessOpen(false);
          setTimeout(() => navigate({ to: "/app" }), 800);
        } else {
          toast.success("Acesso configurado! Faça login com seu CPF/CNPJ e senha.");
          setIsFirstAccessOpen(false);
        }
        setLoading(false);
      };

      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: accessEmail,
          password: passwordInput,
          options: {
            data: {
              full_name: verifiedProfile.full_name,
              ci: verifiedProfile.ci,
              portal_cliente: true,
              cliente_id: verifiedProfile.id,
            },
          },
        });

        toast.dismiss(registrationToast);

        const userAlreadyExists =
          signUpError?.message?.toLowerCase().includes("already registered") ||
          signUpError?.message?.toLowerCase().includes("user already registered");

        if (signUpError && !userAlreadyExists) {
          toast.error(`Erro ao criar acesso: ${signUpError.message}`);
          setLoading(false);
          return;
        }

        let authUserId = signUpData?.user?.id;
        let session = signUpData?.session ?? null;

        if (userAlreadyExists || !authUserId) {
          const { data: signInData, error: signInError } =
            await signInPortalWithPassword(
              verifiedProfile.ci,
              passwordInput,
              verifiedProfile.email
            );

          if (signInError || !signInData || !signInData.user) {
            toast.error(
              signInError?.message ||
                "Este CPF/CNPJ já possui acesso. Use a senha correta ou faça login na tela inicial."
            );
            setLoading(false);
            return;
          }

          authUserId = signInData.user.id;
          session = signInData.session ?? null;
        }

        if (!(await vincularContrato(authUserId))) {
          setLoading(false);
          return;
        }

        finalizarAcesso(!!session);
      } catch (err) {
        console.error(err);
        toast.dismiss(registrationToast);
        toast.error("Erro de conexão ao vincular o contrato.");
        setLoading(false);
      }
    } else {
      // Mock flow
      setTimeout(() => {
        toast.dismiss(registrationToast);
        toast.success("Acesso configurado com sucesso (Modo Demonstração)!");
        setIsFirstAccessOpen(false);
        setLoading(false);
      }, 1200);
    }
  };

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSupabaseConfigured && supabase) {
      try {
        let email = loginInput.trim();
        let clienteEmail: string | null = null;
        let clienteCpf: string | null = null;

        // If login input is not an email, we treat it as Document (CPF, CNPJ) and query clientes table
        if (!email.includes("@")) {
          const loadingToast = toast.loading("Localizando cadastro por Documento...");

          const profile = await buscarClientePortal(email);

          toast.dismiss(loadingToast);

          if (!profile) {
            toast.error("Documento (CPF/CNPJ) não cadastrado no sistema Fênix.");
            setLoading(false);
            return;
          }
          clienteCpf = profile.cpf;
          clienteEmail = profile.email || null;
          email = resolvePortalAuthEmail(profile.cpf, profile.email);
        }

        const authToast = toast.loading("Autenticando...");
        const { error: signInError } = clienteCpf
          ? await signInPortalWithPassword(clienteCpf, password, clienteEmail)
          : await supabase.auth.signInWithPassword({
              email,
              password,
            });

        toast.dismiss(authToast);

        if (signInError) {
          toast.error(`Acesso negado: ${signInError.message}`);
        } else {
          clearPortalCache();
          toast.success("Bem-vindo de volta!");
          setTimeout(() => navigate({ to: "/app" }), 700);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        toast.error("Erro técnico ao conectar com o servidor.");
        setLoading(false);
      }
    } else {
      // Mock login fallback
      toast.success("Portal Fênix acessado em modo de demonstração.");
      setTimeout(() => navigate({ to: "/app" }), 700);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-hero">
      {/* Decorative blobs */}
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 18, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-40 -left-20 h-64 w-64 rounded-full bg-accent/40 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pt-safe-hero pb-safe-page">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={56} />
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-foreground">Fênix</h1>
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
                Assistência Familiar
              </p>
            </div>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mt-14"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card/70 px-3 py-1 text-[11px] font-semibold text-primary shadow-soft">
            <Sparkles className="h-3 w-3" /> Central do Cliente
          </span>
          <h2 className="mt-4 text-[40px] font-black leading-[1.05] tracking-tight text-foreground">
            Cuidado e
            <br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              tranquilidade.
            </span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Acompanhe seu contrato Fênix Funerária, gerencie beneficiários, efetue pagamentos e acione suporte emergencial 24h.
          </p>
        </motion.section>

        <motion.form
          onSubmit={enter}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-auto space-y-3 rounded-3xl bg-card/80 p-5 shadow-card backdrop-blur"
        >
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">E-mail ou Documento (CPF ou CNPJ)</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                autoComplete="username"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Ex: carlos@email.com ou 123.456.789-00"
                className="w-full rounded-2xl border border-border bg-background py-3.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 font-medium"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">Senha de Acesso</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full rounded-2xl border border-border bg-background py-3.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 font-medium"
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            type="submit"
            disabled={loading}
            className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow transition disabled:opacity-80"
          >
            <span className="relative z-10">
              {loading ? "Processando..." : "Entrar no Painel"}
            </span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </motion.button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={openFirstAccess}
              className="font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Primeiro acesso
            </button>
            <a
              href={SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline transition-colors"
            >
              Voltar ao site
            </a>
          </div>
        </motion.form>
      </div>

      {/* Primeiro Acesso Modal */}
      <AnimatePresence>
        {isFirstAccessOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFirstAccessOpen(false)}
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
                  <UserPlus className="h-5 w-5" />
                  <h3 className="text-base font-bold text-foreground">Primeiro Acesso</h3>
                </div>
                <button
                  onClick={() => setIsFirstAccessOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {firstAccessStep === 1 ? (
                <>
                  <p className="mt-3 text-xs text-muted-foreground font-medium leading-relaxed">
                    Passo 1: Informe seu CPF/CNPJ cadastrado para localizarmos seu contrato.
                  </p>

                  <form onSubmit={handleVerifyContract} className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-foreground/75 uppercase tracking-wider">
                        CPF/CNPJ do Titular
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={identifierInput}
                        onChange={(e) => setIdentifierInput(e.target.value)}
                        placeholder="Ex: 123.456.789-00"
                        className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsFirstAccessOpen(false)}
                        className="flex-1 rounded-xl bg-muted py-3.5 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 rounded-xl bg-gradient-primary py-3.5 text-xs font-bold text-primary-foreground shadow-soft hover:shadow-glow transition-all duration-300 disabled:opacity-80"
                      >
                        {loading ? "Verificando..." : "Localizar Contrato"}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <p className="mt-3 text-xs text-muted-foreground font-medium leading-relaxed">
                    Passo 2: Crie sua senha de acesso para o contrato localizado abaixo.
                  </p>

                  <div className="mt-3 rounded-2xl bg-primary/5 border border-primary/10 p-3.5 space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-primary">Contrato Localizado</p>
                    <p className="text-xs font-bold text-foreground line-clamp-1">{verifiedProfile?.full_name}</p>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      CPF/CNPJ: {verifiedProfile?.ci}
                    </p>
                  </div>

                  <form onSubmit={handleFirstAccess} className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-foreground/75 uppercase tracking-wider">
                          Criar Senha
                        </label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          required
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Mín. 6 dígitos"
                          className="w-full rounded-xl border border-border bg-background py-3 px-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-foreground/75 uppercase tracking-wider">
                          Confirmar Senha
                        </label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          required
                          value={confirmPasswordInput}
                          onChange={(e) => setConfirmPasswordInput(e.target.value)}
                          placeholder="Repita a senha"
                          className="w-full rounded-xl border border-border bg-background py-3 px-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setFirstAccessStep(1)}
                        className="flex-1 rounded-xl bg-muted py-3.5 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-colors"
                      >
                        Voltar
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 rounded-xl bg-gradient-primary py-3.5 text-xs font-bold text-primary-foreground shadow-soft hover:shadow-glow transition-all duration-300 disabled:opacity-80"
                      >
                        {loading ? "Cadastrando..." : "Cadastrar Senha"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
