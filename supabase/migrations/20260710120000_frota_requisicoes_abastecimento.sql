-- Frota: requisições de abastecimento emitidas pela empresa.
-- Fluxo: empresa emite a requisição (voucher numerado) -> motorista abastece no posto
-- -> requisição é baixada gerando o registro em frota_abastecimentos.

CREATE TABLE IF NOT EXISTS public.frota_requisicoes_abastecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  numero bigint NOT NULL,
  veiculo_id uuid NOT NULL REFERENCES public.frota_veiculos(id),
  motorista_id uuid REFERENCES public.frota_motoristas(id),
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  validade date,
  combustivel text CHECK (combustivel IN ('gasolina', 'diesel', 'etanol', 'flex', 'gnv')),
  -- Limite autorizado: por valor (R$), por litros ou tanque cheio ("completar")
  tipo_limite text NOT NULL DEFAULT 'valor' CHECK (tipo_limite IN ('valor', 'litros', 'completar')),
  litros_autorizados numeric CHECK (litros_autorizados IS NULL OR litros_autorizados > 0),
  valor_autorizado numeric CHECK (valor_autorizado IS NULL OR valor_autorizado > 0),
  posto text,
  observacao text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'utilizada', 'cancelada')),
  abastecimento_id uuid REFERENCES public.frota_abastecimentos(id),
  criado_por uuid,
  utilizada_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT frota_req_abast_numero_unico UNIQUE (empresa_id, numero),
  -- Limite coerente com o tipo escolhido
  CONSTRAINT frota_req_abast_limite_coerente CHECK (
    (tipo_limite = 'valor' AND valor_autorizado IS NOT NULL)
    OR (tipo_limite = 'litros' AND litros_autorizados IS NOT NULL)
    OR (tipo_limite = 'completar')
  )
);

CREATE INDEX IF NOT EXISTS idx_frota_req_abast_empresa_status
  ON public.frota_requisicoes_abastecimento (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_frota_req_abast_empresa_emissao
  ON public.frota_requisicoes_abastecimento (empresa_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_frota_req_abast_veiculo
  ON public.frota_requisicoes_abastecimento (veiculo_id);

-- Numeração sequencial por empresa (advisory lock evita corrida em emissões simultâneas).
CREATE OR REPLACE FUNCTION public.fn_frota_req_abastecimento_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero <= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('frota_req_abast_' || NEW.empresa_id::text));
    SELECT COALESCE(MAX(numero), 0) + 1
      INTO NEW.numero
      FROM public.frota_requisicoes_abastecimento
     WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_frota_req_abast_numero ON public.frota_requisicoes_abastecimento;
CREATE TRIGGER tg_frota_req_abast_numero
  BEFORE INSERT ON public.frota_requisicoes_abastecimento
  FOR EACH ROW EXECUTE FUNCTION public.fn_frota_req_abastecimento_numero();

CREATE OR REPLACE FUNCTION public.fn_frota_req_abastecimento_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_frota_req_abast_touch ON public.frota_requisicoes_abastecimento;
CREATE TRIGGER tg_frota_req_abast_touch
  BEFORE UPDATE ON public.frota_requisicoes_abastecimento
  FOR EACH ROW EXECUTE FUNCTION public.fn_frota_req_abastecimento_touch();

-- RLS no mesmo padrão do restante da frota (empresa própria ou do mesmo grupo econômico).
ALTER TABLE public.frota_requisicoes_abastecimento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS frota_req_abast_staff_select_grupo ON public.frota_requisicoes_abastecimento;
DROP POLICY IF EXISTS frota_req_abast_admins_manage_grupo ON public.frota_requisicoes_abastecimento;

CREATE POLICY frota_req_abast_staff_select_grupo
  ON public.frota_requisicoes_abastecimento
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND COALESCE(u.ativo, true)
    )
    AND public.rls_empresa_ou_do_mesmo_grupo(frota_requisicoes_abastecimento.empresa_id)
  );

CREATE POLICY frota_req_abast_admins_manage_grupo
  ON public.frota_requisicoes_abastecimento
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND COALESCE(u.ativo, true)
    )
    AND public.rls_empresa_ou_do_mesmo_grupo(frota_requisicoes_abastecimento.empresa_id)
  );
