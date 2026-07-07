import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  LogOut,
  ChevronRight,
  Bell,
  Lock,
  HelpCircle,
  FileText,
  Moon,
  Sun,
} from "lucide-react";
import { fetchClienteData, clearPortalCache, Cliente } from "../lib/api/db";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { TELEFONE_EMERGENCIA } from "../lib/contato";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/perfil")({
  component: PerfilPage,
});

const THEME_STORAGE_KEY = "fenix-portal-theme";
const NOTIFICATIONS_STORAGE_KEY = "fenix-portal-notifications";

function PerfilPage() {
  const navigate = useNavigate();
  const [client, setClient] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const savedNotifications = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const prefersDark = savedTheme === "dark";

    setDarkMode(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
    setNotificationsEnabled(savedNotifications !== "off");
  }, []);

  useEffect(() => {
    async function loadProfile() {
      try {
        const c = await fetchClienteData();
        setClient(c);
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      const logoutToast = toast.loading("Encerrando sessão...");
      await supabase.auth.signOut();
      toast.dismiss(logoutToast);
    }
    clearPortalCache();
    toast.success("Sessão encerrada com sucesso.");
    navigate({ to: "/" });
  };

  const toggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, next ? "on" : "off");
    toast.success(next ? "Notificações ativadas." : "Notificações desativadas.");
  };

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    toast.success(next ? "Modo escuro ativado." : "Modo claro ativado.");
  };

  const handleSupport = () => {
    window.location.href = `tel:${TELEFONE_EMERGENCIA}`;
  };

  const handlePasswordSave = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      toast.info("Alteração de senha disponível após login no portal.");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      toast.error(`Não foi possível alterar a senha: ${error.message}`);
      return;
    }

    setPasswordModalOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Senha atualizada com sucesso.");
  };

  const items = [
    {
      icon: Bell,
      title: notificationsEnabled ? "Notificações ativas" : "Notificações desativadas",
      hint: "Avisos de pagamento e contrato",
      action: toggleNotifications,
    },
    {
      icon: Lock,
      title: "Segurança e senha",
      hint: "Alterar senha de acesso",
      action: () => setPasswordModalOpen(true),
    },
    {
      icon: FileText,
      title: "Documentos e contratos",
      hint: "Ver plano e baixar contrato",
      action: () => navigate({ to: "/app/plano" }),
    },
    {
      icon: darkMode ? Sun : Moon,
      title: darkMode ? "Usar modo claro" : "Usar modo escuro",
      hint: "Alternar aparência do app",
      action: toggleTheme,
    },
    {
      icon: HelpCircle,
      title: "Central de suporte Fênix",
      hint: "Plantão 24h",
      action: handleSupport,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground animate-pulse">
          Carregando dados do perfil...
        </p>
      </div>
    );
  }

  const activeClient = client || {
    nome: "Cliente Fênix",
    desde: "N/A",
    email: "Não informado",
    telefone: "N/A",
    fotoIniciais: "FN",
    cpf: "N/A",
  };

  return (
    <div className="px-5 pt-safe-page pb-6">
      <header className="flex items-center justify-between">
        <Link
          to="/app"
          className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-card border border-border/20 tap-scale"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-sm font-bold uppercase tracking-wider text-foreground">Perfil</h1>
        <div className="h-10 w-10" />
      </header>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 flex flex-col items-center text-center"
      >
        <div className="relative">
          <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-primary text-2xl font-black text-primary-foreground shadow-glow">
            {activeClient.fotoIniciais}
          </div>
          <span className="absolute -bottom-1 -right-1 rounded-full border-4 border-background bg-success px-2 py-0.5 text-[9px] font-bold text-success-foreground uppercase">
            Ativo
          </span>
        </div>
        <h2 className="mt-4 text-xl font-extrabold text-foreground">{activeClient.nome}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cliente associado desde {activeClient.desde}
        </p>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-2xl bg-card p-3 shadow-card border border-border/20 overflow-hidden">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">CPF/CNPJ</p>
          <p className="mt-0.5 text-xs font-bold text-foreground truncate">{activeClient.cpf}</p>
        </div>
        <div className="rounded-2xl bg-card p-3 shadow-card border border-border/20 overflow-hidden">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">E-mail</p>
          <p className="mt-0.5 truncate text-xs font-bold text-foreground">{activeClient.email}</p>
        </div>
        <div className="rounded-2xl bg-card p-3 shadow-card border border-border/20 overflow-hidden">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Telefone</p>
          <p className="mt-0.5 text-xs font-bold text-foreground truncate">{activeClient.telefone}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl bg-card shadow-card border border-border/20">
        {items.map((it, i) => (
          <motion.button
            key={it.title}
            type="button"
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * i }}
            onClick={it.action}
            className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3.5 last:border-0 hover:bg-muted/30 transition-colors"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <it.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <span className="block text-sm font-semibold text-foreground">{it.title}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">{it.hint}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </motion.button>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleLogout}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 py-3.5 text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="h-4 w-4" /> Sair da Conta
      </motion.button>

      <p className="mt-7 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        Fênix Funerária · Central 2.1.0
      </p>

      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para acessar o portal Fênix.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Confirmar senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                placeholder="Repita a nova senha"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setPasswordModalOpen(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePasswordSave}
              disabled={savingPassword}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {savingPassword ? "Salvando..." : "Salvar senha"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
