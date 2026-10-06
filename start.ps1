$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$venvDir = Join-Path $backendDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

function Ensure-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Required command '$name' was not found in PATH. Install it and try again."
    }
}

Ensure-Command python
Ensure-Command npm

# -- Python venv + deps --
if (-not (Test-Path $venvPython)) {
    Write-Host "[1/4] Creating Python virtual environment..."
    python -m venv $venvDir
} else {
    Write-Host "[1/4] Python venv exists."
}

$markerFile = Join-Path $venvDir ".deps-installed"
$reqsFile = Join-Path $backendDir "requirements.txt"
$needsInstall = (-not (Test-Path $markerFile)) -or ((Get-Item $reqsFile).LastWriteTime -gt (Get-Item $markerFile).LastWriteTime)
if ($needsInstall) {
    Write-Host "[2/4] Installing backend dependencies..."
    & $venvPython -m pip install -q -r $reqsFile
    New-Item -Path $markerFile -ItemType File -Force | Out-Null
} else {
    Write-Host "[2/4] Backend dependencies up to date."
}

# -- Frontend deps --
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "[3/4] Installing frontend dependencies..."
    Push-Location $frontendDir
    npm install
    Pop-Location
} else {
    Write-Host "[3/4] Frontend node_modules exists."
}

# -- Kill stale processes on ports 8000 / 5173 --
function Get-ListeningPid {
    param(
        [int]$Port
    )

    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' } |
        Select-Object -First 1

    if ($connection) {
        return $connection.OwningProcess
    }

    return $null
}

$staleBackendPid = Get-ListeningPid -Port 8000
if ($staleBackendPid) {
    Write-Host "Killing stale process on port 8000 (PID $staleBackendPid)..."
    Stop-Process -Id $staleBackendPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

$staleFrontendPid = Get-ListeningPid -Port 5173
if ($staleFrontendPid) {
    Write-Host "Killing stale process on port 5173 (PID $staleFrontendPid)..."
    Stop-Process -Id $staleFrontendPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# -- Start backend --
$backendCommand = "cd '$backendDir'; & '$venvPython' -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand

# -- Start frontend immediately; use the installed Vite binary directly --
$viteExecutable = Join-Path $frontendDir "node_modules\.bin\vite.cmd"
$frontendCommand = "cd '$frontendDir'; & '$viteExecutable' --port 5173 --host 0.0.0.0"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand

# Wait for the lightweight root endpoint, not /api/health, which checks external providers.
$frontendUrl = "http://localhost:5173/"
$backendUrl = "http://localhost:8000/"
$frontendReady = $false
$backendReady = $false
for ($attempt = 1; $attempt -le 20; $attempt++) {
    try {
        if (-not $frontendReady) {
            $response = Invoke-WebRequest -Uri $frontendUrl -TimeoutSec 1 -UseBasicParsing
            $frontendReady = $response.StatusCode -eq 200
        }
        if (-not $backendReady) {
            $response = Invoke-WebRequest -Uri $backendUrl -TimeoutSec 1 -UseBasicParsing
            $backendReady = $response.StatusCode -eq 200
        }
        if ($frontendReady -and $backendReady) {
            break
        }
    }
    catch {
    }
    Start-Sleep -Milliseconds 500
}

if (-not $backendReady) {
    Write-Host "Backend is still starting. Check the backend PowerShell window if API requests fail."
}

if ($frontendReady) {
    Start-Process $frontendUrl
} else {
    Write-Host "Frontend did not respond at $frontendUrl. Check the frontend PowerShell window for errors."
}

# -- Judge0 (Docker); start after opening the app so it does not delay the page --
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue
$judge0Running = $false

if ($dockerAvailable) {
    $judge0Running = docker ps --filter "name=judge0" --format "{{.Names}}" 2>$null | Select-String "judge0"
    if (-not $judge0Running) {
        Write-Host "[4/4] Starting Judge0 (Docker)..."
        Push-Location $root
        docker compose up -d judge0 judge0-workers judge0-db judge0-redis
        Pop-Location
    } else {
        Write-Host "[4/4] Judge0 already running."
    }
} else {
    Write-Host "[4/4] Docker not found - skipping Judge0. Coding assessment will not work without it."
}

# -- Summary --
Write-Host ""
Write-Host "============================================"
Write-Host "  AdaptQ - Adaptive DSA Learning Platform"
Write-Host "============================================"
Write-Host ""
Write-Host "  Frontend:    http://localhost:5173"
Write-Host "  Backend:     http://localhost:8000/docs"
Write-Host "  Health:      http://localhost:8000/api/health"
if ($dockerAvailable) {
    Write-Host "  Judge0:      http://localhost:2358 (code execution)"
}
Write-Host ""
Write-Host "  Database:    Supabase (cloud PostgreSQL)"
Write-Host "  LLM:         Groq + OpenRouter + Ollama (auto failover)"
Write-Host ""
Write-Host "  Configure:   backend/.env"
Write-Host "============================================"
Write-Host ""
Write-Host "Two PowerShell windows opened (backend + frontend)."
Write-Host "Close them to stop the servers."
Write-Host ""
