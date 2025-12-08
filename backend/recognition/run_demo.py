from face_service import FaceRecognitionService
import cv2

service = FaceRecognitionService()

print("Presiona R para registrar usuario")
print("Presiona Q para salir")

while True:
    frame = service.read_frame()
    if frame is None:
        continue

    key = cv2.waitKey(1)

    if key == ord("q"):
        break

    if key == ord("r"):
        name = input("Nombre del usuario: ")
        res = service.register(name, frame)
        print(res)

    # reconocimiento en tiempo real
    result = service.recognize(frame)
    print(result)

    # ========================================
    # 🔹 DIBUJAR NOMBRE EN LA VENTANA
    # ========================================
    if result["found"] and result["user"] is not None:
        cv2.putText(
            frame,
            f"{result['user']} ({result['confidence']:.2f})",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2,
            cv2.LINE_AA
        )
    elif result["found"] and result["user"] is None:
        cv2.putText(
            frame,
            "Desconocido",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2,
            cv2.LINE_AA
        )

    cv2.imshow("Demo", frame)

service.release()
