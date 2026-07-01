import { downloadPdfBlob } from './printPdfBlob';

export function slugArquivoFolhaPonto(
  nomeColaborador: string,
  ano: number,
  mesIndex: number,
): string {
  const nome =
    (nomeColaborador || 'colaborador')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'colaborador';
  const mes = String(mesIndex + 1).padStart(2, '0');
  return `folha-de-ponto-${nome}-${ano}-${mes}.pdf`;
}

export function tituloJanelaFolhaPonto(nomeColaborador: string, nomeMes: string): string {
  const nome = (nomeColaborador || 'Colaborador').trim();
  return `Folha de Ponto - ${nome} - ${nomeMes}`.replace(/[\\/:*?"<>|]/g, '-');
}

const PROPS_INLINE_PDF = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'verticalAlign',
  'textTransform',
  'display',
  'width',
  'height',
  'minHeight',
  'maxWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'flexDirection',
  'flexWrap',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignItems',
  'justifyContent',
  'alignContent',
  'gap',
  'columnGap',
  'rowGap',
  'gridTemplateColumns',
  'gridColumn',
  'gridRow',
  'tableLayout',
  'borderCollapse',
  'borderSpacing',
  'whiteSpace',
  'wordBreak',
  'overflow',
  'boxSizing',
  'opacity',
  'visibility',
  'textDecorationLine',
  'fontVariantNumeric',
] as const;

function camelToKebab(prop: string): string {
  return prop.replace(/([A-Z])/g, '-$1').toLowerCase();
}

const PROPS_COR_INLINE_PDF = new Set([
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
]);

let canvasNormalizacaoCor: CanvasRenderingContext2D | null = null;

/**
 * getComputedStyle() devolve oklch()/lab()/lch() tal como o Tailwind 4 declarou (Chrome não
 * resolve para rgb no computed style) e o html2canvas não entende essas funções de cor —
 * gera "Attempting to parse an unsupported color function" e aborta a captura inteira.
 * O <canvas> 2D normaliza qualquer cor válida para rgb()/rgba() de forma confiável.
 */
function normalizarCorParaRgb(valor: string): string {
  if (!valor || !/(oklch|oklab|lch|lab|color)\(/i.test(valor)) return valor;
  try {
    if (!canvasNormalizacaoCor) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      canvasNormalizacaoCor = canvas.getContext('2d');
    }
    if (!canvasNormalizacaoCor) return valor;
    canvasNormalizacaoCor.fillStyle = valor;
    return canvasNormalizacaoCor.fillStyle;
  } catch {
    return valor;
  }
}

/** html2canvas não entende oklch() do Tailwind 4 — inline com RGB do computed style. */
function aplicarEstilosComputadosInline(origem: HTMLElement, clone: HTMLElement): void {
  const filaOrigem: HTMLElement[] = [origem];
  const filaClone: HTMLElement[] = [clone];

  while (filaOrigem.length > 0) {
    const o = filaOrigem.shift()!;
    const c = filaClone.shift()!;
    const cs = window.getComputedStyle(o);

    for (const prop of PROPS_INLINE_PDF) {
      const valBruto = cs[prop];
      if (!valBruto) continue;
      const val = PROPS_COR_INLINE_PDF.has(prop) ? normalizarCorParaRgb(valBruto) : valBruto;
      c.style.setProperty(camelToKebab(prop), val, 'important');
    }

    const bg = normalizarCorParaRgb(cs.backgroundColor);
    c.style.setProperty('background-image', 'none', 'important');
    if (bg && bg !== 'rgba(0, 0, 0, 0)') {
      c.style.setProperty('background-color', bg, 'important');
    }
    c.style.setProperty('box-shadow', 'none', 'important');

    const origemFilhos = Array.from(o.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    const cloneFilhos = Array.from(c.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    for (let i = 0; i < origemFilhos.length; i++) {
      if (cloneFilhos[i]) {
        filaOrigem.push(origemFilhos[i]);
        filaClone.push(cloneFilhos[i]);
      }
    }
  }
}

function forcarRodapeImpressaoVisivel(clonedDoc: Document): void {
  clonedDoc
    .querySelectorAll(
      '.ponto-espelho-somente-impressao, .ponto-espelho-rodape-impressao, .ponto-espelho-assinaturas-impressao, #ponto-espelho-print-footer',
    )
    .forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.style.setProperty('display', 'block', 'important');
      node.style.setProperty('visibility', 'visible', 'important');
      node.style.setProperty('opacity', '1', 'important');
    });
}

function prepararDocumentoCloneHtml2Canvas(clonedDoc: Document, origem: HTMLElement): void {
  clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => node.remove());

  const alvo =
    (origem.id ? clonedDoc.getElementById(origem.id) : null) ??
    clonedDoc.body.firstElementChild;

  if (alvo instanceof HTMLElement) {
    aplicarEstilosComputadosInline(origem, alvo);
  }

  forcarRodapeImpressaoVisivel(clonedDoc);
}

export async function baixarPdfFolhaPonto(
  elemento: HTMLElement,
  filename: string,
): Promise<void> {
  elemento.classList.add('captura-pdf-ativa');
  document.body.classList.add('captura-folha-ponto-ativa');
  const footer = elemento.querySelector('#ponto-espelho-print-footer');
  const somenteImpressao = elemento.querySelectorAll(
    '.ponto-espelho-somente-impressao, .ponto-espelho-assinaturas-impressao',
  );
  if (footer instanceof HTMLElement) {
    footer.style.setProperty('display', 'block', 'important');
    footer.style.setProperty('visibility', 'visible', 'important');
    footer.style.setProperty('opacity', '1', 'important');
  }
  somenteImpressao.forEach((node) => {
    if (node instanceof HTMLElement) {
      node.style.setProperty('display', 'block', 'important');
      node.style.setProperty('visibility', 'visible', 'important');
      node.style.setProperty('opacity', '1', 'important');
    }
  });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: elemento.scrollWidth,
      windowHeight: elemento.scrollHeight,
      onclone: (clonedDoc) => {
        prepararDocumentoCloneHtml2Canvas(clonedDoc, elemento);
      },
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginTopMm = 2;
    const marginBottomMm = 4;
    const marginSideMm = 4;
    const usableWidth = pageWidth - marginSideMm * 2;
    const usableHeight = pageHeight - marginTopMm - marginBottomMm;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = 0;

    while (heightLeft > 0) {
      pdf.addImage(imgData, 'PNG', marginSideMm, position + marginTopMm, imgWidth, imgHeight);
      heightLeft -= usableHeight;
      position -= usableHeight;
      if (heightLeft > 1) {
        pdf.addPage();
      }
    }

    const blob = pdf.output('blob');
    await downloadPdfBlob(blob, filename);
  } finally {
    elemento.classList.remove('captura-pdf-ativa');
    document.body.classList.remove('captura-folha-ponto-ativa');
    if (footer instanceof HTMLElement) {
      footer.style.removeProperty('display');
      footer.style.removeProperty('visibility');
      footer.style.removeProperty('opacity');
    }
    somenteImpressao.forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.removeProperty('display');
        node.style.removeProperty('visibility');
        node.style.removeProperty('opacity');
      }
    });
  }
}
