-- Atestado/folga/bonificação no espelho: financeiro (Natacha) podia ler mas não gravar ocorrências.

DROP POLICY IF EXISTS insert_ponto_dia_ocorrencias ON public.ponto_dia_ocorrencias;
CREATE POLICY insert_ponto_dia_ocorrencias ON public.ponto_dia_ocorrencias
FOR INSERT TO authenticated
WITH CHECK (
  public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
  AND public.current_user_role() IN (
    'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
    'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
  )
);

DROP POLICY IF EXISTS update_ponto_dia_ocorrencias ON public.ponto_dia_ocorrencias;
CREATE POLICY update_ponto_dia_ocorrencias ON public.ponto_dia_ocorrencias
FOR UPDATE TO authenticated
USING (
  public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
  AND public.current_user_role() IN (
    'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
    'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
  )
)
WITH CHECK (
  public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
  AND public.current_user_role() IN (
    'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
    'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
  )
);

DROP POLICY IF EXISTS delete_ponto_dia_ocorrencias ON public.ponto_dia_ocorrencias;
CREATE POLICY delete_ponto_dia_ocorrencias ON public.ponto_dia_ocorrencias
FOR DELETE TO authenticated
USING (
  public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
  AND public.current_user_role() IN (
    'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
    'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
  )
);
