-- Mensalidades: 1 por mês/contrato, dia de vencimento estável, competência = vencimento.

-- 1) Remove duplicatas no mesmo mês de vencimento (mantém a "melhor" parcela)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        assinatura_id,
        make_date(
          EXTRACT(YEAR FROM data_vencimento)::integer,
          EXTRACT(MONTH FROM data_vencimento)::integer,
          1
        )
      ORDER BY
        CASE
          WHEN status = 'pago' THEN 0
          WHEN status = 'pago_parcial' THEN 1
          WHEN status IN ('aberto', 'vencido') THEN 2
          ELSE 3
        END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.fin_contas_receber
  WHERE deleted_at IS NULL
    AND tipo_documento = 'mensalidade'
    AND assinatura_id IS NOT NULL
)
UPDATE public.fin_contas_receber cr
SET deleted_at = NOW()
FROM ranked r
WHERE cr.id = r.id
  AND r.rn > 1;

-- 2) Alinha competência ao vencimento (mesmo mês/dia)
UPDATE public.fin_contas_receber
SET data_competencia = data_vencimento
WHERE deleted_at IS NULL
  AND tipo_documento = 'mensalidade'
  AND data_competencia IS NOT NULL
  AND date_trunc('month', data_competencia) <> date_trunc('month', data_vencimento);

-- 3) Índice único parcial: não permite duas mensalidades ativas no mesmo mês da assinatura
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_cr_mensalidade_assinatura_mes
ON public.fin_contas_receber (
  assinatura_id,
  (make_date(
    EXTRACT(YEAR FROM COALESCE(data_competencia, data_vencimento))::integer,
    EXTRACT(MONTH FROM COALESCE(data_competencia, data_vencimento))::integer,
    1
  ))
)
WHERE deleted_at IS NULL
  AND tipo_documento = 'mensalidade'
  AND assinatura_id IS NOT NULL;

-- 4) Avanço mensal com dia fixo (clamp no último dia do mês — evita pular fev com dia 29–31)
CREATE OR REPLACE FUNCTION public.fn_avancar_vencimento_mensal(p_base date, p_dia integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_prox date;
  v_dia integer;
  v_ultimo integer;
BEGIN
  v_prox := (date_trunc('month', p_base) + INTERVAL '1 month')::date;
  v_dia := GREATEST(1, LEAST(COALESCE(p_dia, EXTRACT(DAY FROM p_base)::integer), 31));
  v_ultimo := EXTRACT(DAY FROM (date_trunc('month', v_prox) + INTERVAL '1 month - 1 day'))::integer;
  RETURN make_date(
    EXTRACT(YEAR FROM v_prox)::integer,
    EXTRACT(MONTH FROM v_prox)::integer,
    LEAST(v_dia, v_ultimo)
  );
END;
$fn$;

-- 5) Regenera fn_gerar_mensalidades com dia estável + skip se o mês já existir
CREATE OR REPLACE FUNCTION public.fn_gerar_mensalidades(p_assinatura_id uuid, p_meses integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_assinatura RECORD;
    v_plano RECORD;
    v_data_vencimento DATE;
    v_ultimo_venc DATE;
    v_ultima_parcela INTEGER;
    v_codigo_base TEXT;
    i INTEGER;
    v_count INTEGER := 0;
    v_status TEXT;
    v_parcela_num INTEGER;
    v_dia INTEGER;
    v_mes_ocupado BOOLEAN;
BEGIN
    SELECT * INTO v_assinatura FROM assinaturas WHERE id = p_assinatura_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assinatura não encontrada';
    END IF;

    IF COALESCE(v_assinatura.em_inercia, false) THEN
        RETURN 0;
    END IF;

    SELECT * INTO v_plano FROM planos WHERE id = v_assinatura.plano_id;

    v_dia := GREATEST(1, LEAST(COALESCE(v_assinatura.dia_vencimento, 5), 31));

    SELECT MAX(cr.data_vencimento), MAX(cr.parcela_numero)
    INTO v_ultimo_venc, v_ultima_parcela
    FROM fin_contas_receber cr
    WHERE cr.assinatura_id = p_assinatura_id
      AND cr.deleted_at IS NULL
      AND cr.tipo_documento = 'mensalidade';

    IF v_ultimo_venc IS NOT NULL THEN
        v_data_vencimento := public.fn_avancar_vencimento_mensal(v_ultimo_venc, v_dia);
        v_parcela_num := COALESCE(v_ultima_parcela, 0);
    ELSE
        v_data_vencimento := COALESCE(v_assinatura.data_primeiro_vencimento, CURRENT_DATE);
        -- Normaliza o 1º vencimento para o dia fixo do mês correspondente
        v_data_vencimento := make_date(
          EXTRACT(YEAR FROM v_data_vencimento)::integer,
          EXTRACT(MONTH FROM v_data_vencimento)::integer,
          LEAST(
            v_dia,
            EXTRACT(DAY FROM (date_trunc('month', v_data_vencimento) + INTERVAL '1 month - 1 day'))::integer
          )
        );
        v_parcela_num := 0;
    END IF;

    FOR i IN 1..GREATEST(1, LEAST(COALESCE(p_meses, 12), 36)) LOOP
        SELECT EXISTS (
          SELECT 1
          FROM fin_contas_receber cr
          WHERE cr.assinatura_id = p_assinatura_id
            AND cr.deleted_at IS NULL
            AND cr.tipo_documento = 'mensalidade'
            AND date_trunc('month', COALESCE(cr.data_competencia, cr.data_vencimento))
                = date_trunc('month', v_data_vencimento)
        ) INTO v_mes_ocupado;

        IF v_mes_ocupado THEN
            -- Mês já existe (buraco preenchido manualmente): avança sem inserir
            v_data_vencimento := public.fn_avancar_vencimento_mensal(v_data_vencimento, v_dia);
            CONTINUE;
        END IF;

        v_parcela_num := v_parcela_num + 1;
        v_codigo_base := fn_fin_novo_codigo_cr();

        v_status := CASE
            WHEN v_data_vencimento < CURRENT_DATE THEN 'vencido'
            ELSE 'aberto'
        END;

        INSERT INTO fin_contas_receber (
            empresa_id,
            filial_id,
            codigo,
            cliente_id,
            assinatura_id,
            tipo_documento,
            descricao,
            valor_original_centavos,
            valor_juros_centavos,
            valor_multa_centavos,
            valor_desconto_centavos,
            valor_pago_centavos,
            data_emissao,
            data_vencimento,
            data_competencia,
            status,
            parcela_numero,
            total_parcelas,
            created_at
        ) VALUES (
            v_assinatura.empresa_id,
            v_assinatura.filial_id,
            v_codigo_base,
            v_assinatura.cliente_id,
            p_assinatura_id,
            'mensalidade',
            'Mensalidade ' || v_parcela_num || ' - ' || COALESCE(v_plano.nome, 'Plano Associativo'),
            v_assinatura.valor_mensal_centavos,
            0,
            0,
            0,
            0,
            CURRENT_DATE,
            v_data_vencimento,
            v_data_vencimento, -- competência = mesmo mês/dia do vencimento
            v_status,
            v_parcela_num,
            NULL,
            NOW()
        );

        v_data_vencimento := public.fn_avancar_vencimento_mensal(v_data_vencimento, v_dia);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$function$;
