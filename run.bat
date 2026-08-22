@echo off
echo ===================================================
echo Starting all Shop.me services...
echo ===================================================

echo [1/4] Starting Go Backend...
cd backend
start "Shop.me Backend" cmd /k "run.bat"
cd ..

echo [2/4] Starting Admin Dashboard...
cd admin
start "Shop.me Admin" cmd /k "npm run dev"
cd ..

echo [3/4] Starting Storefront...
cd storefront
start "Shop.me Storefront" cmd /k "npm run dev"
cd ..

echo [4/4] Starting AIML Service...
cd aiml
start "Shop.me AIML" cmd /k ".\venv\Scripts\activate.bat && python main.py"
cd ..

echo ===================================================
echo All services have been launched in separate windows!
echo ===================================================
