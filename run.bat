@echo off
echo ===================================================
echo Starting all Shop.me services (with LLM Firewall)...
echo ===================================================

echo [1/5] Starting Go Backend...
cd backend
start "Shop.me Backend" cmd /k "run.bat"
cd ..

echo [2/5] Starting Admin Dashboard...
cd admin
start "Shop.me Admin" cmd /k "npm run dev"
cd ..

echo [3/5] Starting Storefront...
cd storefront
start "Shop.me Storefront" cmd /k "npm run dev"
cd ..

echo [4/5] Starting AIML Service...
cd aiml
start "Shop.me AIML" cmd /k ".\venv\Scripts\activate.bat && python main.py"
cd ..

echo [5/5] Starting LiteLLM Proxy (LLM Firewall)...
cd aiml
start "Shop.me LLM Firewall" cmd /k "set PYTHONIOENCODING=utf-8 && .\venv\Scripts\activate.bat && litellm --config litellm_config.yaml --port 4000"
cd ..

echo ===================================================
echo All 5 services have been launched in separate windows!
echo ===================================================
