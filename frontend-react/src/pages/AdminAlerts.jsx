import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useDynamicTheme from '../hooks/useDynamicTheme';
import { notifyError, notifySuccess, notifyWarning } from '../utils/toast';

function AdminAlerts() {
  const { theme } = useDynamicTheme();
  const bg = theme?.colors?.primary || 'from-gray-400 via-gray-500 to-slate-600';

  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [adminName, setAdminName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  
  // Filtros
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all', 'critical', 'high', 'medium'
  const [sortBy, setSortBy] = useState('severity'); // 'severity', 'name', 'phq9', 'gad7'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    checkAuth();
    loadAlerts();

    // Auto-actualizar cada 3 minutos si está activado
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadAlerts();
        setLastUpdate(new Date());
      }, 180000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    applyFilters();
  }, [alerts, severityFilter, sortBy, searchTerm]);

  const checkAuth = () => {
    const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
    const adminNameStored = localStorage.getItem('admin_name') || sessionStorage.getItem('admin_name');
    
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    
    setAdminName(adminNameStored || 'Administrador');
  };

  const loadAlerts = async () => {
    try {
      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
      const response = await api.get(`/admin/users?user_id=${adminId}`);
      
      // Filtrar usuarios que requieren atención
      const usersWithAlerts = response.data.filter(user => {
        const hasHighScores = (user.latest_phq9 >= 15 || user.latest_gad7 >= 15);
        const hasModerateScores = (user.latest_phq9 >= 10 || user.latest_gad7 >= 10);
        return hasHighScores || hasModerateScores;
      });

      // Ordenar por severidad
      usersWithAlerts.sort((a, b) => {
        const severityA = Math.max(a.latest_phq9 || 0, a.latest_gad7 || 0);
        const severityB = Math.max(b.latest_phq9 || 0, b.latest_gad7 || 0);
        return severityB - severityA;
      });

      setAlerts(usersWithAlerts);
      setFilteredAlerts(usersWithAlerts);
    } catch (error) {
      console.error('Error al cargar alertas:', error);
      if (error.response?.status === 403) {
        navigate('/admin/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...alerts];

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toString().includes(searchTerm)
      );
    }

    // Filtro por severidad
    if (severityFilter !== 'all') {
      filtered = filtered.filter(user => {
        const maxScore = Math.max(user.latest_phq9 || 0, user.latest_gad7 || 0);
        
        if (severityFilter === 'critical') return maxScore >= 20;
        if (severityFilter === 'high') return maxScore >= 15 && maxScore < 20;
        if (severityFilter === 'medium') return maxScore >= 10 && maxScore < 15;
        
        return true;
      });
    }

    // Ordenar
    if (sortBy === 'severity') {
      filtered.sort((a, b) => {
        const severityA = Math.max(a.latest_phq9 || 0, a.latest_gad7 || 0);
        const severityB = Math.max(b.latest_phq9 || 0, b.latest_gad7 || 0);
        return severityB - severityA;
      });
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (sortBy === 'phq9') {
      filtered.sort((a, b) => (b.latest_phq9 || 0) - (a.latest_phq9 || 0));
    } else if (sortBy === 'gad7') {
      filtered.sort((a, b) => (b.latest_gad7 || 0) - (a.latest_gad7 || 0));
    }

    setFilteredAlerts(filtered);
  };

  const getAlertType = (user) => {
    const phq9 = user.latest_phq9 || 0;
    const gad7 = user.latest_gad7 || 0;
    const maxScore = Math.max(phq9, gad7);

    if (maxScore >= 20) {
      return {
        icon: '🔴',
        text: 'Crítico - Intervención inmediata',
        color: 'bg-red-100 text-red-700 border-red-300',
        priority: 'CRÍTICO'
      };
    } else if (maxScore >= 15) {
      return {
        icon: '🟠',
        text: 'Severo - Requiere atención urgente',
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        priority: 'ALTO'
      };
    } else if (maxScore >= 10) {
      return {
        icon: '🟡',
        text: 'Moderado - Monitoreo recomendado',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        priority: 'MEDIO'
      };
    }

    return {
      icon: '⚠️',
      text: 'Requiere seguimiento',
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      priority: 'BAJO'
    };
  };

  const handleViewProfile = (userId) => {
    navigate(`/admin/user/${userId}`);
  };

  const handleContactUser = (user) => {
    if (user.email) {
      const subject = encodeURIComponent('Seguimiento Urgente - CalmaSense');
      const body = encodeURIComponent(`Estimado/a ${user.full_name},\n\nNos comunicamos para hacer un seguimiento de tu estado...\n\nSaludos,\n${adminName}`);
      window.location.href = `mailto:${user.email}?subject=${subject}&body=${body}`;
    } else {
      notifyWarning('Este usuario no tiene email registrado');
    }
  };

  const handleSelectAlert = (userId) => {
    setSelectedAlerts(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedAlerts.length === filteredAlerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(filteredAlerts.map(u => u.id));
    }
  };

  const handleBulkAction = (action) => {
    if (selectedAlerts.length === 0) {
      notifyWarning('Selecciona al menos un usuario');
      return;
    }

    const selectedUsers = filteredAlerts.filter(u => selectedAlerts.includes(u.id));
    
    if (action === 'email') {
      const emails = selectedUsers.map(u => u.email).filter(e => e).join(',');
      if (emails) {
        window.location.href = `mailto:${emails}?subject=${encodeURIComponent('Seguimiento - CalmaSense')}`;
      } else {
        notifyWarning('Ninguno de los usuarios seleccionados tiene email');
      }
    } else if (action === 'export') {
      // Exportar CSV de seleccionados
      const csvData = [
        ['ID', 'Nombre', 'PHQ-9', 'GAD-7', 'Prioridad'],
        ...selectedUsers.map(u => [
          u.id,
          u.full_name,
          u.latest_phq9 || 'N/A',
          u.latest_gad7 || 'N/A',
          getAlertType(u).priority
        ])
      ];
      
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alertas_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      notifySuccess(`${selectedAlerts.length} alertas exportadas`);
    } else if (action === 'mark') {
      notifySuccess(`${selectedAlerts.length} alertas marcadas como atendidas`);
      setSelectedAlerts([]);
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

  const criticalCount = alerts.filter(u => Math.max(u.latest_phq9 || 0, u.latest_gad7 || 0) >= 20).length;
  const highCount = alerts.filter(u => {
    const max = Math.max(u.latest_phq9 || 0, u.latest_gad7 || 0);
    return max >= 15 && max < 20;
  }).length;
  const mediumCount = alerts.filter(u => {
    const max = Math.max(u.latest_phq9 || 0, u.latest_gad7 || 0);
    return max >= 10 && max < 15;
  }).length;

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bg} transition-all duration-1000`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-gray-600">Cargando alertas...</p>
        </div>
      </div>
    );
  }

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
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 hover:bg-blue-700/50 transition"
          >
            <span>🏠</span>
            <span className="font-medium">Inicio</span>
          </button>

          <button
            onClick={() => navigate('/admin/users')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 hover:bg-blue-700/50 transition"
          >
            <span>👥</span>
            <span className="font-medium">Usuarios</span>
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 bg-blue-700 shadow-lg">
            <span>⚠️</span>
            <span className="font-medium">Alertas</span>
            <span className="ml-auto bg-red-500 text-xs px-2 py-1 rounded-full font-bold animate-pulse">
              {alerts.length}
            </span>
          </button>
        </nav>

        {/* Estadísticas en sidebar */}
        <div className="px-4 pb-4 border-t border-blue-700 pt-4">
          <p className="text-xs text-blue-300 mb-3">Resumen de Prioridades</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Críticos
              </span>
              <span className="font-bold">{criticalCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                Altos
              </span>
              <span className="font-bold">{highCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Medios
              </span>
              <span className="font-bold">{mediumCount}</span>
            </div>
          </div>
        </div>

        {/* Auto-refresh */}
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Casos que Requieren Atención</h2>
            <p className="text-gray-600">
              Mostrando {filteredAlerts.length} de {alerts.length} alertas activas
            </p>
          </div>

          <div className="flex gap-2">
            {/* <button
              onClick={() => {
                loadAlerts();
                setLastUpdate(new Date());
              }}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
            >
              <span>🔄</span>
              <span>Actualizar</span>
            </button> */}

            {/* <button
              onClick={() => handleBulkAction('export')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <span>📥</span>
              <span>Exportar Todo</span>
            </button> */}
          </div>
        </div>

        {/* Contador de alertas con breakdown */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          
          {/* Total */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white text-2xl">
                ⚠️
              </div>
              <div>
                <p className="text-3xl font-bold text-red-900">{alerts.length}</p>
                <p className="text-sm text-red-700">Alertas Totales</p>
              </div>
            </div>
          </div>

          {/* Críticos */}
          <div 
            onClick={() => setSeverityFilter('critical')}
            className={`bg-white border-2 rounded-2xl p-6 cursor-pointer transition hover:shadow-lg ${
              severityFilter === 'critical' ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🔴</span>
              <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
            </div>
            <p className="text-sm text-gray-600">Críticos</p>
          </div>

          {/* Altos */}
          <div 
            onClick={() => setSeverityFilter('high')}
            className={`bg-white border-2 rounded-2xl p-6 cursor-pointer transition hover:shadow-lg ${
              severityFilter === 'high' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🟠</span>
              <p className="text-3xl font-bold text-orange-600">{highCount}</p>
            </div>
            <p className="text-sm text-gray-600">Altos</p>
          </div>

          {/* Medios */}
          <div 
            onClick={() => setSeverityFilter('medium')}
            className={`bg-white border-2 rounded-2xl p-6 cursor-pointer transition hover:shadow-lg ${
              severityFilter === 'medium' ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🟡</span>
              <p className="text-3xl font-bold text-yellow-600">{mediumCount}</p>
            </div>
            <p className="text-sm text-gray-600">Medios</p>
          </div>

        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Filtros</h3>
            {(severityFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setSeverityFilter('all');
                  setSearchTerm('');
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            
            {/* Búsqueda */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro severidad */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todas las prioridades</option>
              <option value="critical">🔴 Solo Críticos</option>
              <option value="high">🟠 Solo Altos</option>
              <option value="medium">🟡 Solo Medios</option>
            </select>

            {/* Ordenar */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="severity">Ordenar por severidad</option>
              <option value="name">Ordenar A-Z</option>
              <option value="phq9">Ordenar por PHQ-9</option>
              <option value="gad7">Ordenar por GAD-7</option>
            </select>

          </div>

          {/* Filtros activos */}
          {(searchTerm || severityFilter !== 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Filtros activos:</span>
              {searchTerm && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2">
                  Búsqueda: "{searchTerm}"
                  <button type="button" onClick={() => setSearchTerm('')} className="hover:text-blue-900" aria-label="Quitar filtro de búsqueda">✕</button>
                </span>
              )}
              {severityFilter !== 'all' && (
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-2">
                  Prioridad: {severityFilter === 'critical' ? 'Crítica' : severityFilter === 'high' ? 'Alta' : 'Media'}
                  <button type="button" onClick={() => setSeverityFilter('all')} className="hover:text-orange-900" aria-label="Quitar filtro de prioridad">✕</button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Acciones masivas */}
        {selectedAlerts.length > 0 && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedAlerts.length === filteredAlerts.length}
                onChange={handleSelectAll}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="font-semibold text-blue-900">{selectedAlerts.length} alerta(s) seleccionada(s)</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('email')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                📧 Contactar Todos
              </button>
              {/* <button
                onClick={() => handleBulkAction('export')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
              >
                📥 Exportar
              </button> */}
              <button
                onClick={() => handleBulkAction('mark')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
              >
                ✓ Marcar Atendidas
              </button>
            </div>
          </div>
        )}

        {/* Lista de alertas */}
        <div className="space-y-4">
          {filteredAlerts.map((user) => {
            const alert = getAlertType(user);
            const isSelected = selectedAlerts.includes(user.id);
            
            return (
              <div 
                key={user.id} 
                className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-center gap-6">
                  
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectAlert(user.id)}
                    className="w-5 h-5 cursor-pointer flex-shrink-0"
                  />

                  {/* Avatar */}
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-lg">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-bold text-gray-800">{user.full_name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            alert.priority === 'CRÍTICO' ? 'bg-red-200 text-red-800' :
                            alert.priority === 'ALTO' ? 'bg-orange-200 text-orange-800' :
                            'bg-yellow-200 text-yellow-800'
                          }`}>
                            {alert.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {user.age ? `${user.age} años` : 'Edad no registrada'} • ID: #{user.id}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewProfile(user.id)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition font-medium"
                        >
                          Ver Perfil
                        </button>
                        <button
                          onClick={() => handleContactUser(user)}
                          className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg transition font-medium"
                        >
                          Contactar
                        </button>
                      </div>
                    </div>

                    {/* Scores con barras */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">PHQ-9:</span>
                          <span className="font-bold text-gray-800">{user.latest_phq9 ?? '—'} / 27</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              (user.latest_phq9 || 0) >= 15 ? 'bg-red-500' :
                              (user.latest_phq9 || 0) >= 10 ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${((user.latest_phq9 || 0) / 27) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">GAD-7:</span>
                          <span className="font-bold text-gray-800">{user.latest_gad7 ?? '—'} / 21</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              (user.latest_gad7 || 0) >= 15 ? 'bg-red-500' :
                              (user.latest_gad7 || 0) >= 10 ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${((user.latest_gad7 || 0) / 21) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Alerta */}
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${alert.color}`}>
                      <span className="text-xl">{alert.icon}</span>
                      <span className="text-sm font-medium">{alert.text}</span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}

          {filteredAlerts.length === 0 && alerts.length > 0 && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-12 text-center">
              <span className="text-6xl mb-4 block">🔍</span>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                No se encontraron alertas
              </h3>
              <p className="text-gray-600 mb-4">
                Intenta ajustar los filtros de búsqueda
              </p>
              <button
                onClick={() => {
                  setSeverityFilter('all');
                  setSearchTerm('');
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {alerts.length === 0 && (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                ¡Todo bajo control!
              </h3>
              <p className="text-green-700">
                No hay usuarios que requieran atención inmediata en este momento
              </p>
            </div>
          )}
        </div>

        {/* Footer de actualización */}
        <div className="mt-8 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <span className={autoRefresh ? 'animate-spin' : ''}>🔄</span>
              <span>
                {autoRefresh ? 'Actualización automática cada 3 minutos' : 'Auto-actualización desactivada'}
              </span>
            </p>
            <p className="text-sm text-gray-500">
              Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
            </p>
          </div>
        </div>

      </main>

    </div>
  );
}

export default AdminAlerts;