import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Camera from './Camera';

function FaceMonitor({ isActive = true }) {
  const navigate = useNavigate();
  const lastDetectionTimeRef = useRef(Date.now());
  const initializedRef = useRef(false);
  const currentUserRef = useRef(localStorage.getItem('user_name'));

  // Convertir base64 -> Blob
  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }

    return new Blob([u8arr], { type: mime });
  };

  // Procesamiento del frame
  const onCapture = async (dataURL) => {
    if (!dataURL || !currentUserRef.current) return;

    try {
      const blob = dataURLtoBlob(dataURL);
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const res = await api.post('/face/recognize/check', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const result = res.data;

      // Usuario presente
      if (result.found && result.user === currentUserRef.current) {
        lastDetectionTimeRef.current = Date.now();
        console.log(`✓ ${result.user} presente`);
        return;
      }

      // Verificar timeout
      const elapsed = Date.now() - lastDetectionTimeRef.current;

      if (elapsed >= 10000) {
        console.log('⏱️ Timeout - cerrando sesión');
        handleLogout();
      } else {
        const remain = Math.ceil((10000 - elapsed) / 1000);
        console.log(`⚠️ No detectado (${remain}s restantes)`);
      }

    } catch (err) {
      console.error('Error en checkPresence:', err);
    }
  };

  // Inicialización
  useEffect(() => {
    if (!isActive || initializedRef.current) return;

    const user = localStorage.getItem('user_name');
    if (!user) {
      console.log('No hay usuario en sesión');
      navigate('/');
      return;
    }

    currentUserRef.current = user;
    initializedRef.current = true;
    lastDetectionTimeRef.current = Date.now();

    console.log('👁️ Monitoreo activado para:', user);

    return () => {
      initializedRef.current = false;
    };
  }, [isActive, navigate]);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_recognition');

    alert('Sesión cerrada: no se detectó tu presencia por más de 10 segundos');
    navigate('/');
  };

  if (!isActive || !currentUserRef.current) {
    return null;
  }

  return (
    <Camera 
      isActive={isActive}
      onCapture={onCapture}
      hidden={true}
    />
  );
}

export default FaceMonitor;