-- Auditoria de reimpressões de recibo de cobrador em campo

CREATE TABLE IF NOT EXISTS public.cob_recebimentos_campo_reimpressoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  recebimento_campo_id uuid NOT NULL REFERENCES public.cob_recebimentos_campo(id) ON DELETE CASCADE,
  reimpresso_por uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reimpresso_em timestamptz NOT NULL DEFAULT now(),
  modo text NOT NULL DEFAULT 'termica'
    CHECK (modo IN ('termica', 'pdf', 'navegador')),
  motivo text,
  admin_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cob_rc_reimp_recebimento
  ON public.cob_recebimentos_campo_reimpressoes (recebimento_campo_id, reimpresso_em DESC);

CREATE INDEX IF NOT EXISTS idx_cob_rc_reimp_empresa_data
  ON public.cob_recebimentos_campo_reimpressoes (empresa_id, reimpresso_em DESC);

COMMENT ON TABLE public.cob_recebimentos_campo_reimpressoes IS
  'Log de reimpressões de comprovante térmico de recebimentos em campo (limite cobrador: 7 dias, até 3x).';

ALTER TABLE public.cob_recebimentos_campo_reimpressoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cob_rc_reimp_select ON public.cob_recebimentos_campo_reimpressoes;
CREATE POLICY cob_rc_reimp_select ON public.cob_recebimentos_campo_reimpressoes
  FOR SELECT USING (public.rls_empresa_ou_do_mesmo_grupo(empresa_id));

DROP POLICY IF EXISTS cob_rc_reimp_insert ON public.cob_recebimentos_campo_reimpressoes;
CREATE POLICY cob_rc_reimp_insert ON public.cob_recebimentos_campo_reimpressoes
  FOR INSERT WITH CHECK (public.rls_empresa_ou_do_mesmo_grupo(empresa_id));
