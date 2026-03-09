@echo off
echo Starting VidToReels dev servers...

start "Backend" cmd /k "cd /d D:\lovedeep\video-reels-saas\backend && python -m uvicorn main:app --reload --port 8000"
start "Frontend" cmd /k "cd /d D:\lovedeep\video-reels-saas\frontend && npm run dev"

echo Both servers started.
echo   Backend  -> http://localhost:8000
echo   Frontend -> http://localhost:3000
