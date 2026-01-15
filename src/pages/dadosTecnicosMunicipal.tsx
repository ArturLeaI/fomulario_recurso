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

// Schema de validação
const schema = yup.object({
  uf: yup.string().required("UF é obrigatória"),
  nomeEstado: yup.string().required("Nome do Estado é obrigatório"),
  municipio: yup.string().required("Município é obrigatório"),
  ibgeMunicipio: yup.string().required("Código IBGE do município é obrigatório"),
});

export default function DadosMunicipio() {
  const navigate = useNavigate();

  const [values, setValues] = useState({
    uf: "",
    nomeEstado: "",
    municipio: "",
    ibgeMunicipio: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [municipios, setMunicipios] = useState<{ nome: string; ibge: string }[]>([]);

  // Atualiza UF, nome do estado e lista de municípios
  const handleUFChange = (uf: string) => {
    const estado = estadosRecurso.find((e) => e.uf === uf);
    if (!estado) return;

    setValues({
      uf: estado.uf,
      nomeEstado: estado.nome,
      municipio: "",
      ibgeMunicipio: "",
    });

    setMunicipios(estado.municipios || []);
    setErrors({});
  };

  // Atualiza município e IBGE do município
  const handleMunicipioChange = (municipioNome: string) => {
    const mun = municipios.find((m) => m.nome === municipioNome);
    setValues((prev) => ({
      ...prev,
      municipio: municipioNome,
      ibgeMunicipio: mun ? mun.ibge : "",
    }));
    setErrors((prev) => ({ ...prev, municipio: "", ibgeMunicipio: "" }));
  };

  // Submissão
  const handleSubmit = async () => {
    try {
      await schema.validate(values, { abortEarly: false });

      // Salva no sessionStorage
      sessionStorage.setItem("dadosMunicipio", JSON.stringify(values));

      navigate("/form-vagas"); // ajuste a rota conforme seu fluxo
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
            Selecione o estado e município para preenchimento do IBGE
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

          {/* Nome do Estado */}
          <TextField
            label="Nome do Estado"
            fullWidth
            value={values.nomeEstado}
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
            onChange={(e) => handleMunicipioChange(e.target.value)}
            sx={{ mb: 3 }}
            disabled={!values.uf}
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

          {/* IBGE Município */}
          <TextField
            label="Código IBGE do Município"
            fullWidth
            value={values.ibgeMunicipio}
            InputProps={{ readOnly: true }}
            error={!!errors.ibgeMunicipio}
            helperText={errors.ibgeMunicipio}
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 3 }} />

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
