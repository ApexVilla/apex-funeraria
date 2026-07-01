-- Tipos adicionais de ocorrência no espelho de ponto (inclui bonificação de horas)

ALTER TABLE public.ponto_dia_ocorrencias
  DROP CONSTRAINT IF EXISTS ponto_dia_ocorrencias_tipo_check;

ALTER TABLE public.ponto_dia_ocorrencias
  ADD CONSTRAINT ponto_dia_ocorrencias_tipo_check
  CHECK (tipo IN (
    'folga',
    'atestado',
    'feriado',
    'jornada_normal',
    'hora_extra',
    'bonificacao'
  ));

-- Registros de folga com horas bonificadas (ex.: liberação para jogo) passam ao tipo correto
UPDATE public.ponto_dia_ocorrencias
SET tipo = 'bonificacao',
    updated_at = now()
WHERE tipo = 'folga'
  AND motivo ILIKE '%bonificad%';

COMMENT ON TABLE public.ponto_dia_ocorrencias IS
  'Justificativas de dia no espelho de ponto (folga, atestado, bonificação, etc.)';
