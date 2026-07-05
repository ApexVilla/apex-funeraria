-- Garante created_by/updated_by em lançamentos (inclusive títulos em aberto) e preenche histórico.
CREATE OR REPLACE FUNCTION public.trg_fin_contas_pagar_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    IF NEW.updated_by IS NULL THEN
      NEW.updated_by := COALESCE(NEW.created_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.updated_by := auth.uid();
      IF OLD.created_by IS NULL THEN
        NEW.created_by := auth.uid();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fin_contas_pagar_set_created_by ON public.fin_contas_pagar;
CREATE TRIGGER fin_contas_pagar_set_created_by
  BEFORE INSERT OR UPDATE ON public.fin_contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fin_contas_pagar_set_created_by();

-- Histórico em aberto/vencido: mesmo dia e empresa do primeiro lançamento com usuário.
WITH dia_user AS (
  SELECT DISTINCT ON (empresa_id, DATE(created_at))
    empresa_id,
    DATE(created_at) AS dia,
    created_by
  FROM public.fin_contas_pagar
  WHERE created_by IS NOT NULL
    AND deleted_at IS NULL
  ORDER BY empresa_id, DATE(created_at), created_at ASC
)
UPDATE public.fin_contas_pagar cp
SET created_by = du.created_by,
    updated_by = COALESCE(cp.updated_by, du.created_by)
FROM dia_user du
WHERE cp.created_by IS NULL
  AND cp.deleted_at IS NULL
  AND cp.empresa_id = du.empresa_id
  AND DATE(cp.created_at) = du.dia;
