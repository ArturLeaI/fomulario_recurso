import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BRASAO_DATA_URL } from "../assets/brasaoDataUrl";

type AprimoramentoRow = { name: string; cnes: string; vagas: number };

type TermoData = {
  totalvagas: number;
  aprimoramentos: AprimoramentoRow[];

  tipoAcao: string; // "AUMENTAR_VAGAS" | "DIMINUIR_VAGAS" | "MUDANCA_CURSO"
  nomeente: string;
  cnpj: string;
  sede: string;
  representacao: string;

  // ✅ NOVO: dados do gestor no PDF
  gestorNome: string;
  gestorCpf: string;

  dia: string;
  mes: string;
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
// Helpers (anti-corte)
// =====================
function ensureSpace(doc: jsPDF, y: number, needed: number, topY: number, bottomY: number) {
  if (y + needed > bottomY) {
    doc.addPage();
    return topY;
  }
  return y;
}

/**
 * ✅ addParagraph “seguro”
 * - quebra em linhas (splitTextToSize)
 * - se não couber na página atual, cria nova página
 * - continua a renderizar sem cortar
 */
function addParagraphSafe(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  topY: number,
  bottomY: number,
  lineHeight = LINE
) {
  const lines = doc.splitTextToSize(text, maxWidth);

  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight, topY, bottomY);
    doc.text(String(line), x, y);
    y += lineHeight;
  }

  return y;
}

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

function onlyDigits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function formatCpf11(cpfRaw: unknown) {
  const d = onlyDigits(cpfRaw).slice(0, 11);
  if (d.length !== 11) return String(cpfRaw ?? "").trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

// =====================
// PDF
// =====================
export async function gerarTermoPdfFile(data: TermoData): Promise<File> {
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
  // Brasão (centralizado) - Base64 embutido
  // =====================
  const xImg = pageWidth / 2 - BRASAO_SIZE_MM / 2;
  const yImg = y;
  const headerAfterImageY = yImg + BRASAO_SIZE_MM + BRASAO_GAP_AFTER;

  try {
    doc.addImage(BRASAO_DATA_URL, "JPEG", xImg, yImg, BRASAO_SIZE_MM, BRASAO_SIZE_MM);
  } catch (e) {
    console.warn("Não foi possível adicionar o brasão.", e);
  }

  y = headerAfterImageY;

  // =====================
  // Cabeçalho
  // =====================
  setBold();
  y = ensureSpace(doc, y, 8, topY, bottomY);
  doc.text("MINISTÉRIO DA SAÚDE", pageWidth / 2, y, { align: "center" });
  y += 7;

  y = ensureSpace(doc, y, 12, topY, bottomY);
  doc.text("SECRETARIA DE GESTÃO DO TRABALHO E DA EDUCAÇÃO NA SAÚDE", pageWidth / 2, y, { align: "center" });
  y += 10;

  y = ensureSpace(doc, y, 12, topY, bottomY);
  doc.text("ANEXO I", MARGIN_LEFT, y);
  y += 10;

  setBold();
  y = addParagraphSafe(
    doc,
    "TERMO DE ADESÃO E COMPROMISSO ENTRE O MINISTÉRIO DA SAÚDE E O ENTE FEDERATIVO PARA PARTICIPAÇÃO NO PROJETO MAIS MÉDICOS ESPECIALISTAS",
    MARGIN_LEFT,
    y,
    maxWidth,
    topY,
    bottomY
  );
  y += 8;

  // =====================
  // Resumo + tipo de ação
  // =====================
  setNormal();
  y = ensureSpace(doc, y, 8, topY, bottomY);
  doc.text(`Tipo de ação: ${labelTipoAcao(data.tipoAcao)}`, MARGIN_LEFT, y);
  y += 7;

  y = ensureSpace(doc, y, 9, topY, bottomY);
  doc.text(`Total de vagas solicitadas: ${data.totalvagas}`, MARGIN_LEFT, y);
  y += 8;

  y = ensureSpace(doc, y, 7, topY, bottomY);
  doc.text("Quadro de vagas solicitadas por Aprimoramento e estabelecimento:", MARGIN_LEFT, y);
  y += 6;

  // =====================
  // Tabela (já pagina sozinha)
  // =====================
  autoTable(doc, {
    startY: y,
    head: [
      [
        {
          content: `Tipo de ação: ${labelTipoAcao(data.tipoAcao)}   |   Total: ${data.totalvagas}`,
          colSpan: 3,
          styles: { halign: "center", fontStyle: "bold" },
        },
      ],
      ["Aprimoramento", "CNES", "Nº de vagas solicitadas"],
    ],
    body: data.aprimoramentos.map((a) => [a.name, a.cnes, String(a.vagas)]),

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
      fontSize: 11,
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

    alternateRowStyles: { fillColor: [255, 255, 255] },

    columnStyles: {
      0: { cellWidth: maxWidth * 0.6 },
      1: { cellWidth: maxWidth * 0.2, halign: "center" },
      2: { cellWidth: maxWidth * 0.2, halign: "center" },
    },
  });

  // @ts-expect-error lastAutoTable exists at runtime
  y = doc.lastAutoTable.finalY + 10;

  // =====================
  // Corpo (anti-corte)
  // =====================
  setBold();
  y = addParagraphSafe(
    doc,
    `TERMO DE ADESÃO E COMPROMISSO QUE ENTRE SI CELEBRAM O MINISTÉRIO DA SAÚDE E O ENTE FEDERATIVO ${data.nomeente}, PARA ADESÃO AO PROJETO MAIS MÉDICOS ESPECIALISTAS, NO ÂMBITO DO PROGRAMA MAIS MÉDICOS.`,
    MARGIN_LEFT,
    y,
    maxWidth,
    topY,
    bottomY
  );
  y += 6;

  setNormal();
  y = addParagraphSafe(
    doc,
    `O MINISTÉRIO DA SAÚDE, CNPJ nº 03.274.533/0001-50, neste ato representado por FELIPE PROENÇO DE OLIVEIRA, Secretário de Gestão do Trabalho e da Educação na Saúde - SGTES, com sede na Esplanada dos Ministérios, Bloco "O", 9º andar, Brasília/DF e o ENTE FEDERATIVO ${data.nomeente}, CNPJ nº ${data.cnpj}, com sede em ${data.sede}, representado por ${data.representacao}, resolvem celebrar o presente Termo de Adesão e Compromisso, com fundamento na Lei nº 12.871/2013, Decreto nº 7.508/2011, Lei nº 8.080/1990 e demais normas aplicáveis, mediante as cláusulas e condições seguintes:`,
    MARGIN_LEFT,
    y,
    maxWidth,
    topY,
    bottomY
  );
  y += 6;

  const clause = (title: string, body: string) => {
    setBold();
    y = addParagraphSafe(doc, title, MARGIN_LEFT, y, maxWidth, topY, bottomY);
    y += 2;

    setNormal();
    y = addParagraphSafe(doc, body, MARGIN_LEFT, y, maxWidth, topY, bottomY);
    y += 6;
  };

  clause(
    "CLÁUSULA PRIMEIRA - DO OBJETO",
    "O presente Termo tem por objeto formalizar a adesão do Ente Federativo ao Projeto Mais Médicos Especialistas, destinado a contribuir para a ampliação, qualificação e fortalecimento da atenção especializada à saúde no âmbito do Sistema Único de Saúde - SUS."
  );

  clause(
    "CLÁUSULA SEGUNDA - DOS OBJETIVOS",
    `Constituem objetivos do presente Termo:

I - ampliar a oferta e a resolutividade da atenção especializada, mediante consultas, procedimentos cirúrgicos e exames diagnósticos;

II - apoiar o provimento e a fixação de profissionais em regiões e serviços com carência assistencial;

III - estimular a integração entre a Atenção Especializada, a Atenção Primária e a Vigilância em Saúde;

IV - fortalecer a Política Nacional de Educação Permanente em Saúde - PNEPS, integrando ensino, serviço e comunidade;

V - fomentar inovação e desenvolvimento de práticas qualificadas no SUS;

VI - promover articulação entre regiões de saúde, instituições de ensino e pesquisa, estados, Distrito Federal e municípios; e

VII - contribuir para a formação e desenvolvimento de equipes especializadas em linhas de cuidado e políticas prioritárias do SUS.

Parágrafo único. As especialidades abrangidas observarão demandas prioritárias do SUS e critérios de baixa disponibilidade regional.`
  );

  clause(
    "CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DOS ENTES FEDERATIVOS (MUNICÍPIOS, ESTADOS E DISTRITO FEDERAL)",
    `O ente federativo compromete-se a:

I - validar a alocação dos profissionais e homologar suas apresentações, mediante verificação da documentação exigida;

II - articular-se com os estabelecimentos de saúde responsáveis por receber os profissionais, garantindo acolhimento, orientação e integração às ações do Projeto;

III - implementar as diretrizes da atenção especializada previstas na legislação aplicável e no Projeto Mais Médicos Especialistas;

IV - promover integração entre os diferentes níveis de atenção à saúde para assegurar continuidade do cuidado;

V - disponibilizar profissionais e equipes de saúde necessárias ao funcionamento dos serviços de atenção especializada;

VI - adotar estratégias de gestão que ampliem o acesso da população e promovam resolutividade;

VII - monitorar e avaliar os resultados alcançados, com base em indicadores assistenciais, educacionais e de gestão;

VIII - assegurar que o(a) diretor(a) ou gerente de cada unidade participante adote medidas de segurança do paciente, incluindo infraestrutura adequada, capacitação da equipe, monitoramento de riscos e comunicação de intercorrências;

IX - garantir que cada unidade participante disponha de equipe técnica de retaguarda multidisciplinar adequada ao perfil assistencial;

X - assegurar comunicação efetiva entre gestor local e unidades participantes sobre o processo de trabalho e as ações do Projeto;

XI - observar que as responsabilidades assistenciais e técnicas são exclusivas dos entes federativos e dos estabelecimentos de saúde, não recaindo sobre o Ministério da Saúde.

XII - Caso o estabelecimento de saúde não disponha da capacidade instalada mínima necessária ao pleno desenvolvimento das atividades de aprimoramento descritas no e-Gestor, o profissional poderá ser realocado para outro estabelecimento, no mesmo município ou em município distinto, conforme disponibilidade de vagas e observado o disposto no subitem 2.2.2 deste Edital.`
  );

  clause(
    "CLÁUSULA QUARTA - DAS OBRIGAÇÕES DO MINISTÉRIO DA SAÚDE",
    `Compete ao Ministério da Saúde:

I - coordenar nacionalmente o Projeto Mais Médicos Especialistas;

II - definir critérios técnicos e operacionais para adesão dos entes e das instituições parceiras;

III - acompanhar e avaliar ações desenvolvidas, com base em indicadores assistenciais, educacionais e territoriais;

IV - articular e integrar componentes de formação, trabalho e inovação do Projeto;

V - estabelecer valores de bolsas e incentivos financeiros aplicáveis, conforme normativas vigentes; e

VI - promover parcerias institucionais necessárias à execução do Projeto, observada a legislação pertinente.`
  );

  clause(
    "CLÁUSULA QUINTA - DAS CONDIÇÕES DOS SERVIÇOS DE SAÚDE",
    "Os estabelecimentos de saúde indicados pelo ente federativo deverão assegurar as condições mínimas de infraestrutura física, tecnológica e organizacional necessárias ao desenvolvimento das atividades de ensino-serviço, conforme parâmetros definidos no Quadro de Capacidade Instalada disponível no portal do Programa Mais Médicos."
  );

  clause(
    "CLÁUSULA SEXTA - DAS SANÇÕES",
    `O descumprimento das obrigações previstas neste Termo poderá implicar:

I - notificação formal ao ente federativo, com prazo de 5 (cinco) dias úteis para manifestação;

II - bloqueio de vagas e remanejamento de profissionais, mediante justificativa da Coordenação Nacional;

III - descredenciamento do ente ou das vagas associadas, caso não haja regularização no prazo estabelecido; e

IV - comunicação a órgãos competentes, quando necessário.`
  );

  clause(
    "CLÁUSULA SÉTIMA - DA VIGÊNCIA",
    "O Termo terá vigência de 12 (doze) meses, a partir de sua confirmação, podendo ser prorrogado mediante termo aditivo."
  );

  clause(
    "CLÁUSULA OITAVA - DA RESCISÃO",
    `O Termo poderá ser rescindido:

I - por mútuo consentimento; e

II - unilateralmente, mediante aviso prévio de 30 (trinta) dias.`
  );

  clause(
    "CLÁUSULA NONA - DAS ALTERAÇÕES",
    "Alterações deste Termo deverão ser formalizadas mediante termo aditivo pactuado entre as partes."
  );

  clause(
    "CLÁUSULA DÉCIMA - DAS DISPOSIÇÕES FINAIS",
    "Os casos omissos ou controvérsias serão resolvidos administrativamente entre as partes, visando à execução integral do objeto do Projeto."
  );

  // =====================
  // Rodapé / assinaturas (anti-corte)
  // =====================
  // precisa caber: data + 28 + bloco do gestor (~18) + etc
  const neededFooter = 58;
  y = ensureSpace(doc, y, neededFooter, topY, bottomY);

  setNormal();
  doc.text(`Brasília/DF, ${data.dia} de ${data.mes} de 2026.`, MARGIN_LEFT, y);
  y += 28;

  const leftX = MARGIN_LEFT;
  const rightX = pageWidth / 2 + 10;


  doc.text("______________________________________", rightX, y);

  // ✅ nome/cpf do gestor abaixo da linha (lado direito)
  const gestorNome = String(data.gestorNome || "").trim();
  const gestorCpf = formatCpf11(data.gestorCpf);

  setBold();
  doc.text("GESTOR LOCAL", rightX, y + 7);

  setNormal();
  if (gestorNome) doc.text(gestorNome, rightX, y + 13);
  if (gestorCpf) doc.text(`CPF: ${gestorCpf}`, rightX, y + 18);

  const blob = doc.output("blob");
  return new File([blob], "Termo_de_Adesao.pdf", { type: "application/pdf" });
}
