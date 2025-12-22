// Fallback simple para STT usando Vosk en el backend.
// Graba unos segundos de audio (MediaRecorder) y lo envía a /voice/transcribe.

export async function recordAudioBlob({ seconds = 4 } = {}) {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia no disponible");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder no disponible");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Elegir un mimeType compatible cuando sea posible.
  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  let mimeType;
  for (const t of preferredTypes) {
    if (MediaRecorder.isTypeSupported?.(t)) {
      mimeType = t;
      break;
    }
  }

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // noop
      }
    };

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = (e) => {
      cleanup();
      reject(e?.error || new Error("Error grabando audio"));
    };

    recorder.onstop = () => {
      cleanup();
      const blobType = recorder.mimeType || mimeType || "audio/webm";
      resolve(new Blob(chunks, { type: blobType }));
    };

    recorder.start();

    window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, seconds * 1000);
  });
}
