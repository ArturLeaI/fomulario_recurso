import { useEffect, useMemo, useState } from "react";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { postAcaoVagas } from "../services/api";
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
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";

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
  cursos: Curso[];
};

export default function FormularioVagasMunicipio() {
  const navigate = useNavigate();

  // =========================
  // Localidade (agora nessa página)
  // =========================
  const [estadosApi, setEstadosApi] = useState<EstadoApi[]>([]);
  const [municipiosApi, setMunicipiosApi] = useState<MunicipioApi[]>([]);
  const [cnesDescredenciar, setCnesDescredenciar] = useState<string>("");

  const dadosMunicipioAnterior = JSON.parse(
    sessionStorage.getItem("dadosMunicipio") || "{}"
  );

  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  const [ufSelecionada, setUfSelecionada] = useState<string>(
    dadosMunicipioAnterior.uf || ""
  );
  const [nomeEstado, setNomeEstado] = useState<string>(
    dadosMunicipioAnterior.nomeEstado || ""
  );
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string>(
    dadosMunicipioAnterior.municipio || ""
  );
  const [ibgeMunicipio, setIbgeMunicipio] = useState<string>(
    dadosMunicipioAnterior.ibgeMunicipio || ""
  );
  const [municipioId, setMunicipioId] = useState<number | null>(
    dadosMunicipioAnterior.municipio_id
      ? Number(dadosMunicipioAnterior.municipio_id)
      : null
  );

  // =========================
  // Estado do formulário (ações)
  // =========================
  const [todosCursos, setTodosCursos] = useState<{ nome: string }[]>([]);
  const [quantidadesCursos, setQuantidadesCursos] = useState<{
    [nome: string]: number;
  }>({});
  const [cursosDisponiveis, setCursosDisponiveis] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);

  const [estabelecimentosDisponiveis, setEstabelecimentosDisponiveis] =
    useState<Estabelecimento[]>([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(false);

  const [tipoAcao, setTipoAcao] = useState("");
  const [motivoDescredenciar, setMotivoDescredenciar] = useState("");

  const [estabelecimentoSelecionado, setEstabelecimentoSelecionado] =
    useState<Estabelecimento | null>(null);
  const [cursoSelecionado, setCursoSelecionado] = useState<Curso | null>(null);
  const [quantidade, setQuantidade] = useState<number | "">("");

  const possuiCursosSelecionados = useMemo(
    () => Object.values(quantidadesCursos).some((qtd) => qtd > 0),
    [quantidadesCursos]
  );

  const [cursosAdicionados, setCursosAdicionados] = useState<
    {
      id: string;
      nome: string;
      quantidade: number;
      vagasDisponiveis: number;
      estabelecimento: string;
      cnes: string;
      tipoAcao: string; // ✅
    }[]
  >([]);

  const [cursosOriginais, setCursosOriginais] = useState<
    {
      id: string;
      nome: string;
      quantidade: number;
      cnes: string;
      estabelecimento: string;
    }[]
  >([]);

  const toNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getSaldoParaAumentar = (curso: Curso) => {
    // se seu backend envia vagas_disponiveis
    return toNumber((curso as any).vagas_disponiveis);
  };

  const getSaldoAumentar = (curso: any) => {
    return toNumber(
      curso.vagasDisponiveisAumentar ??
      curso.vagas_disponiveis ??
      curso.vagas_disponiveis_aumentar ??
      curso.saldo_aumentar ??
      curso.saldoAumentar
    );
  };

  // =========================
  // ✅ Helpers para "diminuir vagas"
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

    if (tipoAcao === "aumentar vagas") {
      const saldoAumentar = getSaldoAumentar(curso);
      return Math.max(saldoAumentar - ja, 0);
    }

    return Math.max(toNumber(curso.vagas) - ja, 0);
  };
  const maxAtual = useMemo(() => {
    if (!cursoSelecionado || !estabelecimentoSelecionado) return undefined;
    return getMaxPermitido(cursoSelecionado, estabelecimentoSelecionado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cursoSelecionado?.id,
    estabelecimentoSelecionado?.cnes,
    tipoAcao,
    cursosAdicionados,
  ]);

  // =========================
  // Util: resetar dados dependentes quando muda localidade
  // =========================
  const resetAposTrocarLocalidade = () => {
    setMotivoDescredenciar("");
    setEstabelecimentoSelecionado(null);
    setCursoSelecionado(null);
    setQuantidade("");
    setCursosAdicionados([]);
    setCursosOriginais([]);
    setCursosDisponiveis([]);

    // ✅ só zera os contadores (mantendo a lista)
    setQuantidadesCursos((prev) => {
      const zerado: Record<string, number> = {};
      Object.keys(prev).forEach((k) => (zerado[k] = 0));
      return zerado;
    });
  };

  // =========================
  // Carregar estados (API)
  // =========================
  useEffect(() => {
    async function carregarEstados() {
      try {
        setLoadingEstados(true);
        const resp = await fetch("http://localhost:3000/localidades/estados");
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
  // Quando UF muda: buscar municipios (API)
  // =========================
  useEffect(() => {
    async function carregarMunicipios() {
      if (!tipoAcao || !ufSelecionada) {
        setMunicipiosApi([]);
        return;
      }

      const estabelecimentoStatus =
        tipoAcao === "incluir_aprimoramento" ? "NAO_ADERIDO" : "ADERIDO";

      try {
        setLoadingMunicipios(true);

        const resp = await fetch(
          `http://localhost:3000/localidades/municipios?uf=${encodeURIComponent(
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
  // Salvar dadosMunicipio no sessionStorage
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
  // Buscar estabelecimentos quando municipioId muda
  // =========================
  useEffect(() => {
    if (!municipioId) return;

    async function buscarEstabelecimentos() {
      const status =
        tipoAcao === "incluir_aprimoramento" ? "NAO_ADERIDO" : "ADERIDO";

      try {
        setLoadingEstabelecimentos(true);
        const response = await fetch(
          `http://localhost:3000/estabelecimentos?municipio_id=${municipioId}&status_adesao=${encodeURIComponent(
            status
          )}`
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
  // Buscar cursos do estabelecimento (para ações que dependem)
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
          `http://localhost:3000/estabelecimentos/cursos?estabelecimento_id=${estabelecimentoSelecionado.id}`
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

            // ✅ pega de qualquer campo que o backend mande
            vagasDisponiveisAumentar: getSaldoAumentar(c),

            vagasSolicitadas: toNumber(c.vagasSolicitadas ?? c.vagas_solicitadas),
          };
        });

        console.log("NORMALIZADO cursos:", normalizado);
        setCursosDisponiveis(normalizado);
      } catch (error) {
        console.error("Erro ao buscar cursos", error);
        setCursosDisponiveis([]);
      } finally {
        setLoadingCursos(false);
      }
    }

    buscarCursos();
  }, [estabelecimentoSelecionado?.id, tipoAcao]);



  // =========================
  // Buscar "todos cursos" quando incluir_aprimoramento (mantive sua lógica)
  // =========================
  useEffect(() => {
    if (tipoAcao !== "incluir_aprimoramento") return;
    if (todosCursos.length > 0) return; // já carregado

    async function buscarTodosCursos() {
      try {
        const response = await fetch(
          "http://localhost:3000/estabelecimentos/todos-cursos"
        );
        const data = await response.json();
        const lista = Array.isArray(data) ? data : [];
        console.log("PARSED cursosDisponiveis:", lista);
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
  // Carrega cursos originais quando mudança de curso
  // =========================
  useEffect(() => {
    if (tipoAcao === "mudanca_curso" && estabelecimentoSelecionado) {
      const existentes = (estabelecimentoSelecionado.cursos || [])
        .filter((c) => c.vagasSolicitadas && c.vagasSolicitadas > 0)
        .map((c) => ({
          id: c.id,
          nome: c.nome,
          quantidade: c.vagasSolicitadas || 0,
          cnes: estabelecimentoSelecionado.cnes,
          estabelecimento: estabelecimentoSelecionado.nome,
        }));
      setCursosOriginais(existentes);
    } else {
      setCursosOriginais([]);
    }
  }, [tipoAcao, estabelecimentoSelecionado]);

  // =========================
  // handlers
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

  const handleAdicionarCurso = () => {
    if (!cursoSelecionado || !quantidade || !estabelecimentoSelecionado) return;

    const existe = cursosAdicionados.find(
      (c) => c.id === cursoSelecionado.id && c.cnes === estabelecimentoSelecionado.cnes
    );
    if (existe) {
      alert(
        "Curso já adicionado nesse estabelecimento! Remova ou altere a quantidade na lista."
      );
      return;
    }

    const vagasMax = getMaxPermitido(cursoSelecionado, estabelecimentoSelecionado);

    // ✅ regra: em "diminuir", só pode diminuir até o saldo solicitado disponível
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

    setCursosAdicionados([
      ...cursosAdicionados,
      {
        id: cursoSelecionado.id,
        nome: cursoSelecionado.nome,
        quantidade: Number(quantidade),
        vagasDisponiveis: vagasMax,
        estabelecimento: estabelecimentoSelecionado.nome,
        cnes: estabelecimentoSelecionado.cnes,
        tipoAcao, // ✅
      },
    ]);

    setCursoSelecionado(null);
    setQuantidade("");
  };

  const handleRemoverCurso = (id: string, cnes: string, origem = false) => {
    if (origem) {
      setCursosOriginais(cursosOriginais.filter((c) => !(c.id === id && c.cnes === cnes)));
    } else {
      setCursosAdicionados(cursosAdicionados.filter((c) => !(c.id === id && c.cnes === cnes)));
    }
  };

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

      if (tipoAcao === "descredenciar vaga" && !cnesDescredenciar) {
        alert("Selecione o estabelecimento (CNES).");
        return;
      }

      const cursosParaEnviar =
        tipoAcao === "mudanca_curso"
          ? [...cursosOriginais, ...cursosAdicionados]
          : cursosAdicionados;

      if (tipoAcao !== "descredenciar vaga" && cursosParaEnviar.length === 0) {
        alert("Adicione ao menos um curso.");
        return;
      }

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
          : {
            gestorId,
            tipoAcao,
            ufSelecionada,
            municipio_id: municipioId,
            municipioSelecionado,
            cursos: cursosParaEnviar.map((c: any) => ({
              id: c.id,
              nome: c.nome,
              quantidade: Number(c.quantidade),
              cnes: c.cnes,
              estabelecimento: c.estabelecimento,
            })),
          };

      const resp = await postAcaoVagas(payload);
      sessionStorage.setItem("acaoVagaResposta", JSON.stringify(resp));

      if (estabelecimentoSelecionado?.id) {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Vagas por Município`, 20, 20);
        doc.setFontSize(12);
        doc.text(`Ação: ${tipoAcao}`, 20, 28);
        doc.text(`UF: ${ufSelecionada}`, 20, 36);
        doc.text(`Município: ${municipioSelecionado}`, 20, 44);

        let y = 60;
        cursosAdicionados.forEach((curso, index) => {
          doc.text(
            `${index + 1}. Estabelecimento: ${curso.estabelecimento} (CNES: ${curso.cnes}) | Curso: ${curso.nome} | Quantidade: ${curso.quantidade} | Máx: ${curso.vagasDisponiveis}`,
            20,
            y
          );
          y += 10;
        });

        doc.save(`Termo`);

        if (tipoAcao === "adesao_edital") {
          const docEdital = new jsPDF();
          docEdital.setFontSize(16);
          docEdital.text(`Termo`, 20, 20);
          docEdital.setFontSize(12);
          docEdital.text(`UF: ${ufSelecionada}`, 20, 28);
          docEdital.text(`Município: ${municipioSelecionado}`, 20, 36);

          let y2 = 50;
          cursosAdicionados.forEach((curso, index) => {
            docEdital.text(
              `${index + 1}. Estabelecimento: ${curso.estabelecimento} (CNES: ${curso.cnes}) | Curso: ${curso.nome} | Quantidade: ${curso.quantidade}`,
              20,
              y2
            );
            y2 += 10;
          });

          docEdital.save(`Recurso.pdf`);
        }
      }

      navigate("/proximo-passo");
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
            <MenuItem value="mudanca_curso">Mudança de Curso de Aprimoramento</MenuItem>
            <MenuItem value="incluir_aprimoramento">Incluir Aprimoramento</MenuItem>
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
              <TextField
                label="Nome do Estado"
                fullWidth
                value={nomeEstado}
                InputProps={{ readOnly: true }}
              />
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
              <TextField
                label="Código IBGE"
                fullWidth
                value={ibgeMunicipio}
                InputProps={{ readOnly: true }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* ========================= Tipo de ação ========================= */}

          {/* Descredenciar */}
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
                <RadioGroup
                  value={motivoDescredenciar}
                  onChange={(e) => setMotivoDescredenciar(e.target.value)}
                >
                  <FormControlLabel
                    value="desinteresse"
                    control={<Radio />}
                    label="Desinteresse no curso de aprimoramento ofertado"
                  />
                  <FormControlLabel
                    value="falta_demanda"
                    control={<Radio />}
                    label="Falta de demanda para o curso de aprimoramento"
                  />
                  <FormControlLabel
                    value="capacidade_insuficiente"
                    control={<Radio />}
                    label="Falta de capacidade instalada"
                  />
                </RadioGroup>
              </FormControl>
            </>
          )}

          {/* incluir_aprimoramento (mantive como estava) */}
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
                      const est =
                        estabelecimentosDisponiveis.find((ex) => ex.cnes === e.target.value) ||
                        null;
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
                      tipoAcao, // ✅
                    }));

                  if (selecionados.length === 0) {
                    alert("Selecione ao menos um curso com quantidade maior que zero.");
                    return;
                  }

                  setCursosAdicionados((prev) => {
                    const novos = selecionados.filter(
                      (novo) => !prev.some(
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
                          <IconButton edge="end" onClick={() => handleRemoverCurso(c.id, c.cnes)}>
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

          {/* Ações que manipulam cursos */}
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
                    const est =
                      estabelecimentosDisponiveis.find((ex) => ex.cnes === e.target.value) || null;

                    setEstabelecimentoSelecionado(est);
                    setCursoSelecionado(null);
                    setQuantidade("");
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

                <TextField
                  select
                  label="Curso"
                  fullWidth
                  value={cursoSelecionado?.id?.toString() || ""}
                  onChange={(e) => {
                    const curso =
                      cursosDisponiveis.find((c) => c.id.toString() === e.target.value) || null;

                    setCursoSelecionado(curso);

                    if (!curso || !estabelecimentoSelecionado) {
                      setQuantidade("");
                      return;
                    }

                    const max = getMaxPermitido(curso, estabelecimentoSelecionado);

                    if ((tipoAcao === "diminuir vagas" || tipoAcao === "aumentar vagas") && max <= 0) {
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
                    const max = estabelecimentoSelecionado
                      ? getMaxPermitido(c, estabelecimentoSelecionado)
                      : 0;

                    const desabilitado =
                      (tipoAcao === "diminuir vagas" || tipoAcao === "aumentar vagas") && max <= 0;

                    return (
                      <MenuItem key={c.id} value={c.id.toString()} disabled={desabilitado}>
                        {c.nome} (Teto: {c.vagas})
                        {tipoAcao === "diminuir vagas" ? ` • Saldo diminuir: ${toNumber(c.vagasSolicitadas)}` : ""}
                        {tipoAcao === "aumentar vagas"
                          ? ` • Saldo aumentar: ${getSaldoAumentar(c)}`
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

                    if (!Number.isFinite(valor)) {
                      setQuantidade("");
                      return;
                    }

                    if (max <= 0) {
                      setQuantidade("");
                      return;
                    }

                    const clamped = Math.min(Math.max(valor, 1), max);
                    setQuantidade(clamped);
                  }}
                  sx={{ mb: 2 }}
                  disabled={
                    !cursoSelecionado ||
                    (tipoAcao === "diminuir vagas" && (maxAtual ?? 0) <= 0)
                  }
                  inputProps={{
                    min: 1,
                    max: maxAtual,
                  }}
                  helperText={
                    cursoSelecionado && estabelecimentoSelecionado
                      ? `Máximo permitido: ${maxAtual ?? 0}`
                      : ""
                  }
                />

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleAdicionarCurso}
                  disabled={
                    !cursoSelecionado ||
                    !quantidade ||
                    (tipoAcao === "diminuir vagas" && (maxAtual ?? 0) <= 0)
                  }
                  sx={{ mb: 3 }}
                >
                  Adicionar Curso
                </Button>

                {(cursosAdicionados.length > 0 || cursosOriginais.length > 0) && (
                  <>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle1" mb={1}>
                      Cursos Selecionados:
                    </Typography>
                    <List>
                      {cursosOriginais.map((c) => (
                        <ListItem
                          key={`orig-${c.id}-${c.cnes}`}
                          secondaryAction={
                            <IconButton edge="end" onClick={() => handleRemoverCurso(c.id, c.cnes, true)}>
                              <DeleteIcon />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={`${c.nome} - ${c.estabelecimento}`}
                            secondary={`CNES: ${c.cnes} | Quantidade: ${c.quantidade}`}
                          />
                        </ListItem>
                      ))}
                      {cursosAdicionados.map((c) => (
                        <ListItem
                          key={`${c.id}-${c.cnes}`}
                          secondaryAction={
                            <IconButton edge="end" onClick={() => handleRemoverCurso(c.id, c.cnes)}>
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
              (tipoAcao === "descredenciar vaga" &&
                (!motivoDescredenciar || !cnesDescredenciar)) ||
              (tipoAcao !== "descredenciar vaga" &&
                cursosAdicionados.length === 0 &&
                cursosOriginais.length === 0)
            }
          >
            Finalizar Solicitacao
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}