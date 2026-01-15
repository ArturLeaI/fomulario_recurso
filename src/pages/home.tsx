import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
} from "@mui/material";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import PublicIcon from "@mui/icons-material/Public";

export type NivelGestao = "municipal" | "estadual";

// Função utilitária para salvar o nível no sessionStorage
export const salvarNivelGestao = (nivel: NivelGestao) => {
  sessionStorage.setItem("nivelGestao", nivel);
};

// Função utilitária para ler o nível salvo
export const obterNivelGestao = (): NivelGestao | null => {
  const nivel = sessionStorage.getItem("nivelGestao");
  return nivel === "municipal" || nivel === "estadual" ? nivel : null;
};

export default function Home() {
  const navigate = useNavigate();

  // Função de seleção de nível
  const handleSelectNivel = useCallback(
    (nivel: NivelGestao) => {
      salvarNivelGestao(nivel);
      navigate("/dados-gestor");
    },
    [navigate]
  );

  // Botões de seleção configuráveis
  const botoes: { nivel: NivelGestao; title: string; subtitle: string; icon: React.ReactNode; }[] =
    [
      {
        nivel: "municipal",
        title: "Municipal",
        subtitle: "Seleção de um único município",
        icon: <LocationCityIcon sx={{ fontSize: 40 }} />,
      },
      {
        nivel: "estadual",
        title: "Estadual",
        subtitle: "Seleção de múltiplos municípios da UF",
        icon: <PublicIcon sx={{ fontSize: 40 }} />,
      },
    ];

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
            Projeto Mais Médicos Especialistas
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            mb={4}
          >
            Selecione o nível de gestão para iniciar o processo
          </Typography>

          <Box
            display="grid"
            gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
            gap={2}
          >
            {botoes.map((botao) => (
              <Button
                key={botao.nivel}
                variant="outlined"
                size="large"
                onClick={() => handleSelectNivel(botao.nivel)}
                sx={{
                  py: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                }}
              >
                {botao.icon}
                <Typography fontWeight={600}>{botao.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {botao.subtitle}
                </Typography>
              </Button>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
