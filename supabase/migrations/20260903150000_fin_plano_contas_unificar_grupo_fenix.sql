-- Unifica as naturezas financeiras (fin_plano_contas) do grupo Fênix.
-- Estratégia conservadora:
-- 1) monta um conjunto canônico por código usando prioridade
--    Aparecida > Ipameri > Catalão;
-- 2) replica códigos ausentes para todas as empresas do grupo;
-- 3) padroniza automaticamente apenas contas sem uso histórico
--    (nem nelas nem nos descendentes), preservando lançamentos antigos.

DO $$
DECLARE
    v_grupo_fenix_id uuid;
    v_empresa RECORD;
    v_conta RECORD;
    v_pai_id uuid;
    v_uso_subarvore bigint;
    v_inseridos integer := 0;
    v_atualizados integer := 0;
    v_preservados integer := 0;
BEGIN
    SELECT eg.id
    INTO v_grupo_fenix_id
    FROM public.empresa_grupos eg
    WHERE eg.slug = 'fenix'
    LIMIT 1;

    IF v_grupo_fenix_id IS NULL THEN
        RAISE NOTICE 'Grupo Fênix não encontrado; migration ignorada.';
        RETURN;
    END IF;

    CREATE TEMP TABLE tmp_fenix_empresas ON COMMIT DROP AS
    SELECT
        e.id,
        COALESCE(NULLIF(trim(e.nome), ''), NULLIF(trim(e.razao_social), ''), 'Empresa') AS nome
    FROM public.empresas e
    WHERE e.grupo_empresa_id = v_grupo_fenix_id;

    IF NOT EXISTS (SELECT 1 FROM tmp_fenix_empresas) THEN
        RAISE NOTICE 'Nenhuma empresa vinculada ao grupo Fênix; migration ignorada.';
        RETURN;
    END IF;

    CREATE TEMP TABLE tmp_fenix_uso_conta ON COMMIT DROP AS
    SELECT
        pc.id,
        (
            SELECT COUNT(*)
            FROM public.fin_contas_pagar cp
            WHERE cp.plano_conta_id = pc.id
        ) +
        (
            SELECT COUNT(*)
            FROM public.fin_contas_receber cr
            WHERE cr.plano_conta_id = pc.id
        ) AS total_uso
    FROM public.fin_plano_contas pc
    INNER JOIN tmp_fenix_empresas fe
        ON fe.id = pc.empresa_id;

    CREATE TEMP TABLE tmp_fenix_plano_canonico ON COMMIT DROP AS
    WITH ranked AS (
        SELECT
            pc.codigo,
            pc.nome,
            pc.tipo,
            pc.natureza,
            pc.nivel,
            COALESCE(
                pai.codigo,
                NULLIF(regexp_replace(pc.codigo, '\.[^.]+$', ''), pc.codigo)
            ) AS pai_codigo,
            pc.aceita_lancamento,
            pc.conta_sistema,
            pc.ativo,
            ROW_NUMBER() OVER (
                PARTITION BY pc.codigo
                ORDER BY
                    CASE
                        WHEN lower(fe.nome) LIKE '%aparecida%' THEN 1
                        WHEN lower(fe.nome) LIKE '%ipameri%' THEN 2
                        WHEN lower(fe.nome) LIKE '%catalao%' OR lower(fe.nome) LIKE '%catalão%' THEN 3
                        ELSE 9
                    END,
                    CASE WHEN COALESCE(pc.ativo, true) THEN 0 ELSE 1 END,
                    pc.updated_at DESC,
                    pc.created_at DESC,
                    pc.id
            ) AS rn
        FROM public.fin_plano_contas pc
        INNER JOIN tmp_fenix_empresas fe
            ON fe.id = pc.empresa_id
        LEFT JOIN public.fin_plano_contas pai
            ON pai.id = pc.pai_id
    )
    SELECT
        codigo,
        nome,
        tipo,
        natureza,
        nivel,
        pai_codigo,
        aceita_lancamento,
        conta_sistema,
        ativo
    FROM ranked
    WHERE rn = 1;

    FOR v_empresa IN
        SELECT *
        FROM tmp_fenix_empresas
        ORDER BY nome
    LOOP
        FOR v_conta IN
            SELECT *
            FROM tmp_fenix_plano_canonico
            ORDER BY nivel, codigo
        LOOP
            v_pai_id := NULL;

            IF v_conta.pai_codigo IS NOT NULL THEN
                SELECT pc.id
                INTO v_pai_id
                FROM public.fin_plano_contas pc
                WHERE pc.empresa_id = v_empresa.id
                  AND pc.codigo = v_conta.pai_codigo
                LIMIT 1;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM public.fin_plano_contas pc
                WHERE pc.empresa_id = v_empresa.id
                  AND pc.codigo = v_conta.codigo
            ) THEN
                INSERT INTO public.fin_plano_contas (
                    empresa_id,
                    codigo,
                    nome,
                    tipo,
                    natureza,
                    nivel,
                    pai_id,
                    aceita_lancamento,
                    conta_sistema,
                    ativo
                ) VALUES (
                    v_empresa.id,
                    v_conta.codigo,
                    v_conta.nome,
                    v_conta.tipo,
                    v_conta.natureza,
                    v_conta.nivel,
                    v_pai_id,
                    v_conta.aceita_lancamento,
                    v_conta.conta_sistema,
                    v_conta.ativo
                );

                v_inseridos := v_inseridos + 1;
                CONTINUE;
            END IF;

            SELECT COALESCE(SUM(COALESCE(u.total_uso, 0)), 0)
            INTO v_uso_subarvore
            FROM public.fin_plano_contas pc
            LEFT JOIN tmp_fenix_uso_conta u
                ON u.id = pc.id
            WHERE pc.empresa_id = v_empresa.id
              AND (
                  pc.codigo = v_conta.codigo
                  OR pc.codigo LIKE v_conta.codigo || '.%'
              );

            IF COALESCE(v_uso_subarvore, 0) > 0 THEN
                v_preservados := v_preservados + 1;
                CONTINUE;
            END IF;

            UPDATE public.fin_plano_contas pc
            SET
                nome = v_conta.nome,
                tipo = v_conta.tipo,
                natureza = v_conta.natureza,
                nivel = v_conta.nivel,
                pai_id = v_pai_id,
                aceita_lancamento = v_conta.aceita_lancamento,
                conta_sistema = v_conta.conta_sistema,
                ativo = v_conta.ativo,
                updated_at = now()
            WHERE pc.empresa_id = v_empresa.id
              AND pc.codigo = v_conta.codigo
              AND (
                  pc.nome IS DISTINCT FROM v_conta.nome
                  OR pc.tipo IS DISTINCT FROM v_conta.tipo
                  OR pc.natureza IS DISTINCT FROM v_conta.natureza
                  OR pc.nivel IS DISTINCT FROM v_conta.nivel
                  OR pc.pai_id IS DISTINCT FROM v_pai_id
                  OR pc.aceita_lancamento IS DISTINCT FROM v_conta.aceita_lancamento
                  OR pc.conta_sistema IS DISTINCT FROM v_conta.conta_sistema
                  OR pc.ativo IS DISTINCT FROM v_conta.ativo
              );

            IF FOUND THEN
                v_atualizados := v_atualizados + 1;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Grupo Fênix / plano de contas unificado. Inseridos: %, atualizados sem uso: %, preservados por histórico: %.',
        v_inseridos, v_atualizados, v_preservados;
END $$;
