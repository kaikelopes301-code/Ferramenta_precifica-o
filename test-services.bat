.@echo off
REM Script para testar cada servico individualmente
chcp 65001 >nul
setlocal enabledelayedexpansion
color 0A

echo ========================================
echo  TESTE DE SERVICOS - Diagnóstico
echo ========================================
echo.

REM Testar venv
echo [1/6] Testando ambiente virtual Python...
if exist ".venv\Scripts\python.exe" (
    echo [OK] .venv encontrado
    .venv\Scripts\python.exe --version
) else (
    echo [ERRO] .venv nao encontrado!
    echo Execute: python -m venv .venv
    pause
    exit /b 1
)

echo.
echo [2/6] Testando dependencias Python...
.venv\Scripts\python.exe -c "import fastapi; import uvicorn; print('[OK] fastapi e uvicorn instalados')" 2>nul
if !errorlevel! neq 0 (
    echo [ERRO] Dependencias Python faltando!
    echo Execute: .venv\Scripts\pip.exe install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo [3/6] Testando estrutura backend Python...
if exist "backend\app\api\main.py" (
    echo [OK] backend\app\api\main.py encontrado
) else (
    echo [ERRO] backend\app\api\main.py nao encontrado!
    pause
    exit /b 1
)

echo.
echo [4/6] Testando backend TypeScript...
if exist "backend-ts\package.json" (
    echo [OK] backend-ts\package.json encontrado
    if exist "backend-ts\node_modules" (
        echo [OK] node_modules instalado
    ) else (
        echo [AVISO] node_modules nao instalado
        echo Execute: cd backend-ts ^&^& npm install
    )
) else (
    echo [ERRO] backend-ts nao encontrado!
    pause
    exit /b 1
)

echo.
echo [5/6] Testando frontend...
if exist "frontend\package.json" (
    echo [OK] frontend\package.json encontrado
    if exist "frontend\node_modules" (
        echo [OK] node_modules instalado
    ) else (
        echo [AVISO] node_modules nao instalado
        echo Execute: cd frontend ^&^& npm install
    )
) else (
    echo [ERRO] frontend nao encontrado!
    pause
    exit /b 1
)

echo.
echo [6/6] Testando portas...
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [AVISO] Porta 8000 JA ESTA EM USO
) else (
    echo [OK] Porta 8000 disponivel
)

netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [AVISO] Porta 3001 JA ESTA EM USO
) else (
    echo [OK] Porta 3001 disponivel
)

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [AVISO] Porta 3000 JA ESTA EM USO
) else (
    echo [OK] Porta 3000 disponivel
)

echo.
echo ========================================
echo  TESTE COMPLETO - Escolha uma acao:
echo ========================================
echo 1. Testar Backend Python (porta 8000)
echo 2. Testar Backend TypeScript (porta 3001)
echo 3. Testar Frontend (porta 3000)
echo 4. Instalar todas as dependencias
echo 5. Sair
echo.
set /p choice="Escolha (1-5): "

if "%choice%"=="1" goto test_python
if "%choice%"=="2" goto test_ts
if "%choice%"=="3" goto test_frontend
if "%choice%"=="4" goto install_all
if "%choice%"=="5" goto end

:test_python
echo.
echo Iniciando Backend Python...
cd /d "%~dp0"
call .venv\Scripts\activate.bat
echo Acesse: http://localhost:8000/docs
python -m uvicorn backend.app.api.main:app --host 0.0.0.0 --port 8000 --reload
pause
goto end

:test_ts
echo.
echo Iniciando Backend TypeScript...
cd backend-ts
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
)
echo Acesse: http://localhost:3001
npm run dev
pause
goto end

:test_frontend
echo.
echo Iniciando Frontend...
cd frontend
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
)
echo Acesse: http://localhost:3000
npm run dev
pause
goto end

:install_all
echo.
echo Instalando todas as dependencias...
echo [1/3] Python...
.venv\Scripts\pip.exe install -r requirements.txt

echo [2/3] Backend TypeScript...
cd backend-ts
npm install
cd ..

echo [3/3] Frontend...
cd frontend
npm install
cd ..

echo.
echo Dependencias instaladas!
pause
goto end

:end
endlocal
