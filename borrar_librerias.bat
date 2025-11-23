@echo off
REM ============================================
REM SCRIPT DE LIMPIEZA COMPLETA DE PYTHON
REM limpiar_python.bat
REM ============================================
REM EJECUTAR COMO ADMINISTRADOR
REM ============================================

echo ========================================
echo   LIMPIEZA COMPLETA DE PYTHON
echo ========================================
echo.

echo [1/4] Guardando backup de paquetes...
pip freeze > paquetes_instalados_backup.txt
echo     Backup guardado: paquetes_instalados_backup.txt
echo.

echo [2/4] Desinstalando TODOS los paquetes...
echo     Esto puede tomar varios minutos...
echo.

pip freeze > temp_packages.txt
for /f "delims==" %%i in (temp_packages.txt) do (
    echo     Desinstalando: %%i
    pip uninstall -y %%i >nul 2>&1
)
del temp_packages.txt

echo.
echo [3/4] Limpiando cache de pip...
pip cache purge

echo.
echo [4/4] Actualizando pip...
python -m pip install --upgrade pip

echo.
echo ========================================
echo   VERIFICACION
echo ========================================
pip list
echo.

echo ========================================
echo   LIMPIEZA COMPLETADA
echo ========================================
echo.
echo SIGUIENTE PASO:
echo   1. Crear entorno virtual: python -m venv venv_facial
echo   2. Activar entorno: venv_facial\Scripts\activate.bat
echo   3. Instalar dependencias: pip install -r requirements.txt
echo.
pause