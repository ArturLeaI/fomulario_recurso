import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";

// ✅ sua API (pode usar fetch direto se preferir)
async function postGestor(payload: { nome: string; cpf: string; email: string }) {
  const res = await fetch("http://localhost:3000/gestores/validar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // padroniza erro
    const msg =
      data?.error ||
      (Array.isArray(data?.errors) ? data.errors?.[0]?.message : null) ||
      "Erro ao validar/criar gestor";
    throw new Error(msg);
  }

  return data as {
    ok: boolean;
    message: string;
    gestor?: { id: number; nome: string; cpf: string; email: string };
  };
}

const schema = yup.object({
  nome: yup.string().required("Nome é obrigatório"),
  cpf: yup
    .string()
    .required("CPF é obrigatório")
    .matches(/^\d{11}$/, "CPF inválido"),
  email: yup
    .string()
    .required("E-mail é obrigatório")
    .email("E-mail inválido"),
});

export type NivelGestao = "municipal" | "estadual";

const obterNivelGestao = (): NivelGestao | null => {
  const nivel = sessionStorage.getItem("nivelGestao");
  return nivel === "municipal" || nivel === "estadual" ? nivel : null;
};

export default function DadosGestor() {
  const navigate = useNavigate();

  const [values, setValues] = useState({
    nome: "",
    cpf: "",
    email: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
      6,
      9
    )}-${digits.slice(9)}`;
  };

  const handleChange = (field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setApiError("");
  };

  const handleSubmit = async () => {
    setApiError("");

    try {
      setLoading(true);

      // 1) validação yup (CPF sem máscara)
      const payload = {
        nome: values.nome.trim(),
        cpf: values.cpf.replace(/\D/g, ""),
        email: values.email.trim(),
      };

      await schema.validate(payload, { abortEarly: false });

      // 2) chama API: cria ou busca gestor (retorna gestor.id)
      const resp = await postGestor(payload);

      const gestorId = resp?.gestor?.id;
      if (!gestorId) {
        throw new Error("API não retornou gestorId");
      }

      // 3) salva dados para o resto do fluxo
      sessionStorage.setItem("gestorId", String(gestorId));
      sessionStorage.setItem("dadosGestor", JSON.stringify(payload));

      // 4) navegação como você já fazia
      const nivelGestao = obterNivelGestao();
      if (nivelGestao === "municipal") {
        navigate("/form-vagas");
      } else if (nivelGestao === "estadual") {
        navigate("/form-vagas");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      // yup errors
      if (err?.inner) {
        const validationErrors: Record<string, string> = {};
        err.inner.forEach((e: any) => {
          validationErrors[e.path] = e.message;
        });
        setErrors(validationErrors);
      } else {
        setApiError(err?.message || "Erro inesperado");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 520, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography
            variant="h5"
            fontWeight={600}
            textAlign="center"
            gutterBottom
          >
            Dados do Responsável
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            mb={4}
          >
            Preencha os dados do responsável pela solicitação
          </Typography>

          <TextField
            label="Nome completo"
            fullWidth
            value={values.nome}
            error={!!errors.nome}
            helperText={errors.nome}
            onChange={(e) => handleChange("nome", e.target.value)}
            sx={{ mb: 3 }}
            disabled={loading}
          />

          <TextField
            label="CPF"
            fullWidth
            value={values.cpf}
            error={!!errors.cpf}
            helperText={errors.cpf}
            onChange={(e) => handleChange("cpf", formatCPF(e.target.value))}
            inputProps={{ maxLength: 14 }}
            sx={{ mb: 3 }}
            disabled={loading}
          />

          <TextField
            label="E-mail"
            type="email"
            fullWidth
            value={values.email}
            error={!!errors.email}
            helperText={errors.email}
            onChange={(e) => handleChange("email", e.target.value)}
            sx={{ mb: 2 }}
            disabled={loading}
          />

          {apiError && (
            <Typography color="error" variant="body2" sx={{ mb: 2 }}>
              {apiError}
            </Typography>
          )}

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Enviando..." : "Continuar"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}