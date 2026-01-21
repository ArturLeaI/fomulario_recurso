import { useMemo, useState } from "react";
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
const API_BASE = import.meta.env.API_URL;

type UploadFile = {
    key: string;
    label: string;
    file: File | null;
};

function isPdf(file: File) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function UploadArquivos() {
    const navigate = useNavigate();

    // Ajuste os rótulos conforme seus PDFs
    const [files, setFiles] = useState<UploadFile[]>([
        { key: "termo", label: "Termo (PDF)", file: null },
        { key: "recurso", label: "Recurso (PDF) — se aplicável", file: null },
    ]);

    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string>("");
    const [successMsg, setSuccessMsg] = useState<string>("");

    const hasAtLeastOnePdf = useMemo(() => files.some((f) => f.file), [files]);

    const setFileByKey = (key: string, file: File | null) => {
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, file } : f)));
    };

    const handlePickFile = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMsg("");
        setSuccessMsg("");

        const file = e.target.files?.[0] ?? null;
        if (!file) return;

        if (!isPdf(file)) {
            setErrorMsg("Envie apenas arquivos PDF.");
            return;
        }

        setFileByKey(key, file);

        // permite re-selecionar o mesmo arquivo
        e.target.value = "";
    };

    const removeFile = (key: string) => {
        setErrorMsg("");
        setSuccessMsg("");
        setFileByKey(key, null);
    };

    // Drag & drop: se cair 1 pdf, coloca no primeiro slot vazio
    const handleDrop = (ev: React.DragEvent) => {
        ev.preventDefault();
        setDragOver(false);
        setErrorMsg("");
        setSuccessMsg("");

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

    const API_BASE = import.meta.env.VITE_API_URL || "${API_BASE}";

    const handleUpload = async () => {
        setErrorMsg("");
        setSuccessMsg("");

        if (!hasAtLeastOnePdf) {
            setErrorMsg("Selecione pelo menos 1 PDF para enviar.");
            return;
        }

        try {
            setLoading(true);

            const gestorId = sessionStorage.getItem("gestorId") || "";
            const acaoVagaResposta = sessionStorage.getItem("acaoVagaResposta") || "";

            const uploaded: Array<{ key: string; filename: string }> = [];

            for (const item of files) {
                if (!item.file) continue;

                const form = new FormData();
                form.append("file", item.file); // ✅ backend espera "file"
                if (gestorId) form.append("gestorId", gestorId);
                if (acaoVagaResposta) form.append("acaoVagaResposta", acaoVagaResposta);
                form.append("docType", item.key); // "termo" | "recurso" (opcional, mas ajuda)

                const resp = await fetch(`${API_BASE}/uploads`, {
                    method: "POST",
                    body: form,
                });

                if (!resp.ok) {
                    const txt = await resp.text().catch(() => "");
                    throw new Error(txt || `Falha ao enviar ${item.label}`);
                }

                const data = await resp.json();
                uploaded.push({ key: item.key, filename: data.filename });
            }

            sessionStorage.setItem("uploadedFiles", JSON.stringify(uploaded));
            setSuccessMsg("Arquivos enviados com sucesso!");

            // ✅ se quiser ir pra próxima tela após upload
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
                        Envie o Termo e, se existir, o Recurso em PDF.
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

                    {/* Área drag/drop */}
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

                    {/* Slots */}
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
                                        <IconButton edge="end" onClick={() => removeFile(item.key)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    ) : null
                                }
                            >
                                <ListItemText
                                    primary={<Typography fontWeight={700}>{item.label}</Typography>}
                                    secondary={
                                        item.file ? (
                                            <>
                                                <Typography variant="caption" display="block">
                                                    {item.file.name} • {(item.file.size / 1024).toFixed(1)} KB
                                                </Typography>
                                            </>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary">
                                                Nenhum arquivo selecionado
                                            </Typography>
                                        )
                                    }
                                />

                                <Button
                                    variant={item.file ? "outlined" : "contained"}
                                    component="label"
                                    startIcon={<UploadFileIcon />}
                                    sx={{ ml: 2, textTransform: "none", whiteSpace: "nowrap" }}
                                    disabled={loading}
                                >
                                    {item.file ? "Trocar PDF" : "Selecionar PDF"}
                                    <input hidden type="file" accept="application/pdf" onChange={handlePickFile(item.key)} />
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
