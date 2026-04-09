#Requires -Version 5.1
<#
  Start Docker (Desktop) if needed, then bring up the hospital-scheduler stack.
  Default: detached containers + open http://localhost:3000/ in the default browser (after port 3000 is open).
  Use -Interactive to run `docker compose up --build` in the foreground; the browser is not opened in that mode.
#>
param(
  [switch]$Interactive,
  [switch]$NoBrowser,
  [switch]$SkipDockerDesktop
)

$ErrorActionPreference = "Stop"
$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
Set-Location $Root

# --- All functions first (never skip with mid-script exit) ---------------------------------

function Write-StartAppFooter {
  Write-Host ""
  Write-Host "Containers are running. Useful commands:"
  Write-Host "  docker compose logs -f     # follow all logs"
  Write-Host "  docker compose down        # stop and remove containers"
  Write-Host ""
}

function Test-DockerDaemon {
  cmd /c "docker info >nul 2>nul"
  return ($LASTEXITCODE -eq 0)
}

function Invoke-DockerIgnoreStderrWarnings {
  param([Parameter(Mandatory)][scriptblock]$Command)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command
    $exit = $LASTEXITCODE
    if ($null -eq $exit) { return 0 }
    return [int]$exit
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Start-DockerDesktop {
  $proc = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
  if ($proc) { return }

  $candidates = @(
    "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
  )
  $exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $exe) {
    Write-Error "Docker Desktop was not found. Install Docker Desktop for Windows or start the Docker engine, then run this script again."
  }
  Write-Host "Starting Docker Desktop..."
  Start-Process -FilePath $exe
}

function Wait-DockerDaemon {
  param([int]$TimeoutSec = 120)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-DockerDaemon) { return }
    Start-Sleep -Seconds 2
  }
  Write-Error "Docker did not become ready within ${TimeoutSec}s. Open Docker Desktop and wait until it finishes starting, then run this script again."
}

function Test-LocalPortOpen {
  param([int]$Port)
  $client = $null
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.ReceiveTimeout = 800
    $client.SendTimeout = 800
    $client.Connect("127.0.0.1", $Port)
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $client) {
      try { $client.Close() } catch { }
    }
  }
}

function Open-UrlInDefaultBrowser {
  param([string]$Url)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"

  try {
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $Url
    $psi.UseShellExecute = $true
    [void][System.Diagnostics.Process]::Start($psi)
    $ErrorActionPreference = $prev
    return $true
  } catch { }

  try {
    [void][System.Diagnostics.Process]::Start($Url)
    $ErrorActionPreference = $prev
    return $true
  } catch { }

  try {
    Invoke-Item -LiteralPath $Url -ErrorAction SilentlyContinue
    $ErrorActionPreference = $prev
    return $true
  } catch { }

  try {
    Start-Process -FilePath $Url -ErrorAction SilentlyContinue
    $ErrorActionPreference = $prev
    return $true
  } catch { }

  try {
    Start-Process -FilePath "rundll32.exe" -ArgumentList @("url.dll,FileProtocolHandler", $Url) -ErrorAction SilentlyContinue
    $ErrorActionPreference = $prev
    return $true
  } catch { }

  try {
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "start", '""', $Url) -WindowStyle Normal -ErrorAction SilentlyContinue
    $ErrorActionPreference = $prev
    return $true
  } catch { }

  $edge = Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"
  if (Test-Path -LiteralPath $edge) {
    try {
      Start-Process -FilePath $edge -ArgumentList @($Url) -ErrorAction SilentlyContinue
      $ErrorActionPreference = $prev
      return $true
    } catch { }
  }

  $ErrorActionPreference = $prev
  return $false
}

# --- Docker daemon --------------------------------------------------------------------------

if (-not $SkipDockerDesktop) {
  if (-not (Test-DockerDaemon)) {
    Start-DockerDesktop
    Wait-DockerDaemon
  }
} else {
  if (-not (Test-DockerDaemon)) {
    Write-Error "Docker daemon is not running. Start Docker Desktop or run without -SkipDockerDesktop."
  }
}

Write-Host "Project root: $Root"
Write-Host "Running docker compose up $(if ($Interactive) { '(foreground)' } else { '-d (detached)' })..."

$exitCode = 0

if ($Interactive) {
  $exitCode = Invoke-DockerIgnoreStderrWarnings { docker compose up --build }
  if ($null -eq $exitCode) { $exitCode = 0 }
  Write-StartAppFooter
  exit $exitCode
}

# Detached: capture exit code without using mid-script exit (compose often prints OK but returns a non-zero from a plugin bug).
$composeExit = Invoke-DockerIgnoreStderrWarnings { docker compose up -d --build }
if ($null -eq $composeExit) { $composeExit = 0 }
try {
  $composeExit = [int]$composeExit
} catch {
  $composeExit = 1
}

# Treat "containers already running" as success: if frontend is up on 3000, continue even when compose reports non-zero.
$portAlreadyUp = Test-LocalPortOpen -Port 3000
if ($composeExit -ne 0 -and -not $portAlreadyUp) {
  Write-Host "docker compose reported exit code $composeExit (see output above)." -ForegroundColor Yellow
  Write-StartAppFooter
  exit $composeExit
}

if ($composeExit -ne 0 -and $portAlreadyUp) {
  Write-Host "docker compose exit code was $composeExit, but port 3000 is open - continuing (browser / tips below)." -ForegroundColor DarkYellow
}

# --- Browser (optional) ---------------------------------------------------------------------

if (-not $NoBrowser) {
  $url = "http://localhost:3000/"
  Write-Host "Waiting for frontend (port 3000)..."
  Start-Sleep -Seconds 4

  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-LocalPortOpen -Port 3000) {
      Start-Sleep -Seconds 2
      if (Test-LocalPortOpen -Port 3000) {
        $ready = $true
        break
      }
    }
    Start-Sleep -Seconds 2
  }

  $opened = $false
  try {
    $opened = Open-UrlInDefaultBrowser -Url $url
  } catch {
    Write-Host "Browser launch error: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  if ($opened) {
    if ($ready) {
      Write-Host ('Opened ' + $url + ' in your default browser.')
    } else {
      Write-Host ('Opened ' + $url + ' - if the page is blank, wait and refresh (container still starting).')
    }
  } else {
    Write-Host ('Could not start the browser automatically. Open this link manually: ' + $url)
  }
}

Write-StartAppFooter
exit 0
