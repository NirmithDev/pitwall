# Run from anywhere. Uses the same .env settings as Docker Compose.
param([switch]$Snapshot)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $Snapshot) {
    $envPath = Join-Path $projectRoot '.env'
    if (-not (Test-Path -LiteralPath $envPath)) { throw 'Run node scripts/setup-env.mjs first, then docker compose up -d db.' }
    $settings = @{}
    Get-Content -LiteralPath $envPath | ForEach-Object {
        if ($_ -match '^([A-Z_]+)=(.*)$') { $settings[$matches[1]] = $matches[2] }
    }
    # Npgsql's builder safely handles special characters in a database password.
    $connectionSettings = [System.Data.Common.DbConnectionStringBuilder]::new()
    $connectionSettings['Host'] = '127.0.0.1'
    $connectionSettings['Port'] = $settings['POSTGRES_PORT']
    $connectionSettings['Database'] = $settings['POSTGRES_DB']
    $connectionSettings['Username'] = $settings['POSTGRES_USER']
    $connectionSettings['Password'] = $settings['POSTGRES_PASSWORD']
    $env:ConnectionStrings__Pitwall = $connectionSettings.ConnectionString
} else {
    Remove-Item Env:ConnectionStrings__Pitwall -ErrorAction SilentlyContinue
}
dotnet run --project (Join-Path $projectRoot 'backend/Pitwall.Api') --urls http://127.0.0.1:5080
