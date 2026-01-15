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

// Função utilitária para ler o nível salvo
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

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6)
      return `${digits.slice(0, 3)}.${digits.slice(3)}`;
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
  };

  const handleSubmit = async () => {
    try {
      await schema.validate(
        {
          ...values,
          cpf: values.cpf.replace(/\D/g, ""),
        },
        { abortEarly: false }
      );

      // Salva os dados do gestor
      sessionStorage.setItem("dadosGestor", JSON.stringify(values));

      // Lê o nível de gestão salvo anteriormente
      const nivelGestao = obterNivelGestao();

      if (nivelGestao === "municipal") {
        navigate("/dados-municipio"); // Rota para municipal
      } else if (nivelGestao === "estadual") {
        navigate("/dados-estadual"); // Rota para estadual
      } else {
        // fallback caso não exista nível selecionado
        navigate("/");
      }
    } catch (err: any) {
      const validationErrors: Record<string, string> = {};
      err.inner?.forEach((error: any) => {
        validationErrors[error.path] = error.message;
      });
      setErrors(validationErrors);
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
          />

          <TextField
            label="E-mail"
            type="email"
            fullWidth
            value={values.email}
            error={!!errors.email}
            helperText={errors.email}
            onChange={(e) => handleChange("email", e.target.value)}
            sx={{ mb: 4 }}
          />

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleSubmit}
          >
            Continuar
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
