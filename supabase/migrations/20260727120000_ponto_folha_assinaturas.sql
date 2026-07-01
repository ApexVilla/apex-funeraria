-- Assinaturas digitais da folha de ponto (colaborador e gestor/RH)

CREATE TABLE IF NOT EXISTS public.ponto_folha_assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    tipo TEXT NOT NULL CHECK (tipo IN ('colaborador', 'gestor')),
    assinatura_imagem_url TEXT NOT NULL,
    assinado_por UUID NOT NULL REFERENCES auth.users(id),
    assinante_nome TEXT,
    assinante_cargo TEXT,
    assinado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, ano, mes, tipo)
);

CREATE INDEX IF NOT EXISTS idx_ponto_folha_assin_empresa
    ON public.ponto_folha_assinaturas (empresa_id, ano, mes);

CREATE INDEX IF NOT EXISTS idx_ponto_folha_assin_user_periodo
    ON public.ponto_folha_assinaturas (user_id, ano, mes);

ALTER TABLE public.ponto_folha_assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ponto_folha_assin_select ON public.ponto_folha_assinaturas;
CREATE POLICY ponto_folha_assin_select ON public.ponto_folha_assinaturas
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR (
            public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
            AND public.current_user_role() IN (
                'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
                'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
            )
        )
    );

DROP POLICY IF EXISTS ponto_folha_assin_insert ON public.ponto_folha_assinaturas;
CREATE POLICY ponto_folha_assin_insert ON public.ponto_folha_assinaturas
    FOR INSERT TO authenticated
    WITH CHECK (
        public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
        AND (
            (tipo = 'colaborador' AND user_id = auth.uid())
            OR (
                tipo = 'gestor'
                AND public.current_user_role() IN (
                    'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
                    'gerente', 'supervisao', 'gestor', 'diretoria', 'rh'
                )
            )
            OR (
                public.current_user_role() IN (
                    'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
                    'gerente', 'supervisao', 'gestor', 'diretoria', 'rh'
                )
            )
        )
    );

DROP POLICY IF EXISTS ponto_folha_assin_update ON public.ponto_folha_assinaturas;
CREATE POLICY ponto_folha_assin_update ON public.ponto_folha_assinaturas
    FOR UPDATE TO authenticated
    USING (
        public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
        AND (
            (tipo = 'colaborador' AND user_id = auth.uid())
            OR public.current_user_role() IN (
                'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
                'gerente', 'supervisao', 'gestor', 'diretoria', 'rh'
            )
        )
    )
    WITH CHECK (
        public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
    );

COMMENT ON TABLE public.ponto_folha_assinaturas IS
    'Assinaturas digitais da folha de ponto mensal por colaborador (colaborador e gestor/RH).';
