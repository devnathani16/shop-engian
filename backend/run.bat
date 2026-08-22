@echo off
REM Set Go environment variables to use the F: drive for storage
set GOPATH=F:\gopath
set GOCACHE=F:\gocache
set GOTMPDIR=F:\gotmp

echo [INFO] Go environment variables set to F: drive to save C: drive space.
echo [INFO] GOPATH=%GOPATH%
echo [INFO] GOCACHE=%GOCACHE%

echo [INFO] Syncing dependencies...
go mod tidy

echo [INFO] Building the Go backend...
go build -o server.exe

if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    exit /b %errorlevel%
)

echo [INFO] Starting the Go backend...
.\server.exe
