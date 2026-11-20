param(
  [Parameter(Mandatory)] [string] $Config,
  [switch] $Initialize,
  [string] $RestoreArchive
)

$ErrorActionPreference = 'Stop'
if ($Initialize) {
  if (Test-Path -LiteralPath $Config) { throw 'Backup configuration already exists' }
  $settings = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $bytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
  @{
    connection = ConvertFrom-SecureString (ConvertTo-SecureString $settings.connection -AsPlainText -Force)
    key = ConvertFrom-SecureString (ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force)
    archives = $settings.archives
    postgresBin = $settings.postgresBin
    caFile = $settings.caFile
    node = $settings.node
  } | ConvertTo-Json | Set-Content -LiteralPath $Config -Encoding utf8
  exit
}

$settings = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
$env:ONLINESCHOOL_BACKUP_KEY = ConvertFrom-SecureString (ConvertTo-SecureString $settings.key) -AsPlainText
$env:ONLINESCHOOL_PG_BIN = $settings.postgresBin
$env:ONLINESCHOOL_PG_CA_FILE = $settings.caFile
$backupScript = Join-Path $PSScriptRoot 'database-backup.mjs'
if ($RestoreArchive) {
  & $settings.node $backupScript restore $RestoreArchive
} else {
  if (!$env:ONLINESCHOOL_BACKUP_URL) {
    $env:ONLINESCHOOL_BACKUP_URL = ConvertFrom-SecureString (ConvertTo-SecureString $settings.connection) -AsPlainText
  }
  & $settings.node $backupScript capture $settings.archives
}
exit $LASTEXITCODE
