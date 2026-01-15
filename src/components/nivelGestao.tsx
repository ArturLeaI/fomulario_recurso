import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
} from "@mui/material";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import PublicIcon from "@mui/icons-material/Public";

export type NivelGestao = "municipal" | "estadual";

export default function Home() {
  const navigate = useNavigate();

  const handleSelectNivel = (nivel: NivelGestao) => {
    // Persistência simples (pode virar Context depois)
    sessionStorage.setItem("nivelGestao", nivel);

    // Fluxo inicial
    navigate("/recurso");
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Card sx={{ width: "100%", p: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Projeto Mais Médicos Especialistas
          </Typography>

          <Typography variant="body2" color="text.secondary" mb={3}>
            Selecione o nível de gestão para iniciar o processo
          </Typography>

          <Box
            display="grid"
            gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
            gap={2}
          >
            <Button
              variant="outlined"
              size="large"
              onClick={() => handleSelectNivel("municipal")}
              sx={{
                py: 3,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              <LocationCityIcon sx={{ fontSize: 40 }} />
              <Typography fontWeight={600}>Municipal</Typography>
              <Typography variant="caption" color="text.secondary">
                Seleção de um único município
              </Typography>
            </Button>

            <Button
              variant="outlined"
              size="large"
              onClick={() => handleSelectNivel("estadual")}
              sx={{
                py: 3,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              <PublicIcon sx={{ fontSize: 40 }} />
              <Typography fontWeight={600}>Estadual</Typography>
              <Typography variant="caption" color="text.secondary">
                Seleção de múltiplos municípios da UF
              </Typography>
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
