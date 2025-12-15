#!/usr/bin/env pwsh
# E2E Test Suite - Backend TypeScript
# Executa bateria completa de testes end-to-end

$ErrorActionPreference = "Continue"
$API_URL = "http://localhost:3000"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🧪 TESTES END-TO-END - Backend TypeScript" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$totalTests = 0
$passedTests = 0
$failedTests = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [string]$Body = $null,
        [string]$ExpectedStatus = "200"
    )
    
    $global:totalTests++
    
    Write-Host "Test $global:totalTests : $Name" -NoNewline
    
    try {
        $params = @{
            Method = $Method
            Uri = $Url
            UseBasicParsing = $true
            TimeoutSec = 10
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.Headers = @{"Content-Type"="application/json"}
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host " ✅ PASS" -ForegroundColor Green
            $global:passedTests++
            return $response
        } else {
            Write-Host " ❌ FAIL (Expected $ExpectedStatus, got $($response.StatusCode))" -ForegroundColor Red
            $global:failedTests++
            return $null
        }
    } catch {
        Write-Host " ❌ FAIL ($($_.Exception.Message))" -ForegroundColor Red
        $global:failedTests++
        return $null
    }
}

# ==============================================================================
# 1. TESTES DE INFRAESTRUTURA
# ==============================================================================

Write-Host "`n## 1. Testes de Infraestrutura`n" -ForegroundColor Yellow

$health = Test-Endpoint `
    -Name "Health Check" `
    -Method "GET" `
    -Url "$API_URL/api/health"

if ($health) {
    $healthData = $health.Content | ConvertFrom-Json
    Write-Host "   Status: $($healthData.status)" -ForegroundColor Gray
    Write-Host "   Uptime: $($healthData.uptime_seconds)s" -ForegroundColor Gray
}

$metrics = Test-Endpoint `
    -Name "Metrics Endpoint" `
    -Method "GET" `
    -Url "$API_URL/api/metrics"

# ==============================================================================
# 2. TESTES DE API - FUNCIONALIDADE
# ==============================================================================

Write-Host "`n## 2. Testes de Funcionalidade`n" -ForegroundColor Yellow

# Teste 3: Query simples
$search1 = Test-Endpoint `
    -Name "Search - Query Simples (mop)" `
    -Method "POST" `
    -Url "$API_URL/api/search" `
    -Body '{"query":"mop","top_k":5}'

if ($search1) {
    $data = $search1.Content | ConvertFrom-Json
    Write-Host "   Results: $($data.total)" -ForegroundColor Gray
    Write-Host "   Latency: $($data.metadata.latency_ms)ms" -ForegroundColor Gray
}

# Teste 4: Query com typo
$search2 = Test-Endpoint `
    -Name "Search - Query com Typo (lavdora)" `
    -Method "POST" `
    -Url "$API_URL/api/search" `
    -Body '{"query":"lavdora","top_k":5}'

# Teste 5: Query com sinônimo
$search3 = Test-Endpoint `
    -Name "Search - Query com Sinônimo (esfregão)" `
    -Method "POST" `
    -Url "$API_URL/api/search" `
    -Body '{" query":"esfregão profissional","top_k":5}'

# Teste 6: Query complexa
$search4 = Test-Endpoint `
    -Name "Search - Query Complexa" `
    -Method "POST" `
    -Url "$API_URL/api/search" `
    -Body '{"query":"máquina lavar piso alta pressão 220v","top_k":10}'

# ==============================================================================
# 3. TESTES DE VALIDAÇÃO
# ==============================================================================

Write-Host "`n## 3. Testes de Validação`n" -ForegroundColor Yellow

# Teste 7: Query vazia (deve falhar)
Test-Endpoint `
    -Name "Validation - Query Vazia" `
    -Method "POST" `
    -Url "$API_URL/api/search" `
    -Body '{"query":"","top_k":5}' `
    -ExpectedStatus "400"

# Teste 8: top_k inválido (deve falhar)
Test-Endpoint `
    -Name "Validation - top_k > 100" `
    -Method "POST" `
    -Url "$API_URL/api/search" `
    -Body '{"query":"mop","top_k":200}' `
    -ExpectedStatus "400"

# Teste 9: top_k negativo (deve falhar)
Test-Endpoint `
    -Name "Validation - top_k < 0" `
    -Method "POST" `
    -Url "$API_URL/api/search" `
    -Body '{"query":"mop","top_k":-1}' `
    -ExpectedStatus "400"

# ==============================================================================
# 4. TESTES DE PERFORMANCE
# ==============================================================================

Write-Host "`n## 4. Testes de Performance`n" -ForegroundColor Yellow

$latencies = @()
for ($i = 1; $i -le 10; $i++) {
    $start = Get-Date
    $result = Test-Endpoint `
        -Name "Performance Test $i/10" `
        -Method "POST" `
        -Url "$API_URL/api/search" `
        -Body '{"query":"mop industrial","top_k":10}'
    $end = Get-Date
    $latency = ($end - $start).TotalMilliseconds
    $latencies += $latency
}

$avgLatency = ($latencies | Measure-Object -Average).Average
$p95Latency = ($latencies | Sort-Object)[[math]::Floor($latencies.Count * 0.95)]

Write-Host "`n   Avg Latency: $([math]::Round($avgLatency, 2))ms" -ForegroundColor Gray
Write-Host "   P95 Latency: $([math]::Round($p95Latency, 2))ms" -ForegroundColor Gray

# ==============================================================================
# RESUMO
# ==============================================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "📊 RESUMO DOS TESTES" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Total de Testes: $totalTests"
Write-Host "Testes Passaram: $passedTests" -ForegroundColor Green
Write-Host "Testes Falharam: $failedTests" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Red" })

$passRate = [math]::Round(($passedTests / $totalTests) * 100, 2)
Write-Host "`nTaxa de Sucesso: $passRate%" -ForegroundColor $(if ($passRate -ge 80) { "Green" } else { "Red" })

if ($passRate -ge 80) {
    Write-Host "`n✅ TESTES APROVADOS - Sistema pronto para produção!`n" -ForegroundColor Green
} else {
    Write-Host "`n❌ TESTES REPROVADOS - Verificar falhas antes de deploy`n" -ForegroundColor Red
}
