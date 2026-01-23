import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../pages/home";
import DadosGestor from "../pages/dadosGestor"
import DadosEstadual from "../pages/dadosTecnicosEstadual";
import DadosMunicipio from "../pages/dadosTecnicosMunicipal";
import FormularioVagas from "../pages/formVagas";
import UploadArquivos from "../pages/uploadArquivos";
import ListarPdfs from "../pages/listarPdfs";

export default function AppRoutes() {
  return (
    <Routes>

      <Route path="/" element={<Home />} />
      <Route path="/dados-gestor" element={<DadosGestor />} />
      <Route path="/dados-estadual" element={<DadosEstadual />} />
      <Route path="/dados-municipio" element={<DadosMunicipio />} />
      <Route path="/form-vagas" element={<FormularioVagas />} />
      <Route path="/upload" element={<UploadArquivos />} />
      <Route path="/listar-pdf" element={<ListarPdfs />} />


      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
