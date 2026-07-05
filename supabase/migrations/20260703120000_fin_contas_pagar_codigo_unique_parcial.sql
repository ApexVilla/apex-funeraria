-- Corrige colisão ao lançar conta a pagar após exclusão lógica:
-- a constraint UNIQUE (empresa_id, codigo) impedia reutilizar códigos de títulos excluídos,
-- enquanto fn_proximo_codigo_conta_pagar só considerava registros ativos (deleted_at IS NULL).

ALTER TABLE public.fin_contas_pagar
  DROP CONSTRAINT IF EXISTS fin_contas_pagar_empresa_id_codigo_key;

DROP INDEX IF EXISTS public.fin_contas_pagar_empresa_codigo_uq;

CREATE UNIQUE INDEX IF NOT EXISTS fin_contas_pagar_empresa_codigo_uidx
  ON public.fin_contas_pagar (empresa_id, codigo)
  WHERE deleted_at IS NULL;
