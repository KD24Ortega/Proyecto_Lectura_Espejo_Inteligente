// ============================================================
// SessionManager.jsx - Componente para manejar sesiones
// Colocar en: src/components/SessionManager.jsx
// VERSIÓN CORREGIDA - Sin useNavigate
// ============================================================

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { API_BASE_URL } from '../services/api';

/**
 * Componente que maneja el ciclo de vida de las sesiones
 * - Cierra sesión al cerrar pestaña/navegador
 * - Cierra sesión al detectar navegación a Welcome
 */
export default function SessionManager({ children }) {
  const location = useLocation();

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

  useEffect(() => {
    // ============================================================
    // 1. Cerrar sesión al cerrar pestaña/navegador
    // ============================================================
    const sendEndSessionBeacon = () => {
      const userId = localStorage.getItem('user_id');
      
      if (userId) {
        // Usar sendBeacon (más confiable durante cierre/refresh).
        // Importante: enviar como text/plain para evitar preflight CORS.
        const data = JSON.stringify({ user_id: parseInt(userId) });
        const blob = new Blob([data], { type: 'text/plain;charset=UTF-8' });

        const apiUrl = API_BASE_URL;

        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon(`${apiUrl}/session/end`, blob);
        } else {
          // Fallback best-effort
          fetch(`${apiUrl}/session/end`, {
            method: 'POST',
            body: data,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            keepalive: true,
          }).catch(() => {});
        }
      }
    };

    const handleBeforeUnload = () => {
      sendEndSessionBeacon();
    };

    const handlePageHide = () => {
      // pagehide es más confiable en algunos navegadores que beforeunload
      sendEndSessionBeacon();
    };

    // Agregar event listener
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
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

  return <>{children}</>;
}


