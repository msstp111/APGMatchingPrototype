# Runs both halves of the prototype in one go.
#
#   .\dev.ps1
#
# Opens the API (http://localhost:5286) in a background job and runs the Angular dev server
# (http://localhost:4200) in the foreground. Ctrl+C stops the dev server; the script then stops the
# API job on its way out. Run the two halves in separate terminals instead if you want the API's log
# in front of you.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host 'Starting the API on http://localhost:5286 ...' -ForegroundColor Cyan
$api = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    dotnet run --project src/Apg.Api --launch-profile http
} -ArgumentList $root

try {
    Write-Host 'Starting the Angular dev server on http://localhost:4200 ...' -ForegroundColor Cyan
    Push-Location (Join-Path $root 'web')
    npm start
}
finally {
    Pop-Location
    Write-Host 'Stopping the API ...' -ForegroundColor Cyan
    Stop-Job $api -ErrorAction SilentlyContinue
    Remove-Job $api -Force -ErrorAction SilentlyContinue
}
