param([int]$Port = 4317, [switch]$NoBrowser, [ValidateSet('pixel','3d')][string]$View = '3d')
$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
Set-Location -LiteralPath $projectPath
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js 24 이상을 설치한 뒤 다시 실행해 주세요.' }
$majorVersion = [int]((& $nodePath --version).TrimStart('v').Split('.')[0])
if ($majorVersion -lt 24) { throw '이 실행본은 Node.js 24 이상이 필요합니다.' }
$url = "http://127.0.0.1:$Port"
try { $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2 } catch { $health = $null }
if ($health -and $health.app -ne 'tangbisil') { throw "다른 앱이 $Port 포트를 쓰고 있습니다." }
if (-not $health) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectPath 'dist\index.html'))) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectPath 'node_modules\vite\bin\vite.js'))) { throw '먼저 README의 설치 절차(npm ci)를 실행해 주세요.' }
    & $nodePath 'node_modules\vite\bin\vite.js' build
    if ($LASTEXITCODE -ne 0) { throw '게임 빌드에 실패했습니다.' }
  }
  New-Item -ItemType Directory -Path (Join-Path $projectPath 'data') -Force | Out-Null
  $env:PORT = $Port
  $started = Start-Process -FilePath $nodePath -ArgumentList @('server/start.mjs') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectPath 'data\server.log') -RedirectStandardError (Join-Path $projectPath 'data\server-error.log') -PassThru
  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    try { $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 1; if ($health.app -eq 'tangbisil') { break } } catch {}
    Start-Sleep -Milliseconds 200
  }
  if ($health.app -ne 'tangbisil') { throw '서버가 시작되지 않았습니다. data\server-error.log를 확인해 주세요.' }
  $started.Id | Set-Content -LiteralPath (Join-Path $projectPath 'data\server.pid')
}
$launchUrl = if ($View -eq '3d') { "$url/?view=3d" } else { "$url/?view=pixel" }
Write-Output "탕비실이 열렸습니다: $launchUrl"
if (-not $NoBrowser) { Start-Process $launchUrl }
