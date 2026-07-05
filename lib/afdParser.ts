import { marcacoesAfdDentroDoAnoMinimo } from './pontoRules';

export interface AfdPunchParsed {
  /** PIS ou CPF (somente dígitos) — chave de vínculo com colaborador. */
  pis: string;
  dataStr: string;
  horaStr: string;
}

export interface AfdParseResult {
  punches: AfdPunchParsed[];
  nameMap: Map<string, string>;
  ignoradasAno: number;
}

const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** REP FENIX e similares: após NSR+tipo+data+hora vem [I|A|E]? + PIS/CPF + nome. */
const FENIX_TIPO5_TAIL_RE =
  /^([IAE]?)(\d{10,12})([A-Za-zÀ-ú\u00C0-\u024F].*?)\s*$/;

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Variações do PIS/CPF do relógio (11/12 dígitos, zero à esquerda). */
export function chavesIdentificadorRelogio(identificador: string): string[] {
  const clean = somenteDigitos(identificador);
  if (!clean) return [];
  const chaves = new Set<string>([clean]);
  if (clean.length === 12 && clean.startsWith('0')) chaves.add(clean.slice(1));
  if (clean.length === 11) chaves.add(`0${clean}`);
  if (clean.length === 12) chaves.add(clean.slice(0, 11));
  return [...chaves];
}

/** Registra PIS/CPF e variações para pareamento na importação AFD. */
export function registrarIdentificadorRelogio(
  mapa: Map<string, string>,
  identificador: string,
  userId: string,
): void {
  for (const chave of chavesIdentificadorRelogio(identificador)) {
    mapa.set(chave, userId);
  }
}

/** Busca colaborador pelo identificador gravado no relógio. */
export function buscarUserIdPorIdentificadorRelogio(
  mapa: Map<string, string>,
  identificador: string,
): string | undefined {
  for (const chave of chavesIdentificadorRelogio(identificador)) {
    const uid = mapa.get(chave);
    if (uid) return uid;
  }
  return undefined;
}

/** Remove prefixo numérico do nome gravado no relógio (ex.: 8ARNALDO → ARNALDO). */
function normalizarNomeCadastro(nome: string): string {
  return nome.trim().replace(/^\d+/, '').trim();
}

function registrarNome(nameMap: Map<string, string>, pisRaw: string, nomeRaw: string): void {
  const pis = somenteDigitos(pisRaw);
  const nome = normalizarNomeCadastro(nomeRaw);
  if (!pis || !nome || !/^[A-Za-zÀ-ú\u00C0-\u024F]/.test(nome)) return;
  nameMap.set(pis, nome);
}

function pushPunch(
  punches: AfdPunchParsed[],
  pisRaw: string,
  yyyy: string,
  mm: string,
  dd: string,
  hh: string,
  min: string,
): boolean {
  if (!marcacoesAfdDentroDoAnoMinimo(yyyy)) return false;

  const dataStr = `${yyyy}-${mm}-${dd}`;
  const horaStr = `${hh}:${min}`;
  const pis = somenteDigitos(pisRaw);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr) || !/^\d{2}:\d{2}$/.test(horaStr) || !pis) {
    return false;
  }

  punches.push({ pis, dataStr, horaStr });
  return true;
}

/** Marcação tipo 3 — Portaria 671 (datetime ISO + CPF). */
function parseMarcacaoTipo3Iso671(line: string): AfdPunchParsed | null {
  const campoDataHora = line.substring(10, 34);
  const match = ISO_DATETIME_RE.exec(campoDataHora);
  if (!match) return null;

  const [, yyyy, mm, dd, hh, min] = match;
  const identificador = line.substring(34, 46).trim();
  if (!identificador) return null;

  const punches: AfdPunchParsed[] = [];
  if (!pushPunch(punches, identificador, yyyy, mm, dd, hh, min)) return null;
  return punches[0] ?? null;
}

/** Marcação tipo 3 — Portaria 1510 (DDMMYYYY + HHMM + PIS). */
function parseMarcacaoTipo3Legado1510(line: string): AfdPunchParsed | null {
  const dd = line.substring(10, 12);
  const mm = line.substring(12, 14);
  const yyyy = line.substring(14, 18);
  const hh = line.substring(18, 20);
  const min = line.substring(20, 22);
  const pis = line.substring(22, 34).trim();

  const punches: AfdPunchParsed[] = [];
  if (!pushPunch(punches, pis, yyyy, mm, dd, hh, min)) return null;
  return punches[0] ?? null;
}

function parseMarcacaoTipo3(line: string): AfdPunchParsed | null {
  const iso = parseMarcacaoTipo3Iso671(line);
  if (iso) return iso;
  return parseMarcacaoTipo3Legado1510(line);
}

/** Marcação tipo 7 — Portaria 671 REP-P (datetime ISO + CPF). */
function parseMarcacaoTipo7(line: string): AfdPunchParsed | null {
  if (line.length < 46) return null;
  return parseMarcacaoTipo3Iso671(line);
}

/**
 * Cadastro / evento tipo 5 — Portaria 1510 ou REP FENIX (data+hora+PIS+nome após pos. 22).
 */
function parseCadastroTipo5(line: string): { pis: string; nome: string } | null {
  if (line.length < 30) return null;

  const tail = line.substring(22).trim();
  const fenix = FENIX_TIPO5_TAIL_RE.exec(tail);
  if (fenix) {
    const pis = somenteDigitos(fenix[2]);
    const nome = normalizarNomeCadastro(fenix[3]);
    if (pis && nome) return { pis, nome };
  }

  const pis1510 = somenteDigitos(line.substring(23, 34).trim());
  const nome1510 = normalizarNomeCadastro(line.substring(34, 184).trim());
  if (pis1510 && nome1510) return { pis: pis1510, nome: nome1510 };

  const pisAlt = somenteDigitos(line.substring(22, 34).trim());
  const nomeAlt = normalizarNomeCadastro(line.substring(34, 184).trim());
  if (pisAlt && nomeAlt) return { pis: pisAlt, nome: nomeAlt };

  return null;
}

/**
 * Lê arquivo AFD (Portaria 1510/671 e REP FENIX): tipos 3/7 (marcações) e 5 (cadastro).
 */
export function parseAfdTextAndNames(text: string): AfdParseResult {
  const lines = text.split(/\r?\n/);
  const punches: AfdPunchParsed[] = [];
  const nameMap = new Map<string, string>();
  let ignoradasAno = 0;

  for (const line of lines) {
    if (line.length < 22) continue;

    const tipo = line.substring(9, 10);

    if (tipo === '3' || tipo === '7') {
      const parsed = tipo === '7' ? parseMarcacaoTipo7(line) : parseMarcacaoTipo3(line);
      if (!parsed) {
        if (tipo === '3') {
          const yyyyLegado = line.substring(14, 18);
          const isoMatch = ISO_DATETIME_RE.exec(line.substring(10, 34));
          const ano = isoMatch?.[1] ?? yyyyLegado;
          if (ano && !marcacoesAfdDentroDoAnoMinimo(ano)) ignoradasAno++;
        }
        continue;
      }
      punches.push(parsed);
      continue;
    }

    if (tipo === '5') {
      const cadastro = parseCadastroTipo5(line);
      if (cadastro) {
        registrarNome(nameMap, cadastro.pis, cadastro.nome);
      }
    }
  }

  return { punches, nameMap, ignoradasAno };
}
