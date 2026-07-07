import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Home, ShieldCheck, Users, CreditCard, User, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { TELEFONE_EMERGENCIA } from "../lib/contato";

import { ForwardRefExoticComponent, RefAttributes } from "react";
import type { LucideProps } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  exact?: boolean;
}

const nav: NavItem[] = [
  { to: "/app", label: "Início", icon: Home, exact: true },
  { to: "/app/plano", label: "Plano", icon: ShieldCheck },
  { to: "/app/beneficiarios", label: "Família", icon: Users },
  { to: "/app/pagamentos", label: "Pagar", icon: CreditCard },
  { to: "/app/perfil", label: "Perfil", icon: User },
];

function navIsActive(item: NavItem, pathname: string) {
  const current = pathname.replace(/\/$/, "") || "/";
  const target = item.to.replace(/\/$/, "") || "/";

  if (item.exact) {
    return current === target;
  }

  return current === target || current.startsWith(`${target}/`);
}

export function AppShell() {
  const loc = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          navigate({ to: "/" });
        }
      });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-soft pb-safe-shell">
      <div className="mx-auto max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              duration: 0.28,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Emergency 24h floating button */}
      <motion.a
        href={`tel:${TELEFONE_EMERGENCIA}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 220, damping: 18 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-safe-fab left-5 z-40 flex items-center gap-2 rounded-full bg-destructive px-5 py-3.5 text-destructive-foreground shadow-glow animate-pulse-ring-destructive"
      >
        <Phone className="h-4 w-4 fill-current" />
        <span className="text-xs font-bold tracking-wide">Emergência 24h</span>
      </motion.a>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 px-3 pb-safe-nav">
        <div className="glass flex items-center justify-between rounded-3xl border border-border/60 px-2 py-2 shadow-card">
          {nav.map((item) => {
            const active = navIsActive(item, loc.pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 tap-scale"
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-2xl bg-gradient-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                )}
                <motion.div
                  animate={active ? { scale: [1, 1.15, 1], y: -1 } : { scale: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative z-10 flex flex-col items-center"
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      active ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-semibold transition-colors mt-0.5 tracking-wide",
                      active ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
