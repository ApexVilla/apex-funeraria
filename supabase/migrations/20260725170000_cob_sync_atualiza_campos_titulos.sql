-- Mantém a carteira de cobrança alinhada com alterações posteriores no financeiro
-- (vencimento/valor do título), sem perder o histórico operacional da pendência.

CREATE OR REPLACE FUNCTION public.fn_cob_carteira_upsert_pendencias_de_titulos(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int := 0;
  n2 int := 0;
BEGIN
  INSERT INTO public.cob_cobrancas_pendentes (
    empresa_id,
    conta_receber_id,
    cliente_id,
    valor_centavos,
    data_vencimento,
    dias_atraso,
    status,
    prioridade,
    tentativas,
    updated_at
  )
  SELECT
    fr.empresa_id,
    fr.id,
    fr.cliente_id,
    fr.valor_aberto_centavos,
    fr.data_vencimento::date,
    GREATEST(0, (CURRENT_DATE - fr.data_vencimento::date))::integer,
    'pendente',
    'media',
    0,
    now()
  FROM public.fin_contas_receber fr
  WHERE fr.empresa_id = p_empresa_id
    AND fr.deleted_at IS NULL
    AND fr.cliente_id IS NOT NULL
    AND fr.valor_aberto_centavos > 0
  ON CONFLICT (empresa_id, conta_receber_id) DO UPDATE
  SET
    cliente_id = EXCLUDED.cliente_id,
    valor_centavos = EXCLUDED.valor_centavos,
    data_vencimento = EXCLUDED.data_vencimento,
    dias_atraso = EXCLUDED.dias_atraso,
    updated_at = now();

  GET DIAGNOSTICS n = ROW_COUNT;

  INSERT INTO public.cob_cobrancas_pendentes (
    empresa_id,
    conta_receber_id,
    cliente_id,
    valor_centavos,
    data_vencimento,
    dias_atraso,
    status,
    prioridade,
    tentativas,
    observacao,
    updated_at
  )
  SELECT
    a.empresa_id,
    NULL,
    a.cliente_id,
    coalesce(a.valor_mensal_centavos, 0),
    coalesce(a.data_primeiro_vencimento, a.data_contratacao, CURRENT_DATE)::date,
    0,
    'pendente',
    'media',
    0,
    'Contrato ' || coalesce(a.codigo, a.id::text),
    now()
  FROM public.assinaturas a
  WHERE a.empresa_id = p_empresa_id
    AND a.deleted_at IS NULL
    AND a.status = 'ativo'
    AND a.cliente_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.cob_cobrancas_pendentes cp
      WHERE cp.empresa_id = a.empresa_id
        AND cp.cliente_id = a.cliente_id
    );

  GET DIAGNOSTICS n2 = ROW_COUNT;
  RETURN n + n2;
END;
$$;

COMMENT ON FUNCTION public.fn_cob_carteira_upsert_pendencias_de_titulos(uuid) IS
  'Sincroniza cob_cobrancas_pendentes com fin_contas_receber em aberto, atualizando vencimento e valor quando o título financeiro muda.';

UPDATE public.cob_cobrancas_pendentes cp
SET
  cliente_id = fr.cliente_id,
  valor_centavos = fr.valor_aberto_centavos,
  data_vencimento = fr.data_vencimento::date,
  dias_atraso = GREATEST(0, (CURRENT_DATE - fr.data_vencimento::date))::integer,
  updated_at = now()
FROM public.fin_contas_receber fr
WHERE cp.conta_receber_id = fr.id
  AND cp.empresa_id = fr.empresa_id
  AND fr.deleted_at IS NULL
  AND fr.cliente_id IS NOT NULL
  AND fr.valor_aberto_centavos > 0;
