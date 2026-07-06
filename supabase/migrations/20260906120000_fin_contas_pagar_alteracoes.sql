-- Histórico de alterações em contas a pagar (edição de título em aberto).

ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.fin_contas_pagar_alteracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    conta_pagar_id UUID NOT NULL REFERENCES public.fin_contas_pagar(id) ON DELETE CASCADE,
    campo_alterado TEXT NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    motivo TEXT,
    usuario_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_cp_alteracoes_conta
    ON public.fin_contas_pagar_alteracoes (conta_pagar_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fin_cp_alteracoes_empresa
    ON public.fin_contas_pagar_alteracoes (empresa_id, created_at DESC);

COMMENT ON TABLE public.fin_contas_pagar_alteracoes IS
    'Registro de alterações manuais em títulos de contas a pagar (competência, vencimento, valor, etc.).';

ALTER TABLE public.fin_contas_pagar_alteracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_contas_pagar_alteracoes_staff_all_grupo ON public.fin_contas_pagar_alteracoes;
CREATE POLICY fin_contas_pagar_alteracoes_staff_all_grupo
    ON public.fin_contas_pagar_alteracoes
    FOR ALL TO authenticated
    USING (
        public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
    )
    WITH CHECK (
        public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
    );
