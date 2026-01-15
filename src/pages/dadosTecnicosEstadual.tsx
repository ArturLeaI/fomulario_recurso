import { useState } from "react";
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
import { estadosRecurso } from "../data/ufIbge";

// Schema de validação incluindo município
const schema = yup.object({
  uf: yup.string().required("UF é obrigatória"),
  ibge: yup.string().required("Código IBGE é obrigatório"),
  nomeEstado: yup.string().required("Nome do Estado é obrigatório"),
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
  const [municipios, setMunicipios] = useState<{ nome: string; ibge: string }[]>([]);

  // Atualiza estado e lista de municípios ao selecionar UF
  const handleUFChange = (uf: string) => {
    const estado = estadosRecurso.find((e) => e.uf === uf);
    if (!estado) return;

    setValues({
      uf: estado.uf,
      ibge: estado.ibge,
      nomeEstado: estado.nome,
      municipio: "", // resetar município ao mudar UF
    });

    setMunicipios(estado.municipios || []);
    setErrors({});
  };

  // Submissão com validação
  const handleSubmit = async () => {
    try {
      await schema.validate(values, { abortEarly: false });

      // Salva no sessionStorage
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

          {/* SELECT UF */}
          <TextField
            select
            label="UF do Estado"
            fullWidth
            value={values.uf}
            error={!!errors.uf}
            helperText={errors.uf}
            onChange={(e) => handleUFChange(e.target.value)}
            sx={{ mb: 3 }}
          >
            <MenuItem value="">
              <em>Selecione</em>
            </MenuItem>

            {estadosRecurso.map((estado) => (
              <MenuItem key={estado.uf} value={estado.uf}>
                {estado.uf}
              </MenuItem>
            ))}
          </TextField>

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
            label="Nome do Estado"
            fullWidth
            value={values.nomeEstado}
            error={!!errors.nomeEstado}
            helperText={errors.nomeEstado}
            InputProps={{ readOnly: true }}
            sx={{ mb: 3 }}
          />

          {/* SELECT Município */}
          <TextField
            select
            label="Município"
            fullWidth
            value={values.municipio}
            error={!!errors.municipio}
            helperText={errors.municipio}
            onChange={(e) => setValues({ ...values, municipio: e.target.value })}
            sx={{ mb: 3 }}
            disabled={!values.uf} // só habilita se UF estiver selecionado
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
