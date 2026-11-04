$ErrorActionPreference = "Stop"

Write-Host "GuardAI Stage 5 - Security & Quality Assurance" -ForegroundColor Cyan
Write-Host "Repository: $(Get-Location)"

if (-not (Test-Path "package.json") -or -not (Test-Path "frontend/package.json")) {
  throw "Run this script from the GuardAI repository root."
}

Write-Host "`n[1/4] TypeScript validation" -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed." }

Write-Host "`n[2/4] Unit tests for detection, tokenization, risk and restoration" -ForegroundColor Cyan
npm run qa:unit
if ($LASTEXITCODE -ne 0) { throw "Privacy engine unit tests failed." }

Write-Host "`n[3/4] Static security audit" -ForegroundColor Cyan
npm run qa:security
if ($LASTEXITCODE -ne 0) { throw "Static security audit failed." }

Write-Host "`n[4/4] Production build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

Write-Host "`nStage 5 local code gates passed. Database/RLS integration and manual browser tests are still required." -ForegroundColor Green
