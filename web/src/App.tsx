import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import HRDashboard from "./pages/HRDashboard";
import TeamDashboard from "./pages/TeamDashboard";
import TADashboard from "./pages/TADashboard";
import HowItWorks from "./pages/HowItWorks";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/executive" replace />} />
          <Route path="/executive" element={<ExecutiveDashboard />} />
          <Route path="/finance" element={<FinanceDashboard />} />
          <Route path="/hr" element={<HRDashboard />} />
          <Route path="/team" element={<TeamDashboard />} />
          <Route path="/ta" element={<TADashboard />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
