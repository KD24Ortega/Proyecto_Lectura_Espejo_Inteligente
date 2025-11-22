from .face_service import FaceService

if __name__ == "__main__":
    service = FaceService()

    # 1) Una vez: registrar tu cara con un ID de usuario (por ejemplo 1)
    #service.register_user(user_id=1)

    # 2) Luego: comentar la línea anterior y probar reconocimiento:
    service.recognize_loop()
