import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BRASAO_DATA_URL } from "../assets/brasaoDataUrl";

type EstabRow = {
  nomeestabelecimento: string;
  cnes: string;
  nomecurso: string;
  vagas: number;
};

type AssinaturaRow = {
  nomeestabelecimento: string;
  cnes: string;
  nomediretor: string;
};

type TermoEstabelecimentosData = {
  nomeente: string;

  // ✅ tipo de ação no Anexo II
  tipoAcao: string; // "AUMENTAR_VAGAS" | "DIMINUIR_VAGAS" | "MUDANCA_CURSO" (ou variantes)
  establist: EstabRow[];
  assinaturalist: AssinaturaRow[];

  dia: string;
  mes: string;
  ano?: string; // opcional (default: "2026")
};

// =====================
// Layout A4 (margens “padrão”)
// =====================
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;

const BRASAO_SIZE_MM = 28;
const BRASAO_GAP_AFTER = 6;

const FONT_SIZE = 12;
const LINE = 5.2;

// =====================
// Helpers de texto / paginação
// =====================

/**
 * Escreve texto quebrando linhas e evitando corte no rodapé:
 * - calcula linhas (splitTextToSize)
 * - escreve linha por linha
 * - se faltar espaço, cria nova página e continua no topo
 */
function addParagraphSafe(opts: {
  doc: jsPDF;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  topY: number;
  bottomY: number;
  lineHeight?: number;
}) {
  const { doc, text, x, maxWidth, topY, bottomY } = opts;
  const lineHeight = opts.lineHeight ?? LINE;

  const lines = doc.splitTextToSize(text, maxWidth);

  let y = opts.y;

  for (const line of lines) {
    if (y + lineHeight > bottomY) {
      doc.addPage();
      y = topY;
    }
    doc.text(String(line), x, y);
    y += lineHeight;
  }

  return y;
}

/** Garante espaço antes de inserir um bloco "alto" (ex.: tabela, assinatura) */
function ensureSpace(doc: jsPDF, y: number, needed: number, topY: number, bottomY: number) {
  if (y + needed > bottomY) {
    doc.addPage();
    return topY;
  }
  return y;
}

// =====================
// Helpers tipo de ação
// =====================
function formatTipoAcao(tipo: string) {
  const v = String(tipo ?? "").trim().toUpperCase();
  if (v === "AUMENTAR VAGAS") return "AUMENTAR_VAGAS";
  if (v === "DIMINUIR VAGAS") return "DIMINUIR_VAGAS";
  if (v === "MUDANÇA DE CURSO" || v === "MUDANCA CURSO" || v === "MUDANCA_CURSO") return "MUDANCA_CURSO";
  return v;
}

function labelTipoAcao(tipo: string) {
  const v = formatTipoAcao(tipo);
  if (v === "AUMENTAR_VAGAS") return "Aumentar vagas";
  if (v === "DIMINUIR_VAGAS") return "Diminuir vagas";
  if (v === "MUDANCA_CURSO") return "Mudança de curso";
  return v;
}

// =====================
// PDF (ANEXO II)
// =====================
export async function gerarTermoEstabelecimentosPdfFile(
  data: TermoEstabelecimentosData
): Promise<File> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const topY = MARGIN_TOP;
  const bottomY = pageHeight - MARGIN_BOTTOM;
  const maxWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

  const setNormal = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_SIZE);
  };
  const setBold = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT_SIZE);
  };

  let y = topY;

  // =====================
  // Brasão
  // =====================
  const xImg = pageWidth / 2 - BRASAO_SIZE_MM / 2;
  const yImg = y;
  const headerAfterImageY = yImg + BRASAO_SIZE_MM + BRASAO_GAP_AFTER;

  try {
    // ⚠️ seu base64 é JPEG ("/9j/..."), então o formato deve ser JPEG
    doc.addImage(BRASAO_DATA_URL, "JPEG", xImg, yImg, BRASAO_SIZE_MM, BRASAO_SIZE_MM);
  } catch (e) {
    console.warn("Não foi possível adicionar o brasão.", e);
  }

  y = headerAfterImageY;

  // =====================
  // Cabeçalho
  // =====================
  setBold();
  y = ensureSpace(doc, y, 25, topY, bottomY);

  doc.text("MINISTÉRIO DA SAÚDE", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.text("SECRETARIA DE GESTÃO DO TRABALHO E DA EDUCAÇÃO NA SAÚDE", pageWidth / 2, y, {
    align: "center",
  });
  y += 10;

  doc.text("ANEXO II", MARGIN_LEFT, y);
  y += 10;

  // =====================
  // Parágrafo inicial (anti-corte)
  // =====================
  setBold();
  y = addParagraphSafe({
    doc,
    text: `TERMO DE COMPROMISSO QUE ENTRE SI CELEBRAM O MINISTÉRIO DA SAÚDE E O(S) ESTABELECIMENTO(S) DE SAÚDE DO QUADRO ABAIXO E INDICADOS NA ADESÃO DO ENTE FEDERATIVO ${data.nomeente}, PARA RECEBIMENTO E ACOMPANHAMENTO DOS APRIMORANDOS DO PROJETO MAIS MÉDICOS ESPECIALISTAS, NO ÂMBITO DO PROGRAMA MAIS MÉDICOS.`,
    x: MARGIN_LEFT,
    y,
    maxWidth,
    topY,
    bottomY,
  });
  y += 8;

  // =====================
  // Tipo de ação (anti-corte)
  // =====================
  setNormal();
  y = addParagraphSafe({
    doc,
    text: `Tipo de ação: ${labelTipoAcao(data.tipoAcao)}`,
    x: MARGIN_LEFT,
    y,
    maxWidth,
    topY,
    bottomY,
  });
  y += 4;

  // =====================
  // Tabela estabelecimentos
  // =====================
  y = ensureSpace(doc, y, 25, topY, bottomY);

  autoTable(doc, {
    startY: y,
    head: [
      [
        {
          content: `Tipo de ação: ${labelTipoAcao(data.tipoAcao)}`,
          colSpan: 4,
          styles: { halign: "center", fontStyle: "bold" },
        },
      ],
      ["ESTABELECIMENTO", "CNES", "CURSO DE APRIMORAMENTO", "QUANTIDADE DE VAGAS"],
    ],
    body: data.establist.map((r) => [r.nomeestabelecimento, r.cnes, r.nomecurso, String(r.vagas)]),
    margin: {
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
      left: MARGIN_LEFT,
      right: MARGIN_RIGHT,
    },
    tableWidth: maxWidth,
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 10.5,
      cellPadding: 2,
      lineWidth: 0.2,
      valign: "middle",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    headStyles: {
      fontStyle: "bold",
      lineWidth: 0.2,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: maxWidth * 0.34 },
      1: { cellWidth: maxWidth * 0.14, halign: "center" },
      2: { cellWidth: maxWidth * 0.38 },
      3: { cellWidth: maxWidth * 0.14, halign: "center" },
    },
    didDrawPage: () => {
      // garante que o texto após a tabela respeite o topY
      // (autotable já usa margin.top, mas mantemos consistência)
    },
  });

  // @ts-expect-error lastAutoTable exists at runtime
  y = doc.lastAutoTable.finalY + 10;

  // =====================
  // Cláusulas (anti-corte real)
  // =====================
  const clause = (title: string, body: string) => {
    // título
    setBold();
    y = addParagraphSafe({
      doc,
      text: title,
      x: MARGIN_LEFT,
      y,
      maxWidth,
      topY,
      bottomY,
    });
    y += 2;

    // corpo
    setNormal();
    y = addParagraphSafe({
      doc,
      text: body,
      x: MARGIN_LEFT,
      y,
      maxWidth,
      topY,
      bottomY,
    });
    y += 6;
  };

  clause(
    "CLÁUSULA PRIMEIRA - DO OBJETO",
    "O presente Termo tem por objeto formalizar a parceria com o estabelecimento de saúde responsável pelo recebimento e acompanhamento dos aprimorandos do Projeto Mais Médicos Especialistas, estabelecendo obrigações técnicas e operacionais necessárias ao desenvolvimento da formação em serviço, visando à ampliação, qualificação e fortalecimento da atenção especializada à saúde."
  );

  clause(
    "CLÁUSULA SEGUNDA - DAS OBRIGAÇÕES DO ESTABELECIMENTO DE SÁUDE",
    `O estabelecimento de saúde compromete-se a:

I - receber os profissionais especialistas para o aprimoramento, garantindo a acolhida e a orientação quanto ao processo de trabalho, em consonância com as diretrizes do Projeto Mais Médicos Especialistas e do Programa Agora Tem Especialistas, do Governo Federal;

II - promover a integração entre a atenção especializada, a atenção primária à saúde e a vigilância em saúde, de forma a assegurar a continuidade do cuidado;

III - disponibilizar profissionais e equipes de saúde necessárias para as atividades de atenção especializada à saúde;

IV - adotar estratégias que assegurem a continuidade do cuidado, a resolutividade e a ampliação do acesso à população;

V - monitorar e avaliar os resultados obtidos, com base em indicadores assistenciais, educacionais e de gestão;

VI - adotar todas as medidas necessárias para garantir a segurança do paciente, observando princípios de qualidade assistencial, ética profissional e integralidade do cuidado, incluindo:

a) oferta de condições adequadas de infraestrutura física, tecnológica, equipamentos e insumos;

b) capacitação e orientação da equipe local;

c) monitoramento de riscos e adoção de medidas preventivas e corretivas;

d) comunicação efetiva entre equipes e níveis de atenção;

e) registro formal e comunicação imediata ao ente federativo e, quando aplicável, ao Ministério da Saúde, de situações extraordinárias que envolvam os profissionais vinculados ao Projeto.; e

VII - assegurar que os ambientes de prática, fluxos assistenciais e condições de atendimento estejam alinhados ao Quadro de Capacidade Instalada dos Serviços para Realização do Aprimoramento, disponibilizado pelo Ministério da Saúde.; e

VIII - articular-se permanentemente com o ente federado ao qual a unidade está vinculada (município, estado ou Distrito Federal), garantindo que as atividades dos aprimorandos respeitem os fluxos, protocolos e orientações do gestor local do SUS, assegurando integração com a rede local de atenção à saúde.

Parágrafo único. As medidas previstas nesta Cláusula constituem responsabilidade exclusiva do Estabelecimento de Saúde, não cabendo ao Ministério da Saúde a supervisão direta, a gestão assistencial ou a corresponsabilidade técnica sobre os atendimentos realizados, conforme legislação sanitária aplicável e diretrizes do Projeto.`
  );

  clause(
    "CLÁUSULA TERCEIRA- DAS SANÇÕES",
    `O descumprimento das obrigações deste Termo poderá implicar:

I - suspensão temporária da participação da unidade no Projeto, após notificação formal;

II - descredenciamento da unidade participante, assegurados o contraditório e a ampla defesa; e

III - comunicação ao Ministério da Saúde para adoção das medidas cabíveis no âmbito da SGTES/MS.`
  );

  clause(
    "CLÁUSULA QUARTA - DA VIGÊNCIA",
    "O presente Termo terá vigência de 12 (doze) meses, a partir de sua assinatura, podendo ser prorrogado mediante termo aditivo."
  );

  clause(
    "CLÁUSULA QUINTA - DA RESCISÃO",
    `O Termo poderá ser rescindido:

I - por manifestação unilateral de qualquer dos signatários, mediante aviso prévio de 30 dias;

II - por comum acordo entre as partes; e

III - por recomendação da SGTES/MS, quando constatado descumprimento das diretrizes do Projeto.`
  );

  clause(
    "CLÁUSULA SEXTA- DAS ALTERAÇÕES",
    "Qualquer alteração deverá ser formalizada por meio de termo aditivo, pactuado entre o Ministério da Saúde e o estabelecimento de saúde, observadas as diretrizes do Projeto Mais Médicos Especialistas e assegurada a ciência do ente federativo."
  );

  clause(
    "CLÁUSULA SÉTIMA - DOS CASOS OMISSOS",
    "Situações não previstas neste instrumento serão resolvidas entre as partes, observando-se as normas do Projeto e as orientações complementares emitidas pela SGTES/MS, bem como a legislação aplicável ao SUS."
  );

  // =====================
  // Quadro de assinaturas
  // =====================
  // estimativa: cabeçalho + ao menos 2 linhas + respiro
  y = ensureSpace(doc, y, 45, topY, bottomY);

  setBold();
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["ESTABELECIMENTO", "CNES", "DIRETOR DO ESTABELECIMENTO", "ASSINATURA"]],
    body: data.assinaturalist.map((r) => [r.nomeestabelecimento, r.cnes, r.nomediretor, ""]),
    margin: {
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
      left: MARGIN_LEFT,
      right: MARGIN_RIGHT,
    },
    tableWidth: maxWidth,
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 10.5,
      cellPadding: 2,
      lineWidth: 0.2,
      valign: "middle",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      minCellHeight: 10,
    },
    headStyles: {
      fontStyle: "bold",
      lineWidth: 0.2,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: maxWidth * 0.35 },
      1: { cellWidth: maxWidth * 0.15, halign: "center" },
      2: { cellWidth: maxWidth * 0.30 },
      3: { cellWidth: maxWidth * 0.20 },
    },
  });

  // @ts-expect-error lastAutoTable exists at runtime
  y = doc.lastAutoTable.finalY + 14;

  // =====================
  // Assinatura do Gestor Local (anti-corte)
  // =====================
  y = ensureSpace(doc, y, 40, topY, bottomY);

  setNormal();
  const ano = data.ano ?? "2026";
  y = addParagraphSafe({
    doc,
    text: `Brasília/DF, ${data.dia} de ${data.mes} de ${ano}.`,
    x: MARGIN_LEFT,
    y,
    maxWidth,
    topY,
    bottomY,
  });
  y += 10;

  // se a linha de assinatura não couber, pula página
  y = ensureSpace(doc, y, 18, topY, bottomY);

  doc.text("_____________________________________", MARGIN_LEFT, y);
  y += 7;

  setBold();
  doc.text("GESTOR LOCAL", MARGIN_LEFT, y);

  const blob = doc.output("blob");
  return new File([blob], "Termo_Estabelecimentos_Anexo_II.pdf", {
    type: "application/pdf",
  });
}
