@echo off
cd /d C:\Users\muyan\mutantefy

echo.
echo === MUTANTES MC — Deploy ===
echo.

git add .

set /p msg="Descricao da atualizacao: "

git commit -m "%msg%"
git push origin main

echo.
echo ✓ Enviado! O site atualiza em ~1 minuto.
echo https://muyanepetters-alt.github.io/mutantefy/
echo.
pause
