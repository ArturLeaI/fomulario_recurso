import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  InputAdornment,
  Backdrop,
  CircularProgress,
  Collapse,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SearchIcon from "@mui/icons-material/Search";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

type AssinadosResponse =
  | { ok: true; map: AssinadoMap }
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

async function persistAssinado(filename: string, assinado: boolean) {
  if (!API_URL) return;
  await fetch(`${API_URL}/uploads/assinados`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, assinado }),
  });
}

// ✅ filtro de status
type StatusFiltro = "TODOS" | "ASSINADOS" | "NAO_ASSINADOS";

export default function ListarPdfs() {
  const navigate = useNavigate();

  const [estados, setEstados] = useState<EstadoApi[]>([]);
  const [municipios, setMunicipios] = useState<MunicipioApi[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [estabsByMunicipioId, setEstabsByMunicipioId] = useState<
    Record<string, Estabelecimento[]>
  >({});
  const [estabsCache, setEstabsCache] = useState<Record<string, Estabelecimento[]>>({});

  const [uf, setUf] = useState("");
  const [municipioId, setMunicipioId] = useState<string>("");
  const [cnes, setCnes] = useState<string>("");

  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("TODOS");
  const [query, setQuery] = useState("");
  const [showCnesFilter, setShowCnesFilter] = useState(true);
  const [showNaoAssinadosFilter, setShowNaoAssinadosFilter] = useState(true);

  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [loadingEstabs, setLoadingEstabs] = useState(false);
  const [loadingEstabsUf, setLoadingEstabsUf] = useState(false);
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [assinados, setAssinados] = useState<AssinadoMap>(() => loadAssinados());

  const canLoadMunicipios = Boolean(uf);
  const canLoadEstabs = Boolean(municipioId);

  const deferredUf = useDeferredValue(uf);
  const deferredCnes = useDeferredValue(cnes);
  const deferredStatusFiltro = useDeferredValue(statusFiltro);
  const deferredQuery = useDeferredValue(query);
  const deferredAssinados = useDeferredValue(assinados);

  const isAssinado = (filename: string) => Boolean(assinados[filename]);

  const isBusy =
    loadingPdfs || loadingEstabsUf || loadingEstados || loadingMunicipios || loadingEstabs;
  const busyLabel = loadingPdfs
    ? "Atualizando PDFs..."
    : loadingEstabsUf
      ? "Carregando estabelecimentos da UF..."
      : loadingMunicipios
        ? "Carregando municípios..."
        : loadingEstabs
          ? "Carregando estabelecimentos..."
          : loadingEstados
            ? "Carregando estados..."
            : "Carregando...";

  const setAssinado = (filename: string, value: boolean) => {
    setAssinados((prev) => {
      const next = { ...prev, [filename]: value };
      localStorage.setItem(ASSINADOS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    persistAssinado(filename, value).catch(() => {
      setErrorMsg("Não foi possível salvar o status no servidor.");
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
      setEstabsByMunicipioId({});
      setCnes("");
      setQuery("");

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
  // Carregar Estabelecimentos de todos os municípios da UF
  // =========================
  useEffect(() => {
    let alive = true;

    async function loadEstabsUf() {
      setEstabsByMunicipioId({});
      if (!API_URL || !uf || municipios.length === 0) return;

      try {
        const missing = municipios.filter((m) => !estabsCache[String(m.municipio_id)]);
        if (missing.length === 0) {
          const nextByMunicipio: Record<string, Estabelecimento[]> = {};
          for (const m of municipios) {
            const id = String(m.municipio_id);
            nextByMunicipio[id] = estabsCache[id] ?? [];
          }
          setEstabsByMunicipioId(nextByMunicipio);
          return;
        }

        setLoadingEstabsUf(true);

        const fetchedPairs: Array<[string, Estabelecimento[]]> = [];
        const CONCURRENCY = 6;
        const queue = [...missing];

        while (queue.length > 0) {
          const batch = queue.splice(0, CONCURRENCY);
          const batchPairs = await Promise.all(
            batch.map(async (m) => {
              try {
                const resp = await fetch(
                  `${API_URL}/estabelecimentos?municipio_id=${encodeURIComponent(
                    m.municipio_id
                  )}`
                );
                const data = (await resp.json()) as Estabelecimento[];
                return [
                  String(m.municipio_id),
                  Array.isArray(data) ? data : ([] as Estabelecimento[]),
                ] as [string, Estabelecimento[]];
              } catch {
                return [String(m.municipio_id), [] as Estabelecimento[]] as [
                  string,
                  Estabelecimento[],
                ];
              }
            })
          );
          fetchedPairs.push(...batchPairs);
        }

        if (!alive) return;
        const nextCache: Record<string, Estabelecimento[]> = {
          ...estabsCache,
        };
        for (const [id, list] of fetchedPairs) nextCache[id] = list;

        const nextByMunicipio: Record<string, Estabelecimento[]> = {};
        for (const m of municipios) {
          const id = String(m.municipio_id);
          nextByMunicipio[id] = nextCache[id] ?? [];
        }

        setEstabsCache(nextCache);
        setEstabsByMunicipioId(nextByMunicipio);
      } finally {
        if (alive) setLoadingEstabsUf(false);
      }
    }

    loadEstabsUf();
    return () => {
      alive = false;
    };
  }, [uf, municipios, estabsCache]);

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
  // Sync assinados (localStorage -> servidor)
  // =========================
  useEffect(() => {
    let alive = true;

    async function syncAssinados() {
      if (!API_URL) return;

      try {
        const resp = await fetch(`${API_URL}/uploads/assinados`);
        const data = (await resp.json()) as AssinadosResponse;
        const serverMap = resp.ok && (data as any).ok ? (data as any).map : {};

        const localMap = loadAssinados();
        const merged: AssinadoMap = { ...serverMap, ...localMap };

        for (const [filename, assinado] of Object.entries(localMap)) {
          if (serverMap?.[filename] !== assinado) {
            await persistAssinado(filename, assinado);
          }
        }

        if (!alive) return;
        setAssinados(merged);
        localStorage.setItem(ASSINADOS_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {
        if (!alive) return;
        console.error(e);
      }
    }

    syncAssinados();
    return () => {
      alive = false;
    };
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

  const totalAssinados = useMemo(() => {
    let count = 0;
    for (const p of pdfs) if (assinados[p.filename]) count += 1;
    return count;
  }, [pdfs, assinados]);

  const totalNaoAssinados = useMemo(
    () => Math.max(pdfs.length - totalAssinados, 0),
    [pdfs.length, totalAssinados]
  );

  const filteredPdfs = useMemo(() => {
    let list = [...pdfs];

    const cnesNorm = normalizeCnes(deferredCnes);

    if (!isValidCnes(cnesNorm)) {
      const allowed = new Set<string>();

      if (estabelecimentos.length > 0) {
        for (const e of estabelecimentos) {
          const cn = normalizeCnes(e.cnes);
          if (cn) allowed.add(cn);
        }
      }

      if (allowed.size === 0 && municipios.length > 0 && deferredUf) {
        for (const m of municipios) {
          const estabsInMunicipio = estabsByMunicipioId[String(m.municipio_id)];
          if (!estabsInMunicipio) continue;
          for (const e of estabsInMunicipio) {
            const cn = normalizeCnes(e.cnes);
            if (cn) allowed.add(cn);
          }
        }
      }

      if (allowed.size > 0) {
        list = list.filter((p) => allowed.has(normalizeCnes(p.cnes)));
      }
    }

    if (isValidCnes(cnesNorm)) {
      list = list.filter((p) => normalizeCnes(p.cnes) === cnesNorm);
    }

    if (deferredStatusFiltro === "ASSINADOS") {
      list = list.filter((p) => Boolean(deferredAssinados[p.filename]));
    } else if (deferredStatusFiltro === "NAO_ASSINADOS") {
      list = list.filter((p) => !deferredAssinados[p.filename]);
    }

    const q = deferredQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const file = String(p.filename || "").toLowerCase();
        const name = friendlyNameFromFilename(p.filename).toLowerCase();
        const cn = normalizeCnes(p.cnes);
        return file.includes(q) || name.includes(q) || cn.includes(q);
      });
    }

    list.sort((a, b) => {
      const da = toDate(a.createdAt)?.getTime() ?? 0;
      const db = toDate(b.createdAt)?.getTime() ?? 0;
      return db - da;
    });

    return list;
  }, [
    pdfs,
    estabelecimentos,
    estabsByMunicipioId,
    municipios,
    deferredCnes,
    deferredUf,
    deferredStatusFiltro,
    deferredQuery,
    deferredAssinados,
  ]);

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
        <CardContent sx={{ p: 4, position: "relative" }}>
          <Backdrop
            sx={{
              position: "absolute",
              zIndex: (theme) => theme.zIndex.drawer + 1,
              color: "#111",
              backgroundColor: "rgba(255,255,255,0.6)",
              borderRadius: 2,
            }}
            open={isBusy}
          >
            <Stack alignItems="center" spacing={1}>
              <CircularProgress size={28} />
              <Typography variant="caption" fontWeight={600}>
                {busyLabel}
              </Typography>
            </Stack>
          </Backdrop>

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
          {uf && loadingEstabsUf && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Carregando estabelecimentos da UF para aplicar o filtro dos PDFs...
            </Alert>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip label={`Total: ${pdfs.length}`} color="default" />
            <Chip label={`Assinados: ${totalAssinados}`} color="success" />
            <Chip label={`Não assinados: ${totalNaoAssinados}`} color="warning" />
          </Stack>

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

          <TextField
            fullWidth
            label="Busca rápida (nome, arquivo ou CNES)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {(loadingPdfs || loadingEstabsUf) && <LinearProgress sx={{ mb: 2 }} />}

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

              <Button
                size="small"
                variant="text"
                onClick={() => setShowCnesFilter((v) => !v)}
                sx={{ textTransform: "none" }}
                endIcon={showCnesFilter ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              >
                {showCnesFilter ? "Minimizar" : "Expandir"}
              </Button>
            </Box>

            <Collapse in={showCnesFilter} timeout="auto" unmountOnExit>
              <Box sx={{ pt: 0.5 }}>
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
            </Collapse>
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

              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={copyCnesNaoAssinados}
                disabled={cnesNaoAssinados.length === 0}
                sx={{ textTransform: "none" }}
              >
                Copiar lista
              </Button>

              <Button
                size="small"
                variant="text"
                onClick={() => setShowNaoAssinadosFilter((v) => !v)}
                sx={{ textTransform: "none" }}
                endIcon={showNaoAssinadosFilter ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              >
                {showNaoAssinadosFilter ? "Minimizar" : "Expandir"}
              </Button>
            </Box>

            <Collapse in={showNaoAssinadosFilter} timeout="auto" unmountOnExit>
              <Box sx={{ pt: 0.5 }}>
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
            </Collapse>
          </Box>


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
