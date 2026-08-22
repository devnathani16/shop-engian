@echo off
echo Installing dependencies...
pip install -r requirements.txt
echo Starting EaaS Database Inspector...
python app.py
if %errorlevel% neq 0 (
    echo.
    echo The application crashed. See the error above.
    pause
)
