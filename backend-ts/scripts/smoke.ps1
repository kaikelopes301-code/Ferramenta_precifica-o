param(
  [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
  Write-Host "[SMOKE][FAIL] $Message" -ForegroundColor Red
  exit 1
}

function Info([string]$Message) {
  Write-Host "[SMOKE] $Message"
}

$port = 4000
if ($env:PORT -and $env:PORT.Trim() -ne '') {
  try {
    $port = [int]$env:PORT
  } catch {
    Fail "PORT inválida: '$env:PORT'"
  }
}

if (-not $env:LOG_LEVEL -or $env:LOG_LEVEL.Trim() -eq '') {
  $env:LOG_LEVEL = 'error'
}

# Default DB path for smoke
if (-not $env:DATABASE_PATH -or $env:DATABASE_PATH.Trim() -eq '') {
  $dataDir = Join-Path -Path $PSScriptRoot -ChildPath '..\data'
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
  $env:DATABASE_PATH = Join-Path -Path $dataDir -ChildPath 'smoke.db'
}

$indexJs = Join-Path -Path $PSScriptRoot -ChildPath '..\dist\index.js'
if (-not (Test-Path -LiteralPath $indexJs)) {
  Fail "dist/index.js não encontrado. Rode 'npm run build' antes do smoke. (Esperado: $indexJs)"
}

$base = "http://127.0.0.1:$port"

Info "Iniciando servidor: node dist/index.js (PORT=$port, DATABASE_PATH=$env:DATABASE_PATH)"
$proc = Start-Process node -ArgumentList "dist/index.js" -PassThru -NoNewWindow

try {
  # Wait /api/health
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $healthOk = $false

  Info "Aguardando /api/health (timeout ${TimeoutSeconds}s)..."
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri "$base/api/health" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) {
        $healthOk = $true
        break
      }
    } catch {
      # ignore until timeout
    }

    Start-Sleep -Milliseconds 250
  }

  if (-not $healthOk) {
    Fail "Health timeout: $base/api/health"
  }

  Info "Health OK"

  # POST /api/search (formato EXATO do handler: query, top_k, min_score)
  $bodyObj = @{ query = 'mop'; top_k = 3; min_score = 0 }
  $bodyJson = $bodyObj | ConvertTo-Json -Depth 10

  Info "Chamando POST /api/search"
  $search = Invoke-WebRequest -Uri "$base/api/search" -Method Post -ContentType 'application/json' -Body $bodyJson -UseBasicParsing -TimeoutSec 20

  $status = $search.StatusCode
  if ($status -ne 200) {
    $snippet = $search.Content
    if ($snippet.Length -gt 400) { $snippet = $snippet.Substring(0, 400) + '…' }
    Fail "Search retornou status=$status. Body: $snippet"
  }

  $json = $null
  try {
    $json = $search.Content | ConvertFrom-Json
  } catch {
    $snippet = $search.Content
    if ($snippet.Length -gt 400) { $snippet = $snippet.Substring(0, 400) + '…' }
    Fail "Resposta de /api/search não é JSON válido. Body: $snippet"
  }

  $top1 = $null
  if ($json -and $json.resultados -and $json.resultados.Count -gt 0) {
    $top1 = $json.resultados[0]
  }

  $top1Title = $top1.title
  if ((-not $top1Title) -and $top1.descricao) { $top1Title = $top1.descricao }
  if ((-not $top1Title) -and $top1.grupo) { $top1Title = $top1.grupo }

  $top1Valor = $top1.valor_unitario
  if ((-not $top1Valor) -and $top1.valorUnitario) { $top1Valor = $top1.valorUnitario }

  Info "OK search status=$status"
  Info "top1.title=$top1Title"
  Info "top1.valor_unitario=$top1Valor"

  exit 0
} catch {
  Fail $_.Exception.Message
} finally {
  Info "Parando servidor (pid=$($proc.Id))"
  try {
    if ($proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force
    }
  } catch {
    # ignore
  }
}
