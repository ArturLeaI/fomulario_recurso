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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL as string;

// Schema de validação (mantém apenas os campos visíveis)
const schema = yup.object({
  uf: yup.string().required("UF é obrigatória"),
  nomeEstado: yup.string().required("Nome do Estado é obrigatório"),
  municipio: yup.string().required("Município é obrigatório"),
  ibgeMunicipio: yup.string().required("Código IBGE do município é obrigatório"),
});

type Estado = {
  uf: string;
  nome: string;
};

type Municipio = {
  nome: string;
  ibge: string;
  municipio_id: string; // Adicionado da API
};

type FormValues = {
  uf: string;
  nomeEstado: string;
  municipio: string;
  ibgeMunicipio: string;
};

export default function DadosMunicipio() {
  const navigate = useNavigate();

  const [formValues, setFormValues] = useState<FormValues>({
    uf: "",
    nomeEstado: "",
    municipio: "",
    ibgeMunicipio: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipioId, setMunicipioId] = useState<string>(""); // Estado separado para o ID

  // 🔹 Carrega estados ao montar a página
  useEffect(() => {
    async function carregarEstados() {
      try {
        const response = await axios.get<Estado[]>(
          `${API_URL}/localidades/estados`
        );
        setEstados(response.data);
      } catch (error) {
        console.error("Erro ao carregar estados:", error);
      }
    }

    carregarEstados();
  }, []);

  // 🔹 Quando seleciona UF
  const handleUFChange = async (uf: string) => {
    const estadoSelecionado = estados.find((e) => e.uf === uf);
    if (!estadoSelecionado) return;

    // Limpa os valores
    setFormValues({
      uf,
      nomeEstado: estadoSelecionado.nome,
      municipio: "",
      ibgeMunicipio: "",
    });

    setMunicipioId(""); // Limpa o ID
    setErrors({});
    setMunicipios([]);

    try {
      // Busca municípios da UF
      const response = await axios.get<Municipio[]>(
        `http://localhost:3000/localidades/municipios?uf=${uf}`
      );

      setMunicipios(response.data);
    } catch (error) {
      console.error("Erro ao carregar municípios:", error);
    }
  };

  // 🔹 Quando seleciona município
  const handleMunicipioChange = (municipioNome: string) => {
    const municipioSelecionado = municipios.find((m) => m.nome === municipioNome);

    if (municipioSelecionado) {
      setFormValues((prev) => ({
        ...prev,
        municipio: municipioNome,
        ibgeMunicipio: municipioSelecionado.ibge,
      }));

      // Armazena o municipio_id separadamente (vindo da API)
      setMunicipioId(municipioSelecionado.municipio_id);

      setErrors((prev) => ({ 
        ...prev, 
        municipio: "", 
        ibgeMunicipio: "" 
      }));
    }
  };

  // 🔹 Submissão final
  const handleSubmit = async () => {
    try {
      // Valida apenas os campos do formulário
      await schema.validate(formValues, { abortEarly: false });

      // Cria objeto com todos os dados incluindo o municipio_id
      const dadosCompletos = {
        ...formValues,
        municipio_id: municipioId, // Adiciona o ID da API
      };

      // Armazena no sessionStorage
      sessionStorage.setItem("dadosMunicipio", JSON.stringify(dadosCompletos));

      // Para verificação (opcional)
      console.log("Dados armazenados:", dadosCompletos);

      // Navega para a próxima página
      navigate("/form-vagas");
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 560, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={600} textAlign="center" gutterBottom>
            Dados do Município
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            mb={3}
          >
            Selecione o estado e o município
          </Typography>

          {/* UF */}
          <TextField
            select
            label="UF do Estado"
            fullWidth
            value={formValues.uf}
            error={!!errors.uf}
            helperText={errors.uf}
            onChange={(e) => handleUFChange(e.target.value)}
            sx={{ mb: 3 }}
          >
            <MenuItem value="">
              <em>Selecione</em>
            </MenuItem>
            {estados.map((estado) => (
              <MenuItem key={estado.uf} value={estado.uf}>
                {estado.uf}
              </MenuItem>
            ))}
          </TextField>

          {/* Nome do Estado */}
          <TextField
            label="Nome do Estado"
            fullWidth
            value={formValues.nomeEstado}
            InputProps={{ readOnly: true }}
            sx={{ mb: 3 }}
          />

          {/* Município */}
          <TextField
            select
            label="Município"
            fullWidth
            value={formValues.municipio}
            error={!!errors.municipio}
            helperText={errors.municipio}
            onChange={(e) => handleMunicipioChange(e.target.value)}
            sx={{ mb: 3 }}
            disabled={!formValues.uf}
          >
            <MenuItem value="">
              <em>Selecione</em>
            </MenuItem>
            {municipios.map((mun) => (
              <MenuItem key={mun.ibge} value={mun.nome}>
                {mun.nome}
              </MenuItem>
            ))}
          </TextField>

          {/* IBGE */}
          <TextField
            label="Código IBGE do Município"
            fullWidth
            value={formValues.ibgeMunicipio}
            InputProps={{ readOnly: true }}
            error={!!errors.ibgeMunicipio}
            helperText={errors.ibgeMunicipio}
            sx={{ mb: 3 }}
          />

          {/* Campo oculto para debug (opcional) */}
          <input type="hidden" value={municipioId} />

          <Divider sx={{ my: 3 }} />

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleSubmit}
            disabled={!municipioId} // Opcional: desabilita se não tiver municipio_id
          >
            Continuar
          </Button>

          {/* Para debug - mostrar o municipio_id (opcional) */}
          {process.env.NODE_ENV === 'development' && (
            <Typography variant="caption" color="text.secondary" mt={2} display="block">
              ID do Município: {municipioId || "Não selecionado"}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}