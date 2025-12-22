import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import api from '../services/api';
import useDynamicTheme from '../hooks/useDynamicTheme';

function AdminUserProfile() {
  const { theme } = useDynamicTheme();
  const bg = theme?.colors?.primary || 'from-gray-400 via-gray-500 to-slate-600';

  const navigate = useNavigate();
  const { userId } = useParams();

  const [user, setUser] = useState(null);
  const [trends, setTrends] = useState(null);

  const [adminName, setAdminName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Estado de actividad (sesión activa/inactiva)
  const [isUserActive, setIsUserActive] = useState(false);

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [timeRange, setTimeRange] = useState(8);

  const [showNotes, setShowNotes] = useState(false);
  const [note, setNote] = useState('');

  // Modales
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);
  const [showAttendedModal, setShowAttendedModal] = useState(false);
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [scheduleFollowup, setScheduleFollowup] = useState(true);
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [followupDate, setFollowupDate] = useState('');
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);

  // ====== VOZ ======
  const [voiceStats, setVoiceStats] = useState(null);
  const [voiceSessions, setVoiceSessions] = useState([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  // Ref para captura de gráfica
  const chartRef = useRef(null);

  // -------------------------
  // Helpers
  // -------------------------
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const toNum = (v, fallback = null) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const apiGetTryPaths = async (paths) => {
    let lastErr = null;
    for (const p of paths) {
      try {
        return await api.get(p);
      } catch (e) {
        lastErr = e;
        const status = e?.response?.status;
        if (status === 404 || status === 405) continue;
        throw e;
      }
    }
    throw lastErr || new Error('No se pudo resolver ninguna ruta.');
  };

  const toBool = (v) => {
    if (v === true) return true;
    if (v === false || v === null || v === undefined) return false;
    if (typeof v === 'number') return v === 1;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'si';
    }
    return Boolean(v);
  };

  const normalizeVoiceScoreTo100 = (raw) => {
    if (raw === null || raw === undefined) return null;
    const v = Number(raw);
    if (Number.isNaN(v)) return null;

    if (v >= 0 && v <= 1) return v * 100;
    if (v >= 0 && v <= 100) return v;

    return clamp(v, 0, 100);
  };

  const computeMultimodal = (emotionalIndex100, voiceScore100, riskDist) => {
    const wTests = 0.6;
    const wVoice = 0.4;

    const tests = typeof emotionalIndex100 === 'number' ? clamp(emotionalIndex100, 0, 100) : null;
    const voice = typeof voiceScore100 === 'number' ? clamp(voiceScore100, 0, 100) : null;

    let index = null;
    if (tests !== null && voice !== null) index = (wTests * tests) + (wVoice * voice);
    else if (tests !== null) index = tests;
    else if (voice !== null) index = voice;

    if (index === null) {
      return {
        index: null,
        level: 'Sin datos',
        color: 'bg-gray-200 text-gray-700',
        note: 'No hay suficientes señales para calcular.'
      };
    }

    const highCount = riskDist?.HIGH ?? 0;
    const totalRisk = (riskDist?.LOW ?? 0) + (riskDist?.MODERATE ?? 0) + (riskDist?.HIGH ?? 0);
    const highPct = totalRisk > 0 ? (highCount / totalRisk) * 100 : 0;

    const boosted = clamp(index + (highPct >= 40 ? 7 : highPct >= 20 ? 4 : 0), 0, 100);

    let level = 'Estable';
    let color = 'bg-green-100 text-green-700';
    if (boosted >= 60) { level = 'Severo'; color = 'bg-red-100 text-red-700'; }
    else if (boosted >= 40) { level = 'Moderado'; color = 'bg-orange-100 text-orange-700'; }
    else if (boosted >= 20) { level = 'Leve'; color = 'bg-blue-100 text-blue-700'; }

    return {
      index: Number(boosted.toFixed(1)),
      level,
      color,
      note: totalRisk > 0
        ? `Incluye ajuste por riesgo HIGH: ${highPct.toFixed(0)}%`
        : 'Sin distribución de riesgo disponible.'
    };
  };

  const getSeverityInfo = (score, type) => {
    const val = toNum(score, null);
    if (val === null) {
      return { text: 'Sin evaluación', color: 'bg-gray-200 text-gray-600', max: type === 'phq9' ? 27 : 21 };
    }

    const max = type === 'phq9' ? 27 : 21;
    let severity, color;

    if (val < 5) { severity = 'Mínima'; color = 'bg-green-100 text-green-700'; }
    else if (val < 10) { severity = 'Leve'; color = 'bg-blue-100 text-blue-700'; }
    else if (val < 15) { severity = 'Moderada'; color = 'bg-orange-100 text-orange-700'; }
    else { severity = 'Severa'; color = 'bg-red-100 text-red-700'; }

    return { text: severity, color, max };
  };

  const calculateTrend = (history) => {
    if (!Array.isArray(history) || history.length < 2) {
      return { text: 'Insuficientes datos', color: 'text-gray-600', icon: '—', percent: 0 };
    }

    const recent = history.slice(-3);
    const older = history.slice(0, Math.min(3, Math.max(0, history.length - 3)));

    const recentAvg = recent.reduce((sum, a) => sum + (toNum(a?.score, 0) ?? 0), 0) / recent.length;
    const olderAvg = older.length > 0
      ? older.reduce((sum, a) => sum + (toNum(a?.score, 0) ?? 0), 0) / older.length
      : recentAvg;

    const change = recentAvg - olderAvg;

    let percent = 0;
    if (olderAvg > 0) percent = Math.min(999, Math.abs((change / olderAvg) * 100));
    else if (change !== 0) percent = Math.min(999, Math.abs(change * 10));

    percent = Number(percent.toFixed(1));

    if (change < -2) return { text: 'Mejorando', color: 'text-green-600', icon: '📈', percent };
    if (change > 2) return { text: 'Empeorando', color: 'text-red-600', icon: '📉', percent };
    return { text: 'Estable', color: 'text-gray-600', icon: '➡️', percent: 0 };
  };

  // -------------------------
  // Effects
  // -------------------------
  useEffect(() => {
    const checkAuth = () => {
      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
      const adminNameStored = localStorage.getItem('admin_name') || sessionStorage.getItem('admin_name');

      if (!adminId) {
        navigate('/admin/login');
        return;
      }
      setAdminName(adminNameStored || 'Administrador');
    };

    checkAuth();
    loadUserProfile();
    loadUserActiveStatus();

    const interval = setInterval(loadUserActiveStatus, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    loadTrendsAnalysis();
    loadVoiceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeRange, userId]);

  // -------------------------
  // API loaders
  // -------------------------
  const loadUserProfile = async () => {
    try {
      setIsLoading(true);

      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
      const response = await api.get(`/admin/user/${userId}?user_id=${adminId}`);
      const lastResponse = await api.get(`/assessments/last/${userId}`);

      const phqLast = lastResponse.data?.phq9?.score ?? 0;
      const gadLast = lastResponse.data?.gad7?.score ?? 0;

      const merged = {
        ...response.data,
        trend_summary: {
          phq9_last: lastResponse.data?.phq9?.score,
          gad7_last: lastResponse.data?.gad7?.score,
          phq9_trend: lastResponse.data?.phq9?.severity,
          gad7_trend: lastResponse.data?.gad7?.severity,
          status:
            (phqLast >= 15 || gadLast >= 15)
              ? "severo"
              : (phqLast >= 10 || gadLast >= 10)
              ? "moderado"
              : "leve"
        }
      };

      setUser(merged);
    } catch (error) {
      console.error('Error al cargar perfil:', error);
      if (error.response?.status === 403) {
        navigate('/admin/login');
      } else if (error.response?.status === 404) {
        alert('Usuario no encontrado');
        navigate('/admin/users');
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserActiveStatus = async () => {
    try {
      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');
      if (!adminId) return;

      const res = await api.get(`/admin/sessions/active?user_id=${adminId}`);
      const uid = Number(userId);
      const sessions = Array.isArray(res.data) ? res.data : [];
      const active = sessions.some((s) => Number(s?.user_id) === uid && toBool(s?.is_active));
      setIsUserActive(active);
    } catch (error) {
      console.error('Error al cargar estado activo del usuario:', error);
      setIsUserActive(false);
    }
  };

  const loadTrendsAnalysis = async () => {
    try {
      const days = timeRange * 7;
      const response = await api.get(`/trends/analyze/${userId}?days=${days}`);
      setTrends(response.data);
    } catch (error) {
      console.error('Error al cargar análisis de tendencias:', error);
    }
  };

  const loadVoiceData = async () => {
    try {
      setVoiceLoading(true);
      setVoiceError(null);

      const days = timeRange * 7;
      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

      const statsRes = await apiGetTryPaths([
        `/voice/user/${userId}/stats?days=${days}`,
        `/api/voice/user/${userId}/stats?days=${days}`,
      ]);
      setVoiceStats(statsRes.data);

      let sessionsRes = null;
      let backendFiltered = true;

      try {
        sessionsRes = await apiGetTryPaths([
          `/voice/sessions/user/${userId}?days=${days}&limit=50`,
          `/api/voice/sessions/user/${userId}?days=${days}&limit=50`,
        ]);
      } catch {
        backendFiltered = false;
        sessionsRes = await apiGetTryPaths([
          `/voice/sessions/user/${userId}?limit=50`,
          `/api/voice/sessions/user/${userId}?limit=50`,
        ]);
      }

      let sessions = Array.isArray(sessionsRes?.data) ? sessionsRes.data : [];

      if (!backendFiltered) {
        sessions = sessions.filter((s) => {
          if (!s?.created_at) return false;
          const t = new Date(s.created_at).getTime();
          return Number.isFinite(t) && t >= cutoffMs;
        });
      }

      setVoiceSessions(sessions);
    } catch (error) {
      console.error('Error cargando datos de voz:', error);
      setVoiceError('No se pudo cargar el análisis de voz.');
      setVoiceStats(null);
      setVoiceSessions([]);
    } finally {
      setVoiceLoading(false);
    }
  };

  // -------------------------
  // Derived (SIEMPRE se ejecutan, aunque user sea null)
  // -------------------------
  const assessments = user?.assessments ?? [];

  const lastByType = (type) => {
    let best = null;
    for (const a of assessments) {
      if (a?.type !== type || !a?.created_at) continue;
      if (!best) best = a;
      else if (new Date(a.created_at) > new Date(best.created_at)) best = a;
    }
    return best;
  };

  const lastPhq9 = lastByType('phq9');
  const lastGad7 = lastByType('gad7');

  const phq9Info = getSeverityInfo(lastPhq9?.score, 'phq9');
  const gad7Info = getSeverityInfo(lastGad7?.score, 'gad7');

  const totalEvaluations = assessments.length;
  const phq9Count = assessments.filter(a => a.type === 'phq9').length;
  const gad7Count = assessments.filter(a => a.type === 'gad7').length;

  const mostRecentDate = useMemo(() => {
    const candidates = [lastPhq9?.created_at, lastGad7?.created_at].filter(Boolean);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => new Date(b) - new Date(a))[0];
  }, [lastPhq9?.created_at, lastGad7?.created_at]);

  const daysSinceLastEval = useMemo(() => {
    if (!mostRecentDate) return null;
    return Math.floor((Date.now() - new Date(mostRecentDate).getTime()) / (1000 * 60 * 60 * 24));
  }, [mostRecentDate]);

  const { phq9History, gad7History } = useMemo(() => {
    const phq = assessments
      .filter(a => a.type === 'phq9' && a.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-timeRange);

    const gad = assessments
      .filter(a => a.type === 'gad7' && a.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-timeRange);

    return { phq9History: phq, gad7History: gad };
  }, [assessments, timeRange]);

  const adherence = useMemo(() => {
    const weeks = timeRange;
    if (!weeks) return 0;

    const end = Date.now();
    const start = end - weeks * 7 * 24 * 60 * 60 * 1000;

    const within = assessments.filter(a => a?.created_at && new Date(a.created_at).getTime() >= start);
    if (!within.length) return 0;

    const weekHas = new Array(weeks).fill(false);

    for (const a of within) {
      const t = new Date(a.created_at).getTime();
      const diffDays = Math.floor((end - t) / (24 * 60 * 60 * 1000));
      const w = Math.floor(diffDays / 7);
      if (w >= 0 && w < weeks) weekHas[w] = true;
    }

    const completed = weekHas.filter(Boolean).length;
    return Math.round((completed / weeks) * 100);
  }, [assessments, timeRange]);

  const phq9Trend = useMemo(() => calculateTrend(phq9History), [phq9History]);
  const gad7Trend = useMemo(() => calculateTrend(gad7History), [gad7History]);

  const emotionalIndex = useMemo(() => {
    const phqAvg = phq9History.length > 0
      ? phq9History.reduce((s, a) => s + (toNum(a?.score, 0) ?? 0), 0) / phq9History.length
      : null;

    const gadAvg = gad7History.length > 0
      ? gad7History.reduce((s, a) => s + (toNum(a?.score, 0) ?? 0), 0) / gad7History.length
      : null;

    const parts = [];
    if (phqAvg !== null) parts.push((phqAvg / 27) * 100);
    if (gadAvg !== null) parts.push((gadAvg / 21) * 100);

    if (!parts.length) return 0;
    return Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(1));
  }, [phq9History, gad7History]);

  const voiceScore100 = useMemo(() => {
    return normalizeVoiceScoreTo100(voiceStats?.summary?.avg_score);
  }, [voiceStats]);

  const multimodal = useMemo(() => {
    return computeMultimodal(
      emotionalIndex,
      voiceScore100,
      voiceStats?.summary?.risk_distribution
    );
  }, [emotionalIndex, voiceScore100, voiceStats]);

  // Tooltip coords (fix foreignObject)
  const tooltipCoords = useMemo(() => {
    if (!hoveredPoint) return null;
    const len = hoveredPoint.type === 'phq9' ? phq9History.length : gad7History.length;
    const x = len <= 1 ? 50 : (hoveredPoint.index / Math.max(len - 1, 1)) * 100;
    const score = toNum(hoveredPoint.score, 0) ?? 0;
    const max = toNum(hoveredPoint.max, 1) ?? 1;
    const y = 100 - (score / max) * 100;
    const fx = clamp(x - 15, 0, 70);
    const fy = clamp(y - 25, 0, 80);
    return { x: fx, y: fy };
  }, [hoveredPoint, phq9History.length, gad7History.length]);

  // -------------------------
  // Actions
  // -------------------------
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_id');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_name');
    sessionStorage.clear();
    navigate('/admin/login');
  };

  const handleMarkAsAttended = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setFollowupDate(nextWeek.toISOString().split('T')[0]);
    setShowAttendedModal(true);
  };

  const submitAttendance = async () => {
    try {
      setIsSubmittingAttendance(true);
      const adminId = localStorage.getItem('admin_id') || sessionStorage.getItem('admin_id');

      await api.post(`/admin/mark-attended/${userId}`, {
        admin_id: parseInt(adminId, 10),
        notes: attendanceNotes,
        schedule_followup: scheduleFollowup,
        followup_date: scheduleFollowup ? followupDate : null,
        send_confirmation: sendConfirmation
      });

      setShowAttendedModal(false);
      setAttendanceNotes('');
      setScheduleFollowup(true);
      setSendConfirmation(true);

      alert('✅ Usuario marcado como atendido exitosamente');
      loadUserProfile();
    } catch (error) {
      console.error('Error al marcar como atendido:', error);
      alert('❌ Error al marcar como atendido. Por favor intenta nuevamente.');
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleSaveNote = () => {
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

  const handleExportCSV = () => {
    try {
      if (!assessments.length) {
        alert("Este usuario aún no posee evaluaciones registradas.");
        return;
      }

      const csvData = [
        ['Fecha', 'Tipo', 'Puntuación', 'Severidad'],
        ...assessments.map(a => [
          a?.created_at ? new Date(a.created_at).toLocaleDateString('es-ES') : '',
          String(a?.type ?? '').toUpperCase(),
          a?.score ?? '',
          getSeverityInfo(a?.score, a?.type).text
        ])
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url;
      el.download = `datos_${(user?.user?.full_name || 'usuario')}_${new Date().toISOString().split('T')[0]}.csv`;
      el.click();

      alert('Datos exportados exitosamente');
    } catch (error) {
      console.error(error);
      alert('Error al exportar CSV');
    }
  };

  const handleSendNotification = async () => {
    try {
      if (!user?.user?.email) {
        alert("Este usuario no tiene correo registrado");
        return;
      }

      const phq = toNum(lastPhq9?.score, null);
      const gad = toNum(lastGad7?.score, null);

      let recommendation = "Sin datos suficientes.";
      if (phq !== null || gad !== null) {
        if ((phq ?? 0) >= 15 || (gad ?? 0) >= 15) recommendation = "Requiere evaluación profesional prioritaria.";
        else if ((phq ?? 0) >= 10 || (gad ?? 0) >= 10) recommendation = "Se sugiere monitoreo clínico.";
        else recommendation = "Estado estable.";
      }

      const message = `
Estimado/a ${user.user.full_name},

Nos comunicamos desde el sistema CalmaSense para dar seguimiento a su bienestar emocional.


Resultados más recientes:

PHQ-9: ${phq ?? "N/A"}
GAD-7: ${gad ?? "N/A"}

Recomendación:
${recommendation}

Saludos,
Equipo CalmaSense

Administrador: ${adminName}
`;

      await api.post("/notifications/email", {
        user_id: user.user.id,
        message
      });

      alert("📧 Correo enviado correctamente");
    } catch (error) {
      console.error("Error enviando correo:", error);
      alert("❌ No se pudo enviar la notificación.");
    }
  };

  const handleDeleteUser = async () => {
    if (!user?.user?.full_name) return;

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

  const riskBadge = (risk) => {
    const r = String(risk || '').toUpperCase();
    if (r === 'HIGH' || r === 'ALTO') return 'bg-red-100 text-red-700 border-red-200';
    if (r === 'LOW' || r === 'BAJO') return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-orange-100 text-orange-700 border-orange-200';
  };

  const handleSelectPoint = (type, index, score, date) => {
    const max = type === 'phq9' ? 27 : 21;
    setHoveredPoint({ type, index, score: toNum(score, 0) ?? 0, date, max });
  };

  // -------------------------
  // PDF export (sin cambios fuertes; solo evita nulls)
  // -------------------------
  const handleExportPDF = async () => {
    if (!user?.user) return;

    const profile = user.user;
    if (!assessments.length) {
      alert("Este usuario aún no posee evaluaciones registradas.");
      return;
    }

    const phq9 = assessments.filter(a => a.type === "phq9");
    const gad7 = assessments.filter(a => a.type === "gad7");

    const avg = (arr) =>
      arr.length ? (arr.reduce((s, a) => s + (toNum(a?.score, 0) ?? 0), 0) / arr.length).toFixed(1) : null;

    const phq9_avg = avg(phq9);
    const gad7_avg = avg(gad7);

    const parts = [];
    if (phq9_avg !== null) parts.push((Number(phq9_avg) / 27) * 100);
    if (gad7_avg !== null) parts.push((Number(gad7_avg) / 21) * 100);
    const emotionalIndexPdf = parts.length ? Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(1)) : 0;

    let status = "Estable";
    if (emotionalIndexPdf >= 60) status = "Severo";
    else if (emotionalIndexPdf >= 40) status = "Moderado";
    else if (emotionalIndexPdf >= 20) status = "Leve";

    const voiceScore100Pdf = normalizeVoiceScoreTo100(voiceStats?.summary?.avg_score);
    const multimodalPdf = computeMultimodal(
      emotionalIndexPdf,
      voiceScore100Pdf,
      voiceStats?.summary?.risk_distribution
    );

    let chartImage = null;
    if (chartRef?.current) {
      try {
        setHoveredPoint(null);
        await new Promise(r => setTimeout(r, 60));

        const canvas = await html2canvas(chartRef.current, {
          backgroundColor: "#ffffff",
          scale: 2
        });
        chartImage = canvas.toDataURL("image/png");
      } catch (error) {
        console.error("Error capturando gráfica:", error);
      }
    }

    const doc = new jsPDF("p", "mm", "a4");

    doc.setFontSize(18);
    doc.text("CALMASENSE - REPORTE CLÍNICO", 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 105, 22, { align: "center" });
    doc.line(10, 26, 200, 26);

    doc.setFontSize(14);
    doc.text("Datos del Paciente", 14, 35);

    autoTable(doc, {
      startY: 40,
      head: [["Campo", "Detalle"]],
      body: [
        ["Nombre", profile.full_name],
        ["Edad", profile.age ?? "N/A"],
        ["Género", profile.gender ?? "N/A"],
        ["Email", profile.email ?? "N/A"],
        ["ID Usuario", profile.id]
      ]
    });

    const y2 = doc.lastAutoTable.finalY + 10;
    doc.text("Estado Emocional (Tests)", 14, y2);

    autoTable(doc, {
      startY: y2 + 4,
      head: [["Métrica", "Resultado"]],
      body: [
        ["PHQ-9 Promedio", phq9_avg ?? "Sin datos"],
        ["GAD-7 Promedio", gad7_avg ?? "Sin datos"],
        ["Índice emocional", `${emotionalIndexPdf} / 100`],
        ["Clasificación", status]
      ]
    });

    const y3 = doc.lastAutoTable.finalY + 10;
    doc.text("Historial de Evaluaciones", 14, y3);

    autoTable(doc, {
      startY: y3 + 4,
      head: [["Fecha", "Test", "Score", "Severidad"]],
      body: assessments.map(a => [
        a?.created_at ? new Date(a.created_at).toLocaleDateString("es-ES") : "—",
        String(a?.type ?? "—").toUpperCase(),
        a?.score ?? "—",
        a?.severity ?? getSeverityInfo(a?.score, a?.type).text
      ])
    });

    const y4 = doc.lastAutoTable.finalY + 10;
    doc.text("Biomarcadores Vocales", 14, y4);

    const vs = voiceStats?.summary;

    autoTable(doc, {
      startY: y4 + 4,
      head: [["Métrica", "Resultado"]],
      body: [
        ["Ventana (días)", voiceStats?.days ?? (timeRange * 7)],
        ["Sesiones (total)", vs?.total_sessions ?? "Sin datos"],
        ["Sesiones completadas", vs?.completed_sessions ?? "Sin datos"],
        ["Duración total (s)", vs?.total_duration ?? "Sin datos"],
        ["Pitch promedio", vs?.avg_pitch ?? "Sin datos"],
        ["Energía promedio", vs?.avg_energy ?? "Sin datos"],
        ["HNR promedio", vs?.avg_hnr ?? "Sin datos"],
        ["Score vocal promedio", voiceScore100Pdf !== null ? `${Number(voiceScore100Pdf).toFixed(1)} / 100` : "Sin datos"],
        ["Riesgo LOW/MOD/HIGH", vs?.risk_distribution
          ? `LOW ${vs.risk_distribution.LOW} | MOD ${vs.risk_distribution.MODERATE} | HIGH ${vs.risk_distribution.HIGH}`
          : "Sin datos"
        ]
      ]
    });

    const y5 = doc.lastAutoTable.finalY + 8;
    doc.text("Sesiones de Voz (recientes)", 14, y5);

    autoTable(doc, {
      startY: y5 + 4,
      head: [["Fecha", "Ejercicio", "Score", "Riesgo", "Duración(s)"]],
      body: (voiceSessions || []).slice(0, 15).map(s => [
        s?.created_at ? new Date(s.created_at).toLocaleDateString("es-ES") : "—",
        s?.exercise_id ?? "—",
        (s?.score ?? "—"),
        (s?.risk_level ?? "—"),
        (s?.duration_seconds ?? "—")
      ])
    });

    const y6 = doc.lastAutoTable.finalY + 10;
    doc.text("Evaluación Multimodal", 14, y6);

    autoTable(doc, {
      startY: y6 + 4,
      head: [["Componente", "Valor"]],
      body: [
        ["Índice tests (PHQ-9/GAD-7)", `${emotionalIndexPdf} / 100`],
        ["Índice voz (promedio)", voiceScore100Pdf !== null ? `${Number(voiceScore100Pdf).toFixed(1)} / 100` : "Sin datos"],
        ["Índice multimodal", multimodalPdf.index !== null ? `${multimodalPdf.index} / 100` : "Sin datos"],
        ["Clasificación multimodal", multimodalPdf.level],
        ["Nota", multimodalPdf.note]
      ]
    });

    if (chartImage) {
      doc.addPage();
      doc.text("Gráfica de evolución clínica", 105, 15, { align: "center" });
      doc.addImage(chartImage, "PNG", 10, 20, 190, 100);
    }

    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.text(
      "Documento generado automáticamente por CalmaSense",
      105,
      pageHeight - 12,
      { align: "center" }
    );

    const safeName = String(profile.full_name || "usuario").replace(/\s+/g, "_");
    doc.save(`reporte_${safeName}.pdf`);
  };

  // -------------------------
  // Render
  // -------------------------
  const showMain = !isLoading && !!user;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} transition-all duration-1000`}>
      {/* Pantalla de carga */}
      {isLoading && (
        <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bg} transition-all duration-1000`}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xl text-gray-600">Cargando perfil...</p>
          </div>
        </div>
      )}

      {/* Usuario no encontrado */}
      {!isLoading && !user && (
        <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bg} transition-all duration-1000`}>
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
      )}

      {/* UI principal */}
      {showMain && (
        <div className={`min-h-screen bg-gradient-to-br ${bg} transition-all duration-1000 flex`}>
          {/* Sidebar */}
          <aside className="w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col shadow-2xl">
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

          {/* Main */}
          <main className="flex-1 p-8 overflow-y-auto">
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

            {/* Modal notas */}
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

            {/* Resumen usuario */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center text-white text-4xl font-bold flex-shrink-0 shadow-lg">
                  {(user?.user?.full_name || 'U').charAt(0).toUpperCase()}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-1">{user?.user?.full_name}</h3>
                      <p className="text-gray-600 mb-2">
                        {user?.user?.age ? `${user.user.age} años` : 'Edad no registrada'} •
                        {user?.user?.gender === 'm' ? ' Masculino' : user?.user?.gender === 'f' ? ' Femenino' : ' No especificado'} •
                        ID: #{user?.user?.id}
                      </p>
                      <p className="text-gray-600 flex items-center gap-2">
                        <span>📧</span>
                        <span>{user?.user?.email || 'No registrado'}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium mb-2 ${isUserActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        <span className={`w-2 h-2 rounded-full ${isUserActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        {isUserActive ? 'Activo' : 'Inactivo'}
                      </span>
                      {daysSinceLastEval !== null && (
                        <p className="text-xs text-gray-500">
                          Última evaluación: hace {daysSinceLastEval} día{daysSinceLastEval !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {((toNum(lastPhq9?.score, 0) ?? 0) >= 10 || (toNum(lastGad7?.score, 0) ?? 0) >= 10) && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">⚠️</span>
                        <div className="flex-1">
                          <p className="font-semibold text-orange-800 mb-1">
                            Usuario con niveles {(toNum(lastPhq9?.score, 0) ?? 0) >= 15 || (toNum(lastGad7?.score, 0) ?? 0) >= 15 ? 'severos' : 'moderados'}
                          </p>
                          <p className="text-sm text-orange-700 mb-3">
                            {(toNum(lastPhq9?.score, 0) ?? 0) >= 15 || (toNum(lastGad7?.score, 0) ?? 0) >= 15
                              ? 'Requiere intervención inmediata. Considerar derivación profesional urgente.'
                              : 'Monitoreo recomendado. Considerar seguimiento en las próximas semanas.'}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowRecommendationsModal(true)}
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

                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>📅</span>
                      <span>Registrado: {user?.user?.created_at ? new Date(user.user.created_at).toLocaleDateString('es-ES') : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>📊</span>
                      <span>{totalEvaluations} evaluaciones totales</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>🔗</span>
                      <span>{user?.user?.total_sessions || 0} sesiones</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Multimodal */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Evaluación Multimodal</h3>
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${multimodal.color}`}>
                  {multimodal.level}{multimodal.index !== null ? ` • ${multimodal.index}/100` : ''}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-gray-50">
                  <p className="text-sm text-gray-500 mb-1 font-semibold">Índice Tests</p>
                  <p className="text-3xl font-bold text-gray-800">{emotionalIndex}</p>
                  <p className="text-xs text-gray-500">0–100 (PHQ-9/GAD-7 normalizado)</p>
                </div>

                <div className="p-4 rounded-xl border bg-gray-50">
                  <p className="text-sm text-gray-500 mb-1 font-semibold">Índice Voz</p>
                  <p className="text-3xl font-bold text-gray-800">{voiceScore100 !== null ? voiceScore100.toFixed(1) : '—'}</p>
                  <p className="text-xs text-gray-500">Promedio (0–100)</p>
                </div>

                <div className="p-4 rounded-xl border bg-gray-50">
                  <p className="text-sm text-gray-500 mb-1 font-semibold">Detalle</p>
                  <p className="text-sm text-gray-700">{multimodal.note}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    Ventana voz: {timeRange * 7} días
                  </div>
                </div>
              </div>
            </div>

            {/* Estado actual */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Estado Actual</h3>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl">
                  <p className="text-gray-600 text-sm mb-2 font-semibold">PHQ-9 (Depresión)</p>
                  <p className="text-6xl font-bold text-gray-800 mb-2">
                    {lastPhq9?.score ?? '—'}
                    <span className="text-2xl text-gray-400"> / {phq9Info.max}</span>
                  </p>
                  <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${phq9Info.color} mb-3`}>
                    {phq9Info.text}
                  </span>

                  <div className={`flex items-center justify-center gap-2 text-sm ${phq9Trend.color}`}>
                    <span>{phq9Trend.icon}</span>
                    <span className="font-medium">{phq9Trend.text}</span>
                    {phq9Trend.percent > 0 && <span>({phq9Trend.percent}%)</span>}
                  </div>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
                  <p className="text-gray-600 text-sm mb-2 font-semibold">GAD-7 (Ansiedad)</p>
                  <p className="text-6xl font-bold text-gray-800 mb-2">
                    {lastGad7?.score ?? '—'}
                    <span className="text-2xl text-gray-400"> / {gad7Info.max}</span>
                  </p>
                  <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${gad7Info.color} mb-3`}>
                    {gad7Info.text}
                  </span>

                  <div className={`flex items-center justify-center gap-2 text-sm ${gad7Trend.color}`}>
                    <span>{gad7Trend.icon}</span>
                    <span className="font-medium">{gad7Trend.text}</span>
                    {gad7Trend.percent > 0 && <span>({gad7Trend.percent}%)</span>}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 grid grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-gray-500 mb-1">Última evaluación</p>
                  <p className="font-semibold text-gray-800">
                    {mostRecentDate ? new Date(mostRecentDate).toLocaleDateString('es-ES') : 'N/A'}
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

            {/* Voz */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Análisis de Voz</h3>
                  <p className="text-sm text-gray-600">Ventana: últimos {timeRange * 7} días</p>
                </div>
                <button
                  onClick={loadVoiceData}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <span>🎙️</span>
                  <span>Actualizar voz</span>
                </button>
              </div>

              {voiceLoading && (
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Cargando análisis de voz...</span>
                </div>
              )}

              {!voiceLoading && voiceError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                  {voiceError}
                </div>
              )}

              {!voiceLoading && !voiceError && (
                <>
                  <div className="grid grid-cols-4 gap-4 mb-5">
                    <div className="p-4 rounded-xl border bg-gray-50">
                      <p className="text-xs text-gray-500 font-semibold">Sesiones</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {voiceStats?.summary?.total_sessions ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">
                        Completadas: {voiceStats?.summary?.completed_sessions ?? 0}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border bg-gray-50">
                      <p className="text-xs text-gray-500 font-semibold">Pitch promedio</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {voiceStats?.summary?.avg_pitch ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500">Hz (según backend)</p>
                    </div>

                    <div className="p-4 rounded-xl border bg-gray-50">
                      <p className="text-xs text-gray-500 font-semibold">Energía promedio</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {voiceStats?.summary?.avg_energy ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500">Escala backend</p>
                    </div>

                    <div className="p-4 rounded-xl border bg-gray-50">
                      <p className="text-xs text-gray-500 font-semibold">Score voz promedio</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {voiceScore100 !== null ? voiceScore100.toFixed(1) : '—'}
                      </p>
                      <p className="text-xs text-gray-500">0–100 (normalizado)</p>
                    </div>
                  </div>

                  <div className="rounded-xl border p-4 bg-gradient-to-r from-green-50 via-orange-50 to-red-50">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Distribución de riesgo (sesiones)</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                        LOW: {voiceStats?.summary?.risk_distribution?.LOW ?? 0}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                        MODERATE: {voiceStats?.summary?.risk_distribution?.MODERATE ?? 0}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                        HIGH: {voiceStats?.summary?.risk_distribution?.HIGH ?? 0}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-gray-800">Sesiones recientes</p>
                      <p className="text-xs text-gray-500">Mostrando hasta 12</p>
                    </div>

                    {voiceSessions?.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">Fecha</th>
                              <th className="py-2 pr-3">Ejercicio</th>
                              <th className="py-2 pr-3">Score</th>
                              <th className="py-2 pr-3">Riesgo</th>
                              <th className="py-2 pr-3">Pitch</th>
                              <th className="py-2 pr-3">HNR</th>
                              <th className="py-2 pr-3">Duración</th>
                            </tr>
                          </thead>
                          <tbody>
                            {voiceSessions.slice(0, 12).map((s) => (
                              <tr key={s.id} className="border-b last:border-b-0">
                                <td className="py-2 pr-3">
                                  {s.created_at ? new Date(s.created_at).toLocaleString('es-ES') : '—'}
                                </td>
                                <td className="py-2 pr-3">{s.exercise_id ?? '—'}</td>
                                <td className="py-2 pr-3">{s.score ?? '—'}</td>
                                <td className="py-2 pr-3">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full border ${riskBadge(s.risk_level)}`}>
                                    {String(s.risk_level ?? 'MODERATE')}
                                  </span>
                                </td>
                                <td className="py-2 pr-3">{s.pitch_mean ?? '—'}</td>
                                <td className="py-2 pr-3">{s.hnr ?? '—'}</td>
                                <td className="py-2 pr-3">{s.duration_seconds ?? '—'}s</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-gray-600 text-sm bg-gray-50 border rounded-lg p-4">
                        Este usuario aún no tiene sesiones de voz registradas.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Historial (gráfica) */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Historial de Evaluaciones</h3>
                  <p className="text-sm text-gray-600">{phq9History.length} PHQ-9 • {gad7History.length} GAD-7</p>
                </div>

                <div className="flex gap-2">
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

              <div ref={chartRef} className="grid lg:grid-cols-2 gap-6">
                {/* PHQ-9 */}
                <div
                  className="relative h-80 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg p-6"
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold text-gray-800">PHQ-9</p>
                    <p className="text-xs text-gray-600">Max: 27</p>
                  </div>

                  <div className="absolute left-4 top-12 bottom-12 flex flex-col justify-between text-sm text-gray-600">
                    {[27, 20, 15, 10, 5, 0].map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>

                  <div className="absolute left-16 right-6 top-12 bottom-12">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="absolute w-full border-t border-gray-300" style={{ top: `${i * 20}%` }} />
                    ))}
                  </div>

                  <div className="absolute left-16 right-6 top-12 bottom-12">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {phq9History.length > 1 && (
                        <polyline
                          points={phq9History
                            .map((a, i) => {
                              const x = (i / Math.max(phq9History.length - 1, 1)) * 100;
                              const s = clamp(toNum(a?.score, 0) ?? 0, 0, 27);
                              const y = 100 - (s / 27) * 100;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="0.8"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}

                      {phq9History.length > 0 && (
                        phq9History.map((a, i) => {
                          const len = phq9History.length;
                          const x = len <= 1 ? 50 : (i / Math.max(len - 1, 1)) * 100;
                          const s = clamp(toNum(a?.score, 0) ?? 0, 0, 27);
                          const y = 100 - (s / 27) * 100;

                          return (
                            <circle
                              key={`phq9-${i}`}
                              cx={x}
                              cy={y}
                              r={hoveredPoint?.type === 'phq9' && hoveredPoint?.index === i ? "2.5" : "1.8"}
                              fill="#10b981"
                              stroke="white"
                              strokeWidth="0.5"
                              vectorEffect="non-scaling-stroke"
                              className="cursor-pointer"
                              onMouseEnter={() => handleSelectPoint('phq9', i, s, a.created_at)}
                            />
                          );
                        })
                      )}

                      {hoveredPoint?.type === 'phq9' && tooltipCoords && (
                        <foreignObject x={tooltipCoords.x} y={tooltipCoords.y} width="30" height="20">
                          <div className="bg-white px-3 py-2 rounded-lg shadow-xl border-2 border-emerald-500 text-xs whitespace-nowrap">
                            <p className="font-bold text-gray-800">PHQ-9: {hoveredPoint.score}</p>
                            <p className="text-gray-600">
                              {hoveredPoint.date ? new Date(hoveredPoint.date).toLocaleDateString('es-ES') : '—'}
                            </p>
                          </div>
                        </foreignObject>
                      )}
                    </svg>
                  </div>

                  {phq9History.length === 0 && (
                    <div className="absolute left-16 right-6 top-12 bottom-12 flex items-center justify-center text-sm text-gray-600">
                      Sin evaluaciones PHQ-9 en este rango.
                    </div>
                  )}
                </div>

                {/* GAD-7 */}
                <div
                  className="relative h-80 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6"
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold text-gray-800">GAD-7</p>
                    <p className="text-xs text-gray-600">Max: 21</p>
                  </div>

                  <div className="absolute left-4 top-12 bottom-12 flex flex-col justify-between text-sm text-gray-600">
                    {[21, 17, 13, 9, 5, 0].map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>

                  <div className="absolute left-16 right-6 top-12 bottom-12">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="absolute w-full border-t border-gray-300" style={{ top: `${i * 20}%` }} />
                    ))}
                  </div>

                  <div className="absolute left-16 right-6 top-12 bottom-12">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {gad7History.length > 1 && (
                        <polyline
                          points={gad7History
                            .map((a, i) => {
                              const x = (i / Math.max(gad7History.length - 1, 1)) * 100;
                              const s = clamp(toNum(a?.score, 0) ?? 0, 0, 21);
                              const y = 100 - (s / 21) * 100;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="0.8"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}

                      {gad7History.length > 0 && (
                        gad7History.map((a, i) => {
                          const len = gad7History.length;
                          const x = len <= 1 ? 50 : (i / Math.max(len - 1, 1)) * 100;
                          const s = clamp(toNum(a?.score, 0) ?? 0, 0, 21);
                          const y = 100 - (s / 21) * 100;

                          return (
                            <circle
                              key={`gad7-${i}`}
                              cx={x}
                              cy={y}
                              r={hoveredPoint?.type === 'gad7' && hoveredPoint?.index === i ? "2.5" : "1.8"}
                              fill="#3b82f6"
                              stroke="white"
                              strokeWidth="0.5"
                              vectorEffect="non-scaling-stroke"
                              className="cursor-pointer"
                              onMouseEnter={() => handleSelectPoint('gad7', i, s, a.created_at)}
                            />
                          );
                        })
                      )}

                      {hoveredPoint?.type === 'gad7' && tooltipCoords && (
                        <foreignObject x={tooltipCoords.x} y={tooltipCoords.y} width="30" height="20">
                          <div className="bg-white px-3 py-2 rounded-lg shadow-xl border-2 border-blue-500 text-xs whitespace-nowrap">
                            <p className="font-bold text-gray-800">GAD-7: {hoveredPoint.score}</p>
                            <p className="text-gray-600">
                              {hoveredPoint.date ? new Date(hoveredPoint.date).toLocaleDateString('es-ES') : '—'}
                            </p>
                          </div>
                        </foreignObject>
                      )}
                    </svg>
                  </div>

                  {gad7History.length === 0 && (
                    <div className="absolute left-16 right-6 top-12 bottom-12 flex items-center justify-center text-sm text-gray-600">
                      Sin evaluaciones GAD-7 en este rango.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Acciones</h3>

              <div className="grid grid-cols-4 gap-3">
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
                  onClick={handleDeleteUser}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-red-300 rounded-xl hover:border-red-500 hover:bg-red-50 transition transform hover:scale-105"
                >
                  <span className="text-3xl">🗑️</span>
                  <span className="text-sm font-medium text-red-700 text-center">Eliminar Usuario</span>
                </button>
              </div>
            </div>
          </main>

          {/* Modal marcar atendido */}
          {showAttendedModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-t-2xl">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">✅ Marcar como Atendido</h2>
                    <button
                      onClick={() => setShowAttendedModal(false)}
                      className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition"
                      disabled={isSubmittingAttendance}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Registrando atención para:</p>
                    <p className="font-bold text-lg text-gray-800">{user?.user?.full_name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date().toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notas de la Sesión (Opcional)
                    </label>
                    <textarea
                      value={attendanceNotes}
                      onChange={(e) => setAttendanceNotes(e.target.value)}
                      placeholder="Describe brevemente la sesión..."
                      className="w-full border-2 border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      rows="4"
                      disabled={isSubmittingAttendance}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition">
                      <input
                        type="checkbox"
                        checked={scheduleFollowup}
                        onChange={(e) => setScheduleFollowup(e.target.checked)}
                        className="mt-1 w-5 h-5 text-blue-600"
                        disabled={isSubmittingAttendance}
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-gray-800">Programar seguimiento</span>
                        {scheduleFollowup && (
                          <input
                            type="date"
                            value={followupDate}
                            onChange={(e) => setFollowupDate(e.target.value)}
                            className="mt-2 w-full border border-blue-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isSubmittingAttendance}
                          />
                        )}
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition">
                      <input
                        type="checkbox"
                        checked={sendConfirmation}
                        onChange={(e) => setSendConfirmation(e.target.checked)}
                        className="w-5 h-5 text-green-600"
                        disabled={isSubmittingAttendance}
                      />
                      <span className="font-semibold text-gray-800">Enviar email de confirmación al paciente</span>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => setShowAttendedModal(false)}
                      className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                      disabled={isSubmittingAttendance}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitAttendance}
                      className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      disabled={isSubmittingAttendance}
                    >
                      {isSubmittingAttendance ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Registrando...
                        </>
                      ) : (
                        <>✓ Confirmar Atención</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal recomendaciones (si quieres, lo reinsertamos igual que antes) */}
          {showRecommendationsModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl flex justify-between">
                  <h2 className="text-xl font-bold">💡 Recomendaciones</h2>
                  <button
                    onClick={() => setShowRecommendationsModal(false)}
                    className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-gray-50 border rounded-xl p-4">
                    <p className="font-semibold text-gray-800">Multimodal:</p>
                    <p className="text-sm text-gray-700">
                      {multimodal.level}{multimodal.index !== null ? ` • ${multimodal.index}/100` : ''} — {multimodal.note}
                    </p>
                  </div>
                  {trends?.insights?.recommendations?.length ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="font-semibold text-blue-900 mb-2">Recomendaciones (tendencias):</p>
                      <ul className="list-disc pl-5 text-sm text-blue-800 space-y-1">
                        {trends.insights.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No hay recomendaciones automáticas disponibles.</p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default AdminUserProfile;
