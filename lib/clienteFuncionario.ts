const CAMPO_FUNCIONARIO = 'eh_funcionario';

type ClienteCamposPersonalizados =
  | Record<string, unknown>
  | null
  | undefined;

export function clienteEhFuncionario(cliente?: {
  campos_personalizados?: ClienteCamposPersonalizados;
} | null): boolean {
  const valor = cliente?.campos_personalizados?.[CAMPO_FUNCIONARIO];
  return valor === true || valor === 'true' || valor === 1 || valor === '1';
}

export function mergeCamposPersonalizadosFuncionario(
  camposBase: ClienteCamposPersonalizados,
  ativo: boolean,
): Record<string, unknown> | undefined {
  const next: Record<string, unknown> = {
    ...(camposBase && typeof camposBase === 'object' ? camposBase : {}),
  };

  if (ativo) next[CAMPO_FUNCIONARIO] = true;
  else delete next[CAMPO_FUNCIONARIO];

  return Object.keys(next).length > 0 ? next : undefined;
}
