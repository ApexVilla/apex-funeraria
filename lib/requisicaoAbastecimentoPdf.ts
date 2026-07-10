import jsPDF from 'jspdf';
import { abrirPdfNaJanelaReservada, reservarJanelaImpressaoPdf } from './printPdfBlob';

export type RequisicaoAbastecimentoPdfInput = {
  numero: number;
  empresaNome: string;
  empresaCnpj?: string | null;
  dataEmissao: string;           // yyyy-mm-dd
  validade?: string | null;      // yyyy-mm-dd
  veiculoPlaca: string;
  veiculoModelo?: string | null;
  motoristaNome?: string | null;
  posto?: string | null;
  combustivel?: string | null;
  tipoLimite: 'valor' | 'litros' | 'completar';
  valorAutorizado?: number | null;
  litrosAutorizados?: number | null;
  observacao?: string | null;
};

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
};

const fmtMoeda = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const labelCombustivel: Record<string, string> = {
  gasolina: 'Gasolina',
  diesel: 'Diesel',
  etanol: 'Etanol',
  flex: 'Flex',
  gnv: 'GNV',
};

function autorizacaoTexto(input: RequisicaoAbastecimentoPdfInput): string {
  if (input.tipoLimite === 'valor' && input.valorAutorizado) {
    return `Autorizado abastecimento até o limite de ${fmtMoeda(input.valorAutorizado)}`;
  }
  if (input.tipoLimite === 'litros' && input.litrosAutorizados) {
    return `Autorizado abastecimento de até ${input.litrosAutorizados.toLocaleString('pt-BR')} litros`;
  }
  return 'Autorizado completar o tanque do veículo';
}

/** Desenha uma via da requisição a partir de `y`; retorna o y final. */
function drawVia(
  doc: jsPDF,
  input: RequisicaoAbastecimentoPdfInput,
  y: number,
  via: string,
): number {
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const boxW = W - M * 2;
  const numeroFmt = `REQ-${String(input.numero).padStart(6, '0')}`;

  // Cabeçalho da via
  doc.setFillColor(190, 18, 60); // rose-700 (accent do módulo frota)
  doc.roundedRect(M, y, boxW, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('REQUISIÇÃO DE ABASTECIMENTO', M + 5, y + 7);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(input.empresaNome + (input.empresaCnpj ? ` — CNPJ ${input.empresaCnpj}` : ''), M + 5, y + 12.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(numeroFmt, W - M - 5, y + 8, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(via, W - M - 5, y + 13, { align: 'right' });
  y += 20;

  // Grade de dados
  doc.setTextColor(30, 30, 30);
  const linhas: Array<[string, string, string, string]> = [
    ['Data de Emissão', fmtData(input.dataEmissao), 'Válida até', input.validade ? fmtData(input.validade) : 'Sem validade'],
    ['Veículo', `${input.veiculoPlaca}${input.veiculoModelo ? ` — ${input.veiculoModelo}` : ''}`, 'Motorista', input.motoristaNome || '—'],
    ['Posto Credenciado', input.posto || 'Livre escolha', 'Combustível', input.combustivel ? (labelCombustivel[input.combustivel] || input.combustivel) : '—'],
  ];
  doc.setDrawColor(210, 210, 210);
  linhas.forEach((l) => {
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(l[0].toUpperCase(), M + 1, y);
    doc.text(l[2].toUpperCase(), M + boxW / 2 + 1, y);
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(l[1], M + 1, y + 4.5);
    doc.text(l[3], M + boxW / 2 + 1, y + 4.5);
    doc.setFont('helvetica', 'normal');
    y += 9;
    doc.line(M, y - 2.5, W - M, y - 2.5);
  });

  // Autorização em destaque
  y += 2;
  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(190, 18, 60);
  doc.roundedRect(M, y - 3, boxW, 11, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(159, 18, 57);
  doc.text(autorizacaoTexto(input), W / 2, y + 3.5, { align: 'center' });
  y += 12;

  if (input.observacao) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    const obs = doc.splitTextToSize(`Obs: ${input.observacao}`, boxW - 2);
    doc.text(obs, M + 1, y + 1);
    y += obs.length * 3.4 + 2;
  }

  // Campos preenchidos no posto
  y += 2;
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  const campos = ['KM DO VEÍCULO', 'LITROS', 'VALOR/LITRO', 'VALOR TOTAL'];
  const campoW = (boxW - 6) / 4;
  campos.forEach((c, i) => {
    const x = M + i * (campoW + 2);
    doc.setDrawColor(180, 180, 180);
    doc.roundedRect(x, y, campoW, 10, 1, 1, 'S');
    doc.text(c, x + 2, y + 3);
  });
  y += 16;

  // Assinaturas
  const assinW = (boxW - 10) / 2;
  doc.setDrawColor(120, 120, 120);
  doc.line(M + 4, y + 8, M + 4 + assinW - 8, y + 8);
  doc.line(M + assinW + 14, y + 8, M + assinW + 14 + assinW - 8, y + 8);
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text('Autorizado por (Empresa)', M + 4 + (assinW - 8) / 2, y + 11.5, { align: 'center' });
  doc.text('Recebido por (Posto / Frentista)', M + assinW + 14 + (assinW - 8) / 2, y + 11.5, { align: 'center' });

  return y + 16;
}

/** Gera o voucher da requisição em 2 vias (empresa e posto) e abre para impressão. */
export async function gerarRequisicaoAbastecimentoPdf(
  input: RequisicaoAbastecimentoPdfInput,
): Promise<boolean> {
  const janela = reservarJanelaImpressaoPdf();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  let y = drawVia(doc, input, 12, '1ª VIA — EMPRESA');

  // Linha de corte
  doc.setDrawColor(160, 160, 160);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, y + 2, W - 10, y + 2);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text('✂ destacar', 12, y + 1);

  drawVia(doc, input, y + 8, '2ª VIA — POSTO');

  const titulo = `Requisicao_Abastecimento_${String(input.numero).padStart(6, '0')}`;
  const blob = doc.output('blob');
  return abrirPdfNaJanelaReservada(janela, blob, titulo);
}
