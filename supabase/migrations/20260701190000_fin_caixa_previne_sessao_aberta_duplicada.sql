-- Rede de segurança: impede 409 em qualquer INSERT/UPDATE que abra sessão duplicada.
-- Também alinha fin_baixar_conta_pagar com fin_caixa_garantir_sessao_para_data.

CREATE OR REPLACE FUNCTION public.fin_caixa_fechar_outras_sessoes_abertas(
    p_conta_bancaria_id uuid,
    p_excluir_sessao_id uuid DEFAULT NULL,
    p_usuario_id uuid DEFAULT NULL,
    p_motivo text DEFAULT 'Auto-fechamento — nova sessão aberta na mesma conta.'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_old RECORD;
    v_saldo bigint;
BEGIN
    IF p_conta_bancaria_id IS NULL THEN
        RETURN;
    END IF;

    FOR v_old IN
        SELECT id
          FROM fin_caixa_sessoes
         WHERE conta_bancaria_id = p_conta_bancaria_id
           AND status = 'aberto'
           AND (p_excluir_sessao_id IS NULL OR id <> p_excluir_sessao_id)
    LOOP
        v_saldo := public.fin_caixa_saldo_fisico_sessao(v_old.id);

        UPDATE fin_caixa_sessoes
           SET status = 'fechado',
               saldo_sistema_centavos = v_saldo,
               saldo_informado_centavos = v_saldo,
               diferenca_centavos = 0,
               data_fechamento = COALESCE(data_fechamento, now()),
               usuario_fechamento_id = COALESCE(usuario_fechamento_id, p_usuario_id),
               observacoes_fechamento = COALESCE(observacoes_fechamento, p_motivo)
         WHERE id = v_old.id
           AND status = 'aberto';
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fin_caixa_prevent_dup_sessao_aberta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    IF NEW.status IS DISTINCT FROM 'aberto' OR NEW.conta_bancaria_id IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM public.fin_caixa_fechar_outras_sessoes_abertas(
        NEW.conta_bancaria_id,
        CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END,
        COALESCE(NEW.usuario_abertura_id, auth.uid()),
        CASE
            WHEN TG_OP = 'INSERT' THEN 'Auto-fechamento — nova sessão aberta na mesma conta.'
            ELSE 'Auto-fechamento — reabertura de sessão na mesma conta.'
        END
    );

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fin_caixa_prevent_dup_sessao_aberta ON public.fin_caixa_sessoes;

CREATE TRIGGER trg_fin_caixa_prevent_dup_sessao_aberta
    BEFORE INSERT OR UPDATE OF status, conta_bancaria_id
    ON public.fin_caixa_sessoes
    FOR EACH ROW
    EXECUTE FUNCTION public.fin_caixa_prevent_dup_sessao_aberta();

-- Refatora garantir_sessao para reutilizar o helper compartilhado.
CREATE OR REPLACE FUNCTION public.fin_caixa_garantir_sessao_para_data(
    p_conta_bancaria_id uuid,
    p_empresa_id uuid,
    p_data date,
    p_usuario_id uuid DEFAULT NULL,
    p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_sessao_id uuid;
    v_hoje date;
    v_obs text;
    v_saldo bigint;
BEGIN
    IF p_conta_bancaria_id IS NULL OR p_empresa_id IS NULL OR p_data IS NULL THEN
        RETURN NULL;
    END IF;

    v_hoje := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
    v_obs := COALESCE(NULLIF(trim(p_observacao), ''), 'Sessão automática — baixa financeira');

    IF p_data = v_hoje THEN
        PERFORM public.fin_caixa_fechar_outras_sessoes_abertas(
            p_conta_bancaria_id,
            NULL,
            p_usuario_id,
            'Fechamento automático ao registrar baixa no dia corrente.'
        );

        SELECT s.id INTO v_sessao_id
          FROM fin_caixa_sessoes s
         WHERE s.conta_bancaria_id = p_conta_bancaria_id
           AND (s.data_abertura AT TIME ZONE 'America/Sao_Paulo')::date = p_data
         ORDER BY
           CASE WHEN s.status = 'aberto' THEN 0 ELSE 1 END,
           s.data_abertura DESC
         LIMIT 1;

        IF v_sessao_id IS NOT NULL THEN
            UPDATE fin_caixa_sessoes
               SET status = 'aberto',
                   data_fechamento = NULL,
                   usuario_fechamento_id = NULL,
                   observacoes_fechamento = NULL,
                   saldo_informado_centavos = NULL,
                   diferenca_centavos = NULL
             WHERE id = v_sessao_id
               AND status = 'fechado';

            v_saldo := public.fin_caixa_saldo_fisico_sessao(v_sessao_id);

            UPDATE fin_caixa_sessoes
               SET saldo_sistema_centavos = v_saldo
             WHERE id = v_sessao_id;

            RETURN v_sessao_id;
        END IF;

        INSERT INTO fin_caixa_sessoes (
            empresa_id, conta_bancaria_id,
            usuario_abertura_id,
            status, saldo_abertura_centavos, saldo_sistema_centavos,
            data_abertura,
            observacoes_abertura
        ) VALUES (
            p_empresa_id,
            p_conta_bancaria_id,
            p_usuario_id,
            'aberto',
            0,
            0,
            (p_data::timestamp AT TIME ZONE 'America/Sao_Paulo'),
            v_obs
        )
        RETURNING id INTO v_sessao_id;

        RETURN v_sessao_id;
    END IF;

    SELECT s.id INTO v_sessao_id
      FROM fin_caixa_sessoes s
     WHERE s.conta_bancaria_id = p_conta_bancaria_id
       AND (s.data_abertura AT TIME ZONE 'America/Sao_Paulo')::date = p_data
     ORDER BY s.data_abertura DESC
     LIMIT 1;

    IF v_sessao_id IS NOT NULL THEN
        RETURN v_sessao_id;
    END IF;

    INSERT INTO fin_caixa_sessoes (
        empresa_id, conta_bancaria_id,
        usuario_abertura_id, usuario_fechamento_id,
        status, saldo_abertura_centavos, saldo_sistema_centavos,
        data_abertura, data_fechamento,
        observacoes_abertura, observacoes_fechamento
    ) VALUES (
        p_empresa_id,
        p_conta_bancaria_id,
        p_usuario_id,
        p_usuario_id,
        'fechado',
        0,
        0,
        (p_data::timestamp AT TIME ZONE 'America/Sao_Paulo'),
        (p_data::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '12 hours',
        v_obs,
        'Sessão retroativa — baixa financeira'
    )
    RETURNING id INTO v_sessao_id;

    RETURN v_sessao_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fin_caixa_fechar_outras_sessoes_abertas(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fin_caixa_garantir_sessao_para_data(uuid, uuid, date, uuid, text) TO authenticated;

-- fin_baixar_conta_pagar: garante sessão na conta destino (caixa/corrente), como receber.
CREATE OR REPLACE FUNCTION public.fin_baixar_conta_pagar(
    p_conta_pagar_id uuid,
    p_valor_pago_centavos bigint,
    p_forma_pagamento_id uuid DEFAULT NULL,
    p_conta_bancaria_id uuid DEFAULT NULL,
    p_valor_desconto_centavos bigint DEFAULT 0,
    p_valor_juros_centavos bigint DEFAULT 0,
    p_valor_multa_centavos bigint DEFAULT 0,
    p_observacoes text DEFAULT NULL,
    p_data_pagamento date DEFAULT NULL,
    p_usuario_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.fin_baixar_conta_pagar(
    uuid, bigint, uuid, uuid, bigint, bigint, bigint, text, date, uuid
) TO authenticated;

NOTIFY pgrst, 'reload schema';
