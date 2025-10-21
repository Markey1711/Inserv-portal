# migrate_local.ps1 — безопасное применение миграций к локальной БД MySQL
# Использование из PowerShell (Windows):
#   ./backend/scripts/migrate_local.ps1 -Host localhost -Port 3306 -User root -Db tmcdb
# Пароль вводится через Read-Host (SecureString). Можно задать переменную среды MYSQL_PWD — тогда пароль не спросят.

param(
  [string]$DbHost = "localhost",
  [int]$DbPort = 3306,
  [string]$DbUser = "root",
  [string]$Db = "tmcdb"
)

function Check-Cmd($name) {
  $p = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $p) { throw "[ERR] Команда '$name' не найдена. Установите MySQL Client." }
}

Check-Cmd mysql
Check-Cmd mysqldump

# Пароль
$useEnvPwd = $false
if ($env:MYSQL_PWD -and $env:MYSQL_PWD.Length -gt 0) { $useEnvPwd = $true }

if ($useEnvPwd) {
  $passArg = @()
} else {
  $sec = Read-Host -Prompt "Введите пароль MySQL пользователя $DbUser" -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  $env:MYSQL_PWD = $plain
  $passArg = @()
}

# Проверка подключения
Write-Host "[RUN] Проверка подключения к MySQL $($DbHost):$DbPort"
$rc = & mysql -h $DbHost -P $DbPort -u $DbUser -e "SELECT 1;" 2>$null
if ($LASTEXITCODE -ne 0) { throw "[ERR] Не удалось подключиться к MySQL $($DbHost):$DbPort пользователем $DbUser" }
Write-Host "[OK] Подключение успешно"

# Бэкап
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backup = "backup_${Db}_$stamp.sql"
Write-Host "[RUN] Делаю дамп БД $Db -> $backup"
& mysqldump -h $DbHost -P $DbPort -u $DbUser $Db > $backup
if ($LASTEXITCODE -ne 0) { throw "[ERR] Ошибка создания дампа" }
Write-Host "[OK] Бэкап готов: $backup"

# Пути к миграциям
$base = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$mig  = (Join-Path $base "migrations")

$safe1 = Join-Path $mig "2025-10-21_add_period_to_objects_safe.sql"
$safe2 = Join-Path $mig "2025-10-21_alter_card_calc_add_object_fields.sql"
$safe3 = Join-Path $mig "2025-10-21_add_areaTable_if_missing.sql"

function Invoke-SqlFile($file) {
  if (Test-Path $file) {
    Write-Host "[RUN] $file"
    # В PowerShell оператор '<' зарезервирован, поэтому используем mysql -e "source ..."
    $quoted = '"' + $file + '"'
    & mysql -h $DbHost -P $DbPort -u $DbUser $Db -e "source $quoted"
    if ($LASTEXITCODE -ne 0) { throw "[ERR] Ошибка применения $file" }
    Write-Host "[OK] $file"
  } else {
    Write-Host "[SKIP] Файл не найден: $file"
  }
}

Invoke-SqlFile $safe1
Invoke-SqlFile $safe2
Invoke-SqlFile $safe3

Write-Host "[RUN] Проверка схемы"
& mysql -h $DbHost -P $DbPort -u $DbUser -e "USE ${Db}; DESCRIBE objects; DESCRIBE card_calc;"

Write-Host "[DONE] Миграции применены успешно. Бэкап: $backup"
