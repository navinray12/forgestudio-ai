param(
  [ValidateSet('auto', 'docker', 'native', 'status', 'menu', 'help')]
  [string]$Mode = 'auto',
  [ValidateSet('env', 'openai', 'anthropic', 'gemini')]
  [string]$Provider = 'env',
  [ValidateSet('build', 'no-build')]
  [string]$Build = 'build'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo

function Read-EnvSettings([string]$path) {
  $result = @{}
  if (-not (Test-Path -LiteralPath $path)) { return $result }
  foreach ($line in Get-Content -LiteralPath $path) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }
    $value = $Matches[2].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
    $result[$Matches[1]] = $value
  }
  return $result
}

$rootSettings = Read-EnvSettings (Join-Path $repo '.env')
$backendSettings = Read-EnvSettings (Join-Path $repo 'backend\.env')
function Get-Setting([string]$name) {
  $value = [Environment]::GetEnvironmentVariable($name, 'Process')
  if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
  if ($rootSettings.ContainsKey($name)) { return $rootSettings[$name] }
  if ($backendSettings.ContainsKey($name)) { return $backendSettings[$name] }
  return ''
}
function Require-Success([string]$action) {
  if ($LASTEXITCODE -ne 0) { throw "$action failed with exit code $LASTEXITCODE." }
}
function Test-DockerAvailable {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  & docker info --format '{{.ServerVersion}}' *> $null
  return ($LASTEXITCODE -eq 0)
}
function Test-Http([string]$url) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4
    return ($response.StatusCode -eq 200)
  } catch { return $false }
}
function Wait-Ready {
  $urls = @('http://127.0.0.1:5000/api/v1/health', 'http://127.0.0.1:5000/api/ready', 'http://127.0.0.1:5173/login')
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  do {
    $ready = $true
    foreach ($url in $urls) { if (-not (Test-Http $url)) { $ready = $false; break } }
    if ($ready) { Write-Host 'ForgeStudio is ready: http://127.0.0.1:5173/login'; return }
    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'Services did not become ready. Check docker compose ps/logs or the native logs directory.'
}

if ($Mode -eq 'help') {
  Write-Host 'Usage: start.bat [auto|docker|native|status|menu|help] [env|gemini|anthropic|openai] [build|no-build]'
  Write-Host 'Examples: start.bat ; start.bat docker gemini ; start.bat docker anthropic no-build ; start.bat status'
  exit 0
}
if ($Mode -eq 'menu') {
  Write-Host '1 - Docker (recommended when Docker Desktop is running)'
  Write-Host '2 - Native Node.js and local PostgreSQL'
  Write-Host '3 - Show status'
  switch (Read-Host 'Choose 1, 2, or 3') {
    '1' { $Mode = 'docker' }
    '2' { $Mode = 'native' }
    '3' { $Mode = 'status' }
    default { Write-Host 'No option selected.'; exit 1 }
  }
}
if ($Mode -eq 'status') {
  if (Test-DockerAvailable) { & docker compose ps; Require-Success 'Docker status' }
  foreach ($url in @('http://127.0.0.1:5000/api/v1/health', 'http://127.0.0.1:5000/api/ready', 'http://127.0.0.1:5173/login')) {
    Write-Host "$url ready=$(Test-Http $url)"
  }
  exit 0
}

try {
  if ($Provider -ne 'env') { $env:AI_SITE_PROVIDER = $Provider }
  $selected = Get-Setting 'AI_SITE_PROVIDER'
  if (-not $selected) { $selected = 'openai' }
  switch ($selected) {
    'openai' {
      if (Get-Setting 'OPENAI_API_KEY') { $effectiveProvider = 'openai' }
      elseif (Get-Setting 'GEMINI_API_KEY') { $effectiveProvider = 'gemini (missing OpenAI key fallback)' }
      elseif ($Provider -eq 'openai') { throw 'Set OPENAI_API_KEY or GEMINI_API_KEY in .env before selecting OpenAI AI drafts.' }
      else { $effectiveProvider = 'disabled (no configured key)' }
    }
    'anthropic' {
      if (-not (Get-Setting 'ANTHROPIC_API_KEY')) { throw 'Set ANTHROPIC_API_KEY in .env before selecting Anthropic.' }
      $effectiveProvider = 'anthropic'
    }
    'gemini' {
      if (-not (Get-Setting 'GEMINI_API_KEY')) { throw 'Set GEMINI_API_KEY in .env before selecting Gemini.' }
      $effectiveProvider = 'gemini'
    }
    default { throw 'AI_SITE_PROVIDER must be openai, anthropic, or gemini.' }
  }
  Write-Host "AI draft provider: $effectiveProvider (credentials are not displayed)."
  $designMissing = @()
  foreach ($setting in @('STITCH_API_KEY', 'ANTHROPIC_API_KEY', 'AI_PROMPT_ENCRYPTION_KEY')) {
    if (-not (Get-Setting $setting)) { $designMissing += $setting }
  }
  if (-not (Get-Setting 'AI_CLAUDE_DESIGN_MODEL') -and -not (Get-Setting 'AI_MODEL_PLANNER')) { $designMissing += 'AI_CLAUDE_DESIGN_MODEL' }
  if ($designMissing.Count) {
    Write-Host ('Stitch + Claude designer unavailable until server settings are supplied: ' + ($designMissing -join ', '))
  } else {
    Write-Host 'Stitch + Claude designer configured. The worker must remain running; provider access is checked on requests.'
  }
  $cleanupSetting = Get-Setting 'AI_PROMPT_CLEANUP_INTERVAL_MS'
  if ($cleanupSetting) {
    $cleanupInterval = 0
    if (-not [int]::TryParse($cleanupSetting, [ref]$cleanupInterval) -or $cleanupInterval -lt 1000 -or $cleanupInterval -gt 3600000) {
      throw 'AI_PROMPT_CLEANUP_INTERVAL_MS must be an integer between 1000 and 3600000.'
    }
  }
  $retentionKey = Get-Setting 'AI_PROMPT_ENCRYPTION_KEY'
  if ($retentionKey) {
    $validRetentionKey = $false
    try { $validRetentionKey = ([Convert]::FromBase64String($retentionKey).Length -eq 32) } catch { }
    if (-not $validRetentionKey) { throw 'AI_PROMPT_ENCRYPTION_KEY must encode 32 random bytes as base64. Do not use a provider API key.' }
    $retentionSetting = Get-Setting 'AI_PROMPT_RETENTION_HOURS'
    if ($retentionSetting) {
      $retentionHours = 0
      if (-not [int]::TryParse($retentionSetting, [ref]$retentionHours) -or $retentionHours -lt 1 -or $retentionHours -gt 720) {
        throw 'AI_PROMPT_RETENTION_HOURS must be an integer between 1 and 720.'
      }
    }
    Write-Host 'Encrypted prompt retention enabled. The worker performs bounded expiry cleanup.'
  } else {
    Write-Host 'Prompt retention is disabled; retrying a saved brief requires AI_PROMPT_ENCRYPTION_KEY.'
  }

  $dockerAvailable = Test-DockerAvailable
  if ($Mode -eq 'auto') { if ($dockerAvailable) { $Mode = 'docker' } else { $Mode = 'native' } }
  if ($Mode -eq 'docker') {
    if (-not $dockerAvailable) { throw 'Docker Desktop is unavailable. Start it, or run start.bat native with local PostgreSQL.' }
    if (-not (Test-Path -LiteralPath (Join-Path $repo '.env'))) { throw 'Missing root .env. Copy .env.example to .env and configure a server-side AI key.' }
    & docker compose config --quiet; Require-Success 'Compose configuration'
    if ($Build -eq 'no-build') {
      Write-Host 'Starting existing Docker images (no rebuild requested)...'
      & docker compose up -d --no-build
    } else {
      Write-Host 'Building and starting Docker services...'
      & docker compose up -d --build
    }
    Require-Success 'Docker Compose startup'
    & docker compose run --rm migrate npm run db:seed; Require-Success 'Plan seed'
    & docker compose ps; Require-Success 'Docker status'
    Wait-Ready
    exit 0
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22+ is required for native mode.' }
  $major = [int]((& node --version).TrimStart('v').Split('.')[0])
  if ($major -lt 22) { throw 'Node.js 22+ is required for native mode.' }
  $databaseUrl = if ($backendSettings.ContainsKey('DATABASE_URL') -and $backendSettings['DATABASE_URL']) {
    $backendSettings['DATABASE_URL']
  } else { Get-Setting 'DATABASE_URL' }
  $uri = $null
  if (-not [Uri]::TryCreate($databaseUrl, [UriKind]::Absolute, [ref]$uri) -or
    $uri.Scheme -notin @('postgresql', 'postgres') -or $uri.Host -notin @('localhost', '127.0.0.1')) {
    throw 'Native mode requires a PostgreSQL DATABASE_URL on localhost or 127.0.0.1 in backend/.env or root .env.'
  }
  foreach ($name in $rootSettings.Keys) {
    if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $rootSettings[$name], 'Process')
    }
  }
  $env:DATABASE_URL = $databaseUrl
  $env:DOTENV_CONFIG_PATH = if (Test-Path -LiteralPath (Join-Path $repo 'backend\.env')) {
    Join-Path $repo 'backend\.env'
  } else { Join-Path $repo '.env' }
  $env:NODE_ENV = 'development'
  $env:FORGE_AUTH_MODE = 'local'
  $env:FRONTEND_URL = 'http://127.0.0.1:5173'
  $env:VITE_API_URL = 'http://127.0.0.1:5000'
  $env:FORGE_LOCAL_OTP_FILE = Join-Path $env:TEMP 'forge-local-otp.json'
  if (-not (Test-Path -LiteralPath (Join-Path $repo 'backend\node_modules'))) {
    & npm --prefix backend ci; Require-Success 'Backend install'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $repo 'frontend\node_modules'))) {
    & npm --prefix frontend ci; Require-Success 'Frontend install'
  }
  if ((Test-Http 'http://127.0.0.1:5000/api/v1/health') -or (Test-Http 'http://127.0.0.1:5173/login')) {
    throw 'Ports 5000 or 5173 are already serving an app. Stop it before native startup, or use start.bat status.'
  }
  & npm --prefix backend run db:migrate; Require-Success 'Database migrations'
  & npm --prefix backend run db:seed; Require-Success 'Plan seed'
  $logDirectory = Join-Path $repo ('logs\native-start-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  $null = New-Item -ItemType Directory -Path $logDirectory -Force
  $jobs = @(
    @{ Name = 'API'; Directory = 'backend'; Command = 'npm run dev'; Log = 'api' },
    @{ Name = 'worker'; Directory = 'backend'; Command = 'npm run dev:worker'; Log = 'worker' },
    @{ Name = 'frontend'; Directory = 'frontend'; Command = 'npm run dev -- --host 127.0.0.1'; Log = 'frontend' }
  )
  foreach ($job in $jobs) {
    $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', $job.Command) `
      -WorkingDirectory (Join-Path $repo $job.Directory) -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $logDirectory ($job.Log + '.out.log')) `
      -RedirectStandardError (Join-Path $logDirectory ($job.Log + '.err.log'))
    Write-Host ("Started {0} (PID {1})." -f $job.Name, $process.Id)
  }
  Write-Host "Native logs: $logDirectory"
  Wait-Ready
  exit 0
} catch {
  Write-Host ('Startup failed: ' + $_.Exception.Message)
  Write-Host 'Check status with: start.bat status'
  exit 1
}
