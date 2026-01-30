@echo off
echo Starting Time Tracking System...
echo.

echo Starting Flask backend...
cd backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
start cmd /k python app.py
cd ..

echo Backend started on http://localhost:5000
echo.

timeout /t 3 /nobreak > nul

echo Starting Next.js frontend...
cd frontend
start cmd /k npm install ^&^& npm run dev
cd ..

echo Frontend will start on http://localhost:3000
echo.
echo Press any key to exit...
pause > nul
