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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL as string;

type EstadoApi = { uf: string; nome: string };
type MunicipioApi = { nome: string; ibge: string; municipio_id: string };
type Estabelecimento = { id: string | number; nome: string; cnes: string };

type PdfItem = {
    filename: string;
    cnes: string | null;
    sizeKB: number;
    createdAt: string | Date;
    url: string; // vem do backend: /uploads/<arquivo>
};

type PdfListResponse =
    | { ok: true; total: number; files: PdfItem[] }
    | { ok: false; message: string };

function isValidCnes(v: unknown) {
    return /^\d{7}$/.test(String(v ?? "").trim());
}

// tenta transformar o createdAt em Date com segurança
function toDate(value: any) {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
}

function formatPtBrDate(value: any) {
    const d = toDate(value);
    if (!d) return "-";
    return d.toLocaleString("pt-BR");
}

// tenta tirar o nome base (antes do __CNES-...__)
function friendlyNameFromFilename(filename: string) {
    const parts = String(filename).split("__CNES-");
    const base = parts[0] || filename;
    return base.replace(/_/g, " ").trim();
}

export default function ListarPdfs() {
    const navigate = useNavigate();

    const [estados, setEstados] = useState<EstadoApi[]>([]);
    const [municipios, setMunicipios] = useState<MunicipioApi[]>([]);
    const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);

    const [uf, setUf] = useState("");
    const [municipioId, setMunicipioId] = useState<string>("");
    const [cnes, setCnes] = useState<string>("");

    const [pdfs, setPdfs] = useState<PdfItem[]>([]);
    const [loadingEstados, setLoadingEstados] = useState(false);
    const [loadingMunicipios, setLoadingMunicipios] = useState(false);
    const [loadingEstabs, setLoadingEstabs] = useState(false);
    const [loadingPdfs, setLoadingPdfs] = useState(false);

    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const canLoadMunicipios = Boolean(uf);
    const canLoadEstabs = Boolean(municipioId);

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

            if (!API_URL || !uf) return;

            try {
                setLoadingMunicipios(true);
                const resp = await fetch(`${API_URL}/localidades/municipios?uf=${encodeURIComponent(uf)}`);
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
    // Carregar PDFs (lista)
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
    const filteredPdfs = useMemo(() => {
        let list = [...pdfs];

        if (isValidCnes(cnes)) {
            list = list.filter((p) => String(p.cnes ?? "").trim() === String(cnes).trim());
        }

        // ordena mais recentes primeiro
        list.sort((a, b) => {
            const da = toDate(a.createdAt)?.getTime() ?? 0;
            const db = toDate(b.createdAt)?.getTime() ?? 0;
            return db - da;
        });

        return list;
    }, [pdfs, cnes]);

    const selectedMunicipioName = useMemo(() => {
        const m = municipios.find((x) => String(x.municipio_id) === String(municipioId));
        return m?.nome || "";
    }, [municipios, municipioId]);

    const selectedEstab = useMemo(() => {
        if (!cnes) return null;
        return estabelecimentos.find((e) => e.cnes === cnes) || null;
    }, [estabelecimentos, cnes]);

    const handleClear = () => {
        setUf("");
        setMunicipioId("");
        setCnes("");
        setErrorMsg("");
        setSuccessMsg("");
    };

    const joinUrl = (base: string, pathname: string) => {
        const b = String(base || "").replace(/\/+$/, "");
        const p = String(pathname || "").replace(/^\/+/, "");
        return `${b}/${p}`;
    };

    const openPdf = (item: PdfItem) => {
        // monta /uploads/<filename> garantindo encode
        const path = `uploads/${encodeURIComponent(item.filename)}`;
        const fullUrl = joinUrl(API_URL, path);

        window.open(fullUrl, "_blank", "noopener,noreferrer");
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
                        Filtre por UF, Município e Estabelecimento (CNES) para localizar os documentos.
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
                        <Grid size={{ xs: 12, md: 4 }}>
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

                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                                select
                                fullWidth
                                label="Município"
                                value={municipioId}
                                onChange={(e) => setMunicipioId(String(e.target.value))}
                                disabled={!canLoadMunicipios || loadingMunicipios}
                            >
                                <MenuItem value="">
                                    <em>{!uf ? "Selecione UF" : loadingMunicipios ? "Carregando..." : "Selecione"}</em>
                                </MenuItem>
                                {municipios.map((m) => (
                                    <MenuItem key={m.municipio_id} value={m.municipio_id}>
                                        {m.nome}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>

                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                                select
                                fullWidth
                                label="Estabelecimento (CNES)"
                                value={cnes}
                                onChange={(e) => setCnes(String(e.target.value))}
                                disabled={!canLoadEstabs || loadingEstabs}
                            >
                                <MenuItem value="">
                                    <em>{!municipioId ? "Selecione Município" : loadingEstabs ? "Carregando..." : "Selecione"}</em>
                                </MenuItem>
                                {estabelecimentos.map((est) => (
                                    <MenuItem key={est.cnes} value={est.cnes}>
                                        {est.nome} (CNES: {est.cnes})
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                    </Grid>

                    {/* chips de contexto */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                        {uf && <Chip label={`UF: ${uf}`} />}
                        {municipioId && <Chip label={`Município: ${selectedMunicipioName || municipioId}`} />}
                        {cnes && <Chip label={`CNES: ${cnes}${selectedEstab ? ` — ${selectedEstab.nome}` : ""}`} />}
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
                                        <Box sx={{ display: "flex", gap: 1 }}>
                                            <IconButton onClick={() => openPdf(p)} title="Abrir" edge="end">
                                                <OpenInNewIcon />
                                            </IconButton>
                                        </Box>
                                    }
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <PictureAsPdfIcon fontSize="small" />
                                                <Typography fontWeight={800}>{friendlyNameFromFilename(p.filename)}</Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box sx={{ mt: 0.5 }}>
                                                <Typography variant="caption" display="block">
                                                    Arquivo: {p.filename}
                                                </Typography>
                                                <Typography variant="caption" display="block">
                                                    CNES: {p.cnes ?? "-"} • Tamanho: {p.sizeKB} KB • Criado em: {formatPtBrDate(p.createdAt)}
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
