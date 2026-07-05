-- Garante created_by em novos lançamentos e preenche histórico a partir de movimentações.
CREATE OR REPLACE FUNCTION public.trg_fin_contas_pagar_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fin_contas_pagar_set_created_by ON public.fin_contas_pagar;
CREATE TRIGGER fin_contas_pagar_set_created_by
  BEFORE INSERT ON public.fin_contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fin_contas_pagar_set_created_by();

-- Histórico: usa o operador da primeira movimentação vinculada ao título.
UPDATE public.fin_contas_pagar cp
SET created_by = sub.created_by
FROM (
  SELECT DISTINCT ON (m.conta_pagar_id)
    m.conta_pagar_id,
    m.created_by
  FROM public.fin_movimentacoes m
  WHERE m.conta_pagar_id IS NOT NULL
    AND m.created_by IS NOT NULL
  ORDER BY m.conta_pagar_id, m.created_at ASC
) sub
WHERE cp.id = sub.conta_pagar_id
  AND cp.created_by IS NULL
  AND cp.deleted_at IS NULL;

-- Fallback: primeira baixa (quando não há movimentação).
UPDATE public.fin_contas_pagar cp
SET created_by = sub.created_by
FROM (
  SELECT DISTINCT ON (b.conta_pagar_id)
    b.conta_pagar_id,
    b.created_by
  FROM public.fin_contas_pagar_baixas b
  WHERE b.estornada = false
    AND b.created_by IS NOT NULL
  ORDER BY b.conta_pagar_id, b.created_at ASC
) sub
WHERE cp.id = sub.conta_pagar_id
  AND cp.created_by IS NULL
  AND cp.deleted_at IS NULL;
