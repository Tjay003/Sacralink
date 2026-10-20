#Requires -Version 5.1
<#
  Applies supabase/migrations/*.sql to the LOCAL Supabase database (docker) in filename order.
  Skips 000_drop_all.sql and APPLY_ALL_MIGRATIONS.sql. Never touches a remote project.
  Usage: powershell -File scripts/local-db-setup.ps1 [-Reset]
#>
param([switch]$Reset)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$container = docker ps --filter "name=supabase_db_" --format '{{.Names}}' | Select-Object -First 1
if (-not $container) { throw 'Local Supabase is not running. Run: npx supabase start' }

if ($Reset) {
  Write-Output 'Resetting public schema...'
  docker exec $container psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -c "drop schema public cascade; create schema public; grant usage on schema public to postgres, anon, authenticated, service_role; grant all on schema public to postgres, service_role; alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role; alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role; alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;" | Out-Null
}

$files = Get-ChildItem "$root\supabase\migrations" -Filter '*.sql' |
  Where-Object { $_.Name -notin @('000_drop_all.sql', 'APPLY_ALL_MIGRATIONS.sql') } |
  Sort-Object Name

$failed = @()
# psql writes NOTICE lines to stderr; Windows PowerShell 5.1 would turn them into terminating errors.
$ErrorActionPreference = 'Continue'
foreach ($f in $files) {
  $out =Get-Content $f.FullName -Raw -Encoding UTF8 | docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    $failed += $f.Name
    Write-Output "FAIL  $($f.Name)"
    Write-Output (($out -split "`n" | Where-Object { $_ -match 'ERROR' } | Select-Object -First 2) -join "`n")
  } else {
    Write-Output "ok    $($f.Name)"
  }
}

Write-Output ''
if ($failed.Count) { Write-Output "$($failed.Count) migration(s) failed: $($failed -join ', ')"; exit 1 }
Write-Output 'All migrations applied to the local database.'
