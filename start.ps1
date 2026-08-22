# Snivata safe starter - prevents the two failure modes we hit:
#   1) another server/process squatting on :3000  -> freed automatically
#   2) OneDrive corrupting/deleting .next         -> detected, rebuilt automatically
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File start.ps1
#   or:  npm start

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# -- 1. Free port 3000 ------------------------------------------------
$squatters = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($s in $squatters) {
    Write-Host "[start] killing squatter pid=$($s.OwningProcess) on :3000"
    Stop-Process -Id $s.OwningProcess -Force -ErrorAction SilentlyContinue
}
# Also reap orphaned next workers that hold the single DB connection.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "next (start|dev)" } |
    ForEach-Object {
        Write-Host "[start] killing stray next server pid=$($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
Start-Sleep -Seconds 2

# -- 2. Verify the production build exists; rebuild if OneDrive ate it -
if (-not (Test-Path ".next\BUILD_ID")) {
    Write-Host "[start] no valid .next build found - rebuilding..."
    if (Test-Path .next) { Remove-Item -Recurse -Force .next }
    npx prisma generate
    npx next build
    if (-not (Test-Path ".next\BUILD_ID")) {
        Write-Host "[start] FATAL: build failed. Run 'npx next build' and read the error."
        exit 1
    }
}

# -- 3. Start exactly ONE server, logs captured for real stack traces --
$err = Join-Path $env:TEMP "snivat-prod-err.log"
$out = Join-Path $env:TEMP "snivat-prod-out.log"
Remove-Item $err, $out -ErrorAction SilentlyContinue

Write-Host "[start] launching next start on :3000 ..."
$proc = Start-Process -FilePath "node" `
    -ArgumentList "node_modules\next\dist\bin\next start" `
    -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardError $err -RedirectStandardOutput $out -PassThru

# -- 4. Wait until it listens, then report health ----------------------
$up = $false
foreach ($i in 1..20) {
    Start-Sleep -Seconds 1
    $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($c) { $up = $true; break }
}
if ($up) {
    Write-Host "[start] OK - running at http://localhost:3000 (pid $($c.OwningProcess))"
    Write-Host "[start] logs: $out and $err"
} else {
    Write-Host "[start] FAILED to listen. Last errors:"
    Get-Content $err -Tail 15 -ErrorAction SilentlyContinue
    exit 1
}
