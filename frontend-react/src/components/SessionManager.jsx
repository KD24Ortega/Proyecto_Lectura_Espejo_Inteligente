// ============================================================
// SessionManager.jsx - Componente para manejar sesiones
// Colocar en: src/components/SessionManager.jsx
// VERSIÓN CORREGIDA - Sin useNavigate
// ============================================================

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { API_BASE_URL } from '../services/api';

/**
 * Componente que maneja el ciclo de vida de las sesiones
 * - Cierra sesión al cerrar pestaña/navegador
 * - Cierra sesión al detectar navegación a Welcome
 */
export default function SessionManager({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isSameLocalDay = (isoTimestamp, referenceDate = new Date()) => {
    if (!isoTimestamp) return false;
    const d = new Date(isoTimestamp);
    return (
      d.getFullYear() === referenceDate.getFullYear() &&
      d.getMonth() === referenceDate.getMonth() &&
      d.getDate() === referenceDate.getDate()
    );
  };

  const shouldEnforceToday = (date = new Date()) => {
    const day = date.getDay();
    // 1 = Lunes, 5 = Viernes
    return day === 1 || day === 5;
  };

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

  // ============================================================
  // 3. Enforce PHQ-9/GAD-7 lunes y viernes
  //    - Si nunca se han completado, también obliga (línea base)
  // ============================================================
  useEffect(() => {
    const path = location.pathname;

    // Rutas que NO deben ser bloqueadas por la regla
    if (path === '/' || path === '/welcome' || path === '/register') return;
    if (path.startsWith('/admin')) return;

    // Ya estamos dentro de un test → no redirigir para evitar loops
    if (path === '/phq9' || path === '/gad7') return;

    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    let cancelled = false;

    const run = async () => {
      try {
        const today = new Date();
        const enforce = shouldEnforceToday(today);

        const res = await api.get(`/assessments/last/${userId}`);
        if (cancelled) return;

        const phq = res?.data?.phq9;
        const gad = res?.data?.gad7;

        const hasPhqEver = phq?.score !== null && phq?.score !== undefined;
        const hasGadEver = gad?.score !== null && gad?.score !== undefined;

        // Si no hay línea base, obligar a completarlos
        if (!hasPhqEver) {
          navigate('/phq9', { replace: true });
          return;
        }
        if (!hasGadEver) {
          navigate('/gad7', { replace: true });
          return;
        }

        if (!enforce) return;

        const todayStatus = res?.data?.today_status;
        const phqCount = Number(todayStatus?.phq9_count ?? 0);
        const gadCount = Number(todayStatus?.gad7_count ?? 0);

        if (todayStatus) {
          if (phqCount < 1) {
            navigate('/phq9', { replace: true });
            return;
          }
          if (gadCount < 1) {
            navigate('/gad7', { replace: true });
            return;
          }
          return;
        }

        // Fallback si backend no trae today_status
        const phqDoneToday = isSameLocalDay(phq?.timestamp, today);
        const gadDoneToday = isSameLocalDay(gad?.timestamp, today);

        if (!phqDoneToday) {
          navigate('/phq9', { replace: true });
          return;
        }
        if (!gadDoneToday) {
          navigate('/gad7', { replace: true });
          return;
        }
      } catch (error) {
        // Si falla la verificación, no bloquear navegación
        console.warn('⚠️ No se pudo aplicar regla de tests (continuando):', error);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  return <>{children}</>;
}


