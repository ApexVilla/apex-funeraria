-- Importação AFD / Painel de Presença: liberar financeiro (Natacha) e gestor_executivo (Edna).
-- Erro 403 em ponto_registros e rh_colaborador_detalhes ao gravar batidas do relógio.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  SET LOCAL row_security = off;
  SELECT lower(nullif(trim(COALESCE(u.role, '')), ''))
  INTO v_role
  FROM public.users u
  WHERE u.id = auth.uid()
  LIMIT 1;
  SET LOCAL row_security = on;

  IF v_role IN ('gestor_executivo', 'gestao_executiva') THEN
    RETURN 'diretoria';
  END IF;

  RETURN COALESCE(v_role, '');
END;
$function$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ponto_registros: financeiro e rh podem importar AFD, ajustar e excluir batidas do dia
DROP POLICY IF EXISTS insert_ponto_registros ON public.ponto_registros;
CREATE POLICY insert_ponto_registros ON public.ponto_registros
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND origem = 'app'
    AND public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
  )
  OR (
    public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
    AND origem IN ('ajuste_manual', 'afd')
    AND public.current_user_role() IN (
      'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
      'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
    )
  )
);

DROP POLICY IF EXISTS update_ponto_registros ON public.ponto_registros;
CREATE POLICY update_ponto_registros ON public.ponto_registros
FOR UPDATE
TO authenticated
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

DROP POLICY IF EXISTS delete_ponto_registros ON public.ponto_registros;
CREATE POLICY delete_ponto_registros ON public.ponto_registros
FOR DELETE
TO authenticated
USING (
  public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
  AND public.current_user_role() IN (
    'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
    'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
  )
);

-- rh_colaborador_detalhes: financeiro pode vincular PIS na importação AFD
DROP POLICY IF EXISTS select_rh_colaborador_detalhes ON public.rh_colaborador_detalhes;
CREATE POLICY select_rh_colaborador_detalhes ON public.rh_colaborador_detalhes
FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR (
    public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
    AND public.current_user_role() IN (
      'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
      'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
    )
  )
);

DROP POLICY IF EXISTS insert_rh_colaborador_detalhes ON public.rh_colaborador_detalhes;
CREATE POLICY insert_rh_colaborador_detalhes ON public.rh_colaborador_detalhes
FOR INSERT TO authenticated
WITH CHECK (
  public.rls_empresa_ou_do_mesmo_grupo(empresa_id)
  AND public.current_user_role() IN (
    'admin', 'admin_empresa', 'admin_sistema', 'super_admin',
    'gerente', 'supervisao', 'gestor', 'diretoria', 'financeiro', 'rh'
  )
);

DROP POLICY IF EXISTS update_rh_colaborador_detalhes ON public.rh_colaborador_detalhes;
CREATE POLICY update_rh_colaborador_detalhes ON public.rh_colaborador_detalhes
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

-- Permissões granulares no app (importação AFD / colaboradores RH)
UPDATE public.users u
SET permissoes = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(u.permissoes, '{}'::jsonb),
      '{ponto_espelho}',
      COALESCE(u.permissoes -> 'ponto_espelho', '{}'::jsonb)
        || '{"view": true, "edit": true, "liberado": true, "view_todos": true}'::jsonb,
      true
    ),
    '{rh_colaboradores}',
    COALESCE(u.permissoes -> 'rh_colaboradores', '{}'::jsonb)
      || '{"view": true, "edit": true, "create": true, "delete": false, "liberado": true}'::jsonb,
    true
  ),
  '{ponto}',
  COALESCE(u.permissoes -> 'ponto', '{}'::jsonb)
    || '{"view": true, "edit": true, "create": true, "delete": true, "liberado": true}'::jsonb,
  true
)
WHERE lower(u.email) IN ('natacha@fenixfuneraria.com', 'edna@fenixfuneraria.com');
