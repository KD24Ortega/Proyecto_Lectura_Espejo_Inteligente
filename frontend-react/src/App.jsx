import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Welcome from './pages/Welcome';
import Register from './pages/Register';
import ProfileSuccess from './pages/ProfileSuccess';
import Home from './pages/Home';
import PHQ9 from './pages/PHQ9';
import GAD7 from './pages/Gad7';
import Results from './pages/Results';
import Dashboard from './pages/Dashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminUserProfile from './pages/AdminUserProfile';
import AdminAlerts from './pages/AdminAlerts';

function App() {
  return (
    <BrowserRouter>
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
        {/* <Route path="/dashboard" element={<Dashboard />} /> */}
        {/* <Route path="/evaluation/:type" element={<Evaluation />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;