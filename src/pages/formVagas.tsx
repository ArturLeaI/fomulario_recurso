import { useState, useEffect } from "react";
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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import { estadosRecurso, Estabelecimento, Curso, Municipio } from "../data/ufIbge";
import { jsPDF } from "jspdf";

export default function FormularioVagasMunicipio() {
  const navigate = useNavigate();

  const dadosMunicipioAnterior = JSON.parse(
    sessionStorage.getItem("dadosMunicipio") || "{}"
  );


  const [municipioId, setMunicipioId] = useState<number | null>(
    dadosMunicipioAnterior.municipio_id ?? null
  );
  const [cursosDisponiveis, setCursosDisponiveis] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [estabelecimentosDisponiveis, setEstabelecimentosDisponiveis] = useState<Estabelecimento[]>([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(false);
  const [tipoAcao, setTipoAcao] = useState("");
  const [motivoDescredenciar, setMotivoDescredenciar] = useState("");
  const [ufSelecionada, setUfSelecionada] = useState(dadosMunicipioAnterior.uf || "");
  const [municipioSelecionado, setMunicipioSelecionado] = useState(
    dadosMunicipioAnterior.municipio || ""
  );
  const [estabelecimentoSelecionado, setEstabelecimentoSelecionado] = useState<Estabelecimento | null>(null);
  const [cursoSelecionado, setCursoSelecionado] = useState<Curso | null>(null);
  const [quantidade, setQuantidade] = useState<number | "">("");
  const [cursosAdicionados, setCursosAdicionados] = useState<
    {
      id: string;
      nome: string;
      quantidade: number;
      vagasDisponiveis: number;
      estabelecimento: string;
      cnes: string;
    }[]
  >([]);

  // Lista de cursos já selecionados para mudança de curso
  const [cursosOriginais, setCursosOriginais] = useState<
    { id: string; nome: string; quantidade: number; cnes: string; estabelecimento: string }[]
  >([]);

  const municipiosDisponiveis: Municipio[] = ufSelecionada
    ? estadosRecurso.find((e) => e.uf === ufSelecionada)?.municipios || []
    : [];

  // const estabelecimentosDisponiveis: Estabelecimento[] = municipioSelecionado
  //   ? municipiosDisponiveis.find((m) => m.nome === municipioSelecionado)?.estabelecimentos || []
  //   : [];

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

        // Normaliza resposta
        setCursosDisponiveis(
          Array.isArray(data) ? data : data.rows ?? []
        );
      } catch (error) {
        console.error("Erro ao buscar cursos", error);
        setCursosDisponiveis([]);
      } finally {
        setLoadingCursos(false);
      }
    }

    buscarCursos();
  }, [estabelecimentoSelecionado?.id]);

  useEffect(() => {
    if (!municipioId) return;

    async function buscarEstabelecimentos() {
      try {
        const response = await fetch(
          `http://localhost:3000/estabelecimentos?municipio_id=${municipioId}`
        );

        const data = await response.json();

        setEstabelecimentosDisponiveis(
          Array.isArray(data) ? data : data.rows ?? []
        );
      } catch (error) {
        console.error("Erro ao buscar estabelecimentos", error);
        setEstabelecimentosDisponiveis([]);
      }
    }

    buscarEstabelecimentos();
  }, [municipioId]);

  // Carrega os cursos já selecionados para mudança de curso
  useEffect(() => {
    if (tipoAcao === "mudanca_curso" && estabelecimentoSelecionado) {
      const existentes = estabelecimentoSelecionado.cursos
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

  const handleAdicionarCurso = () => {
    if (!cursoSelecionado || !quantidade || !estabelecimentoSelecionado) return;

    const existe = cursosAdicionados.find(
      (c) => c.id === cursoSelecionado.id && c.cnes === estabelecimentoSelecionado.cnes
    );
    if (existe) {
      alert("Curso já adicionado nesse estabelecimento! Remova ou altere a quantidade na lista.");
      return;
    }

    const vagasMax =
      tipoAcao === "diminuir vagas" ? cursoSelecionado.vagasSolicitadas || 0 : cursoSelecionado.vagas;

    setCursosAdicionados([
      ...cursosAdicionados,
      {
        id: cursoSelecionado.id,
        nome: cursoSelecionado.nome,
        quantidade,
        vagasDisponiveis: vagasMax,
        estabelecimento: estabelecimentoSelecionado.nome,
        cnes: estabelecimentoSelecionado.cnes,
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

  const handleSubmit = () => {
    const dados = {
      tipoAcao,
      ...(tipoAcao === "descredenciar vaga" && { motivoDescredenciar }),
      ...(tipoAcao !== "descredenciar vaga" && {
        ufSelecionada,
        municipioSelecionado,
        cursos: cursosAdicionados,
      }),
    };

    sessionStorage.setItem("dadosVagasMunicipio", JSON.stringify(dados));

    if (tipoAcao !== "descredenciar vaga" && cursosAdicionados.length > 0) {
      // PDF padrão
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

      // PDF especial "Adesão ao Edital"
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
  };

  return (
    <Box sx={{ width: "100vw", height: "100vh", backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card sx={{ width: "100%", maxWidth: 600, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={600} textAlign="center" gutterBottom>
            Gestão de Vagas por Município
          </Typography>

          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            Selecione a ação que deseja realizar
          </Typography>

          <TextField
            select
            label="Tipo de ação"
            fullWidth
            value={tipoAcao}
            onChange={(e) => {
              setTipoAcao(e.target.value);
              setMotivoDescredenciar("");
              setEstabelecimentoSelecionado(null);
              setCursoSelecionado(null);
              setQuantidade("");
              setCursosAdicionados([]);
              setCursosOriginais([]);
            }}
            sx={{ mb: 3 }}
          >
            <MenuItem value="">
              <em>Selecione</em>
            </MenuItem>
            <MenuItem value="descredenciar vaga">Descredenciar Vaga</MenuItem>
            <MenuItem value="aumentar vagas">Aumentar Número de Vagas</MenuItem>
            <MenuItem value="diminuir vagas">Diminuir Número de Vagas</MenuItem>
            <MenuItem value="mudanca_curso">Mudança de Curso de Aprimoramento</MenuItem>
            <MenuItem value="adesao_edital">Adesão ao Edital</MenuItem>
          </TextField>

          {/* Descredenciar */}
          {tipoAcao === "descredenciar vaga" && (
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">Motivo</FormLabel>
              <RadioGroup value={motivoDescredenciar} onChange={(e) => setMotivoDescredenciar(e.target.value)}>
                <FormControlLabel value="desinteresse" control={<Radio />} label="Desinteresse no curso de aprimoramento ofertado" />
                <FormControlLabel value="falta_demanda" control={<Radio />} label="Falta de demanda para o curso de aprimoramento" />
                <FormControlLabel value="capacidade_insuficiente" control={<Radio />} label="Falta de capacidade instalada" />
              </RadioGroup>
            </FormControl>
          )}

          {/* Ações que manipulam cursos */}
          {(tipoAcao === "aumentar vagas" || tipoAcao === "diminuir vagas" || tipoAcao === "mudanca_curso" || tipoAcao === "adesao_edital") && (
            <>
              <TextField label="UF" fullWidth value={ufSelecionada} InputProps={{ readOnly: true }} sx={{ mb: 3 }} />
              <TextField label="Município" fullWidth value={municipioSelecionado} InputProps={{ readOnly: true }} sx={{ mb: 3 }} />

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
                disabled={loadingEstabelecimentos}
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
                  const curso = cursosDisponiveis.find(
                    (c) => c.id.toString() === e.target.value // Converta para string também
                  ) || null;

                  setCursoSelecionado(curso);

                  if (curso) {
                    setQuantidade(
                      tipoAcao === "diminuir vagas"
                        ? curso.vagasSolicitadas ?? 0
                        : curso.vagas
                    );
                  }
                }}
                sx={{ mb: 2 }}
                disabled={!estabelecimentoSelecionado || loadingCursos}
              >
                <MenuItem value="">
                  <em>Selecione</em>
                </MenuItem>
                {cursosDisponiveis.map((c) => (
                  <MenuItem key={c.id} value={c.id.toString()}> {/* Converta aqui também */}
                    {c.nome} ({c.vagas} vagas)
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Quantidade de vagas"
                type="number"
                fullWidth
                value={quantidade}
                onChange={(e) => {
                  const valor = Number(e.target.value);
                  if (cursoSelecionado) {
                    const max = tipoAcao === "diminuir vagas" ? cursoSelecionado.vagasSolicitadas || 0 : cursoSelecionado.vagas;
                    setQuantidade(Math.min(valor, max));
                  } else setQuantidade(valor);
                }}
                sx={{ mb: 2 }}
                disabled={!cursoSelecionado}
                inputProps={{ min: 1, max: cursoSelecionado ? (tipoAcao === "diminuir vagas" ? cursoSelecionado.vagasSolicitadas : cursoSelecionado.vagas) : undefined }}
                helperText={cursoSelecionado ? `Máximo de vagas: ${tipoAcao === "diminuir vagas" ? cursoSelecionado.vagasSolicitadas : cursoSelecionado.vagas}` : ""}
              />

              <Button
                variant="outlined"
                fullWidth
                onClick={handleAdicionarCurso}
                disabled={!cursoSelecionado || !quantidade}
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
              (tipoAcao === "descredenciar vaga" && !motivoDescredenciar) ||
              ((tipoAcao !== "descredenciar vaga") && cursosAdicionados.length === 0 && cursosOriginais.length === 0)
            }
          >
            Continuar
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
