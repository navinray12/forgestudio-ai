param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Options)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Invoke-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}

try {
    if ($Options -contains 'help' -or $Options -contains '--help') {
        Write-Host 'Usage: start.bat [docker|native|status|menu] [openai|anthropic|gemini] [no-build]'
        Write-Host 'Docker mode needs Docker Desktop. Native mode needs dependencies and a local PostgreSQL DATABASE_URL.'
        exit 0
    }
    $mode = 'auto'
    foreach ($candidate in @('docker', 'native', 'status', 'menu')) {
        if ($Options -contains $candidate) { $mode = $candidate; break }
    }
    if ($mode -eq 'menu') {
        $mode = Read-Host 'Startup mode (docker or native)'
        if ($mode -notin @('docker', 'native')) { throw 'Choose docker or native.' }
    }
    foreach ($provider in @('openai', 'anthropic', 'gemini')) {
        if ($Options -contains $provider) { $env:AI_SITE_PROVIDER = $provider }
    }
    $dockerReady = $false
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        try {
            & docker info --format '{{.ServerVersion}}' *> $null
            $dockerReady = $LASTEXITCODE -eq 0
        } catch { $dockerReady = $false }
    }
    if ($mode -eq 'status') {
        if ($dockerReady) { Invoke-Checked 'docker' @('compose', 'ps', '-a') }
        foreach ($url in @('http://127.0.0.1:5000/api/ready', 'http://127.0.0.1:5173/login')) {
            try { Write-Host "$url : $((Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri $url).StatusCode)" }
            catch { Write-Host "$url : unavailable" }
        }
        exit 0
    }
    if ($mode -eq 'auto') { if ($dockerReady) { $mode = 'docker' } else { $mode = 'native' } }
    if ($mode -eq 'docker') {
        if (-not $dockerReady) { throw 'Docker engine is unavailable. Start Docker Desktop, then run start.bat docker.' }
        Invoke-Checked 'docker' @('compose', 'config', '--quiet')
        if ($Options -notcontains 'no-build') {
            Invoke-Checked 'docker' @('compose', '--parallel', '1', 'build', 'migrate', 'api', 'worker', 'frontend')
        }
        Invoke-Checked 'docker' @('compose', 'up', '-d', 'postgres')
        # A one-off migration must succeed before starting consumers of the schema.
        Invoke-Checked 'docker' @('compose', 'run', '--rm', 'migrate')
        Invoke-Checked 'docker' @('compose', 'run', '--rm', 'migrate', 'npm', 'run', 'db:seed')
        Invoke-Checked 'docker' @('compose', 'up', '-d', 'api', 'worker', 'frontend')
    } else {
        foreach ($project in @('backend', 'frontend')) {
            if (-not (Test-Path "$repoRoot/$project/node_modules")) { throw "Install dependencies first: npm ci --prefix $project" }
        }
        # Parse dotenv with the application's own parser; values are never printed.
        $dotenvScript = "const fs=require('fs'),d=require('dotenv');let e={};for(const p of ['../.env','.env'])if(fs.existsSync(p))Object.assign(e,d.parse(fs.readFileSync(p)));process.stdout.write(JSON.stringify(e));"
        Push-Location "$repoRoot/backend"
        try {
            $settingsJson = & node -e $dotenvScript
            if ($LASTEXITCODE -ne 0) { throw 'Could not read backend environment.' }
            $settings = $settingsJson | ConvertFrom-Json
            foreach ($entry in $settings.PSObject.Properties) {
                if (-not [Environment]::GetEnvironmentVariable($entry.Name, 'Process')) {
                    [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, 'Process')
                }
            }
            if (-not $env:DATABASE_URL -or $env:DATABASE_URL -notmatch '^postgres(?:ql)?://[^/]+@(localhost|127\.0\.0\.1)(:\d+)?/') {
                throw 'Native startup requires a local PostgreSQL DATABASE_URL in root .env or backend/.env.'
            }
            $env:NODE_ENV = 'development'
            $env:FORGE_AUTH_MODE = 'local'
            $env:FORGE_LOCAL_OTP_FILE = Join-Path $env:TEMP 'forge-local-otp.json'
            $env:PORT = '5000'
            $env:FRONTEND_URL = 'http://127.0.0.1:5173'
            Invoke-Checked 'npm.cmd' @('run', 'db:migrate')
            Invoke-Checked 'npm.cmd' @('run', 'build')
            Invoke-Checked 'npm.cmd' @('run', 'db:seed')
        } finally { Pop-Location }
        $logDirectory = Join-Path $repoRoot ('logs/native-start-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        $env:VITE_API_URL = 'http://127.0.0.1:5000'
        $processes = @(
            @{Name='api'; Directory='backend'; Arguments=@('dist/server.js')},
            @{Name='worker'; Directory='backend'; Arguments=@('dist/workers/main.js')},
            @{Name='frontend'; Directory='frontend'; Arguments=@('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort')}
        )
        foreach ($service in $processes) {
            Start-Process -FilePath (Get-Command node).Source -ArgumentList $service.Arguments -WorkingDirectory "$repoRoot/$($service.Directory)" -WindowStyle Hidden -RedirectStandardOutput "$logDirectory/$($service.Name).log" -RedirectStandardError "$logDirectory/$($service.Name).error.log" | Out-Null
        }
        Write-Host "Startup logs: $logDirectory"
    }
    foreach ($url in @('http://127.0.0.1:5000/api/ready', 'http://127.0.0.1:5173/login')) {
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try { $ready = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $url).StatusCode -eq 200 } catch { $ready = $false }
            if ($ready) { break }
            Start-Sleep -Seconds 1
        }
        if (-not $ready) { throw "Startup did not become ready: $url. Inspect service logs." }
    }
    Write-Host 'ForgeStudio ready: http://127.0.0.1:5173/login (API and AI worker started).'
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
