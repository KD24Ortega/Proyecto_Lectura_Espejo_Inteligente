import pyaudio

p = pyaudio.PyAudio()

print("\n=== DISPOSITIVOS DE AUDIO DETECTADOS ===\n")

for i in range(p.get_device_count()):
    info = p.get_device_info_by_index(i)

    # Mostrar solo dispositivos que tienen entrada de audio
    if info["maxInputChannels"] > 0:
        print(f"ID: {i}")
        print(f"Nombre: {info['name']}")
        print(f"Canales de entrada: {info['maxInputChannels']}")
        print(f"Tasa de muestreo por defecto: {int(info['defaultSampleRate'])} Hz")
        print("-" * 40)

p.terminate()
