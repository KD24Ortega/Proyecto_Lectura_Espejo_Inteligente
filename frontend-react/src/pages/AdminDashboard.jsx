import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useDynamicTheme from '../hooks/useDynamicTheme';

function AdminDashboard() {
  const { theme } = useDynamicTheme();
  const bg = theme?.colors?.primary || 'from-gray-400 via-gray-500 to-slate-600';

  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_users: 0,
    total_assessments: 0,
    active_sessions: 0,
    average_scores: { phq9: 0, gad7: 0 }
  });
  const [chartData, setChartData] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [adminName, setAdminName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState(30);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('evaluations');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState(null); // { type: 'success'|'error', text: string }

  useEffect(() => {
    checkAuth();
    loadDashboardData();

    // Auto-refresh cada 30 segundos si está activado
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadDashboardData();
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh]);

  const checkAuth = () => {
    const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
    const adminNameStored = localStorage.getItem('admin_name') || sessionStorage.getItem('admin_name');
    
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    
    setAdminName(adminNameStored || 'Administrador');
  };

  const loadDashboardData = async () => {
    try {
      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
      
      // Cargar estadísticas generales
      const statsResponse = await api.get(`/admin/dashboard?user_id=${adminId}`);
      setStats(statsResponse.data);
      
      // Cargar usuarios
      const usersResponse = await api.get(`/admin/users?user_id=${adminId}`);
      
      // Usuarios recientes (últimos 5)
      const recent = usersResponse.data
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
      setRecentUsers(recent);
      
      // Alertas críticas (PHQ-9 >= 15 o GAD-7 >= 15)
      const critical = usersResponse.data.filter(u => 
        (u.latest_phq9 >= 15 || u.latest_gad7 >= 15)
      ).slice(0, 3);
      setCriticalAlerts(critical);
      
      // === GRÁFICA CON DATOS REALES ===
      const historyResponse = await api.get(`/admin/stats/history?user_id=${adminId}&days=${timeRange}`);
      
      // Transformar datos del backend al formato esperado por el frontend
      const realChartData = historyResponse.data.history.map((dayData, index) => ({
        day: index + 1,
        evaluations: dayData.assessments,
        users: dayData.users,
        alerts: dayData.alerts
      }));
      
      setChartData(realChartData);
      
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
      if (error.response?.status === 403) {
        navigate('/admin/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/admin/users?search=${searchQuery}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_id');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_name');
    sessionStorage.clear();
    navigate('/admin/login');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordChangeMessage(null);

    const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
    if (!adminId) {
      navigate('/admin/login');
      return;
    }

    if (!currentPassword.trim()) {
      setPasswordChangeMessage({ type: 'error', text: 'Ingresa tu contraseña actual.' });
      return;
    }
    if (!newPassword.trim()) {
      setPasswordChangeMessage({ type: 'error', text: 'Ingresa tu nueva contraseña.' });
      return;
    }
    if (newPassword.trim().length < 8) {
      setPasswordChangeMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeMessage({ type: 'error', text: 'La confirmación no coincide con la nueva contraseña.' });
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordChangeMessage({ type: 'error', text: 'La nueva contraseña debe ser diferente a la actual.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.post(`/admin/change-password?user_id=${adminId}`, {
        old_password: currentPassword,
        new_password: newPassword,
      });

      if (res.data?.success) {
        setPasswordChangeMessage({ type: 'success', text: 'Contraseña actualizada correctamente.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordChangeMessage({ type: 'error', text: 'No se pudo actualizar la contraseña.' });
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        setPasswordChangeMessage({ type: 'error', text: 'Contraseña actual incorrecta.' });
      } else if (status === 403) {
        setPasswordChangeMessage({ type: 'error', text: 'Acceso denegado.' });
      } else {
        setPasswordChangeMessage({ type: 'error', text: 'Error al actualizar la contraseña. Intenta nuevamente.' });
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getMetricData = () => {
    return chartData.map(d => {
      if (selectedMetric === 'evaluations') return d.evaluations;
      if (selectedMetric === 'users') return d.users;
      if (selectedMetric === 'alerts') return d.alerts;
      return d.evaluations;
    });
  };

  const getMetricMax = () => {
    if (selectedMetric === 'evaluations') return 28;
    if (selectedMetric === 'users') return 10;
    if (selectedMetric === 'alerts') return 5;
    return 28;
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bg} transition-all duration-1000`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const metricData = getMetricData();
  const metricMax = getMetricMax();
  const avgMetric = metricData.length > 0
    ? (metricData.reduce((sum, val) => sum + val, 0) / metricData.length).toFixed(1)
    : 0;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} transition-all duration-1000 flex`}>
      
      {/* Barra Lateral */}
      <aside className="w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col shadow-2xl">
        
        {/* Logo */}
        <div className="p-6 border-b border-blue-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-2xl">🛡️</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">CalmaSense</h1>
              <p className="text-xs text-blue-300">Panel Administrativo</p>
            </div>
          </div>
        </div>

        {/* Menú */}
        <nav className="flex-1 p-4">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 bg-blue-700 shadow-lg">
            <span>🏠</span>
            <span className="font-medium">Inicio</span>
          </button>

          <button
            onClick={() => navigate('/admin/users')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 hover:bg-blue-700/50 transition relative"
          >
            <span>👥</span>
            <span className="font-medium">Usuarios</span>
            <span className="ml-auto bg-white text-blue-900 text-xs px-2 py-1 rounded-full font-bold">
              {stats.total_users}
            </span>
          </button>

          <button
            onClick={() => navigate('/admin/alerts')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 hover:bg-blue-700/50 transition relative"
          >
            <span>⚠️</span>
            <span className="font-medium">Alertas</span>
            {criticalAlerts.length > 0 && (
              <span className="ml-auto bg-red-500 text-xs px-2 py-1 rounded-full animate-pulse font-bold">
                {criticalAlerts.length}
              </span>
            )}
          </button>
        </nav>

        {/* Auto-refresh toggle */}
        <div className="px-4 py-3 border-t border-blue-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm">Auto-actualizar</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`w-12 h-6 rounded-full transition ${
                autoRefresh ? 'bg-green-500' : 'bg-gray-400'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                autoRefresh ? 'translate-x-6' : 'translate-x-1'
              }`}></div>
            </button>
          </div>
          <p className="text-xs text-blue-300">
            {autoRefresh ? 'Actualiza cada 30s' : 'Desactivado'}
          </p>
        </div>

        {/* Usuario admin */}
        <div className="p-4 border-t border-blue-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
              {adminName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{adminName}</p>
              <p className="text-xs text-blue-300">Administrador</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 p-8 overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Panel de Control</h2>
            <p className="text-gray-600">
              Última actualización: {new Date().toLocaleTimeString('es-ES')}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Búsqueda funcional */}
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
              <button type="submit" className="absolute left-3 top-2.5 text-gray-400 hover:text-blue-600">
                🔍
              </button>
            </form>
            
            {/* Botón refresh manual */}
            <button
              onClick={() => loadDashboardData()}
              className="p-2 bg-white rounded-lg shadow hover:shadow-lg transition"
              title="Actualizar ahora"
            >
              <span className="text-2xl">🔄</span>
            </button>

            {/* Notificaciones */}
            <button 
              onClick={() => navigate('/admin/alerts')}
              className="relative p-2 bg-white rounded-lg shadow hover:shadow-lg transition"
            >
              <span className="text-2xl">🔔</span>
              {criticalAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                  {criticalAlerts.length}
                </span>
              )}
            </button>

            {/* Perfil admin */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {adminName.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-gray-700">{adminName}</span>
            </div>
          </div>
        </div>

        {/* Cards de estadísticas CLICKEABLES */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          
          {/* Total Usuarios - CLICKEABLE */}
          <div 
            onClick={() => navigate('/admin/users')}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition cursor-pointer group transform hover:-translate-y-1"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Usuarios</p>
                <p className="text-4xl font-bold text-gray-800">{stats.total_users}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-200 transition">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-blue-600 text-sm font-medium">
                Click para ver todos
              </p>
              <span className="text-blue-600">→</span>
            </div>
          </div>

          {/* Evaluaciones */}
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm mb-1">Evaluaciones Totales</p>
                <p className="text-4xl font-bold text-gray-800">{stats.total_assessments}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Completadas en el sistema
            </p>
          </div>

          {/* Alertas Críticas - CLICKEABLE */}
          <div 
            onClick={() => navigate('/admin/alerts')}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition cursor-pointer group transform hover:-translate-y-1"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm mb-1">Alertas Críticas</p>
                <p className="text-4xl font-bold text-red-600">{criticalAlerts.length}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:bg-red-200 transition">
                <span className="text-2xl">⚠️</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-red-600 text-sm font-medium">
                Requieren atención
              </p>
              <span className="text-red-600">→</span>
            </div>
          </div>

          {/* Sesiones Activas */}
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm mb-1">Sesiones Activas</p>
                <p className="text-4xl font-bold text-gray-800">{stats.active_sessions}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🟢</span>
              </div>
            </div>
            <p className="text-green-600 text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>En línea ahora</span>
            </p>
          </div>

        </div>

        {/* Sección de 2 columnas */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          
          {/* Gráfica INTERACTIVA - 2 columnas */}
          <div className="col-span-2 bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {selectedMetric === 'evaluations' && 'Evaluaciones por Día'}
                  {selectedMetric === 'users' && 'Nuevos Usuarios por Día'}
                  {selectedMetric === 'alerts' && 'Alertas por Día'}
                </h3>
                <p className="text-sm text-gray-600">
                  Promedio: {avgMetric} por día
                </p>
              </div>
              
              <div className="flex flex-col gap-2">
                {/* Selector de métrica */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedMetric('evaluations')}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      selectedMetric === 'evaluations'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Evaluaciones
                  </button>
                  <button
                    onClick={() => setSelectedMetric('users')}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      selectedMetric === 'users'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Usuarios
                  </button>
                  <button
                    onClick={() => setSelectedMetric('alerts')}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      selectedMetric === 'alerts'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Alertas
                  </button>
                </div>

                {/* Selector de rango */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setTimeRange(7)}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      timeRange === 7
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    7 días
                  </button>
                  <button
                    onClick={() => setTimeRange(30)}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      timeRange === 30
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    30 días
                  </button>
                </div>
              </div>
            </div>

            {/* SVG Chart CON HOVER */}
            <div className="relative h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6">
              
              {/* Eje Y */}
              <div className="absolute left-2 top-6 bottom-8 flex flex-col justify-between text-xs text-gray-600">
                {[metricMax, Math.floor(metricMax * 0.75), Math.floor(metricMax * 0.5), Math.floor(metricMax * 0.25), 0].map((val, i) => (
                  <span key={i}>{val}</span>
                ))}
              </div>

              {/* Grid */}
              <div className="absolute left-12 right-4 top-6 bottom-8">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="absolute w-full border-t border-gray-300" style={{ top: `${i * 25}%` }} />
                ))}
              </div>

              {/* Chart con HOVER */}
              <div 
                className="absolute left-12 right-4 top-6 bottom-8"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={
                        selectedMetric === 'evaluations' ? '#3b82f6' :
                        selectedMetric === 'users' ? '#10b981' : '#ef4444'
                      } stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={
                        selectedMetric === 'evaluations' ? '#3b82f6' :
                        selectedMetric === 'users' ? '#10b981' : '#ef4444'
                      } stopOpacity="0.05"/>
                    </linearGradient>
                  </defs>

                  <polygon
                    points={`0,100 ${metricData.map((val, i) => {
                      const x = (i / Math.max(metricData.length - 1, 1)) * 100;
                      const y = 100 - (val / metricMax) * 100;
                      return `${x},${y}`;
                    }).join(' ')} 100,100`}
                    fill="url(#chartGradient)"
                  />

                  <polyline
                    points={metricData.map((val, i) => {
                      const x = (i / Math.max(metricData.length - 1, 1)) * 100;
                      const y = 100 - (val / metricMax) * 100;
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke={
                      selectedMetric === 'evaluations' ? '#3b82f6' :
                      selectedMetric === 'users' ? '#10b981' : '#ef4444'
                    }
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                  />

                  {metricData.map((val, i) => {
                    const x = (i / Math.max(metricData.length - 1, 1)) * 100;
                    const y = 100 - (val / metricMax) * 100;
                    return (
                      <circle 
                        key={i} 
                        cx={x} 
                        cy={y} 
                        r={hoveredPoint === i ? "2" : "1"} 
                        fill={
                          selectedMetric === 'evaluations' ? '#3b82f6' :
                          selectedMetric === 'users' ? '#10b981' : '#ef4444'
                        }
                        stroke="white" 
                        strokeWidth="0.3" 
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(i)}
                      />
                    );
                  })}
                </svg>

                {/* Tooltip on hover */}
                {hoveredPoint !== null && (
                  <div 
                    className="absolute bg-white px-3 py-2 rounded-lg shadow-lg border-2 border-blue-500 pointer-events-none"
                    style={{
                      left: `${(hoveredPoint / Math.max(metricData.length - 1, 1)) * 100}%`,
                      top: `${100 - (metricData[hoveredPoint] / metricMax) * 100}%`,
                      transform: 'translate(-50%, -120%)'
                    }}
                  >
                    <p className="text-xs text-gray-600 mb-1">Día {hoveredPoint + 1}</p>
                    <p className="text-sm font-bold text-blue-600">
                      {selectedMetric === 'evaluations' && `${metricData[hoveredPoint]} evaluaciones`}
                      {selectedMetric === 'users' && `${metricData[hoveredPoint]} usuarios`}
                      {selectedMetric === 'alerts' && `${metricData[hoveredPoint]} alertas`}
                    </p>
                  </div>
                )}
              </div>

              {/* Eje X */}
              <div className="absolute left-12 right-4 bottom-2 flex justify-between text-xs text-gray-600">
                {timeRange === 7 ? (
                  ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day, i) => (
                    <span key={i}>{day}</span>
                  ))
                ) : (
                  [0, 5, 10, 15, 20, 25, 30].map((day) => (
                    <span key={day}>{day}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Alertas Críticas CLICKEABLES - 1 columna */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Alertas Críticas</h3>
              {criticalAlerts.length > 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </div>
            
            {criticalAlerts.length > 0 ? (
              <div className="space-y-3">
                {criticalAlerts.map((user) => (
                  <div 
                    key={user.id}
                    onClick={() => navigate(`/admin/user/${user.id}`)}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 cursor-pointer transition transform hover:scale-105"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{user.full_name}</p>
                        <p className="text-xs text-red-600">
                          PHQ-9: {user.latest_phq9} | GAD-7: {user.latest_gad7}
                        </p>
                      </div>
                      <span className="text-red-600 text-lg">→</span>
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={() => navigate('/admin/alerts')}
                  className="w-full py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition font-medium"
                >
                  Ver todas las alertas ({criticalAlerts.length})
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <span className="text-5xl mb-3 block">✅</span>
                <p className="text-gray-600 text-sm font-medium">Sin alertas críticas</p>
                <p className="text-gray-500 text-xs mt-1">Todo bajo control</p>
              </div>
            )}
          </div>

        </div>

        {/* Usuarios Recientes CLICKEABLES */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Usuarios Recientes</h3>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-1"
            >
              Ver todos
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => navigate(`/admin/user/${user.id}`)}
                className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg cursor-pointer transition group transform hover:-translate-y-1"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3 group-hover:scale-110 transition">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-medium text-gray-800 text-sm mb-1 truncate w-full">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cambiar contraseña admin */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Seguridad</h3>
            <span className="text-sm text-gray-500">Cambiar contraseña</span>
          </div>

          {passwordChangeMessage && (
            <div
              className={`mb-4 p-3 rounded-lg border text-sm font-medium ${
                passwordChangeMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {passwordChangeMessage.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="grid grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-gray-50 p-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-50 p-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmar</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full bg-gray-50 p-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Repite la nueva contraseña"
                autoComplete="new-password"
              />
            </div>

            <div className="col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={isChangingPassword}
                className={`px-6 py-3 rounded-lg font-semibold transition shadow ${
                  isChangingPassword
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isChangingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </div>
          </form>
        </div>

      </main>

    </div>
  );
}

export default AdminDashboard;