import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

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

// ✅ Loader simple (puedes poner tu UI bonita aquí)
function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      Cargando...
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<AppLoader />}>
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
