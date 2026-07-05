-- SEGURANÇA: fin_baixar_conta_receber e fin_baixar_conta_pagar são SECURITY DEFINER (bypassam RLS)
-- e recebiam p_conta_receber_id / p_conta_pagar_id sem validar se o título pertence à empresa do
-- usuário autenticado. Qualquer usuário autenticado (de qualquer empresa cliente do sistema) podia
-- chamar essas RPCs via supabase.rpc(...) com o UUID de um título de OUTRA empresa e baixá-lo
-- (marcar como pago, mover saldo de fin_contas_bancarias, gravar fin_movimentacoes) — vazamento e
-- adulteração de dados financeiros entre tenants (IDOR). Corrige adicionando a mesma checagem de
-- tenant já usada em outras RPCs/policies do projeto (rls_empresa_ou_do_mesmo_grupo).
--
-- Recriada a partir da definição LIVE das funções (pg_get_functiondef), não do arquivo de migration
-- local mais antigo — o banco já tinha um refactor (fin_caixa_garantir_sessao_para_data) que não
-- existe nos arquivos locais de supabase/migrations/.

CREATE OR REPLACE FUNCTION public.fin_baixar_conta_receber(
    p_conta_receber_id uuid,
    p_valor_pago_centavos bigint,
    p_forma_pagamento_id uuid DEFAULT NULL::uuid,
    p_conta_bancaria_id uuid DEFAULT NULL::uuid,
    p_valor_desconto_centavos bigint DEFAULT 0,
    p_valor_juros_centavos bigint DEFAULT 0,
    p_valor_multa_centavos bigint DEFAULT 0,
    p_observacoes text DEFAULT NULL::text,
    p_data_pagamento date DEFAULT NULL::date,
    p_usuario_id uuid DEFAULT NULL::uuid,
    p_pix_mesmo_pagador boolean DEFAULT NULL::boolean,
    p_pix_nome_pagador text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_cr RECORD;
    v_baixa_id UUID;
    v_novo_status VARCHAR(20);
    v_total_devido BIGINT;
    v_conta_saldo_id UUID;
    v_sessao_id UUID;
    v_uid UUID;
    v_data DATE;
    v_forma_tipo TEXT;
    v_forma_caixa TEXT;
    v_eh_pix BOOLEAN := false;
    v_obs text;
    v_conta_principal UUID;
    v_caixa_operador UUID;
    v_conta_tipo_sync TEXT;
BEGIN
    IF p_valor_pago_centavos IS NULL OR p_valor_pago_centavos <= 0 THEN
        RAISE EXCEPTION 'Valor pago deve ser maior que zero';
    END IF;

    v_uid  := COALESCE(p_usuario_id, auth.uid());
    v_data := COALESCE(p_data_pagamento, CURRENT_DATE);

    SELECT lower(trim(COALESCE(fp.tipo, fp.nome, ''))) INTO v_forma_tipo
      FROM fin_formas_pagamento fp
     WHERE fp.id = p_forma_pagamento_id;

    v_forma_caixa := COALESCE(
        (SELECT
            CASE lower(trim(COALESCE(fp.tipo, fp.nome, 'dinheiro')))
                WHEN 'dinheiro' THEN 'especie'
                WHEN 'espécie' THEN 'especie'
                WHEN 'especie' THEN 'especie'
                WHEN 'pix' THEN 'pix'
                WHEN 'cartao_credito' THEN 'cartao_credito'
                WHEN 'cartao_debito' THEN 'cartao_debito'
                WHEN 'cheque' THEN 'cheque'
                WHEN 'boleto' THEN 'boleto'
                ELSE lower(trim(COALESCE(fp.tipo, fp.nome, 'dinheiro')))
            END
         FROM fin_formas_pagamento fp
         WHERE fp.id = p_forma_pagamento_id),
        'especie'
    );
    v_eh_pix := (v_forma_caixa = 'pix');

    IF v_eh_pix AND COALESCE(p_pix_mesmo_pagador, true) = false
       AND COALESCE(trim(p_pix_nome_pagador), '') = '' THEN
        RAISE EXCEPTION 'Informe o nome do pagador conforme aparece no comprovante PIX';
    END IF;

    v_obs := p_observacoes;
    IF v_eh_pix AND COALESCE(p_pix_mesmo_pagador, true) = false
       AND COALESCE(trim(p_pix_nome_pagador), '') <> '' THEN
        v_obs := trim(COALESCE(v_obs, '') || CASE WHEN v_obs IS NOT NULL AND trim(v_obs) <> '' THEN ' | ' ELSE '' END
            || 'PIX pagador: ' || trim(p_pix_nome_pagador));
    END IF;

    SELECT * INTO v_cr
      FROM fin_contas_receber
     WHERE id = p_conta_receber_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Titulo a receber % nao encontrado', p_conta_receber_id;
    END IF;
    IF v_cr.status IN ('pago','cancelado') THEN
        RAISE EXCEPTION 'Titulo com status % nao pode ser baixado', v_cr.status;
    END IF;
    IF NOT public.rls_empresa_ou_do_mesmo_grupo(v_cr.empresa_id) THEN
        RAISE EXCEPTION 'Acesso negado a este titulo';
    END IF;

    SELECT id INTO v_conta_principal
      FROM fin_contas_bancarias
     WHERE empresa_id = v_cr.empresa_id AND principal = true AND ativo = true
     ORDER BY created_at
     LIMIT 1;

    SELECT cb.id INTO v_caixa_operador
      FROM fin_contas_bancarias cb
     WHERE cb.empresa_id = v_cr.empresa_id
       AND lower(COALESCE(cb.tipo, '')) = 'caixa'
       AND cb.ativo = true
       AND (
           v_uid IS NULL
           OR cardinality(COALESCE(cb.autorizados_operacao, ARRAY[]::uuid[])) = 0
           OR v_uid = ANY(cb.autorizados_operacao)
       )
     ORDER BY
       CASE WHEN v_uid IS NOT NULL AND cb.autorizados_operacao @> ARRAY[v_uid] THEN 0 ELSE 1 END,
       cb.created_at
     LIMIT 1;

    IF v_forma_tipo IN ('dinheiro', 'especie', 'espécie') THEN
        v_conta_saldo_id := COALESCE(p_conta_bancaria_id, v_caixa_operador, v_conta_principal);
    ELSE
        v_conta_saldo_id := COALESCE(v_conta_principal, p_conta_bancaria_id);
    END IF;

    INSERT INTO fin_contas_receber_baixas (
        empresa_id, conta_receber_id,
        valor_pago_centavos, valor_desconto_centavos,
        valor_juros_centavos, valor_multa_centavos,
        forma_pagamento_id, conta_bancaria_id, observacoes,
        tipo, created_by, data_baixa,
        pix_mesmo_pagador, pix_nome_pagador
    ) VALUES (
        v_cr.empresa_id, p_conta_receber_id,
        p_valor_pago_centavos, p_valor_desconto_centavos,
        p_valor_juros_centavos, p_valor_multa_centavos,
        p_forma_pagamento_id, v_conta_saldo_id, v_obs,
        CASE
            WHEN p_valor_pago_centavos
                 >= (v_cr.valor_original_centavos - v_cr.valor_pago_centavos)
            THEN 'normal' ELSE 'parcial'
        END,
        v_uid,
        v_data,
        CASE WHEN v_eh_pix THEN COALESCE(p_pix_mesmo_pagador, true) ELSE NULL END,
        CASE WHEN v_eh_pix AND COALESCE(p_pix_mesmo_pagador, true) = false
             THEN trim(p_pix_nome_pagador) ELSE NULL END
    ) RETURNING id INTO v_baixa_id;

    UPDATE fin_contas_receber SET
        valor_pago_centavos     = valor_pago_centavos     + p_valor_pago_centavos,
        valor_desconto_centavos = valor_desconto_centavos + p_valor_desconto_centavos,
        valor_juros_centavos    = valor_juros_centavos    + p_valor_juros_centavos,
        valor_multa_centavos    = valor_multa_centavos    + p_valor_multa_centavos,
        updated_by              = v_uid
    WHERE id = p_conta_receber_id;

    SELECT * INTO v_cr FROM fin_contas_receber WHERE id = p_conta_receber_id;

    v_total_devido := v_cr.valor_original_centavos
                    + v_cr.valor_juros_centavos
                    + v_cr.valor_multa_centavos
                    - v_cr.valor_desconto_centavos;

    IF v_cr.valor_pago_centavos >= v_total_devido THEN
        v_novo_status := 'pago';
    ELSE
        v_novo_status := 'pago_parcial';
    END IF;

    UPDATE fin_contas_receber SET
        status              = v_novo_status,
        data_pagamento      = CASE WHEN v_novo_status = 'pago' THEN v_data ELSE data_pagamento END,
        forma_pagamento_id  = COALESCE(p_forma_pagamento_id, forma_pagamento_id),
        conta_bancaria_id   = COALESCE(v_conta_saldo_id, conta_bancaria_id)
    WHERE id = p_conta_receber_id;

    IF v_conta_saldo_id IS NOT NULL THEN
        UPDATE fin_contas_bancarias
           SET saldo_atual_centavos = saldo_atual_centavos + p_valor_pago_centavos
         WHERE id = v_conta_saldo_id;
    END IF;

    INSERT INTO fin_movimentacoes (
        empresa_id, filial_id, codigo, conta_bancaria_id,
        plano_conta_id, centro_custo_id,
        tipo, descricao, valor_centavos,
        data_movimentacao, data_competencia,
        conta_receber_id, conta_receber_baixa_id,
        created_by
    ) VALUES (
        v_cr.empresa_id, v_cr.filial_id,
        'MOV-' || to_char(now(), 'YYYYMMDD-HH24MISS-US'),
        v_conta_saldo_id,
        v_cr.plano_conta_id, v_cr.centro_custo_id,
        'receita',
        'Recebimento: ' || v_cr.codigo || COALESCE(' - ' || v_cr.descricao, ''),
        p_valor_pago_centavos,
        v_data, v_cr.data_competencia,
        p_conta_receber_id, v_baixa_id,
        v_uid
    );

    IF v_conta_saldo_id IS NOT NULL AND v_uid IS NOT NULL THEN
        SELECT lower(COALESCE(tipo, '')) INTO v_conta_tipo_sync
          FROM fin_contas_bancarias
         WHERE id = v_conta_saldo_id;

        IF v_conta_tipo_sync IN ('caixa', 'corrente') THEN
            v_sessao_id := public.fin_caixa_garantir_sessao_para_data(
                v_conta_saldo_id,
                v_cr.empresa_id,
                v_data,
                v_uid,
                'Sessão automática — baixa de conta a receber'
            );

            IF v_sessao_id IS NOT NULL THEN
                PERFORM public.fin_sync_baixas_caixa_sessao(v_sessao_id);
            END IF;
        END IF;
    END IF;

    RETURN v_baixa_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fin_baixar_conta_pagar(
    p_conta_pagar_id uuid,
    p_valor_pago_centavos bigint,
    p_forma_pagamento_id uuid DEFAULT NULL::uuid,
    p_conta_bancaria_id uuid DEFAULT NULL::uuid,
    p_valor_desconto_centavos bigint DEFAULT 0,
    p_valor_juros_centavos bigint DEFAULT 0,
    p_valor_multa_centavos bigint DEFAULT 0,
    p_observacoes text DEFAULT NULL::text,
    p_data_pagamento date DEFAULT NULL::date,
    p_usuario_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_cp RECORD;
    v_baixa_id UUID;
    v_novo_status VARCHAR(20);
    v_total_devido BIGINT;
    v_conta_destino_id UUID;
    v_sessao_id UUID;
    v_uid UUID;
    v_data DATE;
    v_forma_tipo TEXT;
    v_conta_principal UUID;
    v_caixa_operador UUID;
    v_conta_destino_tipo TEXT;
BEGIN
    IF p_valor_pago_centavos IS NULL OR p_valor_pago_centavos <= 0 THEN
        RAISE EXCEPTION 'Valor pago deve ser maior que zero';
    END IF;

    v_uid  := COALESCE(p_usuario_id, auth.uid());
    v_data := COALESCE(p_data_pagamento, CURRENT_DATE);

    SELECT lower(trim(COALESCE(fp.tipo, fp.nome, ''))) INTO v_forma_tipo
      FROM fin_formas_pagamento fp
     WHERE fp.id = p_forma_pagamento_id;

    SELECT * INTO v_cp
      FROM fin_contas_pagar
     WHERE id = p_conta_pagar_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Titulo a pagar % nao encontrado', p_conta_pagar_id;
    END IF;
    IF v_cp.status IN ('pago','cancelado') THEN
        RAISE EXCEPTION 'Titulo com status % nao pode ser baixado', v_cp.status;
    END IF;
    IF NOT public.rls_empresa_ou_do_mesmo_grupo(v_cp.empresa_id) THEN
        RAISE EXCEPTION 'Acesso negado a este titulo';
    END IF;

    SELECT id INTO v_conta_principal
      FROM fin_contas_bancarias
     WHERE empresa_id = v_cp.empresa_id AND principal = true AND ativo = true
     ORDER BY created_at
     LIMIT 1;

    SELECT cb.id INTO v_caixa_operador
      FROM fin_contas_bancarias cb
     WHERE cb.empresa_id = v_cp.empresa_id
       AND lower(COALESCE(cb.tipo, '')) = 'caixa'
       AND cb.ativo = true
       AND (
           v_uid IS NULL
           OR cardinality(COALESCE(cb.autorizados_operacao, ARRAY[]::uuid[])) = 0
           OR v_uid = ANY(cb.autorizados_operacao)
       )
     ORDER BY
       CASE WHEN v_uid IS NOT NULL AND cb.autorizados_operacao @> ARRAY[v_uid] THEN 0 ELSE 1 END,
       cb.created_at
     LIMIT 1;

    IF v_forma_tipo IN ('dinheiro', 'especie', 'espécie') THEN
        v_conta_destino_id := COALESCE(p_conta_bancaria_id, v_caixa_operador, v_conta_principal);
    ELSE
        v_conta_destino_id := COALESCE(v_conta_principal, p_conta_bancaria_id);
    END IF;

    INSERT INTO fin_contas_pagar_baixas (
        empresa_id, conta_pagar_id,
        valor_pago_centavos, valor_desconto_centavos,
        valor_juros_centavos, valor_multa_centavos,
        forma_pagamento_id, conta_bancaria_id, observacoes,
        tipo, created_by, data_baixa
    ) VALUES (
        v_cp.empresa_id, p_conta_pagar_id,
        p_valor_pago_centavos, p_valor_desconto_centavos,
        p_valor_juros_centavos, p_valor_multa_centavos,
        p_forma_pagamento_id, v_conta_destino_id, p_observacoes,
        CASE
            WHEN p_valor_pago_centavos
                 >= (v_cp.valor_original_centavos - v_cp.valor_pago_centavos)
            THEN 'normal' ELSE 'parcial'
        END,
        v_uid,
        v_data
    ) RETURNING id INTO v_baixa_id;

    UPDATE fin_contas_pagar SET
        valor_pago_centavos     = valor_pago_centavos     + p_valor_pago_centavos,
        valor_desconto_centavos = valor_desconto_centavos + p_valor_desconto_centavos,
        valor_juros_centavos    = valor_juros_centavos    + p_valor_juros_centavos,
        valor_multa_centavos    = valor_multa_centavos    + p_valor_multa_centavos,
        updated_by              = v_uid
    WHERE id = p_conta_pagar_id;

    SELECT * INTO v_cp FROM fin_contas_pagar WHERE id = p_conta_pagar_id;

    v_total_devido := v_cp.valor_original_centavos
                    + v_cp.valor_juros_centavos
                    + v_cp.valor_multa_centavos
                    - v_cp.valor_desconto_centavos;

    IF v_cp.valor_pago_centavos >= v_total_devido THEN
        v_novo_status := 'pago';
    ELSE
        v_novo_status := 'pago_parcial';
    END IF;

    UPDATE fin_contas_pagar SET
        status              = v_novo_status,
        data_pagamento      = CASE WHEN v_novo_status = 'pago' THEN v_data ELSE data_pagamento END,
        forma_pagamento_id  = COALESCE(p_forma_pagamento_id, forma_pagamento_id),
        conta_bancaria_id   = COALESCE(v_conta_destino_id, conta_bancaria_id)
    WHERE id = p_conta_pagar_id;

    IF v_conta_destino_id IS NOT NULL THEN
        UPDATE fin_contas_bancarias
           SET saldo_atual_centavos = saldo_atual_centavos - p_valor_pago_centavos
         WHERE id = v_conta_destino_id;
    END IF;

    INSERT INTO fin_movimentacoes (
        empresa_id, filial_id, codigo, conta_bancaria_id,
        plano_conta_id, centro_custo_id,
        tipo, descricao, valor_centavos,
        data_movimentacao, data_competencia,
        conta_pagar_id, conta_pagar_baixa_id,
        created_by
    ) VALUES (
        v_cp.empresa_id, v_cp.filial_id,
        'MOV-' || to_char(now(), 'YYYYMMDD-HH24MISS-US'),
        v_conta_destino_id,
        v_cp.plano_conta_id, v_cp.centro_custo_id,
        'despesa',
        'Pagamento: ' || v_cp.codigo || COALESCE(' - ' || v_cp.descricao, ''),
        p_valor_pago_centavos,
        v_data, v_cp.data_competencia,
        p_conta_pagar_id, v_baixa_id,
        v_uid
    );

    IF v_conta_destino_id IS NOT NULL AND v_uid IS NOT NULL THEN
        SELECT lower(COALESCE(tipo, '')) INTO v_conta_destino_tipo
          FROM fin_contas_bancarias
         WHERE id = v_conta_destino_id;

        IF v_conta_destino_tipo IN ('caixa', 'corrente') THEN
            DELETE FROM fin_caixa_movimentos m
             WHERE m.referencia_tipo = 'fin_contas_pagar'
               AND m.referencia_id = p_conta_pagar_id
               AND m.valor_centavos = p_valor_pago_centavos
               AND m.data_movimentacao IS DISTINCT FROM v_data;

            v_sessao_id := public.fin_caixa_garantir_sessao_para_data(
                v_conta_destino_id,
                v_cp.empresa_id,
                v_data,
                v_uid,
                'Sessão automática — baixa de conta a pagar'
            );

            IF v_sessao_id IS NOT NULL THEN
                PERFORM public.fin_sync_baixas_caixa_pagar_sessao(v_sessao_id);
            END IF;
        ELSIF v_caixa_operador IS NOT NULL THEN
            v_sessao_id := public.fin_caixa_garantir_sessao_para_data(
                v_caixa_operador,
                v_cp.empresa_id,
                v_data,
                v_uid,
                'Sessão automática — baixa de conta a pagar (caixa operador)'
            );

            IF v_sessao_id IS NOT NULL THEN
                PERFORM public.fin_sync_baixas_caixa_pagar_sessao(v_sessao_id);
            END IF;
        END IF;
    END IF;

    RETURN v_baixa_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';
