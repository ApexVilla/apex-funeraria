-- Rastreia quem lançou cada conta a pagar (paridade com baixas e outros módulos financeiros).
ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_contas_pagar_created_by
  ON public.fin_contas_pagar (created_by)
  WHERE created_by IS NOT NULL;

COMMENT ON COLUMN public.fin_contas_pagar.created_by IS
  'Usuário que criou o lançamento da conta a pagar.';
