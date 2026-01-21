import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
const API_URL = import.meta.env.VITE_API_URL as string;

// =====================
// Tipagens
// =====================
interface Estado {
  id: number;
  uf: string;
  nome: string;
  ibge: string;
}

interface Municipio {
  id: number;
  nome: string;
  ibge: string;
}

// =====================
// Schema
// =====================
const schema = yup.object({
  uf: yup.string().required("UF é obrigatória"),
  ibge: yup.string().required("Código IBGE é obrigatório"),
  nomeEstado: yup.string().required("Nome do estado é obrigatório"),
  municipio: yup.string().required("Município é obrigatório"),
});

export default function DadosEstado() {
  const navigate = useNavigate();

  const [values, setValues] = useState({
    uf: "",
    ibge: "",
    nomeEstado: "",
    municipio: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingEstados, setLoadingEstados] = useState(true);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  // =====================
  // Buscar estados
  // =====================
  useEffect(() => {
    async function carregarEstados() {
      try {
        const res = await fetch(`${API_URL}/localidades/estados`);
        const data = await res.json();
        setEstados(data);
      } catch (error) {
        console.error("Erro ao carregar estados", error);
      } finally {
        setLoadingEstados(false);
      }
    }

    carregarEstados();
  }, []);

  // =====================
  // Ao selecionar UF
  // =====================
  const handleUFChange = async (uf: string) => {
    const estado = estados.find((e) => e.uf === uf);
    if (!estado) return;

    setValues({
      uf: estado.uf,
      ibge: estado.ibge,
      nomeEstado: estado.nome,
      municipio: "",
    });

    setErrors({});
    setLoadingMunicipios(true);
    setMunicipios([]);

    try {
      const res = await fetch(
        `${API_URL}/localidades/municipios/${uf}`
      );
      const data = await res.json();
      setMunicipios(data);
    } catch (error) {
      console.error("Erro ao carregar municípios", error);
    } finally {
      setLoadingMunicipios(false);
    }
  };

  // =====================
  // Submit
  // =====================
  const handleSubmit = async () => {
    try {
      await schema.validate(values, { abortEarly: false });
      sessionStorage.setItem("dadosEstado", JSON.stringify(values));
      navigate("/form-vagas");
    } catch (err: any) {
      const validationErrors: Record<string, string> = {};
      err.inner.forEach((error: any) => {
        validationErrors[error.path] = error.message;
      });
      setErrors(validationErrors);
    }
  };

  // =====================
  // Render
  // =====================
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
      <Card sx={{ width: "100%", maxWidth: 560, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={600} textAlign="center" gutterBottom>
            Dados do Estado
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            mb={3}
          >
            Preencha os dados do ente estadual responsável
          </Typography>

          {/* UF */}
          <TextField
            select
            label="UF do Estado"
            fullWidth
            value={values.uf}
            error={!!errors.uf}
            helperText={errors.uf}
            onChange={(e) => handleUFChange(e.target.value)}
            sx={{ mb: 3 }}
            disabled={loadingEstados}
          >
            <MenuItem value="">
              <em>Selecione</em>
            </MenuItem>

            {estados.map((estado) => (
              <MenuItem key={estado.id} value={estado.uf}>
                {estado.uf}
              </MenuItem>
            ))}
          </TextField>

          {loadingEstados && (
            <Box textAlign="center" mb={3}>
              <CircularProgress size={24} />
            </Box>
          )}

          {/* IBGE */}
          <TextField
            label="Código IBGE do Estado"
            fullWidth
            value={values.ibge}
            error={!!errors.ibge}
            helperText={errors.ibge}
            InputProps={{ readOnly: true }}
            sx={{ mb: 3 }}
          />

          {/* Nome */}
          <TextField
            label="Nome do estado"
            fullWidth
            value={values.nomeEstado}
            error={!!errors.nomeEstado}
            helperText={errors.nomeEstado}
            InputProps={{ readOnly: true }}
            sx={{ mb: 3 }}
          />

          {/* Município */}
          <TextField
            select
            label="Município"
            fullWidth
            value={values.municipio}
            error={!!errors.municipio}
            helperText={errors.municipio}
            onChange={(e) =>
              setValues({ ...values, municipio: e.target.value })
            }
            sx={{ mb: 3 }}
            disabled={!values.uf || loadingMunicipios}
          >
            <MenuItem value="">
              <em>Selecione</em>
            </MenuItem>

            {municipios.map((mun) => (
              <MenuItem key={mun.id} value={mun.nome}>
                {mun.nome}
              </MenuItem>
            ))}
          </TextField>

          {loadingMunicipios && (
            <Box textAlign="center" mb={3}>
              <CircularProgress size={24} />
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="body2" color="text.secondary" mb={4}>
            Indicar para qual município deve ser feita a interposição abaixo.
          </Typography>

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