#Requires -Version 5.1
<#
  Dumps the PRODUCTION Supabase database to timestamped SQL files in backups/ (gitignored).
  Read-only: it only runs pg_dump through the Supabase CLI. Needs Docker Desktop running.

  Writes, per run:
    backups/<stamp>/schema.sql   public schema: tables, functions, RLS policies, triggers
    backups/<stamp>/data.sql     rows of the public schema and the auth schema (users), as COPY statements

  Not included: Supabase Storage FILES (QR codes, avatars, receipts). Only their database rows are.

  The password is never stored or printed. Provide it for the current terminal session only:
    $env:SUPABASE_DB_PASSWORD = '<Project Settings > Database > Database password>'
    powershell -File scripts/db-backup.ps1
  Or paste a full connection string instead (Dashboard > Connect > Session pooler):
    $env:SUPABASE_DB_URL = 'postgresql://postgres.<ref>:<password>@<host>:5432/postgres'

  Restore (to a scratch/local database, never straight over production):
    psql "<target connection string>" -f backups/<stamp>/schema.sql
    psql "<target connection string>" -f backups/<stamp>/data.sql
#>
param(
  [string]$OutDir
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not $OutDir) { $OutDir = Join-Path $root 'backups' }

$projectRef = 'oaczurouvaevebpimply'

$dockerUp = $false
try { docker info 2>&1 | Out-Null; $dockerUp = ($LASTEXITCODE -eq 0) } catch { $dockerUp = $false }
if (-not $dockerUp) { throw 'Docker Desktop is not running. Start it first: the Supabase CLI runs pg_dump inside Docker.' }

# Candidate connection strings, tried in order. The free plan direct host is IPv6-only, so the pooler goes first.
$candidates = @()
if ($env:SUPABASE_DB_URL) {
  $candidates += $env:SUPABASE_DB_URL
} elseif ($env:SUPABASE_DB_PASSWORD) {
  $pw = [uri]::EscapeDataString($env:SUPABASE_DB_PASSWORD)
  foreach ($poolerHost in @('aws-1-ap-south-1.pooler.supabase.com', 'aws-0-ap-south-1.pooler.supabase.com')) {
    $candidates += "postgresql://postgres.${projectRef}:${pw}@${poolerHost}:5432/postgres"
  }
  $candidates += "postgresql://postgres:${pw}@db.${projectRef}.supabase.co:5432/postgres"
} else {
  throw 'Set $env:SUPABASE_DB_PASSWORD (or $env:SUPABASE_DB_URL) first. See the header of this script.'
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$dest = Join-Path $OutDir $stamp
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$schemaFile = Join-Path $dest 'schema.sql'
$dataFile = Join-Path $dest 'data.sql'

# The Supabase CLI writes progress to stderr; Windows PowerShell 5.1 would turn that into terminating errors.
$ErrorActionPreference = 'Continue'
$connected = $false
foreach ($url in $candidates) {
  Write-Output 'Dumping schema...'
  npx supabase db dump --db-url $url --schema public -f $schemaFile 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0 -and (Test-Path $schemaFile) -and (Get-Item $schemaFile).Length -gt 0) { $connected = $true; break }
  Write-Output '  could not connect with that route, trying the next one...'
}
if (-not $connected) {
  Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
  throw 'Could not connect to the production database. Check the password, or set SUPABASE_DB_URL from Dashboard > Connect > Session pooler.'
}

Write-Output 'Dumping data (public + auth users)...'
npx supabase db dump --db-url $url --data-only --use-copy --schema public,auth -f $dataFile 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dataFile) -or (Get-Item $dataFile).Length -eq 0) {
  throw "Data dump failed. The schema dump was saved at $schemaFile but this backup is incomplete."
}

$tables = (Select-String -Path $schemaFile -Pattern '^CREATE TABLE' | Measure-Object).Count
$copies = (Select-String -Path $dataFile -Pattern '^COPY ' | Measure-Object).Count
$policies = (Select-String -Path $schemaFile -Pattern '^CREATE POLICY' | Measure-Object).Count
if ($tables -eq 0 -or $copies -eq 0) { throw "Backup looks empty ($tables tables, $copies COPY blocks). Do not rely on it." }

Write-Output ''
Write-Output "Backup saved to $dest"
Write-Output ("  schema.sql  {0:N0} KB  ({1} tables, {2} policies)" -f ((Get-Item $schemaFile).Length / 1KB), $tables, $policies)
Write-Output ("  data.sql    {0:N0} KB  ({1} tables with data)" -f ((Get-Item $dataFile).Length / 1KB), $copies)
Write-Output 'Keep this folder private: it contains real user data. It is gitignored.'
