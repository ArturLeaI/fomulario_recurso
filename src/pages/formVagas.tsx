import { useEffect, useMemo, useState } from "react";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  IconButton,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Grid,
  Paper,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { postAcaoVagas } from "../services/api";

// ✅ ANEXO I (já existia)
import { gerarTermoPdfFile } from "../utils/gerarTermoPdf";
// ✅ ANEXO II (novo)
import { gerarTermoEstabelecimentosPdfFile } from "../utils/gerarTermoEstabelecimento";

const API_URL = import.meta.env.VITE_API_URL as string;

// Tipos vindos da sua API de localidades
type EstadoApi = { uf: string; nome: string };
type MunicipioApi = { nome: string; ibge: string; municipio_id: string };

// Seus tipos
type Curso = {
  id: string;
  nome: string;
  vagas: number;
  vagasSolicitadas?: number; // <- precisa vir do backend quando for "diminuir vagas"
  vagas_disponiveis?: number | string; // <-- vem do backend (às vezes string)
  vagas_usadas?: number | string;
  vagasDisponiveisAumentar?: number;
};

type Estabelecimento = {
  id: string | number;
  nome: string;
  cnes: string;

  // ✅ opcionais (se vierem do backend, ótimo; se não, fica "")
  cnpj?: string;
  diretor_nome?: string;

  cursos: Curso[];
};

type CursoRemover = {
  id: string;
  nome: string;
  quantidade: number; // quanto vai remover (por padrão: saldo solicitado)
  cnes: string;
  estabelecimento: string;
  teto?: number;
  saldoDiminuir?: number;
  saldoAumentar?: number;
};

type CursoAdicionado = {
  id: string;
  nome: string;
  quantidade: number;
  vagasDisponiveis: number;
  estabelecimento: string;
  cnes: string;
  tipoAcao: string;
};

export default function FormularioVagasMunicipio() {
  const navigate = useNavigate();

  // =========================
  // Localidade
  // =========================
  const [estadosApi, setEstadosApi] = useState<EstadoApi[]>([]);
  const [municipiosApi, setMunicipiosApi] = useState<MunicipioApi[]>([]);
  const [cnesDescredenciar, setCnesDescredenciar] = useState<string>("");

  const dadosMunicipioAnterior = JSON.parse(sessionStorage.getItem("dadosMunicipio") || "{}");

  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  const [ufSelecionada, setUfSelecionada] = useState<string>(dadosMunicipioAnterior.uf || "");
  const [nomeEstado, setNomeEstado] = useState<string>(dadosMunicipioAnterior.nomeEstado || "");
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string>(
    dadosMunicipioAnterior.municipio || ""
  );
  const [ibgeMunicipio, setIbgeMunicipio] = useState<string>(dadosMunicipioAnterior.ibgeMunicipio || "");
  const [municipioId, setMunicipioId] = useState<number | null>(
    dadosMunicipioAnterior.municipio_id ? Number(dadosMunicipioAnterior.municipio_id) : null
  );

  // =========================
  // Estado do formulário (ações)
  // =========================
  const [todosCursos, setTodosCursos] = useState<{ nome: string }[]>([]);
  const [quantidadesCursos, setQuantidadesCursos] = useState<Record<string, number>>({});
  const [cursosDisponiveis, setCursosDisponiveis] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);

  const [estabelecimentosDisponiveis, setEstabelecimentosDisponiveis] = useState<Estabelecimento[]>([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(false);

  const [tipoAcao, setTipoAcao] = useState("");
  const [motivoDescredenciar, setMotivoDescredenciar] = useState("");

  const [estabelecimentoSelecionado, setEstabelecimentoSelecionado] = useState<Estabelecimento | null>(null);
  const [cursoSelecionado, setCursoSelecionado] = useState<Curso | null>(null);
  const [quantidade, setQuantidade] = useState<number | "">("");

  const possuiCursosSelecionados = useMemo(
    () => Object.values(quantidadesCursos).some((qtd) => qtd > 0),
    [quantidadesCursos]
  );

  // ✅ Destino / adicionados (para todas ações que adicionam linhas)
  const [cursosAdicionados, setCursosAdicionados] = useState<CursoAdicionado[]>([]);

  // ✅ Origem / remover (somente para mudança de curso)
  const [cursosRemover, setCursosRemover] = useState<CursoRemover[]>([]);

  // =========================
  // Helpers numéricos
  // =========================
  const toNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getSaldoAumentar = (curso: any) =>
    toNumber(
      curso.vagasDisponiveisAumentar ??
      curso.vagas_disponiveis ??
      curso.vagas_disponiveis_aumentar ??
      curso.saldo_aumentar ??
      curso.saldoAumentar
    );

  // =========================
  // Helpers de limite (aumentar/diminuir/adesao)
  // =========================
  const getJaAdicionadoParaCurso = (cursoId: string, cnes: string) =>
    cursosAdicionados
      .filter((x) => x.id === cursoId && x.cnes === cnes && x.tipoAcao === tipoAcao)
      .reduce((sum, x) => sum + Number(x.quantidade || 0), 0);

  const getMaxPermitido = (curso: Curso, est: Estabelecimento) => {
    const ja = getJaAdicionadoParaCurso(String(curso.id), est.cnes);

    if (tipoAcao === "diminuir vagas") {
      const saldoDiminuir = toNumber(curso.vagasSolicitadas);
      return Math.max(saldoDiminuir - ja, 0);
    }

    if (tipoAcao === "aumentar vagas" || tipoAcao === "adesao_edital") {
      const saldoAumentar = getSaldoAumentar(curso);
      return Math.max(saldoAumentar - ja, 0);
    }

    return Math.max(toNumber(curso.vagas) - ja, 0);
  };

  const maxAtual = useMemo(() => {
    if (!cursoSelecionado || !estabelecimentoSelecionado) return undefined;
    return getMaxPermitido(cursoSelecionado, estabelecimentoSelecionado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoSelecionado?.id, estabelecimentoSelecionado?.cnes, tipoAcao, cursosAdicionados]);

  // =========================
  // Reset dependências ao trocar localidade
  // =========================
  const resetAposTrocarLocalidade = () => {
    setMotivoDescredenciar("");
    setEstabelecimentoSelecionado(null);
    setCursoSelecionado(null);
    setQuantidade("");

    setCursosAdicionados([]);
    setCursosRemover([]);
    setCursosDisponiveis([]);

    setQuantidadesCursos((prev) => {
      const zerado: Record<string, number> = {};
      Object.keys(prev).forEach((k) => (zerado[k] = 0));
      return zerado;
    });
  };

  // =========================
  // Persistir dadosMunicipio
  // =========================
  const persistirDadosMunicipio = (payload: {
    uf: string;
    nomeEstado: string;
    municipio: string;
    ibgeMunicipio: string;
    municipio_id: number | null;
  }) => {
    sessionStorage.setItem("dadosMunicipio", JSON.stringify(payload));
  };

  // =========================
  // Download helper
  // =========================
  const downloadFile = (file: File, filename: string) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    // pequeno delay para garantir que o navegador iniciou o download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // =========================
  // Carregar estados
  // =========================
  useEffect(() => {
    async function carregarEstados() {
      try {
        setLoadingEstados(true);
        const resp = await fetch(`${API_URL}/localidades/estados`);
        const data = await resp.json();
        setEstadosApi(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Erro ao carregar estados:", e);
        setEstadosApi([]);
      } finally {
        setLoadingEstados(false);
      }
    }
    carregarEstados();
  }, []);

  // =========================
  // Quando UF muda: buscar municipios
  // =========================
  useEffect(() => {
    async function carregarMunicipios() {
      if (!tipoAcao || !ufSelecionada) {
        setMunicipiosApi([]);
        return;
      }

      const estabelecimentoStatus = tipoAcao === "incluir_aprimoramento" ? "NAO_ADERIDO" : "ADERIDO";

      try {
        setLoadingMunicipios(true);
        const resp = await fetch(
          `${API_URL}/localidades/municipios?uf=${encodeURIComponent(
            ufSelecionada
          )}&estabelecimento_status=${encodeURIComponent(estabelecimentoStatus)}`
        );
        const data = await resp.json();
        setMunicipiosApi(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Erro ao carregar municípios:", e);
        setMunicipiosApi([]);
      } finally {
        setLoadingMunicipios(false);
      }
    }

    carregarMunicipios();
  }, [tipoAcao, ufSelecionada]);

  // =========================
  // Buscar estabelecimentos quando municipioId muda
  // =========================
  useEffect(() => {
    if (!municipioId) return;

    async function buscarEstabelecimentos() {
      const status = tipoAcao === "incluir_aprimoramento" ? "NAO_ADERIDO" : "ADERIDO";

      try {
        setLoadingEstabelecimentos(true);
        const response = await fetch(
          `${API_URL}/estabelecimentos?municipio_id=${municipioId}&status_adesao=${encodeURIComponent(status)}`
        );
        const data = await response.json();
        setEstabelecimentosDisponiveis(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao buscar estabelecimentos", error);
        setEstabelecimentosDisponiveis([]);
      } finally {
        setLoadingEstabelecimentos(false);
      }
    }

    buscarEstabelecimentos();
  }, [municipioId, tipoAcao]);

  // =========================
  // Buscar cursos do estabelecimento
  // =========================
  useEffect(() => {
    if (!estabelecimentoSelecionado?.id) {
      setCursosDisponiveis([]);
      return;
    }

    async function buscarCursos() {
      try {
        setLoadingCursos(true);

        const response = await fetch(
          `${API_URL}/estabelecimentos/cursos?estabelecimento_id=${estabelecimentoSelecionado.id}`
        );
        const data = await response.json();
        const lista = Array.isArray(data) ? data : data.rows ?? [];

        const normalizado: Curso[] = lista.map((c: any) => {
          const vagas = toNumber(c.vagas);

          return {
            ...c,
            vagas,
            vagas_disponiveis: toNumber(c.vagas_disponiveis),
            vagas_usadas: toNumber(c.vagas_usadas),
            vagasDisponiveisAumentar: getSaldoAumentar(c),
            vagasSolicitadas: toNumber(c.vagasSolicitadas ?? c.vagas_solicitadas),
          };
        });

        setCursosDisponiveis(normalizado);
      } catch (error) {
        console.error("Erro ao buscar cursos", error);
        setCursosDisponiveis([]);
      } finally {
        setLoadingCursos(false);
      }
    }

    buscarCursos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estabelecimentoSelecionado?.id, tipoAcao]);

  // =========================
  // Buscar "todos cursos" quando incluir_aprimoramento
  // =========================
  useEffect(() => {
    if (tipoAcao !== "incluir_aprimoramento") return;
    if (todosCursos.length > 0) return;

    async function buscarTodosCursos() {
      try {
        const response = await fetch(`${API_URL}/estabelecimentos/todos-cursos`);
        const data = await response.json();
        const lista = Array.isArray(data) ? data : [];
        setTodosCursos(lista);

        const inicial = lista.reduce((acc: any, c: { nome: string }) => {
          acc[c.nome] = 0;
          return acc;
        }, {});
        setQuantidadesCursos(inicial);
      } catch (error) {
        console.error("Erro ao buscar todos os cursos", error);
        setTodosCursos([]);
        setQuantidadesCursos({});
      }
    }

    buscarTodosCursos();
  }, [tipoAcao, todosCursos.length]);

  // =========================
  // ✅ Mudança de curso: carregar "cursos a remover" (origem)
  // =========================
  useEffect(() => {
    if (tipoAcao !== "mudanca_curso") {
      setCursosRemover([]);
      return;
    }

    if (!estabelecimentoSelecionado) {
      setCursosRemover([]);
      return;
    }

    const solicitados = (cursosDisponiveis || [])
      .filter((c) => toNumber(c.vagasSolicitadas) > 0)
      .map((c) => ({
        id: String(c.id),
        nome: c.nome,
        quantidade: toNumber(c.vagasSolicitadas),
        cnes: estabelecimentoSelecionado.cnes,
        estabelecimento: estabelecimentoSelecionado.nome,
        teto: toNumber(c.vagas),
        saldoDiminuir: toNumber(c.vagasSolicitadas),
        saldoAumentar: getSaldoAumentar(c),
      }));

    setCursosRemover(solicitados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoAcao, estabelecimentoSelecionado?.cnes, cursosDisponiveis]);

  // =========================
  // Handlers localidade
  // =========================
  const handleUFChange = (uf: string) => {
    const estado = estadosApi.find((e) => e.uf === uf);

    setUfSelecionada(uf);
    setNomeEstado(estado?.nome || "");

    setMunicipioSelecionado("");
    setIbgeMunicipio("");
    setMunicipioId(null);

    setEstabelecimentosDisponiveis([]);
    resetAposTrocarLocalidade();

    persistirDadosMunicipio({
      uf,
      nomeEstado: estado?.nome || "",
      municipio: "",
      ibgeMunicipio: "",
      municipio_id: null,
    });
  };

  const handleMunicipioChange = (municipioNome: string) => {
    const mun = municipiosApi.find((m) => m.nome === municipioNome);

    setMunicipioSelecionado(municipioNome);

    const ibge = mun?.ibge || "";
    const mid = mun?.municipio_id ? Number(mun.municipio_id) : null;

    setIbgeMunicipio(ibge);
    setMunicipioId(mid);

    setEstabelecimentosDisponiveis([]);
    resetAposTrocarLocalidade();

    persistirDadosMunicipio({
      uf: ufSelecionada,
      nomeEstado,
      municipio: municipioNome,
      ibgeMunicipio: ibge,
      municipio_id: mid,
    });
  };

  // =========================
  // Adicionar curso (aumentar/diminuir/adesao)
  // =========================
  const handleAdicionarCursoPadrao = () => {
    if (!cursoSelecionado || !quantidade || !estabelecimentoSelecionado) return;

    const existe = cursosAdicionados.find(
      (c) => c.id === cursoSelecionado.id && c.cnes === estabelecimentoSelecionado.cnes
    );
    if (existe) {
      alert("Curso já adicionado nesse estabelecimento! Remova ou altere a quantidade na lista.");
      return;
    }

    const vagasMax = getMaxPermitido(cursoSelecionado, estabelecimentoSelecionado);

    if (tipoAcao === "diminuir vagas") {
      if (vagasMax <= 0) {
        alert("Esse curso não possui vagas solicitadas disponíveis para diminuir.");
        return;
      }
      if (Number(quantidade) > vagasMax) {
        alert(`Você só pode diminuir até ${vagasMax} vaga(s) nesse curso.`);
        return;
      }
    }

    if ((tipoAcao === "aumentar vagas" || tipoAcao === "adesao_edital") && Number(quantidade) > vagasMax) {
      alert(`Você só pode adicionar até ${vagasMax} vaga(s) nesse curso.`);
      return;
    }

    setCursosAdicionados((prev) => [
      ...prev,
      {
        id: cursoSelecionado.id,
        nome: cursoSelecionado.nome,
        quantidade: Number(quantidade),
        vagasDisponiveis: vagasMax,
        estabelecimento: estabelecimentoSelecionado.nome,
        cnes: estabelecimentoSelecionado.cnes,
        tipoAcao,
      },
    ]);

    setCursoSelecionado(null);
    setQuantidade("");
  };

  // =========================
  // Submit
  // =========================
  const handleSubmit = async () => {
    try {
      const gestorId = Number(sessionStorage.getItem("gestorId"));
      if (!gestorId) {
        alert("Gestor não identificado. Volte e preencha os dados do responsável.");
        navigate("/dados-gestor");
        return;
      }

      if (!tipoAcao) {
        alert("Selecione o tipo de ação.");
        return;
      }

      if (!ufSelecionada || !municipioId || !municipioSelecionado) {
        alert("Selecione UF e Município.");
        return;
      }

      // ✅ desistência: só valida campos da desistência
      if (tipoAcao === "descredenciar vaga") {
        if (!cnesDescredenciar) {
          alert("Selecione o estabelecimento (CNES).");
          return;
        }
        if (!motivoDescredenciar) {
          alert("Selecione o motivo.");
          return;
        }
      }

      // ✅ ações com curso: valida lista (não aplica na desistência)
      if (tipoAcao !== "descredenciar vaga" && tipoAcao !== "mudanca_curso") {
        if (cursosAdicionados.length === 0) {
          alert("Selecione ao menos um curso com quantidade maior que zero.");
          return;
        }
      }

      // ✅ validação específica da mudança de curso (mantida)
      if (tipoAcao === "mudanca_curso") {
        const totalRemover = cursosRemover.reduce((s, c) => s + Number(c.quantidade || 0), 0);
        const totalAdicionar = cursosAdicionados.reduce((s, c) => s + Number(c.quantidade || 0), 0);

        if (totalRemover === 0) {
          alert("Não há vagas solicitadas para mover. Selecione um curso solicitado para remover primeiro.");
          return;
        }

        if (totalAdicionar === 0) {
          alert("Adicione ao menos 1 vaga em um novo curso (destino).");
          return;
        }

        if (totalRemover !== totalAdicionar) {
          alert(`Mudança de curso precisa manter o total de vagas: remover=${totalRemover} e adicionar=${totalAdicionar}.`);
          return;
        }
      }

      // ✅ payloads (igual ao seu)
      const payload =
        tipoAcao === "descredenciar vaga"
          ? {
            gestorId,
            tipoAcao,
            motivoDescredenciar,
            ufSelecionada,
            municipio_id: municipioId,
            municipioSelecionado,
            cnes: cnesDescredenciar,
          }
          : tipoAcao === "mudanca_curso"
            ? {
              gestorId,
              tipoAcao,
              ufSelecionada,
              municipio_id: municipioId,
              municipioSelecionado,

              cursosRemover: cursosRemover.map((c) => ({
                id: c.id,
                nome: c.nome,
                quantidade: Number(c.quantidade),
                cnes: c.cnes,
                estabelecimento: c.estabelecimento,
              })),
              cursosAdicionar: cursosAdicionados.map((c) => ({
                id: c.id,
                nome: c.nome,
                quantidade: Number(c.quantidade),
                cnes: c.cnes,
                estabelecimento: c.estabelecimento,
              })),

              cursos: [
                ...cursosRemover.map((c) => ({
                  id: c.id,
                  nome: c.nome,
                  quantidade: Number(c.quantidade),
                  cnes: c.cnes,
                  estabelecimento: c.estabelecimento,
                  operacao: "REMOVER",
                })),
                ...cursosAdicionados.map((c) => ({
                  id: c.id,
                  nome: c.nome,
                  quantidade: Number(c.quantidade),
                  cnes: c.cnes,
                  estabelecimento: c.estabelecimento,
                  operacao: "ADICIONAR",
                })),
              ],
            }
            : {
              gestorId,
              tipoAcao,
              ufSelecionada,
              municipio_id: municipioId,
              municipioSelecionado,
              cursos: cursosAdicionados.map((c) => ({
                id: c.id,
                nome: c.nome,
                quantidade: Number(c.quantidade),
                cnes: c.cnes,
                estabelecimento: c.estabelecimento,
              })),
            };

      const resp = await postAcaoVagas(payload);
      sessionStorage.setItem("acaoVagaResposta", JSON.stringify(resp));

      // ==============================
      // ✅ GERAR PDF(s) — SOMENTE QUANDO FOR INCLUIR NOVO APRIMORAMENTO, GERAR 2
      // - incluir_aprimoramento: Anexo I + Anexo II
      // - outras ações com curso: Anexo I
      // - descredenciar: não gera PDF
      // ==============================
      {
        const nomeente = sessionStorage.getItem("nomeente") || municipioSelecionado;
        const cnpj = sessionStorage.getItem("cnpj") || "";
        const sede = sessionStorage.getItem("sede") || "";
        const representacao = sessionStorage.getItem("representacao") || "";

        const hoje = new Date();
        const dia = String(hoje.getDate());
        const mes = hoje.toLocaleString("pt-BR", { month: "long" });

        // ✅ Lista que vai pro Anexo I depende da ação:
        // - descredenciar: 1 linha "Descredenciar vaga" com CNES escolhido
        // - mudanca_curso: usa cursosRemover
        // - demais: usa cursosAdicionados
        const listaParaTermo =
          tipoAcao === "descredenciar vaga"
            ? [
              {
                nome: `DESISTÊNCIA DA ADESÃO - ${motivoDescredenciar || "MOTIVO NÃO INFORMADO"}`,
                cnes: cnesDescredenciar,
                quantidade: 0,
              },
            ]
            : tipoAcao === "mudanca_curso"
              ? cursosRemover.map((c) => ({
                nome: c.nome,
                cnes: c.cnes,
                quantidade: Number(c.quantidade || 0),
              }))
              : cursosAdicionados.map((c) => ({
                nome: c.nome,
                cnes: c.cnes,
                quantidade: Number(c.quantidade || 0),
              }));

        const totalVagas = listaParaTermo.reduce((acc, c: any) => acc + Number(c.quantidade || 0), 0);

        // --------- ANEXO I (sempre) ---------
        const termoFile = await gerarTermoPdfFile({
          tipoAcao,
          totalvagas: totalVagas,
          nomeente,
          cnpj,
          sede,
          representacao,
          dia,
          mes,
          aprimoramentos: listaParaTermo.map((c: any) => ({
            name: c.nome,
            cnes: c.cnes,
            vagas: Number(c.quantidade || 0),
          })),
        });

        downloadFile(termoFile, "Termo_de_Adesao_Anexo_I.pdf");

        // --------- ANEXO II (somente perda de prazo / adesao_edital) ---------
        if (tipoAcao === "adesao_edital") {
          const nomeente = sessionStorage.getItem("nomeente") || municipioSelecionado;

          const hoje = new Date();
          const dia = String(hoje.getDate());
          const mes = hoje.toLocaleString("pt-BR", { month: "long" });

          const estabByCnes = new Map<string, Estabelecimento>();
          estabelecimentosDisponiveis.forEach((e) => estabByCnes.set(e.cnes, e));

          const establist = cursosAdicionados.map((c) => ({
            nomeestabelecimento: c.estabelecimento,
            cnes: c.cnes,
            nomecurso: c.nome,
            vagas: Number(c.quantidade || 0),
          }));

          const seen = new Set<string>();
          const assinaturalist = cursosAdicionados
            .filter((c) => {
              if (seen.has(c.cnes)) return false;
              seen.add(c.cnes);
              return true;
            })
            .map((c) => {
              const est = estabByCnes.get(c.cnes) || null;
              return {
                nomeestabelecimento: c.estabelecimento,
                cnes: c.cnes,
                nomediretor: (est as any)?.diretor_nome ?? "",
              };
            });

          const termoEstabFile = await gerarTermoEstabelecimentosPdfFile({
            nomeente,
            tipoAcao, // obrigatório
            establist,
            assinaturalist,
            dia,
            mes,
            ano: String(hoje.getFullYear()),
          });

          downloadFile(termoEstabFile, "Termo_Estabelecimentos_Anexo_II.pdf");
        }
      }

      navigate("/upload");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Erro ao enviar solicitação para o servidor.");
    }
  };

  const localidadeOk = Boolean(tipoAcao && ufSelecionada && municipioSelecionado && municipioId);

  return (
    <Box
      sx={{
        width: "100vw",
        minHeight: "100vh",
        backgroundColor: "#fff",
        display: "flex",
        justifyContent: "center",
        pt: 4,
        pb: 4,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 600, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={600} textAlign="center" gutterBottom>
            Gestão de Vagas por Município
          </Typography>

          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            Selecione a localidade e a ação que deseja realizar
          </Typography>

          <TextField
            select
            label="Tipo de ação"
            fullWidth
            value={tipoAcao}
            onChange={(e) => {
              const novaAcao = e.target.value;
              setTipoAcao(novaAcao);

              setUfSelecionada("");
              setNomeEstado("");
              setMunicipioSelecionado("");
              setIbgeMunicipio("");
              setMunicipioId(null);
              setMunicipiosApi([]);
              setEstabelecimentosDisponiveis([]);

              resetAposTrocarLocalidade();
              sessionStorage.removeItem("dadosMunicipio");
            }}
            sx={{ mb: 3 }}
          >
            <MenuItem value="">
              <em>Selecione</em>
            </MenuItem>
            <MenuItem value="descredenciar vaga">Desistir da Adesão</MenuItem>
            <MenuItem value="aumentar vagas">Aumentar Número de Vagas</MenuItem>
            <MenuItem value="diminuir vagas">Diminuir Número de Vagas</MenuItem>
            {/* <MenuItem value="mudanca_curso">Mudança de Curso de Aprimoramento</MenuItem> */}
            <MenuItem value="incluir_aprimoramento">Incluir Outro Curso de Aprimoramento</MenuItem>
            <MenuItem value="adesao_edital">Adesão Por Perda de Prazo</MenuItem>
          </TextField>

          {/* ========================= Localidade ========================= */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="UF"
                fullWidth
                value={ufSelecionada}
                onChange={(e) => handleUFChange(e.target.value)}
                disabled={!tipoAcao || loadingEstados}
              >
                <MenuItem value="">
                  <em>{loadingEstados ? "Carregando..." : "Selecione"}</em>
                </MenuItem>
                {estadosApi.map((estado) => (
                  <MenuItem key={estado.uf} value={estado.uf}>
                    {estado.uf}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <TextField label="Nome do Estado" fullWidth value={nomeEstado} InputProps={{ readOnly: true }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                select
                label="Município"
                fullWidth
                value={municipioSelecionado}
                onChange={(e) => handleMunicipioChange(e.target.value)}
                disabled={!tipoAcao || !ufSelecionada || loadingMunicipios}
              >
                <MenuItem value="">
                  <em>{loadingMunicipios ? "Carregando..." : "Selecione"}</em>
                </MenuItem>
                {municipiosApi.map((m) => (
                  <MenuItem key={`${m.municipio_id}-${m.ibge}`} value={m.nome}>
                    {m.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField label="Código IBGE" fullWidth value={ibgeMunicipio} InputProps={{ readOnly: true }} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* ========================= Descredenciar ========================= */}
          {tipoAcao === "descredenciar vaga" && (
            <>
              <TextField
                select
                label="Estabelecimento (CNES)"
                fullWidth
                value={cnesDescredenciar}
                onChange={(e) => setCnesDescredenciar(e.target.value)}
                disabled={loadingEstabelecimentos || !municipioId}
                sx={{ mb: 2 }}
              >
                <MenuItem value="">
                  <em>{loadingEstabelecimentos ? "Carregando..." : "Selecione"}</em>
                </MenuItem>

                {estabelecimentosDisponiveis.map((est) => (
                  <MenuItem key={est.cnes} value={est.cnes}>
                    {est.nome} (CNES: {est.cnes})
                  </MenuItem>
                ))}
              </TextField>

              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <FormLabel component="legend">Motivo</FormLabel>
                <RadioGroup value={motivoDescredenciar} onChange={(e) => setMotivoDescredenciar(e.target.value)}>
                  <FormControlLabel
                    value="desinteresse"
                    control={<Radio />}
                    label="Desinteresse no curso de aprimoramento ofertado"
                  />
                  <FormControlLabel value="falta_demanda" control={<Radio />} label="Falta de demanda para o curso" />
                  <FormControlLabel
                    value="capacidade_insuficiente"
                    control={<Radio />}
                    label="Falta de capacidade instalada"
                  />
                </RadioGroup>
              </FormControl>
            </>
          )}

          {/* ========================= incluir_aprimoramento ========================= */}
          {tipoAcao === "incluir_aprimoramento" && (
            <>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    select
                    label="Estabelecimento"
                    fullWidth
                    value={estabelecimentoSelecionado?.cnes || ""}
                    onChange={(e) => {
                      const est = estabelecimentosDisponiveis.find((ex) => ex.cnes === e.target.value) || null;
                      setEstabelecimentoSelecionado(est);
                    }}
                    disabled={loadingEstabelecimentos || !municipioId}
                  >
                    <MenuItem value="">
                      <em>{loadingEstabelecimentos ? "Carregando..." : "Selecione"}</em>
                    </MenuItem>
                    {estabelecimentosDisponiveis.map((est) => (
                      <MenuItem key={est.cnes} value={est.cnes}>
                        {est.nome} (CNES: {est.cnes})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mt: 2, mb: 1 }}>
                Selecione a Quantidade de Vagas
              </Typography>

              <Box
                sx={{
                  maxHeight: 350,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  mb: 2,
                }}
              >
                {todosCursos.map((c) => (
                  <Paper
                    key={c.nome}
                    variant="outlined"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 0.5,
                      borderRadius: 1.5,
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        m: 0,
                        fontSize: 14,
                        flex: 1,
                        wordBreak: "break-word",
                        whiteSpace: "normal",
                        pr: 1,
                      }}
                    >
                      {c.nome}
                    </Typography>

                    <TextField
                      type="number"
                      size="small"
                      sx={{ width: 80, flexShrink: 0 }}
                      inputProps={{
                        min: 0,
                        max: 20,
                        style: { textAlign: "center", padding: "4px 8px" },
                      }}
                      value={quantidadesCursos[c.nome] || 0}
                      onChange={(e) => {
                        const valor = Number(e.target.value);
                        setQuantidadesCursos((prev) => ({
                          ...prev,
                          [c.nome]: Math.min(Math.max(valor, 0), 5),
                        }));
                      }}
                    />
                  </Paper>
                ))}
              </Box>

              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                startIcon={<AddCircleOutlineIcon />}
                disabled={!estabelecimentoSelecionado || !possuiCursosSelecionados}
                sx={{
                  mt: 3,
                  mb: 3,
                  py: 1.6,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  boxShadow: "0 6px 16px rgba(25, 118, 210, 0.25)",
                  transition: "all 0.25s ease",
                  "&:hover": {
                    transform: "translateY(-1px)",
                    boxShadow: "0 10px 22px rgba(25, 118, 210, 0.35)",
                  },
                  "&:disabled": {
                    backgroundColor: "#e0e0e0",
                    color: "#9e9e9e",
                    boxShadow: "none",
                  },
                }}
                onClick={() => {
                  const selecionados = Object.entries(quantidadesCursos)
                    .filter(([_, qtd]) => qtd > 0)
                    .map(([nome, qtd]) => ({
                      id: nome,
                      nome,
                      quantidade: Number(qtd),
                      vagasDisponiveis: 20,
                      estabelecimento: estabelecimentoSelecionado!.nome,
                      cnes: estabelecimentoSelecionado!.cnes,
                      tipoAcao,
                    }));

                  setCursosAdicionados((prev) => {
                    const novos = selecionados.filter(
                      (novo) =>
                        !prev.some(
                          (p) => p.nome === novo.nome && p.cnes === novo.cnes && p.tipoAcao === novo.tipoAcao
                        )
                    );
                    return [...prev, ...novos];
                  });

                  setQuantidadesCursos(
                    Object.keys(quantidadesCursos).reduce((acc: any, key) => {
                      acc[key] = 0;
                      return acc;
                    }, {})
                  );
                }}
              >
                Adicionar cursos selecionados
              </Button>

              {cursosAdicionados.length > 0 && (
                <>
                  <Divider sx={{ my: 4 }} />
                  <Typography variant="subtitle1" fontWeight={600} mb={1}>
                    Cursos Selecionados
                  </Typography>

                  <List disablePadding>
                    {cursosAdicionados.map((c) => (
                      <ListItem
                        key={`${c.nome}-${c.cnes}`}
                        divider
                        secondaryAction={
                          <IconButton edge="end" onClick={() => setCursosAdicionados((prev) => prev.filter((x) => !(x.id === c.id && x.cnes === c.cnes)))}>
                            <DeleteIcon />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={c.nome}
                          secondary={
                            <>
                              <Typography variant="caption" display="block">
                                Estabelecimento: {c.estabelecimento}
                              </Typography>
                              <Typography variant="caption" display="block">
                                CNES: {c.cnes} • Quantidade: {c.quantidade}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </>
          )}

          {/* ========================= Ações que manipulam cursos (UI padrão) ========================= */}
          {(tipoAcao === "aumentar vagas" ||
            tipoAcao === "diminuir vagas" ||
            tipoAcao === "mudanca_curso" ||
            tipoAcao === "adesao_edital") && (
              <>
                <TextField
                  select
                  label="Estabelecimento"
                  fullWidth
                  value={estabelecimentoSelecionado?.cnes || ""}
                  onChange={(e) => {
                    const est = estabelecimentosDisponiveis.find((ex) => ex.cnes === e.target.value) || null;

                    setEstabelecimentoSelecionado(est);
                    setCursoSelecionado(null);
                    setQuantidade("");

                    setCursosAdicionados([]);
                    setCursosRemover([]);
                  }}
                  sx={{ mb: 2 }}
                  disabled={loadingEstabelecimentos || !municipioId}
                >
                  <MenuItem value="">
                    <em>{loadingEstabelecimentos ? "Carregando..." : "Selecione"}</em>
                  </MenuItem>

                  {estabelecimentosDisponiveis.map((est) => (
                    <MenuItem key={est.cnes} value={est.cnes}>
                      {est.nome} (CNES: {est.cnes})
                    </MenuItem>
                  ))}
                </TextField>

                {/* UI padrão (sem mudança de curso aqui pq você comentou no menu) */}
                <TextField
                  select
                  label="Curso"
                  fullWidth
                  value={cursoSelecionado?.id?.toString() || ""}
                  onChange={(e) => {
                    const curso = cursosDisponiveis.find((c) => c.id.toString() === e.target.value) || null;
                    setCursoSelecionado(curso);

                    if (!curso || !estabelecimentoSelecionado) {
                      setQuantidade("");
                      return;
                    }

                    const max = getMaxPermitido(curso, estabelecimentoSelecionado);

                    if ((tipoAcao === "diminuir vagas" || tipoAcao === "aumentar vagas" || tipoAcao === "adesao_edital") && max <= 0) {
                      alert("Esse curso não tem saldo disponível para essa ação.");
                      setCursoSelecionado(null);
                      setQuantidade("");
                      return;
                    }

                    setQuantidade(1);
                  }}
                  sx={{ mb: 2 }}
                  disabled={!estabelecimentoSelecionado || loadingCursos}
                >
                  <MenuItem value="">
                    <em>Selecione</em>
                  </MenuItem>

                  {cursosDisponiveis.map((c) => {
                    const max = estabelecimentoSelecionado ? getMaxPermitido(c, estabelecimentoSelecionado) : 0;

                    const desabilitado =
                      (tipoAcao === "diminuir vagas" || tipoAcao === "aumentar vagas" || tipoAcao === "adesao_edital") &&
                      max <= 0;

                    return (
                      <MenuItem key={c.id} value={c.id.toString()} disabled={desabilitado}>
                        {c.nome}
                        {tipoAcao === "diminuir vagas" ? ` • Saldo diminuir: ${toNumber(c.vagasSolicitadas)}` : ""}
                        {tipoAcao === "aumentar vagas" || tipoAcao === "adesao_edital"
                          ? ` (Vagas Disponíveis: ${getSaldoAumentar(c)})`
                          : ""}
                      </MenuItem>
                    );
                  })}
                </TextField>

                <TextField
                  label="Quantidade de vagas"
                  type="number"
                  fullWidth
                  value={quantidade}
                  onChange={(e) => {
                    const valor = Number(e.target.value);

                    if (!cursoSelecionado || !estabelecimentoSelecionado) {
                      setQuantidade(Number.isFinite(valor) ? valor : "");
                      return;
                    }

                    const max = getMaxPermitido(cursoSelecionado, estabelecimentoSelecionado);

                    if (!Number.isFinite(valor) || max <= 0) {
                      setQuantidade("");
                      return;
                    }

                    const clamped = Math.min(Math.max(valor, 1), max);
                    setQuantidade(clamped);
                  }}
                  sx={{ mb: 2 }}
                  disabled={!cursoSelecionado}
                  inputProps={{ min: 1, max: maxAtual }}
                  helperText={cursoSelecionado && estabelecimentoSelecionado ? `Máximo permitido: ${maxAtual ?? 0}` : ""}
                />

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleAdicionarCursoPadrao}
                  disabled={!cursoSelecionado || !quantidade}
                  sx={{ mb: 3 }}
                >
                  Adicionar Curso
                </Button>

                {cursosAdicionados.length > 0 && (
                  <>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle1" mb={1}>
                      Cursos Selecionados:
                    </Typography>
                    <List>
                      {cursosAdicionados.map((c) => (
                        <ListItem
                          key={`${c.id}-${c.cnes}`}
                          secondaryAction={
                            <IconButton edge="end" onClick={() => setCursosAdicionados((prev) => prev.filter((x) => !(x.id === c.id && x.cnes === c.cnes)))}>
                              <DeleteIcon />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={`${c.nome} - ${c.estabelecimento}`}
                            secondary={`CNES: ${c.cnes} | Quantidade: ${c.quantidade} / Máx: ${c.vagasDisponiveis}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </>
            )}

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleSubmit}
            disabled={
              !tipoAcao ||
              !localidadeOk ||
              (tipoAcao === "descredenciar vaga" && (!motivoDescredenciar || !cnesDescredenciar)) ||
              (tipoAcao !== "descredenciar vaga" && tipoAcao !== "mudanca_curso" && cursosAdicionados.length === 0)
            }
          >
            Finalizar Solicitacao
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
