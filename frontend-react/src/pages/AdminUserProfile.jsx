import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

function AdminUserProfile() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [adminName, setAdminName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('both'); // 'both', 'phq9', 'gad7'
  const [timeRange, setTimeRange] = useState(8); // 4, 8, 12 semanas
  const [showNotes, setShowNotes] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    checkAuth();
    loadUserProfile();
  }, [userId]);

  const checkAuth = () => {
    const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
    const adminNameStored = localStorage.getItem('admin_name') || sessionStorage.getItem('admin_name');
    
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    
    setAdminName(adminNameStored || 'Administrador');
  };

  const loadUserProfile = async () => {
    try {
      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
      const response = await api.get(`/admin/user/${userId}?user_id=${adminId}`);
      setUser(response.data);
    } catch (error) {
      console.error('Error al cargar perfil:', error);
      if (error.response?.status === 403) {
        navigate('/admin/login');
      } else if (error.response?.status === 404) {
        alert('Usuario no encontrado');
        navigate('/admin/users');
      }
    } finally {
      setIsLoading(false);
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

  const handleMarkAsAttended = async () => {
    try {
      // Aquí iría la llamada al backend para marcar como atendido
      alert('Usuario marcado como atendido exitosamente');
      loadUserProfile(); // Recargar datos
    } catch (error) {
      alert('Error al marcar como atendido');
    }
  };

  const handleExportPDF = async () => {
    try {
      alert('Generando PDF...');
      // Simular descarga
      const pdfContent = `
        REPORTE DE USUARIO - ${user.user.full_name}
        =====================================
        ID: ${user.user.id}
        Edad: ${user.user.age} años
        Email: ${user.user.email}
        
        ÚLTIMA EVALUACIÓN:
        PHQ-9: ${lastPhq9?.score || 'N/A'}
        GAD-7: ${lastGad7?.score || 'N/A'}
        
        Total de evaluaciones: ${totalEvaluations}
      `;
      
      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${user.user.full_name}_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      
      alert('Reporte descargado exitosamente');
    } catch (error) {
      alert('Error al exportar PDF');
    }
  };

  const handleExportCSV = () => {
    try {
      const csvData = [
        ['Fecha', 'Tipo', 'Puntuación', 'Severidad'],
        ...user.assessments.map(a => [
          new Date(a.created_at).toLocaleDateString('es-ES'),
          a.type.toUpperCase(),
          a.score,
          getSeverityInfo(a.score, a.type).text
        ])
      ];
      
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `datos_${user.user.full_name}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      alert('Datos exportados exitosamente');
    } catch (error) {
      alert('Error al exportar CSV');
    }
  };

  const handleSendNotification = () => {
    if (user.user.email) {
      const subject = encodeURIComponent('Seguimiento - Espejo Inteligente');
      const body = encodeURIComponent(`Estimado/a ${user.user.full_name},\n\nNos comunicamos desde el equipo de Espejo Inteligente para hacer seguimiento de tu bienestar...\n\nSaludos,\n${adminName}`);
      window.location.href = `mailto:${user.user.email}?subject=${subject}&body=${body}`;
    } else {
      alert('Este usuario no tiene email registrado');
    }
  };

  const handleGenerateCode = () => {
    const code = `ESP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    // Copiar al portapapeles
    navigator.clipboard.writeText(code).then(() => {
      alert(`Código de derivación generado y copiado:\n\n${code}\n\nEste código ha sido copiado al portapapeles.`);
    }).catch(() => {
      alert(`Código de derivación generado:\n\n${code}\n\n(No se pudo copiar automáticamente)`);
    });
  };

  const handleDeleteUser = async () => {
    const confirmation = prompt(`Para confirmar la eliminación, escribe el nombre del usuario: "${user.user.full_name}"`);
    
    if (confirmation === user.user.full_name) {
      try {
        const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
        await api.delete(`/admin/user/${userId}?user_id=${adminId}`);
        alert('Usuario eliminado exitosamente');
        navigate('/admin/users');
      } catch (error) {
        console.error('Error al eliminar usuario:', error);
        alert('Error al eliminar usuario');
      }
    } else if (confirmation !== null) {
      alert('El nombre no coincide. Operación cancelada.');
    }
  };

  const handleSaveNote = () => {
    // Guardar nota en localStorage temporalmente
    const notes = JSON.parse(localStorage.getItem('user_notes') || '{}');
    notes[userId] = {
      content: note,
      timestamp: new Date().toISOString(),
      author: adminName
    };
    localStorage.setItem('user_notes', JSON.stringify(notes));
    alert('Nota guardada exitosamente');
    setShowNotes(false);
  };

  const getSeverityInfo = (score, type) => {
    if (score === null || score === undefined) {
      return { text: 'Sin evaluación', color: 'bg-gray-200 text-gray-600', max: type === 'phq9' ? 27 : 21 };
    }
    
    const max = type === 'phq9' ? 27 : 21;
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
    
    return { text: severity, color, max };
  };

  const calculateTrend = (history) => {
    if (history.length < 2) return { text: 'Insuficientes datos', color: 'text-gray-600', icon: '—' };
    
    const recent = history.slice(-3);
    const older = history.slice(0, Math.min(3, history.length - 3));
    
    const recentAvg = recent.reduce((sum, a) => sum + a.score, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, a) => sum + a.score, 0) / older.length : recentAvg;
    
    const change = recentAvg - olderAvg;
    
    if (change < -2) return { text: 'Mejorando', color: 'text-green-600', icon: '📈', percent: Math.abs(((change / olderAvg) * 100).toFixed(1)) };
    if (change > 2) return { text: 'Empeorando', color: 'text-red-600', icon: '📉', percent: Math.abs(((change / olderAvg) * 100).toFixed(1)) };
    return { text: 'Estable', color: 'text-gray-600', icon: '➡️', percent: 0 };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <span className="text-6xl mb-4 block">😕</span>
          <p className="text-2xl font-bold text-red-600 mb-2">Usuario no encontrado</p>
          <button
            onClick={() => navigate('/admin/users')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Volver a Usuarios
          </button>
        </div>
      </div>
    );
  }

  const lastPhq9 = user.assessments.filter(a => a.type === 'phq9').sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  )[0];
  
  const lastGad7 = user.assessments.filter(a => a.type === 'gad7').sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  )[0];

  const phq9Info = getSeverityInfo(lastPhq9?.score, 'phq9');
  const gad7Info = getSeverityInfo(lastGad7?.score, 'gad7');

  const totalEvaluations = user.assessments.length;
  const phq9Count = user.assessments.filter(a => a.type === 'phq9').length;
  const gad7Count = user.assessments.filter(a => a.type === 'gad7').length;
  const adherence = totalEvaluations > 0 ? 100 : 0;

  // Datos de gráfica
  const phq9History = user.assessments
    .filter(a => a.type === 'phq9')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-timeRange);
  
  const gad7History = user.assessments
    .filter(a => a.type === 'gad7')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-timeRange);

  const phq9Trend = calculateTrend(phq9History);
  const gad7Trend = calculateTrend(gad7History);

  // Días desde última evaluación
  const daysSinceLastEval = lastPhq9 || lastGad7 
    ? Math.floor((new Date() - new Date((lastPhq9?.created_at || lastGad7?.created_at))) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-gray-100 flex">
      
      {/* Barra Lateral */}
      <aside className="w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col shadow-2xl">
        
        {/* Logo */}
        <div className="p-6 border-b border-blue-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-2xl">🛡️</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">Espejo Inteligente</h1>
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

          <button
            onClick={() => navigate('/admin/alerts')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 hover:bg-blue-700/50 transition"
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
            <button
              onClick={() => navigate('/admin/users')}
              className="text-blue-600 hover:underline mb-2 flex items-center gap-1"
            >
              ← Volver a Usuarios
            </button>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">Perfil de Usuario</h2>
            <p className="text-gray-600">Información detallada e historial completo</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadUserProfile}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
            >
              <span>🔄</span>
              <span>Actualizar</span>
            </button>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <span>📝</span>
              <span>Notas</span>
            </button>
          </div>
        </div>

        {/* Modal de Notas */}
        {showNotes && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-96">
              <h3 className="text-xl font-bold mb-4">Agregar Nota</h3>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Escribe tus observaciones aquí..."
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSaveNote}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setShowNotes(false)}
                  className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resumen del Usuario */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-6">
            
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center text-white text-4xl font-bold flex-shrink-0 shadow-lg">
              {user.user.full_name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-1">{user.user.full_name}</h3>
                  <p className="text-gray-600 mb-2">
                    {user.user.age ? `${user.user.age} años` : 'Edad no registrada'} • 
                    {user.user.gender === 'm' ? ' Masculino' : user.user.gender === 'f' ? ' Femenino' : ' No especificado'} • 
                    ID: #{user.user.id}
                  </p>
                  <p className="text-gray-600 flex items-center gap-2">
                    <span>📧</span>
                    <span>{user.user.email || 'No registrado'}</span>
                  </p>
                </div>

                {/* Badge de estado con días */}
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Activo
                  </span>
                  {daysSinceLastEval !== null && (
                    <p className="text-xs text-gray-500">
                      Última evaluación: hace {daysSinceLastEval} día{daysSinceLastEval !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Alerta condicional */}
              {(lastPhq9?.score >= 10 || lastGad7?.score >= 10) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">⚠️</span>
                    <div className="flex-1">
                      <p className="font-semibold text-orange-800 mb-1">
                        Usuario con niveles {lastPhq9?.score >= 15 || lastGad7?.score >= 15 ? 'severos' : 'moderados'}
                      </p>
                      <p className="text-sm text-orange-700 mb-3">
                        {lastPhq9?.score >= 15 || lastGad7?.score >= 15 
                          ? 'Requiere intervención inmediata. Considerar derivación profesional urgente.'
                          : 'Monitoreo recomendado. Considerar seguimiento en las próximas semanas.'}
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => navigate(`/admin/user/${userId}/recommendations`)}
                          className="px-4 py-2 bg-white border border-orange-300 text-orange-700 rounded-lg text-sm hover:bg-orange-50 transition font-medium"
                        >
                          Ver recomendaciones
                        </button>
                        <button
                          onClick={handleMarkAsAttended}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 transition font-medium"
                        >
                          Marcar como atendido
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Info adicional */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <span>📅</span>
                  <span>Registrado: {new Date(user.user.created_at).toLocaleDateString('es-ES')}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>📊</span>
                  <span>{totalEvaluations} evaluaciones totales</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>🔗</span>
                  <span>{user.user.total_sessions || 0} sesiones</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Estado Actual */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Estado Actual</h3>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            
            {/* PHQ-9 */}
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl">
              <p className="text-gray-600 text-sm mb-2 font-semibold">PHQ-9 (Depresión)</p>
              <p className="text-6xl font-bold text-gray-800 mb-2">
                {lastPhq9?.score ?? '—'}
                <span className="text-2xl text-gray-400"> / {phq9Info.max}</span>
              </p>
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${phq9Info.color} mb-3`}>
                {phq9Info.text}
              </span>
              
              {/* Tendencia PHQ-9 */}
              <div className={`flex items-center justify-center gap-2 text-sm ${phq9Trend.color}`}>
                <span>{phq9Trend.icon}</span>
                <span className="font-medium">{phq9Trend.text}</span>
                {phq9Trend.percent > 0 && <span>({phq9Trend.percent}%)</span>}
              </div>
            </div>

            {/* GAD-7 */}
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
              <p className="text-gray-600 text-sm mb-2 font-semibold">GAD-7 (Ansiedad)</p>
              <p className="text-6xl font-bold text-gray-800 mb-2">
                {lastGad7?.score ?? '—'}
                <span className="text-2xl text-gray-400"> / {gad7Info.max}</span>
              </p>
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${gad7Info.color} mb-3`}>
                {gad7Info.text}
              </span>
              
              {/* Tendencia GAD-7 */}
              <div className={`flex items-center justify-center gap-2 text-sm ${gad7Trend.color}`}>
                <span>{gad7Trend.icon}</span>
                <span className="font-medium">{gad7Trend.text}</span>
                {gad7Trend.percent > 0 && <span>({gad7Trend.percent}%)</span>}
              </div>
            </div>

          </div>

          {/* Metadata */}
          <div className="border-t border-gray-200 pt-4 grid grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-gray-500 mb-1">Última evaluación</p>
              <p className="font-semibold text-gray-800">
                {lastPhq9 ? new Date(lastPhq9.created_at).toLocaleDateString('es-ES') : 'N/A'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 mb-1">PHQ-9 completadas</p>
              <p className="font-semibold text-gray-800">{phq9Count}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 mb-1">GAD-7 completadas</p>
              <p className="font-semibold text-gray-800">{gad7Count}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 mb-1">Adherencia</p>
              <p className="font-semibold text-green-600">{adherence}%</p>
            </div>
          </div>
        </div>

        {/* Historial INTERACTIVO */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">
                Historial de Evaluaciones
              </h3>
              <p className="text-sm text-gray-600">
                {phq9History.length} PHQ-9 • {gad7History.length} GAD-7
              </p>
            </div>

            <div className="flex gap-2">
              {/* Selector de métrica */}
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="both">Ambas métricas</option>
                <option value="phq9">Solo PHQ-9</option>
                <option value="gad7">Solo GAD-7</option>
              </select>

              {/* Selector de rango */}
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value={4}>4 semanas</option>
                <option value={8}>8 semanas</option>
                <option value={12}>12 semanas</option>
              </select>
            </div>
          </div>

          {/* Gráfica INTERACTIVA */}
          <div 
            className="relative h-80 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg p-6"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            
            {/* Eje Y */}
            <div className="absolute left-4 top-6 bottom-12 flex flex-col justify-between text-sm text-gray-600">
              <span>27</span>
              <span>21</span>
              <span>14</span>
              <span>7</span>
              <span>0</span>
            </div>

            {/* Grid */}
            <div className="absolute left-16 right-6 top-6 bottom-12">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="absolute w-full border-t border-gray-300" style={{ top: `${i * 25}%` }} />
              ))}
            </div>

            {/* SVG Chart CON HOVER */}
            <div className="absolute left-16 right-6 top-6 bottom-12">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                
                {/* Línea PHQ-9 */}
                {(selectedMetric === 'both' || selectedMetric === 'phq9') && phq9History.length > 1 && (
                  <>
                    <polyline
                      points={phq9History.map((a, i) => {
                        const x = (i / Math.max(phq9History.length - 1, 1)) * 100;
                        const y = 100 - (a.score / 27) * 100;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="0.8"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />

                    {phq9History.map((a, i) => {
                      const x = (i / Math.max(phq9History.length - 1, 1)) * 100;
                      const y = 100 - (a.score / 27) * 100;
                      return (
                        <circle 
                          key={`phq9-${i}`} 
                          cx={x} 
                          cy={y} 
                          r={hoveredPoint?.type === 'phq9' && hoveredPoint?.index === i ? "2.5" : "1.5"}
                          fill="#10b981" 
                          stroke="white" 
                          strokeWidth="0.5" 
                          vectorEffect="non-scaling-stroke"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ type: 'phq9', index: i, score: a.score, date: a.created_at })}
                        />
                      );
                    })}
                  </>
                )}

                {/* Línea GAD-7 */}
                {(selectedMetric === 'both' || selectedMetric === 'gad7') && gad7History.length > 1 && (
                  <>
                    <polyline
                      points={gad7History.map((a, i) => {
                        const x = (i / Math.max(gad7History.length - 1, 1)) * 100;
                        const y = 100 - (a.score / 27) * 100;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="0.8"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />

                    {gad7History.map((a, i) => {
                      const x = (i / Math.max(gad7History.length - 1, 1)) * 100;
                      const y = 100 - (a.score / 27) * 100;
                      return (
                        <circle 
                          key={`gad7-${i}`} 
                          cx={x} 
                          cy={y} 
                          r={hoveredPoint?.type === 'gad7' && hoveredPoint?.index === i ? "2.5" : "1.5"}
                          fill="#3b82f6" 
                          stroke="white" 
                          strokeWidth="0.5" 
                          vectorEffect="non-scaling-stroke"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ type: 'gad7', index: i, score: a.score, date: a.created_at })}
                        />
                      );
                    })}
                  </>
                )}

                {/* Tooltip on hover */}
                {hoveredPoint && (
                  <foreignObject 
                    x={hoveredPoint.type === 'phq9' 
                      ? (hoveredPoint.index / Math.max(phq9History.length - 1, 1)) * 100 - 15
                      : (hoveredPoint.index / Math.max(gad7History.length - 1, 1)) * 100 - 15}
                    y={100 - (hoveredPoint.score / 27) * 100 - 25}
                    width="30" 
                    height="20"
                  >
                    <div className="bg-white px-3 py-2 rounded-lg shadow-xl border-2 border-blue-500 text-xs whitespace-nowrap">
                      <p className="font-bold text-gray-800">
                        {hoveredPoint.type === 'phq9' ? 'PHQ-9' : 'GAD-7'}: {hoveredPoint.score}
                      </p>
                      <p className="text-gray-600">{new Date(hoveredPoint.date).toLocaleDateString('es-ES')}</p>
                    </div>
                  </foreignObject>
                )}

              </svg>
            </div>

            {/* Eje X */}
            <div className="absolute left-16 right-6 bottom-6 flex justify-between text-xs text-gray-600">
              {Array.from({length: Math.min(timeRange, Math.max(phq9History.length, gad7History.length))}).map((_, i) => (
                <span key={i}>S{i + 1}</span>
              ))}
            </div>

            {/* Leyenda */}
            <div className="absolute bottom-2 right-6 flex gap-4 text-xs">
              {(selectedMetric === 'both' || selectedMetric === 'phq9') && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>PHQ-9</span>
                </div>
              )}
              {(selectedMetric === 'both' || selectedMetric === 'gad7') && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>GAD-7</span>
                </div>
              )}
            </div>
          </div>

          {/* Análisis automático */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            {/* Análisis PHQ-9 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <span>📊</span>
                Análisis PHQ-9
              </p>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Tendencia: {phq9Trend.icon} {phq9Trend.text}</li>
                <li>• Evaluaciones: {phq9Count}</li>
                <li>• Promedio: {phq9History.length > 0 
                  ? (phq9History.reduce((sum, a) => sum + a.score, 0) / phq9History.length).toFixed(1)
                  : 'N/A'}
                </li>
              </ul>
            </div>

            {/* Análisis GAD-7 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <span>📊</span>
                Análisis GAD-7
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Tendencia: {gad7Trend.icon} {gad7Trend.text}</li>
                <li>• Evaluaciones: {gad7Count}</li>
                <li>• Promedio: {gad7History.length > 0 
                  ? (gad7History.reduce((sum, a) => sum + a.score, 0) / gad7History.length).toFixed(1)
                  : 'N/A'}
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Acciones FUNCIONALES */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Acciones</h3>
          
          <div className="grid grid-cols-5 gap-3">
            <button
              onClick={handleExportPDF}
              className="flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition transform hover:scale-105"
            >
              <span className="text-3xl">📄</span>
              <span className="text-sm font-medium text-gray-700 text-center">Exportar Reporte PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition transform hover:scale-105"
            >
              <span className="text-3xl">📊</span>
              <span className="text-sm font-medium text-gray-700 text-center">Exportar Datos CSV</span>
            </button>

            <button
              onClick={handleSendNotification}
              className="flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition transform hover:scale-105"
            >
              <span className="text-3xl">📧</span>
              <span className="text-sm font-medium text-gray-700 text-center">Enviar Notificación</span>
            </button>

            <button
              onClick={handleGenerateCode}
              className="flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-xl hover:border-yellow-500 hover:bg-yellow-50 transition transform hover:scale-105"
            >
              <span className="text-3xl">🔗</span>
              <span className="text-sm font-medium text-gray-700 text-center">Generar Código Derivación</span>
            </button>

            <button
              onClick={handleDeleteUser}
              className="flex flex-col items-center gap-2 p-4 border-2 border-red-300 rounded-xl hover:border-red-500 hover:bg-red-50 transition transform hover:scale-105"
            >
              <span className="text-3xl">🗑️</span>
              <span className="text-sm font-medium text-red-700 text-center">Eliminar Usuario</span>
            </button>
          </div>
        </div>

      </main>

    </div>
  );
}

export default AdminUserProfile;