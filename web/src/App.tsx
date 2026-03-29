import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import GuidedDemo from "./pages/GuidedDemo";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import HRDashboard from "./pages/HRDashboard";
import TeamDashboard from "./pages/TeamDashboard";
import TADashboard from "./pages/TADashboard";
import HowItWorks from "./pages/HowItWorks";
import Onboarding from "./pages/Onboarding";
import Pricing from "./pages/Pricing";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<GuidedDemo />} />
          <Route path="/dashboard" element={<ExecutiveDashboard />} />
          <Route path="/finance" element={<FinanceDashboard />} />
          <Route path="/hr" element={<HRDashboard />} />
          <Route path="/team" element={<TeamDashboard />} />
          <Route path="/ta" element={<TADashboard />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
