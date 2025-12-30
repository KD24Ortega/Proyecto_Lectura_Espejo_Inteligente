import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from '../services/api';
import useDynamicTheme from '../hooks/useDynamicTheme';
import { notifyError, notifySuccess } from '../utils/toast';

function AdminUsers() {
  const { theme } = useDynamicTheme();
  const bg = theme?.colors?.primary || 'from-gray-400 via-gray-500 to-slate-600';

  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [adminName, setAdminName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [viewMode, setViewMode] = useState('table');
  
  // NUEVO: Estado de sesiones activas
  const [activeSessions, setActiveSessions] = useState(new Set());
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [severityFilter, setSeverityFilter] = useState('Todos los niveles');
  const [trendFilter, setTrendFilter] = useState('Todas las tendencias');
  const [sortOrder, setSortOrder] = useState('name');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    checkAuth();
    loadUsers();
    loadActiveSessions(); // NUEVO
    
    // Actualizar sesiones activas periódicamente
    const interval = setInterval(loadActiveSessions, 10000);
    
    // Leer parámetro de búsqueda de la URL
    const searchParams = new URLSearchParams(location.search);
    const searchQuery = searchParams.get('search');
    if (searchQuery) {
      setSearchTerm(searchQuery);
    }
    
    return () => clearInterval(interval);
  }, [location]);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, statusFilter, severityFilter, trendFilter, sortOrder, activeSessions]);

  const checkAuth = () => {
    const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
    const adminNameStored = localStorage.getItem('admin_name') || sessionStorage.getItem('admin_name');
    
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    
    setAdminName(adminNameStored || 'Administrador');
  };

  // NUEVO: Cargar sesiones activas
  const loadActiveSessions = async () => {
    try {
      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
      const response = await api.get(`/admin/sessions?user_id=${adminId}`);
      
      // Crear Set de user_ids con sesiones activas
      const activeUserIds = new Set(
        response.data
          .filter(session => session.is_active)
          .map(session => session.user_id)
      );
      
      setActiveSessions(activeUserIds);
      console.log('📊 Sesiones activas:', activeUserIds.size);
      
    } catch (error) {
      console.error('Error al cargar sesiones activas:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
      const response = await api.get(`/admin/users?user_id=${adminId}`);
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      if (error.response?.status === 403) {
        navigate('/admin/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Búsqueda por nombre o ID
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toString().includes(searchTerm)
      );
    }

    // CORREGIDO: Filtro por estado (usando sesiones activas)
    if (statusFilter !== 'Todos') {
      filtered = filtered.filter(user => {
        const isActive = activeSessions.has(user.id);
        
        if (statusFilter === 'Activo') {
          return isActive;
        } else if (statusFilter === 'Inactivo') {
          return !isActive;
        }
        return true;
      });
    }

    // Filtro por severidad
    if (severityFilter !== 'Todos los niveles') {
      filtered = filtered.filter(user => {
        const maxScore = Math.max(user.latest_phq9 || 0, user.latest_gad7 || 0);
        
        if (severityFilter === 'Crítico') return maxScore >= 20;
        if (severityFilter === 'Severa') return maxScore >= 15 && maxScore < 20;
        if (severityFilter === 'Moderada') return maxScore >= 10 && maxScore < 15;
        if (severityFilter === 'Leve') return maxScore >= 5 && maxScore < 10;
        if (severityFilter === 'Mínima') return maxScore < 5;
        
        return true;
      });
    }

    // Ordenar
    if (sortOrder === 'name') {
      filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (sortOrder === 'phq9') {
      filtered.sort((a, b) => (b.latest_phq9 || 0) - (a.latest_phq9 || 0));
    } else if (sortOrder === 'gad7') {
      filtered.sort((a, b) => (b.latest_gad7 || 0) - (a.latest_gad7 || 0));
    } else if (sortOrder === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortOrder === 'active') {
      // NUEVO: Ordenar por activos primero
      filtered.sort((a, b) => {
        const aActive = activeSessions.has(a.id);
        const bActive = activeSessions.has(b.id);
        return (bActive ? 1 : 0) - (aActive ? 1 : 0);
      });
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  };

  const getSeverityBadge = (score, type) => {
    if (score === null || score === undefined) return { text: '—', color: 'bg-gray-200 text-gray-600' };
    
    let severity, color;
    
    if (type === 'phq9') {
      if (score < 5) { severity = 'Mínima'; color = 'bg-green-100 text-green-700'; }
      else if (score < 10) { severity = 'Leve'; color = 'bg-blue-100 text-blue-700'; }
      else if (score < 15) { severity = 'Moderada'; color = 'bg-orange-100 text-orange-700'; }
      else { severity = 'Severa'; color = 'bg-red-100 text-red-700'; }
    } else {
      if (score < 5) { severity = 'Mínima'; color = 'bg-green-100 text-green-700'; }
      else if (score < 10) { severity = 'Leve'; color = 'bg-blue-100 text-blue-700'; }
      else if (score < 15) { severity = 'Moderada'; color = 'bg-orange-100 text-orange-700'; }
      else { severity = 'Severa'; color = 'bg-red-100 text-red-700'; }
    }
    
    return { text: severity, color };
  };

  // NUEVO: Función para obtener estado de usuario
  const getUserStatus = (userId) => {
    const isActive = activeSessions.has(userId);
    
    if (isActive) {
      return {
        text: 'En línea',
        icon: '🟢',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        dotColor: 'bg-green-500'
      };
    } else {
      return {
        text: 'Desconectado',
        icon: '⚫',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
        dotColor: 'bg-gray-400'
      };
    }
  };

  const getTimeSince = (dateString) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays > 0) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return 'Hace unos minutos';
  };

  const handleViewProfile = (userId) => {
    navigate(`/admin/user/${userId}`);
  };

  const handleDownloadReport = async (user) => {
    try {
      const adminId = localStorage.getItem("admin_id") || sessionStorage.getItem("admin_id");
      const res = await api.get(`/admin/user/${user.id}?user_id=${adminId}`);
      const data = res.data;
      const profile = data.user;
      const assessments = data.assessments || [];

      const lastPhq9 = assessments
        .filter(a => a.type === "phq9")
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];

      const lastGad7 = assessments
        .filter(a => a.type === "gad7")
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];

      const doc = new jsPDF("p","mm","a4");

      doc.setFontSize(18);
      doc.text("CALMASENSE - REPORTE CLÍNICO",105,15,{align:"center"});

      doc.setFontSize(10);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`,105,22,{align:"center"});
      doc.line(10,26,200,26);

      doc.setFontSize(14);
      doc.text("Datos del Usuario",14,35);

      autoTable(doc,{
        startY:40,
        head:[["Campo","Detalle"]],
        body:[
          ["Nombre", profile.full_name],
          ["Edad", profile.age ?? "N/A"],
          ["Género", profile.gender ?? "N/A"],
          ["Email", profile.email ?? "N/A"],
          ["ID Usuario", profile.id],
          ["Registrado", new Date(profile.created_at).toLocaleDateString("es-ES")],
          ["Estado Actual", activeSessions.has(profile.id) ? "En línea" : "Desconectado"]
        ]
      });

      const y2 = doc.lastAutoTable.finalY + 10;
      doc.text("Estado Actual",14,y2);

      autoTable(doc,{
        startY:y2+4,
        head:[["Métrica","Valor"]],
        body:[
          ["PHQ-9", lastPhq9 ? `${lastPhq9.score} (${lastPhq9.severity})` : "Sin datos"],
          ["GAD-7", lastGad7 ? `${lastGad7.score} (${lastGad7.severity})` : "Sin datos"]
        ]
      });

      if(assessments.length > 0){
        const y3 = doc.lastAutoTable.finalY + 10;
        doc.text("Historial de Evaluaciones",14,y3);

        autoTable(doc,{
          startY:y3+4,
          head:[["Fecha","Test","Score","Severidad"]],
          body: assessments.map(a=>[
            new Date(a.created_at).toLocaleDateString("es-ES"),
            a.type.toUpperCase(),
            a.score,
            a.severity
          ])
        });
      }

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(9);
      doc.text("Documento generado automáticamente por CalmaSense", 105, pageHeight - 12, { align:"center" });

      const safeName = profile.full_name.replace(/\s+/g,"_");
      doc.save(`reporte_${safeName}.pdf`);

    } catch (error) {
      console.error("Error al generar PDF:", error);
      notifyError("Ocurrió un error al generar el reporte.");
    }
  };

  const handleSendEmail = async (user) => {
    try {
      const message = `
Hola ${user.full_name},

Estamos realizando un seguimiento de tus resultados recientes en PHQ-9 y GAD-7.
Si necesitas apoyo adicional, no dudes en comunicarte con nosotros.

Atentamente,
Equipo de CalmaSense.
`;

      await api.post("/notifications/email", {
        user_id: user.id,
        message: message
      });

      notifySuccess("Correo enviado correctamente");

    } catch (error) {
      console.error("Error enviando correo:", error);
      notifyError("Error enviando correo.");
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map(u => u.id));
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

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('Todos');
    setSeverityFilter('Todos los niveles');
    setTrendFilter('Todas las tendencias');
    setSortOrder('name');
  };

  // Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  // NUEVO: Contar usuarios activos e inactivos
  const activeUsersCount = users.filter(u => activeSessions.has(u.id)).length;
  const inactiveUsersCount = users.length - activeUsersCount;

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bg} transition-all duration-1000`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-gray-600">Cargando usuarios...</p>
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

          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 bg-blue-700 shadow-lg">
            <span>👥</span>
            <span className="font-medium">Usuarios</span>
            <span className="ml-auto bg-white text-blue-900 text-xs px-2 py-1 rounded-full font-bold">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => navigate('/admin/alerts')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 hover:bg-blue-700/50 transition relative"
          >
            <span>⚠️</span>
            <span className="font-medium">Alertas</span>
          </button>
        </nav>

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
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Lista de Usuarios</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>
                Mostrando {filteredUsers.length} de {users.length} usuarios
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {activeUsersCount} en línea
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                {inactiveUsersCount} desconectados
              </span>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                loadUsers();
                loadActiveSessions();
              }}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
            >
              <span>🔄</span>
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Filtros</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:underline"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            
            {/* Búsqueda */}
            <div className="col-span-2">
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
            </div>

            {/* Filtro Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option>Todos</option>
              <option>Activo</option>
              <option>Inactivo</option>
            </select>

            {/* Filtro Severidad */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option>Todos los niveles</option>
              <option>Crítico</option>
              <option>Severa</option>
              <option>Moderada</option>
              <option>Leve</option>
              <option>Mínima</option>
            </select>

            {/* Ordenar */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="name">🔤 A-Z</option>
              <option value="phq9">📊 PHQ-9 ↓</option>
              <option value="gad7">📊 GAD-7 ↓</option>
              <option value="recent">🕒 Más reciente</option>
              <option value="active">🟢 Activos primero</option>
            </select>

          </div>

          {/* Filtros activos */}
          {(searchTerm || statusFilter !== 'Todos' || severityFilter !== 'Todos los niveles') && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Filtros activos:</span>
              {searchTerm && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2">
                  Búsqueda: "{searchTerm}"
                  <button type="button" onClick={() => setSearchTerm('')} className="hover:text-blue-900" aria-label="Quitar filtro de búsqueda">✕</button>
                </span>
              )}
              {statusFilter !== 'Todos' && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-2">
                  Estado: {statusFilter}
                  <button type="button" onClick={() => setStatusFilter('Todos')} className="hover:text-green-900" aria-label="Quitar filtro de estado">✕</button>
                </span>
              )}
              {severityFilter !== 'Todos los niveles' && (
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-2">
                  Nivel: {severityFilter}
                  <button type="button" onClick={() => setSeverityFilter('Todos los niveles')} className="hover:text-orange-900" aria-label="Quitar filtro de nivel">✕</button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tabla de Usuarios */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Usuario</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Edad</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">PHQ-9</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">GAD-7</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Última Eval.</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedUsers.map((user) => {
                const phq9Badge = getSeverityBadge(user.latest_phq9, 'phq9');
                const gad7Badge = getSeverityBadge(user.latest_gad7, 'gad7');
                const status = getUserStatus(user.id); // NUEVO
                
                return (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-gray-50 transition ${selectedUsers.includes(user.id) ? 'bg-blue-50' : ''}`}
                  >
                    
                    {/* Checkbox */}
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Usuario */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{user.full_name}</p>
                          <p className="text-sm text-gray-500">#{user.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Edad */}
                    <td className="px-6 py-4 text-center text-gray-700">
                      {user.age ? `${user.age} años` : '—'}
                    </td>

                    {/* PHQ-9 */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-gray-800">{user.latest_phq9 ?? '—'}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${phq9Badge.color}`}>
                          {phq9Badge.text}
                        </span>
                      </div>
                    </td>

                    {/* GAD-7 */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-gray-800">{user.latest_gad7 ?? '—'}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${gad7Badge.color}`}>
                          {gad7Badge.text}
                        </span>
                      </div>
                    </td>

                    {/* Última Evaluación */}
                    <td className="px-6 py-4 text-center text-sm text-gray-700">
                      {getTimeSince(user.created_at)}
                    </td>

                    {/* CORREGIDO: Estado real basado en sesiones */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 ${status.bgColor} ${status.textColor} text-xs font-medium rounded-full`}>
                        <span className={`w-2 h-2 ${status.dotColor} rounded-full ${status.text === 'En línea' ? 'animate-pulse' : ''}`}></span>
                        {status.text}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewProfile(user.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition font-medium"
                          title="Ver Perfil"
                        >
                          Ver Perfil
                        </button>
                        <button
                          onClick={() => handleDownloadReport(user)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Descargar"
                          aria-label="Descargar reporte"
                        >
                          ⬇️
                        </button>
                        <button
                          onClick={() => handleSendEmail(user)}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition"
                          title="Enviar Email"
                          aria-label="Enviar correo"
                        >
                          ✉️
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">🔍</span>
              <p className="text-xl font-semibold text-gray-800 mb-2">No se encontraron usuarios</p>
              <p className="text-gray-500">Intenta ajustar los filtros de búsqueda</p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Mostrando {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredUsers.length)} de {filteredUsers.length}
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg transition ${
                  currentPage === 1
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ← Anterior
              </button>

              <div className="flex gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-lg transition ${
                      currentPage === i + 1
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg transition ${
                  currentPage === totalPages
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}

export default AdminUsers;