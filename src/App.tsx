import { Suspense } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UserSettingsPage from "./pages/UserSettingsPage";
import GoogleSheetsCreationPage from "./pages/GoogleSheetsCreationPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import { Toaster } from "@/components/ui/toaster";
import routes from "tempo-routes";

function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<UserSettingsPage />} />
          <Route path="/create-sheet" element={<GoogleSheetsCreationPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        </Routes>
        {/* import.meta.env.VITE_TEMPO === "true" && useRoutes(routes) */}
        <Toaster />
      </>
    </Suspense>
  );
}

export default App;
