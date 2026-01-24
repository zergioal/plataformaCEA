@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM  Exporta estructura + código de un proyecto React/Vite a TXT
REM  - Excluye node_modules, dist, build, .git, etc.
REM  - Incluye archivos típicos: src, public, supabase, configs
REM ============================================================

REM Carpeta base (por defecto: donde está el .bat)
set "ROOT=%~dp0"
cd /d "%ROOT%"

REM Archivo de salida (en la misma carpeta)
set "OUT=%ROOT%_PROJECT_EXPORT.txt"

REM Limpia salida anterior
if exist "%OUT%" del /f /q "%OUT%"

REM Timestamp simple
for /f "tokens=1-3 delims=/: " %%a in ("%date%") do set "D=%%a-%%b-%%c"
for /f "tokens=1-3 delims=:." %%a in ("%time%") do set "T=%%a%%b%%c"
set "STAMP=%D%_%T%"

echo ============================================================>>"%OUT%"
echo PROYECTO EXPORTADO A TXT (estructura + código)>>"%OUT%"
echo Fecha/Hora: %date% %time%>>"%OUT%"
echo Raíz: %ROOT%>>"%OUT%"
echo Output: %OUT%>>"%OUT%"
echo ============================================================>>"%OUT%"
echo.>>"%OUT%"

REM ------------------------------------------------------------
REM 1) ESTRUCTURA DEL PROYECTO (sin basura)
REM ------------------------------------------------------------
echo [1/2] ESTRUCTURA DEL PROYECTO (filtrada)>>"%OUT%"
echo ------------------------------------------------------------>>"%OUT%"

REM tree /f /a y luego filtramos con findstr para quitar carpetas/archivos no deseados
REM (Esto es más simple y funciona bien en Windows sin dependencias extra)
tree /f /a "%ROOT%" ^
| findstr /v /i "\\node_modules\\" ^
| findstr /v /i "\\dist\\" ^
| findstr /v /i "\\build\\" ^
| findstr /v /i "\\.git\\" ^
| findstr /v /i "\\.next\\" ^
| findstr /v /i "\\.turbo\\" ^
| findstr /v /i "\\.cache\\" ^
| findstr /v /i "\\coverage\\" ^
| findstr /v /i "\\.vercel\\" ^
| findstr /v /i "\\.idea\\" ^
| findstr /v /i "\\.DS_Store" ^
| findstr /v /i "\\Thumbs.db" ^
>>"%OUT%"

echo.>>"%OUT%"
echo.>>"%OUT%"

REM ------------------------------------------------------------
REM 2) CÓDIGO / ARCHIVOS IMPORTANTES
REM ------------------------------------------------------------
echo [2/2] CÓDIGO Y ARCHIVOS IMPORTANTES (concatenado)>>"%OUT%"
echo ------------------------------------------------------------>>"%OUT%"
echo NOTA: Se omiten binarios, lockfiles enormes y carpetas basura.>>"%OUT%"
echo.>>"%OUT%"

REM Extensiones a incluir (ajusta si quieres)
set "EXTS=ts tsx js jsx mjs cjs json md html css scss sass yml yaml toml"

REM Carpetas típicas a exportar (si existen)
set "INCLUDE_DIRS=src public supabase"

REM Archivos raíz típicos a exportar (si existen)
set "ROOT_FILES=package.json vite.config.ts vite.config.js tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js .eslintrc.json .env .env.local .env.development .env.production index.html postcss.config.js postcss.config.cjs tailwind.config.js tailwind.config.ts README.md"

REM --- Exportar archivos en carpeta raíz (web) ---
for %%F in (%ROOT_FILES%) do (
  if exist "%ROOT%%%F" call :AppendFile "%ROOT%%%F"
)

REM --- Exportar carpetas incluidas (src/public/supabase) ---
for %%D in (%INCLUDE_DIRS%) do (
  if exist "%ROOT%%%D\" call :WalkDir "%ROOT%%%D\"
)

echo.>>"%OUT%"
echo ============================================================>>"%OUT%"
echo FIN.>>"%OUT%"
echo ============================================================>>"%OUT%"

echo.
echo Listo. Archivo generado:
echo %OUT%
echo.
pause
exit /b 0


REM ============================================================
REM Recorre recursivamente una carpeta e incluye archivos útiles
REM ============================================================
:WalkDir
set "DIR=%~1"

REM Recorre todos los archivos recursivamente
for /r "%DIR%" %%G in (*) do (
  set "P=%%~fG"

  REM Excluir carpetas basura aunque estén dentro de rutas incluidas
  echo !P! | findstr /i "\\node_modules\\ \\dist\\ \\build\\ \\.git\\ \\.next\\ \\.turbo\\ \\.cache\\ \\coverage\\ \\.vercel\\ \\.idea\\">nul
  if !errorlevel! neq 0 (
    call :ShouldInclude "%%~fG"
    if !errorlevel! equ 0 (
      call :AppendFile "%%~fG"
    )
  )
)
exit /b 0


REM ============================================================
REM Decide si incluir un archivo (por extensión / reglas)
REM Errorlevel 0 = incluir, 1 = excluir
REM ============================================================
:ShouldInclude
set "FILE=%~1"
set "NAME=%~nx1"
set "EXT=%~x1"
set "EXT=!EXT:~1!"

REM Excluir algunos archivos pesados o inútiles para IA
if /i "%NAME%"=="package-lock.json" exit /b 1
if /i "%NAME%"=="yarn.lock" exit /b 1
if /i "%NAME%"=="pnpm-lock.yaml" exit /b 1
if /i "%NAME%"=="bun.lockb" exit /b 1

REM Excluir mapas / binarios / fuentes / imágenes / media
echo %EXT% | findstr /i "map png jpg jpeg gif webp svg ico mp4 mp3 wav flac zip rar 7z pdf exe dll">nul
if %errorlevel% equ 0 exit /b 1

REM Incluir por extensiones permitidas
for %%E in (%EXTS%) do (
  if /i "%%E"=="%EXT%" exit /b 0
)

REM Si no matchea extensión, excluir
exit /b 1


REM ============================================================
REM Agrega archivo al OUT con encabezado de ruta
REM ============================================================
:AppendFile
set "F=%~1"

REM Calcula ruta relativa aproximada para que se lea bonito
set "REL=%F%"
set "REL=!REL:%ROOT%=!"

echo.>>"%OUT%"
echo ----------------------------------------------------------------------------------------- >>"%OUT%"
echo // %REL%>>"%OUT%"
echo ----------------------------------------------------------------------------------------- >>"%OUT%"

REM Volcar contenido (type respeta texto)
type "%F%" >>"%OUT%"
echo.>>"%OUT%"
exit /b 0
