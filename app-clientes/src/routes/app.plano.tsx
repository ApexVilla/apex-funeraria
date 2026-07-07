import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, Download, Share2 } from "lucide-react";
import { fetchPlanoData, fetchClienteData, Plano, Cliente } from "../lib/api/db";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const Route = createFileRoute("/app/plano")({
  component: PlanoPage,
});

function PlanoPage() {
  const [plano, setPlano] = useState<Plano | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [p, c] = await Promise.all([
          fetchPlanoData(),
          fetchClienteData(),
        ]);
        setPlano(p);
        setCliente(c);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatPrice = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleDownload = async () => {
    const activePlan = plano || {
      numero: "CTR-000000",
      nome: "Plano Fênix",
      status: "Ativo",
      valorMensal: 0,
      beneficios: [],
    };

    const activeClient = cliente || {
      nome: "Cliente Fênix",
      cpf: "N/A",
      email: "Não informado",
      telefone: "Não informado",
      desde: "N/A",
    };

    const contractHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Contrato Fênix - ${activePlan.numero}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: Arial, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .logo {
            font-size: 22px;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 4px;
            font-weight: bold;
          }
          .title {
            font-size: 14px;
            font-weight: bold;
            margin-top: 12px;
            text-transform: uppercase;
          }
          .section {
            margin-bottom: 18px;
          }
          .section-title {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin-bottom: 8px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 20px;
          }
          .field {
            margin-bottom: 4px;
          }
          .label {
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            color: #333;
          }
          .value {
            font-size: 10px;
            font-weight: bold;
          }
          .benefits {
            margin: 0;
            padding-left: 15px;
          }
          .benefits li {
            margin-bottom: 4px;
          }
          .terms {
            font-size: 8px;
            text-align: justify;
            border: 1px solid #000;
            padding: 8px;
            background: #fff;
            margin-top: 10px;
          }
          .signatures {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
          }
          .signature-box {
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 30px;
            padding-top: 4px;
            font-size: 9px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">FÊNIX</div>
          <div class="subtitle">ASSISTÊNCIA FAMILIAR</div>
          <div class="title">CONTRATO OFICIAL DE PRESTAÇÃO DE SERVIÇOS</div>
        </div>

        <div class="section">
          <div class="section-title">Dados do Contrato</div>
          <div class="grid">
            <div class="field">
              <div class="label">Número do Contrato</div>
              <div class="value">${activePlan.numero}</div>
            </div>
            <div class="field">
              <div class="label">Plano Contratado</div>
              <div class="value">${activePlan.nome}</div>
            </div>
            <div class="field">
              <div class="label">Status de Adesão</div>
              <div class="value">${activePlan.status}</div>
            </div>
            <div class="field">
              <div class="label">Valor Mensal</div>
              <div class="value">${formatPrice(activePlan.valorMensal)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Dados do Titular</div>
          <div class="grid">
            <div class="field">
              <div class="label">Nome Completo</div>
              <div class="value">${activeClient.nome}</div>
            </div>
            <div class="field">
              <div class="label">CPF / Documento</div>
              <div class="value">${activeClient.cpf}</div>
            </div>
            <div class="field">
              <div class="label">E-mail</div>
              <div class="value">${activeClient.email}</div>
            </div>
            <div class="field">
              <div class="label">Telefone</div>
              <div class="value">${activeClient.telefone}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Cobertura & Benefícios Inclusos</div>
          <ul class="benefits">
            ${activePlan.beneficios.map((b) => `<li>${b}</li>`).join("")}
          </ul>
        </div>

        <div class="section">
          <div class="section-title">Regulamento e Condições Gerais</div>
          <div class="terms">
            O contratante declara ter plena ciência e concordar integralmente com as condições gerais, prazos de carência e termos de prestação de serviços do plano Fênix Assistência Familiar. Este instrumento representa a totalidade do acordo entre as partes.
          </div>
        </div>

        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line">ASSINATURA DO TITULAR</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">FÊNIX ASSISTÊNCIA FAMILIAR</div>
          </div>
        </div>
      </body>
      </html>
    `;

    // No app Android o WebView não suporta window.print(); gera o arquivo do
    // contrato e abre a folha de compartilhamento do sistema.
    if (Capacitor.isNativePlatform()) {
      try {
        const safeNumero = activePlan.numero.replace(/[^a-zA-Z0-9-]/g, "-");
        const { uri } = await Filesystem.writeFile({
          path: `contrato-fenix-${safeNumero}.html`,
          data: contractHtml,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: `Contrato Fênix ${activePlan.numero}`,
          files: [uri],
        });
      } catch (err) {
        if ((err as Error)?.message?.toLowerCase().includes("cancel")) return;
        console.error("Erro ao compartilhar contrato:", err);
        toast.error("Não foi possível gerar o contrato. Tente novamente.");
      }
      return;
    }

    // Na web, imprime via iframe oculto (permite salvar como PDF).
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "100%";
    frame.style.bottom = "100%";
    frame.srcdoc = contractHtml;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
    toast.success("Contrato gerado! Use a impressão para salvar em PDF.");
  };

  const handleShare = async () => {
    const text = `Contrato Fênix: ${plano?.nome || ""} · Número: ${plano?.numero || ""}`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: "Meu Plano Fênix", text });
      } catch {
        // usuário cancelou o compartilhamento
      }
      return;
    }

    if (navigator.share) {
      navigator.share({ title: "Meu Plano Fênix", text }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Dados do plano copiados para a área de transferência.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground animate-pulse">
          Carregando informações do plano...
        </p>
      </div>
    );
  }

  const activePlan = plano || {
    numero: "CTR-000000",
    nome: "Carregando...",
    status: "Pendente",
    valorMensal: 0,
    proximoVencimento: "N/A",
    proximoMesTitulo: "Sem referência",
    proximoMesReferencia: "—",
    proximoParcela: null,
    beneficios: [],
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
        <h1 className="text-sm font-bold uppercase tracking-wider text-foreground">Meu Plano</h1>
        <button
          onClick={handleShare}
          className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-card border border-border/20 tap-scale"
        >
          <Share2 className="h-4 w-4 text-foreground" />
        </button>
      </header>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow"
      >
        <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">Número do Contrato</p>
        <p className="mt-1 font-mono text-sm tracking-widest opacity-95">{activePlan.numero}</p>
        <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight">{activePlan.nome}</h2>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/20 pt-4 text-[10px] uppercase font-bold tracking-wider">
          <div>
            <p className="opacity-80">Status</p>
            <p className="mt-1 text-xs font-black">{activePlan.status}</p>
          </div>
          <div>
            <p className="opacity-80">Parcela</p>
            <p className="mt-1 text-xs font-black">{formatPrice(activePlan.valorMensal)}</p>
          </div>
          <div>
            <p className="opacity-80">Próxima ref.</p>
            <p className="mt-1 text-xs font-black leading-tight">{activePlan.proximoMesReferencia}</p>
            <p className="mt-0.5 text-[9px] font-semibold opacity-85">Vence {activePlan.proximoVencimento}</p>
          </div>
        </div>
      </motion.div>

      <section className="mt-7">
        <h3 className="mb-3.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Cobertura & Benefícios Inclusos
        </h3>
        <div className="space-y-2">
          {activePlan.beneficios.map((b, i) => (
            <motion.div
              key={b}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-3.5 rounded-2xl bg-card p-3.5 shadow-card border border-border/20"
            >
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold text-foreground">{b}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.button
        onClick={handleDownload}
        whileTap={{ scale: 0.97 }}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary-soft py-4 text-sm font-bold text-primary tap-scale hover:bg-primary/10 transition-colors duration-300"
      >
        <Download className="h-4 w-4" />
        Baixar Contrato Oficial Fênix PDF
      </motion.button>
    </div>
  );
}
