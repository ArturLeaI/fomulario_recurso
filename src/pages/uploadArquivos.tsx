import { useMemo, useRef, useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Divider,
    List,
    ListItem,
    ListItemText,
    IconButton,
    LinearProgress,
    Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL as string;

type UploadFile = {
    key: "termo" | "recurso";
    label: string;
    file: File | null;
};

function isPdf(file: File) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isValidCnes(value: unknown) {
    return /^\d{7}$/.test(String(value ?? "").trim());
}

/**
 * ✅ CNES vem do sessionStorage (definido na página anterior)
 * - se não existir, tenta fallback na acaoVagaResposta (legado)
 */
function getCnesForUpload(): string {
    const direct = String(sessionStorage.getItem("cnesPrincipalUpload") || "").trim();
    if (isValidCnes(direct)) return direct;

    const raw = sessionStorage.getItem("acaoVagaResposta");
    if (!raw) return "";

    try {
        const obj = JSON.parse(raw);

        const directFromResp = String(obj?.cnes ?? "").trim();
        if (isValidCnes(directFromResp)) return directFromResp;

        const candidatesArrays: any[] = [
            obj?.cursosAdicionar,
            obj?.cursos_adicionar,
            obj?.cursos,
            obj?.cursosRemover,
            obj?.cursos_remover,
            obj?.payload?.cursos,
            obj?.payload?.cursosAdicionar,
            obj?.payload?.cursosRemover,
            obj?.data?.cursos,
        ].filter(Array.isArray);

        for (const arr of candidatesArrays) {
            const firstWithCnes = arr.find((x: any) => isValidCnes(x?.cnes));
            if (firstWithCnes) return String(firstWithCnes.cnes).trim();
        }

        const nested =
            String(obj?.data?.cnes ?? "").trim() ||
            String(obj?.result?.cnes ?? "").trim() ||
            String(obj?.res?.cnes ?? "").trim();

        if (isValidCnes(nested)) return nested;

        return "";
    } catch {
        return "";
    }
}

export default function UploadArquivos() {
    const navigate = useNavigate();

    const [files, setFiles] = useState<UploadFile[]>([
        { key: "termo", label: "Termo de Adesão (Pdf)", file: null },
        { key: "recurso", label: "Termo de Estabelecimento (Pdf) — se aplicável", file: null },
    ]);

    // ✅ refs por tipo de documento (garante que cada botão abre o input certo)
    const inputRefs = useRef<Record<UploadFile["key"], HTMLInputElement | null>>({
        termo: null,
        recurso: null,
    });

    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const hasAtLeastOnePdf = useMemo(() => files.some((f) => !!f.file), [files]);

    const resetMsgs = () => {
        setErrorMsg("");
        setSuccessMsg("");
    };

    const setFileByKey = (key: UploadFile["key"], file: File | null) => {
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, file } : f)));
    };

    const handlePickFile =
        (key: UploadFile["key"]) => (e: React.ChangeEvent<HTMLInputElement>) => {
            resetMsgs();

            const file = e.target.files?.[0] ?? null;
            if (!file) return;

            if (!isPdf(file)) {
                setErrorMsg("Envie apenas arquivos PDF.");
                return;
            }

            setFileByKey(key, file);

            // ✅ importante: permite escolher o mesmo arquivo de novo e disparar onChange
            e.currentTarget.value = "";
        };

    const removeFile = (key: UploadFile["key"]) => {
        resetMsgs();
        setFileByKey(key, null);
    };

    const handleDrop = (ev: React.DragEvent) => {
        ev.preventDefault();
        setDragOver(false);
        resetMsgs();

        const dropped = Array.from(ev.dataTransfer.files || []);
        const pdfs = dropped.filter(isPdf);

        if (pdfs.length === 0) {
            setErrorMsg("Arraste apenas arquivos PDF.");
            return;
        }

        setFiles((prev) => {
            const next = [...prev];
            for (const pdf of pdfs) {
                const idx = next.findIndex((x) => !x.file);
                if (idx === -1) break;
                next[idx] = { ...next[idx], file: pdf };
            }
            return next;
        });
    };

    const uploadOne = async (docType: UploadFile["key"], file: File, cnes: string) => {
        const gestorId = sessionStorage.getItem("gestorId") || "";
        const acaoVagaResposta = sessionStorage.getItem("acaoVagaResposta") || "";

        const form = new FormData();
        form.append("file", file);
        form.append("cnes", cnes);
        form.append("docType", docType);

        if (gestorId) form.append("gestorId", gestorId);
        if (acaoVagaResposta) form.append("acaoVagaResposta", acaoVagaResposta);

        const resp = await fetch(`${API_BASE}/uploads`, {
            method: "POST",
            body: form,
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(txt || `Falha ao enviar ${docType}`);
        }

        return (await resp.json()) as { filename: string };
    };

    const handleUpload = async () => {
        resetMsgs();

        if (!hasAtLeastOnePdf) {
            setErrorMsg("Selecione pelo menos 1 PDF para enviar.");
            return;
        }

        if (!API_BASE) {
            setErrorMsg("VITE_API_URL não configurado no .env do front.");
            return;
        }

        const cnes = getCnesForUpload();
        if (!isValidCnes(cnes)) {
            setErrorMsg("CNES não encontrado ou inválido. Volte e selecione o estabelecimento.");
            return;
        }

        try {
            setLoading(true);

            const uploaded: Array<{ key: UploadFile["key"]; filename: string }> = [];

            for (const item of files) {
                if (!item.file) continue;
                const data = await uploadOne(item.key, item.file, cnes);
                uploaded.push({ key: item.key, filename: data.filename });
            }

            sessionStorage.setItem("uploadedFiles", JSON.stringify(uploaded));
            setSuccessMsg("Arquivos enviados com sucesso!");
            navigate("/proximo-passo");
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err?.message || "Erro ao enviar arquivos.");
        } finally {
            setLoading(false);
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
            <Card sx={{ width: "100%", maxWidth: 720, boxShadow: 3 }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" fontWeight={700} textAlign="center" gutterBottom>
                        Upload dos Documentos Assinados
                    </Typography>

                    <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
                        Envie o Termo de Adesão e, se necessário, o Termo de Estabelecimento.
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

                    <Box
                        onDragOver={(ev) => {
                            ev.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        sx={{
                            border: "2px dashed",
                            borderColor: dragOver ? "primary.main" : "grey.300",
                            borderRadius: 2,
                            p: 3,
                            mb: 3,
                            textAlign: "center",
                            backgroundColor: dragOver ? "rgba(25,118,210,0.06)" : "transparent",
                            transition: "all .2s ease",
                        }}
                    >
                        <CloudUploadIcon sx={{ fontSize: 40, mb: 1 }} color={dragOver ? "primary" : "action"} />
                        <Typography fontWeight={600}>Arraste e solte PDFs aqui</Typography>
                        <Typography variant="body2" color="text.secondary">
                            (ou selecione nos botões abaixo)
                        </Typography>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <List disablePadding sx={{ mb: 2 }}>
                        {files.map((item) => (
                            <ListItem
                                key={item.key}
                                sx={{
                                    border: "1px solid",
                                    borderColor: "grey.200",
                                    borderRadius: 2,
                                    mb: 1.5,
                                }}
                                secondaryAction={
                                    item.file ? (
                                        <IconButton edge="end" onClick={() => removeFile(item.key)} disabled={loading}>
                                            <DeleteIcon />
                                        </IconButton>
                                    ) : null
                                }
                            >
                                <ListItemText
                                    primary={<Typography fontWeight={700}>{item.label}</Typography>}
                                    secondary={
                                        item.file ? (
                                            <Typography variant="caption" display="block">
                                                {item.file.name} • {(item.file.size / 1024).toFixed(1)} KB
                                            </Typography>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary">
                                                Nenhum arquivo selecionado
                                            </Typography>
                                        )
                                    }
                                />

                                {/* ✅ input escondido (um por item), com ref específico */}
                                <input
                                    ref={(el) => {
                                        inputRefs.current[item.key] = el;
                                    }}
                                    type="file"
                                    accept="application/pdf"
                                    hidden
                                    onChange={handlePickFile(item.key)}
                                />

                                {/* ✅ botão chama o input correto */}
                                <Button
                                    variant={item.file ? "outlined" : "contained"}
                                    startIcon={<UploadFileIcon />}
                                    sx={{ ml: 2, textTransform: "none", whiteSpace: "nowrap" }}
                                    disabled={loading}
                                    onClick={() => inputRefs.current[item.key]?.click()}
                                >
                                    {item.file ? "Trocar PDF" : "Selecionar PDF"}
                                </Button>
                            </ListItem>
                        ))}
                    </List>

                    {loading && <LinearProgress sx={{ mb: 2 }} />}

                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={handleUpload}
                        disabled={loading || !hasAtLeastOnePdf}
                        sx={{ py: 1.6, fontWeight: 700, borderRadius: 2, textTransform: "none" }}
                    >
                        Enviar arquivos
                    </Button>

                    <Button
                        variant="text"
                        fullWidth
                        onClick={() => navigate(-1)}
                        disabled={loading}
                        sx={{ mt: 1, textTransform: "none" }}
                    >
                        Voltar
                    </Button>
                </CardContent>
            </Card>
        </Box>
    );
}
