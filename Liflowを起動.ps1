$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$log = Join-Path $PSScriptRoot "Liflow起動ログ.txt"
function Stop-WithMessage([string]$message) {
  Write-Host ""
  Write-Host $message -ForegroundColor Red
  Write-Host "詳しい内容は Liflow起動ログ.txt に保存されています。" -ForegroundColor Yellow
  Read-Host "Enterキーを押すまで、この画面は閉じません"
  exit 1
}
try {
  "=== Liflow startup $(Get-Date -Format o) ===" | Set-Content -Encoding UTF8 $log
  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) { Stop-WithMessage "Node.jsが見つかりません。Node.js 22以上をインストールしてから、もう一度起動してください。" }
  $major = [int]((& node --version).TrimStart('v').Split('.')[0])
  if ($major -lt 22) { Stop-WithMessage "Node.jsのバージョンが古いです。Node.js 22以上へ更新してください。" }
  Write-Host "Liflowを準備しています。初回は数分かかります。" -ForegroundColor Cyan
  $browserJob = Start-Job -ScriptBlock {
    for ($i = 0; $i -lt 180; $i++) {
      try { $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8787" -TimeoutSec 1; if ($response.StatusCode -ge 200) { Start-Process "http://127.0.0.1:8787"; break } } catch {}
      Start-Sleep -Seconds 1
    }
  }
  & npm.cmd run local *>&1 | Tee-Object -FilePath $log -Append
  $exitCode = $LASTEXITCODE
  Remove-Job $browserJob -Force -ErrorAction SilentlyContinue
  if ($exitCode -ne 0) { Stop-WithMessage "Liflowを起動できませんでした。" }
} catch {
  $_ | Out-String | Add-Content -Encoding UTF8 $log
  Stop-WithMessage "Liflowを起動できませんでした: $($_.Exception.Message)"
}
