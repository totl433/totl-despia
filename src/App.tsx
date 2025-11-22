import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import PredictionsBanner from "./components/PredictionsBanner";
import FloatingProfile from "./components/FloatingProfile";

import HomePage from "./pages/Home";
import LeaguePage from "./pages/League";
import PredictionsPage from "./pages/Predictions";
import AdminPage from "./pages/Admin";
import NewPredictionsCentre from "./pages/NewPredictionsCentre";
import ProfilePage from "./pages/Profile";
import TestDespia from "./pages/TestDespia";

export default function App() {
  const [oldSchoolMode, setOldSchoolMode] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    if (saved !== null) {
      setOldSchoolMode(JSON.parse(saved));
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);

  return (
    <Router>
      <Routes>
        {/* Full-screen route without header/banner */}
        <Route path="/new-predictions" element={<NewPredictionsCentre />} />
        <Route path="/test-despia" element={<TestDespia />} />
        
        {/* Regular routes with header/banner */}
        <Route path="*" element={
          <div className={`min-h-screen overflow-y-auto ${oldSchoolMode ? 'oldschool-theme' : 'text-slate-900'}`} style={{ backgroundColor: '#f5f7f6' }}>
            <FloatingProfile />
            {/* <WhatsAppBanner /> */}
            <PredictionsBanner />
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/league/:id" element={<LeaguePage />} />
                <Route path="/predictions" element={<PredictionsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </main>
          </div>
        } />
      </Routes>
      
    </Router>
  );
}