import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  LinearProgress,
  Alert,
  Chip,
  Stack,
  Grid,
  Tooltip,
  Switch,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL as string;

type EstadoApi = { uf: string; nome: string };
type MunicipioApi = { nome: string; ibge: string; municipio_id: string };
type Estabelecimento = { id: string | number; nome: string; cnes: string | number };

type PdfItem = {
  filename: string;
  cnes: string | number | null;
  sizeKB: number;
  createdAt: string | Date;
  url: string;
};

type PdfListResponse =
  | { ok: true; total: number; files: PdfItem[] }
  | { ok: false; message: string };

// =========================
// Utils
// =========================
function normalizeCnes(v: unknown) {
  const onlyDigits = String(v ?? "").replace(/\D+/g, "");
  if (!onlyDigits) return "";
  return onlyDigits.padStart(7, "0");
}

function isValidCnes(v: unknown) {
  return /^\d{7}$/.test(normalizeCnes(v));
}

function toDate(value: any) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatPtBrDate(value: any) {
  const d = toDate(value);
  if (!d) return "-";
  return d.toLocaleString("pt-BR");
}

function friendlyNameFromFilename(filename: string) {
  const parts = String(filename).split("__CNES-");
  const base = parts[0] || filename;
  return base.replace(/_/g, " ").trim();
}

function joinUrl(base: string, pathname: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(pathname || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

// ===== Assinado (localStorage) =====
type AssinadoMap = Record<string, boolean>;
const ASSINADOS_STORAGE_KEY = "pdf_assinados_map_v1";

function loadAssinados(): AssinadoMap {
  try {
    const raw = localStorage.getItem(ASSINADOS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AssinadoMap) : {};
  } catch {
    return {};
  }
}

// ✅ filtro de status
type StatusFiltro = "TODOS" | "ASSINADOS" | "NAO_ASSINADOS";

export default function ListarPdfs() {
  const navigate = useNavigate();

  const [estados, setEstados] = useState<EstadoApi[]>([]);
  const [municipios, setMunicipios] = useState<MunicipioApi[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);

  const [uf, setUf] = useState("");
  const [municipioId, setMunicipioId] = useState<string>("");
  const [cnes, setCnes] = useState<string>("");

  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("TODOS");

  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [loadingEstabs, setLoadingEstabs] = useState(false);
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [assinados, setAssinados] = useState<AssinadoMap>(() => loadAssinados());

  const canLoadMunicipios = Boolean(uf);
  const canLoadEstabs = Boolean(municipioId);

  const isAssinado = (filename: string) => Boolean(assinados[filename]);

  const setAssinado = (filename: string, value: boolean) => {
    setAssinados((prev) => {
      const next = { ...prev, [filename]: value };
      localStorage.setItem(ASSINADOS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // =========================
  // Carregar Estados
  // =========================
  useEffect(() => {
    let alive = true;

    async function loadEstados() {
      if (!API_URL) return;

      try {
        setLoadingEstados(true);
        const resp = await fetch(`${API_URL}/localidades/estados`);
        const data = (await resp.json()) as EstadoApi[];
        if (!alive) return;
        setEstados(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setEstados([]);
        setErrorMsg("Erro ao carregar estados.");
      } finally {
        if (alive) setLoadingEstados(false);
      }
    }

    loadEstados();
    return () => {
      alive = false;
    };
  }, []);

  // =========================
  // Carregar Municípios por UF
  // =========================
  useEffect(() => {
    let alive = true;

    async function loadMunicipios() {
      setMunicipios([]);
      setMunicipioId("");
      setEstabelecimentos([]);
      setCnes("");

      setErrorMsg("");
      setSuccessMsg("");

      if (!API_URL || !uf) return;

      try {
        setLoadingMunicipios(true);
        const resp = await fetch(
          `${API_URL}/localidades/municipios?uf=${encodeURIComponent(uf)}`
        );
        const data = (await resp.json()) as MunicipioApi[];
        if (!alive) return;
        setMunicipios(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setMunicipios([]);
        setErrorMsg("Erro ao carregar municípios.");
      } finally {
        if (alive) setLoadingMunicipios(false);
      }
    }

    loadMunicipios();
    return () => {
      alive = false;
    };
  }, [uf]);

  // =========================
  // Carregar Estabelecimentos por Município
  // =========================
  useEffect(() => {
    let alive = true;

    async function loadEstabs() {
      setEstabelecimentos([]);
      setCnes("");

      setErrorMsg("");
      setSuccessMsg("");

      if (!API_URL || !municipioId) return;

      try {
        setLoadingEstabs(true);
        const resp = await fetch(
          `${API_URL}/estabelecimentos?municipio_id=${encodeURIComponent(municipioId)}`
        );
        const data = (await resp.json()) as Estabelecimento[];
        if (!alive) return;
        setEstabelecimentos(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setEstabelecimentos([]);
        setErrorMsg("Erro ao carregar estabelecimentos.");
      } finally {
        if (alive) setLoadingEstabs(false);
      }
    }

    loadEstabs();
    return () => {
      alive = false;
    };
  }, [municipioId]);

  // =========================
  // Carregar PDFs
  // =========================
  const fetchPdfs = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!API_URL) {
      setErrorMsg("VITE_API_URL não configurado no .env do front.");
      return;
    }

    try {
      setLoadingPdfs(true);
      const resp = await fetch(`${API_URL}/uploads`);
      const data = (await resp.json()) as PdfListResponse;

      if (!resp.ok || !data || (data as any).ok === false) {
        const msg = (data as any)?.message || "Erro ao listar PDFs.";
        throw new Error(msg);
      }

      const list = (data as any).files as PdfItem[];
      setPdfs(Array.isArray(list) ? list : []);
      setSuccessMsg("Lista carregada.");
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Erro ao listar PDFs.");
      setPdfs([]);
    } finally {
      setLoadingPdfs(false);
    }
  };

  useEffect(() => {
    fetchPdfs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // Filtro local (front)
  // =========================

  const cnesUnicos = useMemo(() => {
    const set = new Set<string>();

    for (const p of pdfs) {
      const cn = normalizeCnes(p.cnes);
      if (cn) set.add(cn);
    }

    return Array.from(set).sort();
  }, [pdfs]);


  const filteredPdfs = useMemo(() => {
    let list = [...pdfs];

    const cnesNorm = normalizeCnes(cnes);

    if (municipioId && !isValidCnes(cnesNorm)) {
      const allowed = new Set(
        estabelecimentos.map((e) => normalizeCnes(e.cnes)).filter(Boolean)
      );

      if (allowed.size > 0) {
        list = list.filter((p) => allowed.has(normalizeCnes(p.cnes)));
      }
    }

    if (isValidCnes(cnesNorm)) {
      list = list.filter((p) => normalizeCnes(p.cnes) === cnesNorm);
    }

    if (statusFiltro === "ASSINADOS") {
      list = list.filter((p) => isAssinado(p.filename));
    } else if (statusFiltro === "NAO_ASSINADOS") {
      list = list.filter((p) => !isAssinado(p.filename));
    }

    list.sort((a, b) => {
      const da = toDate(a.createdAt)?.getTime() ?? 0;
      const db = toDate(b.createdAt)?.getTime() ?? 0;
      return db - da;
    });

    return list;
  }, [pdfs, cnes, municipioId, estabelecimentos, statusFiltro, assinados]);

  // ✅ lista de CNES (únicos) dos PDFs NÃO assinados (respeita filtros atuais)
  const cnesNaoAssinados = useMemo(() => {
    const set = new Set<string>();

    for (const p of filteredPdfs) {
      if (isAssinado(p.filename)) continue; // garante não assinado
      const cn = normalizeCnes(p.cnes);
      if (cn) set.add(cn);
    }

    return Array.from(set).sort(); // ordena
  }, [filteredPdfs, assinados]);

  const selectedMunicipioName = useMemo(() => {
    const m = municipios.find((x) => String(x.municipio_id) === String(municipioId));
    return m?.nome || "";
  }, [municipios, municipioId]);

  const selectedEstab = useMemo(() => {
    const c = normalizeCnes(cnes);
    if (!c) return null;
    return estabelecimentos.find((e) => normalizeCnes(e.cnes) === c) || null;
  }, [estabelecimentos, cnes]);

  const statusLabel =
    statusFiltro === "TODOS"
      ? ""
      : statusFiltro === "ASSINADOS"
        ? "Assinados"
        : "Não assinados";

  const handleClear = () => {
    setUf("");
    setMunicipioId("");
    setCnes("");
    setStatusFiltro("TODOS");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const openPdf = (item: PdfItem) => {
    const path = `uploads/${encodeURIComponent(item.filename)}`;
    const fullUrl = joinUrl(API_URL, path);
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  const copyCnesNaoAssinados = async () => {
    const text = cnesNaoAssinados.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setSuccessMsg(`Copiado: ${cnesNaoAssinados.length} CNES não assinado(s).`);
    } catch {
      setErrorMsg("Não foi possível copiar. Seu navegador bloqueou o clipboard.");
    }
  };

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
      <Card sx={{ width: "100%", maxWidth: 900, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={800} textAlign="center" gutterBottom>
            PDFs enviados
          </Typography>

          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            Filtre por UF, Município, Estabelecimento (CNES) e Status para localizar os documentos.
          </Typography>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMsg}
            </Alert>
          )}
          {successMsg && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMsg}
            </Alert>
          )}

          {/* ===== Filtros ===== */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                fullWidth
                label="UF"
                value={uf}
                onChange={(e) => setUf(String(e.target.value))}
                disabled={loadingEstados}
              >
                <MenuItem value="">
                  <em>{loadingEstados ? "Carregando..." : "Selecione"}</em>
                </MenuItem>
                {estados.map((e) => (
                  <MenuItem key={e.uf} value={e.uf}>
                    {e.uf} — {e.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                fullWidth
                label="Município"
                value={municipioId}
                onChange={(e) => setMunicipioId(String(e.target.value))}
                disabled={!canLoadMunicipios || loadingMunicipios}
              >
                <MenuItem value="">
                  <em>
                    {!uf ? "Selecione UF" : loadingMunicipios ? "Carregando..." : "Selecione"}
                  </em>
                </MenuItem>
                {municipios.map((m) => (
                  <MenuItem key={m.municipio_id} value={m.municipio_id}>
                    {m.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                fullWidth
                label="Estabelecimento (CNES)"
                value={cnes}
                onChange={(e) => setCnes(normalizeCnes(e.target.value))}
                disabled={!canLoadEstabs || loadingEstabs}
              >
                <MenuItem value="">
                  <em>
                    {!municipioId
                      ? "Selecione Município"
                      : loadingEstabs
                        ? "Carregando..."
                        : "Selecione"}
                  </em>
                </MenuItem>
                {estabelecimentos.map((est) => {
                  const cnesNorm = normalizeCnes(est.cnes);
                  return (
                    <MenuItem key={cnesNorm} value={cnesNorm}>
                      {est.nome} (CNES: {cnesNorm})
                    </MenuItem>
                  );
                })}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                fullWidth
                label="Status"
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
              >
                <MenuItem value="TODOS">Todos</MenuItem>
                <MenuItem value="ASSINADOS">Assinados</MenuItem>
                <MenuItem value="NAO_ASSINADOS">Não assinados</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {/* chips de contexto */}
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            {uf && <Chip label={`UF: ${uf}`} />}
            {municipioId && <Chip label={`Município: ${selectedMunicipioName || municipioId}`} />}
            {cnes && (
              <Chip label={`CNES: ${cnes}${selectedEstab ? ` — ${selectedEstab.nome}` : ""}`} />
            )}
            {statusLabel && <Chip label={`Status: ${statusLabel}`} />}
          </Stack>

          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchPdfs}
              disabled={loadingPdfs}
              sx={{ textTransform: "none" }}
            >
              Atualizar lista
            </Button>

            <Button variant="text" onClick={handleClear} sx={{ textTransform: "none" }}>
              Limpar filtros
            </Button>

            <Box sx={{ flex: 1 }} />

            <Button variant="text" onClick={() => navigate(-1)} sx={{ textTransform: "none" }}>
              Voltar
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              border: "1px solid",
              borderColor: "grey.200",
              borderRadius: 2,
              p: 2,
              mb: 2,
              backgroundColor: "grey.50",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography fontWeight={800}>Filtrar por CNES (todos)</Typography>

              <Chip
                size="small"
                label={`${cnesUnicos.length} CNES`}
                color={cnesUnicos.length ? "info" : "default"}
              />

              <Box sx={{ flex: 1 }} />

              <Button
                size="small"
                variant="text"
                onClick={() => setCnes("")}
                disabled={!cnes}
                sx={{ textTransform: "none" }}
              >
                Limpar CNES
              </Button>
            </Box>

            {cnesUnicos.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum CNES encontrado.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {cnesUnicos.map((cn) => {
                  const selected = normalizeCnes(cnes) === cn;

                  return (
                    <Chip
                      key={cn}
                      label={cn}
                      clickable
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      onClick={() => {
                        setCnes(cn);
                        setStatusFiltro("TODOS"); // ✅ sempre mostra assinados e não assinados desse CNES
                        // opcional: se município/UF estiver escondendo PDFs de outros lugares:
                        // setMunicipioId("");
                      }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>

          {/* ✅ CNES não assinados como filtro */}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "grey.200",
              borderRadius: 2,
              p: 2,
              mb: 2,
              backgroundColor: "grey.50",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography fontWeight={800}>CNES com PDFs NÃO assinados</Typography>

              <Chip
                size="small"
                label={`${cnesNaoAssinados.length} CNES`}
                color={cnesNaoAssinados.length ? "warning" : "default"}
              />

              <Box sx={{ flex: 1 }} />

              <Button
                size="small"
                variant="text"
                onClick={() => setCnes("")}
                disabled={!cnes}
                sx={{ textTransform: "none" }}
              >
                Limpar CNES
              </Button>
            </Box>

            {cnesNaoAssinados.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum CNES pendente com os filtros atuais.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {cnesNaoAssinados.map((cn) => {
                  const selected = normalizeCnes(cnes) === cn;

                  return (
                    <Chip
                      key={cn}
                      label={cn}
                      clickable
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      onClick={() => {
                        setCnes(cn);
                        setStatusFiltro("TODOS"); // ✅ mostra assinados e não assinados do CNES
                        // opcional: se municipio/uf estiver escondendo arquivos de outros lugares:
                        // setMunicipioId("");
                      }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>


          {loadingPdfs && <LinearProgress sx={{ mb: 2 }} />}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Mostrando: {filteredPdfs.length} arquivo(s)
          </Typography>

          {/* ===== Lista ===== */}
          {filteredPdfs.length === 0 ? (
            <Alert severity="info">Nenhum PDF encontrado com os filtros atuais.</Alert>
          ) : (
            <List disablePadding>
              {filteredPdfs.map((p) => (
                <ListItem
                  key={p.filename}
                  sx={{
                    border: "1px solid",
                    borderColor: "grey.200",
                    borderRadius: 2,
                    mb: 1.5,
                  }}
                  secondaryAction={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Tooltip title={isAssinado(p.filename) ? "Assinado" : "Não assinado"}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <AssignmentTurnedInIcon
                            fontSize="small"
                            color={isAssinado(p.filename) ? "success" : "disabled"}
                          />
                          <Switch
                            size="small"
                            checked={isAssinado(p.filename)}
                            onChange={(e) => setAssinado(p.filename, e.target.checked)}
                            inputProps={{ "aria-label": "Marcar como assinado" }}
                          />
                        </Box>
                      </Tooltip>

                      <Tooltip title="Abrir PDF">
                        <IconButton onClick={() => openPdf(p)} edge="end">
                          <OpenInNewIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <PictureAsPdfIcon fontSize="small" />
                        <Typography fontWeight={800}>{friendlyNameFromFilename(p.filename)}</Typography>
                        {isAssinado(p.filename) && (
                          <Chip size="small" label="Assinado" color="success" sx={{ ml: 1 }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" display="block">
                          Arquivo: {p.filename}
                        </Typography>
                        <Typography variant="caption" display="block">
                          CNES: {normalizeCnes(p.cnes) || "-"} • Tamanho: {p.sizeKB} KB • Criado em:{" "}
                          {formatPtBrDate(p.createdAt)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
