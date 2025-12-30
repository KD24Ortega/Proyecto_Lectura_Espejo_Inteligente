import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Toaster } from 'react-hot-toast';
import SessionManager from './components/SessionManager';
import useDynamicTheme from "./hooks/useDynamicTheme";
import AppLoader from "./components/AppLoader";

// ✅ Carga inmediata solo para la landing (opcional)
import Welcome from "./pages/Welcome";

// ✅ Resto: carga diferida (code splitting)
const Register = lazy(() => import("./pages/Register"));
const ProfileSuccess = lazy(() => import("./pages/ProfileSuccess"));
const Home = lazy(() => import("./pages/Home"));
const PHQ9 = lazy(() => import("./pages/PHQ9"));
const GAD7 = lazy(() => import("./pages/Gad7"));
const Results = lazy(() => import("./pages/Results"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminUserProfile = lazy(() => import("./pages/AdminUserProfile"));
const AdminAlerts = lazy(() => import("./pages/AdminAlerts"));

const AnxietyExercises = lazy(() => import("./pages/Anxietyexercises"));
const DepressionExercises = lazy(() => import("./pages/Depressionexercises"));
const BreathingVocalization = lazy(() => import("./pages/Breathingvocalization"));
const ConsciousReading = lazy(() => import("./pages/ConsciousReading"));
const VocalAffirmations = lazy(() => import("./pages/VocalAffirmations"));
const VocalPractice = lazy(() => import("./pages/VocalPractice"));
const ProsodicReading = lazy(() => import("./pages/ProsodicReading"));
const GuidedDialogue = lazy(() => import("./pages/Guideddialogue"));

function App() {
  return (
    <BrowserRouter>
      <SessionManager>
        <ThemedShell>
          <Toaster
            position="top-right"
            toastOptions={{
              className:
                'bg-white/90 text-slate-800 border border-slate-200 shadow-card backdrop-blur-md',
            }}
          />
          <Routes>
            <Route path="/" element={<Welcome />} />

            <Route path="/register" element={<Register />} />
            <Route path="/profile-success" element={<ProfileSuccess />} />
            <Route path="/home" element={<Home />} />
            <Route path="/phq9" element={<PHQ9 />} />
            <Route path="/gad7" element={<GAD7 />} />
            <Route path="/results" element={<Results />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/user/:userId" element={<AdminUserProfile />} />
            <Route path="/admin/alerts" element={<AdminAlerts />} />

            <Route path="/exercises/anxiety" element={<AnxietyExercises />} />
            <Route path="/exercises/depression" element={<DepressionExercises />} />
            <Route path="/anxiety/breathing-vocalization" element={<BreathingVocalization />} />
            <Route path="/anxiety/conscious-reading" element={<ConsciousReading />} />
            <Route path="/depression/vocal-affirmations" element={<VocalAffirmations />} />
            <Route path="/anxiety/vocal-practice" element={<VocalPractice />} />
            <Route path="/depression/prosodic-reading" element={<ProsodicReading />} />
            <Route path="/depression/guided-dialogue" element={<GuidedDialogue />} />
          </Routes>
        </ThemedShell>
      </SessionManager>
    </BrowserRouter>
  );
}

function ThemedShell({ children }) {
  const location = useLocation();
  const { theme, isThemeLoading } = useDynamicTheme();

  const MIN_LOADER_MS = 500;
  const loaderStartRef = useRef(typeof performance !== "undefined" ? performance.now() : Date.now());
  const [keepLoaderVisible, setKeepLoaderVisible] = useState(true);

  useEffect(() => {
    if (isThemeLoading) {
      loaderStartRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
      setKeepLoaderVisible(true);
      return;
    }

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = now - loaderStartRef.current;
    const remaining = Math.max(0, MIN_LOADER_MS - elapsed);

    const timeoutId = setTimeout(() => setKeepLoaderVisible(false), remaining);
    return () => clearTimeout(timeoutId);
  }, [isThemeLoading]);

  const loadingGradient = theme?.colors?.primary || "from-gray-400 via-gray-500 to-slate-600";

  if (isThemeLoading || keepLoaderVisible) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${loadingGradient} transition-all duration-1000`}>
        <AppLoader gradient={loadingGradient} />
      </div>
    );
  }

  const isWelcome = location.pathname === "/" || location.pathname === "/welcome";
  if (isWelcome) {
    return (
      <div className="min-h-screen">
        <Suspense fallback={<AppLoader />}>
          {children}
        </Suspense>
      </div>
    );
  }

  const bg = theme?.colors?.primary || "from-gray-400 via-gray-500 to-slate-600";
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} transition-all duration-1000`}>
      <Suspense fallback={<AppLoader gradient={bg} />}>
        {children}
      </Suspense>
    </div>
  );
}

export default App;
