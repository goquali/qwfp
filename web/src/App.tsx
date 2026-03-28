import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import FinanceDashboard from "./pages/FinanceDashboard";
import HRDashboard from "./pages/HRDashboard";
import TeamDashboard from "./pages/TeamDashboard";
import TADashboard from "./pages/TADashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/finance" replace />} />
          <Route path="/finance" element={<FinanceDashboard />} />
          <Route path="/hr" element={<HRDashboard />} />
          <Route path="/team" element={<TeamDashboard />} />
          <Route path="/ta" element={<TADashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
