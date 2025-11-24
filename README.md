***PASOS DE INSTALACION Y USO***
**Version de Python:** 3.10.11

**NOTA:** Antes de todo, seguir los pasos de la siguiente pagina para instalar DLIB: https://omes-va.com/como-instalar-dlib-en-windows-python

1. Instalar requirements.txt
   pip install -r ./utils/requirements.txt
2. Abrir la terminal y poner el siguiente comando:
   uvicorn backend.main:app --reload
3. Una vez que de este mensaje:

       ✓ Cámara inicializada (640x480) 
       INFO:     Started server process [32908]
       INFO:     Waiting for application startup.
       INFO:     Application startup complete
   
   Abrir el navegador con la direccion http://127.0.0.1
5. Saldra la pantalla de inicio de sesion, si detecta que el usuario no existe sale la opcion de registrarse
6. Ingresar datos del usuario y colocar el rostro
7. Luego de registrar el usuario, saldra login nuevamente e iniciara sesion
8. En la interfaz del usuario, se podran completar los tests PHQ-9 y GAD-7 y luego se guardan en la BD
9. Para revisar los datos registrados, ingresar a http://127.0.0.1/docs
10. Dirigise al final a GET /dev/users - /dev/sessions - /dev/assessments
11. Desplegar la tabla a revisar
12. Presionar "Try it out" y luego "Execute"
13. Bajar a code - Details y saldra el contenido en formato JSON
14. Para cerrar el server ir a la terminal y presionar "control + C"
