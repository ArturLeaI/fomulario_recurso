import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/appRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
