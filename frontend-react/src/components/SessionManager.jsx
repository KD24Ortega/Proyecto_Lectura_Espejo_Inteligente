// ============================================================
// SessionManager.jsx - Componente para manejar sesiones
// Colocar en: src/components/SessionManager.jsx
// VERSIÓN CORREGIDA - Sin useNavigate
// ============================================================

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

/**
 * Componente que maneja el ciclo de vida de las sesiones
 * - Cierra sesión al cerrar pestaña/navegador
 * - Cierra sesión al detectar navegación a Welcome
 */
export default function SessionManager({ children }) {
  const location = useLocation();

  useEffect(() => {
    // ============================================================
    // 1. Cerrar sesión al cerrar pestaña/navegador
    // ============================================================
    const handleBeforeUnload = (event) => {
      const userId = localStorage.getItem('user_id');
      
      if (userId) {
        // Usar sendBeacon para request asíncrono confiable
        // (funciona incluso cuando la página se está cerrando)
        const data = JSON.stringify({ user_id: parseInt(userId) });
        const blob = new Blob([data], { type: 'application/json' });
        
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        
        navigator.sendBeacon(
          `${apiUrl}/session/end`,
          blob
        );
        
        console.log('🚪 Sesión cerrada al cerrar pestaña/navegador');
      }
    };

    // Agregar event listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // ============================================================
  // 2. Cerrar sesión al navegar a Welcome
  // ============================================================
  useEffect(() => {
    // Si el usuario navega a Welcome (logout), cerrar sesión
    if (location.pathname === '/' || location.pathname === '/welcome') {
      const userId = localStorage.getItem('user_id');
      
      if (userId) {
        console.log('🔄 Navegación a Welcome detectada - cerrando sesión');
        endSession(parseInt(userId));
      }
    }
  }, [location.pathname]);

  /**
   * Función auxiliar para cerrar sesión
   */
  const endSession = async (userId) => {
    try {
      await api.post('/session/end', { user_id: userId });
      console.log('✅ Sesión cerrada para user_id:', userId);
    } catch (error) {
      console.error('⚠️ Error cerrando sesión:', error);
    }
  };

  return <>{children}</>;
}


