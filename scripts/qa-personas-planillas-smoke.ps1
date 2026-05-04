param(
  [string]$BackendBaseUrl = "http://localhost:3001"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$docsDir = Join-Path $repoRoot "docs"
if (-not (Test-Path $docsDir)) {
  New-Item -ItemType Directory -Path $docsDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$reportPath = Join-Path $docsDir ("REPORTE_QA_TECNICO_PERSONAS_PLANILLAS_{0}.md" -f $timestamp)

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Id,
    [string]$Name,
    [bool]$Passed,
    [string]$Evidence
  )
  $status = if ($Passed) { "PASS" } else { "FAIL" }
  $results.Add([pscustomobject]@{
      id = $Id
      name = $Name
      status = $status
      evidence = $Evidence
    })
}

function Run-CommandTest {
  param(
    [string]$Id,
    [string]$Name,
    [string]$Command
  )

  try {
    $hadNativePref = $null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
    $nativePrefBackup = $false
    if ($hadNativePref) {
      $nativePrefBackup = $PSNativeCommandUseErrorActionPreference
      $PSNativeCommandUseErrorActionPreference = $false
    }

    try {
      $escaped = $Command.Replace('"', '\"')
      Invoke-Expression ("cmd /c ""{0}""" -f $escaped) | Out-Null
    } finally {
      if ($hadNativePref) {
        $PSNativeCommandUseErrorActionPreference = $nativePrefBackup
      }
    }

    if ($LASTEXITCODE -eq 0) {
      Add-Result -Id $Id -Name $Name -Passed $true -Evidence $Command
    } else {
      Add-Result -Id $Id -Name $Name -Passed $false -Evidence ("ExitCode {0} :: {1}" -f $LASTEXITCODE, $Command)
    }
  } catch {
    Add-Result -Id $Id -Name $Name -Passed $false -Evidence ("Exception :: {0}" -f $_.Exception.Message)
  }
}

function Invoke-HttpTest {
  param(
    [string]$Id,
    [string]$Name,
    [string]$Url,
    [int]$ExpectedStatus
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 15 -ErrorAction Stop
    $actual = [int]$response.StatusCode
    $passed = $actual -eq $ExpectedStatus
    $snippet = if ($response.Content) { $response.Content } else { "" }
    if ($snippet.Length -gt 160) {
      $snippet = $snippet.Substring(0, 160) + "..."
    }
    Add-Result -Id $Id -Name $Name -Passed $passed -Evidence ("HTTP {0} :: {1} :: {2}" -f $actual, $Url, $snippet)
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $actual = [int]$resp.StatusCode
      $passed = $actual -eq $ExpectedStatus
      $body = ""
      try {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
      } catch {
        $body = ""
      }
      if ($body.Length -gt 160) {
        $body = $body.Substring(0, 160) + "..."
      }
      Add-Result -Id $Id -Name $Name -Passed $passed -Evidence ("HTTP {0} :: {1} :: {2}" -f $actual, $Url, $body)
    } else {
      Add-Result -Id $Id -Name $Name -Passed $false -Evidence ("Request exception :: {0}" -f $_.Exception.Message)
    }
  }
}

Push-Location $repoRoot
try {
  Run-CommandTest `
    -Id "T1" `
    -Name "eslint alcance personas/permisos" `
    -Command "npx eslint src/utils/permissions.js src/services/personasService.js src/pages/dashboard/personas --max-warnings=0"

  Run-CommandTest `
    -Id "T2" `
    -Name "build frontend" `
    -Command "npm run build"

  Invoke-HttpTest `
    -Id "T3" `
    -Name "GET /status responde 200" `
    -Url ("{0}/status" -f $BackendBaseUrl.TrimEnd('/')) `
    -ExpectedStatus 200

  Invoke-HttpTest `
    -Id "T4" `
    -Name "GET /personas sin sesion responde 401" `
    -Url ("{0}/personas?page=1&limit=9" -f $BackendBaseUrl.TrimEnd('/')) `
    -ExpectedStatus 401

  Invoke-HttpTest `
    -Id "T5" `
    -Name "GET /usuarios/v2/list sin sesion responde 401" `
    -Url ("{0}/usuarios/v2/list?page=1&limit=9" -f $BackendBaseUrl.TrimEnd('/')) `
    -ExpectedStatus 401
} finally {
  Pop-Location
}

$failedRows = @($results | Where-Object { $_.status -ne "PASS" })
$allPassed = $failedRows.Count -eq 0
$overall = if ($allPassed) { "PASS" } else { "FAIL" }

$lines = @()
$lines += "# Reporte QA Tecnico - Personas y Planillas"
$lines += ""
$lines += ("Fecha: {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
$lines += ("Backend base URL: {0}" -f $BackendBaseUrl)
$lines += ("Resultado global: {0}" -f $overall)
$lines += ""
$lines += "| ID | Prueba | Resultado | Evidencia |"
$lines += "|---|---|---|---|"
foreach ($row in $results) {
  $evidence = ($row.evidence -replace "\|", "/")
  $lines += ("| {0} | {1} | {2} | {3} |" -f $row.id, $row.name, $row.status, $evidence)
}
$lines += ""
$lines += "Nota: este reporte cubre validaciones tecnicas automatizables (T1-T5)."
$lines += "Las pruebas funcionales manuales A-E deben registrarse en el acta de aceptacion."

Set-Content -Path $reportPath -Value $lines -Encoding UTF8

Write-Host ("Reporte generado: {0}" -f $reportPath)
Write-Host ("Resultado global: {0}" -f $overall)

if (-not $allPassed) {
  exit 1
}
