-- Adiciona a coluna local_saida_enterro na tabela ser_atendimentos
ALTER TABLE IF EXISTS public.ser_atendimentos
  ADD COLUMN IF NOT EXISTS local_saida_enterro text,
  ADD COLUMN IF NOT EXISTS sepultamento_quadra text,
  ADD COLUMN IF NOT EXISTS sepultamento_lote text;
