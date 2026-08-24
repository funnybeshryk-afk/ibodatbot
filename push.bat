@echo off
cd /d "%~dp0"

echo ==============================
echo   IBODAT BOT - Git Push
echo ==============================
echo.

if not exist ".gitignore" (
    echo .env>.gitignore
    echo __pycache__/>>.gitignore
    echo *.pyc>>.gitignore
)

git rm --cached .env 2>nul

git add .
git status

echo.
set /p msg="Commit message: "

if "%msg%"=="" set msg=Update bot

git commit -m "%msg%"
git push origin main

echo.
echo ==============================
echo   PUSH FINISHED
echo ==============================
pause