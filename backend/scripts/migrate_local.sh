#!/usr/bin/env bash
set -euo pipefail

# migrate_local.sh — безопасное применение миграций к локальной БД MySQL
# Использование:
#   bash backend/scripts/migrate_local.sh -H localhost -P 3306 -u root -d tmcdb
# Пароль можно ввести интерактивно, либо экспортировать переменную MYSQL_PWD перед запуском.

HOST="localhost"
PORT="3306"
USER="root"
DB="tmcdb"
ASK_PASS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    -H|--host) HOST="$2"; shift 2;;
    -P|--port) PORT="$2"; shift 2;;
    -u|--user) USER="$2"; shift 2;;
    -d|--db)   DB="$2";   shift 2;;
    --no-pass) ASK_PASS=0; shift 1;;
    *) echo "Unknown arg: $1"; exit 2;;
  esac
done

MYSQL_BIN="mysql"
DUMP_BIN="mysqldump"

# Проверка наличия клиентов
if ! command -v "$MYSQL_BIN" >/dev/null 2>&1; then
  echo "[ERR] mysql client не найден. Установите MySQL Client и повторите." >&2
  exit 1
fi
if ! command -v "$DUMP_BIN" >/dev/null 2>&1; then
  echo "[ERR] mysqldump не найден. Установите MySQL Client и повторите." >&2
  exit 1
fi

# Подготовка пароля
PASS_ARGS=()
if [[ ${ASK_PASS} -eq 1 && -z "${MYSQL_PWD:-}" ]]; then
  # -p без значения попросит пароль интерактивно
  PASS_ARGS=(-p)
else
  # если задан MYSQL_PWD — не используем -p (mysql сам подхватит)
  PASS_ARGS=()
fi

# Быстрая проверка соединения
set +e
$MYSQL_BIN -h "$HOST" -P "$PORT" -u "$USER" "${PASS_ARGS[@]}" -e "SELECT 1;" >/dev/null 2>&1
RC=$?
set -e
if [[ $RC -ne 0 ]]; then
  echo "[ERR] Не удалось подключиться к MySQL на ${HOST}:${PORT} пользователем ${USER}." >&2
  echo "      Проверьте доступ и пароль (переменная MYSQL_PWD или интерактивный ввод)." >&2
  exit 1
fi

echo "[OK] Подключение к MySQL проверено."

# Бэкап
STAMP=$(date +%F_%H%M%S)
BACKUP_FILE="backup_${DB}_${STAMP}.sql"
echo "[RUN] Делаю дамп БД ${DB} -> ${BACKUP_FILE}"
$DUMP_BIN -h "$HOST" -P "$PORT" -u "$USER" "${PASS_ARGS[@]}" "$DB" > "$BACKUP_FILE"
echo "[OK] Бэкап готов: $BACKUP_FILE"

# Путь к миграциям
BASE_DIR=$(cd "$(dirname "$0")/.." && pwd)
MIG_DIR="$BASE_DIR/migrations"

# Миграции (безопасные)
SAFE1="$MIG_DIR/2025-10-21_add_period_to_objects_safe.sql"
SAFE2="$MIG_DIR/2025-10-21_alter_card_calc_add_object_fields.sql"
SAFE3="$MIG_DIR/2025-10-21_add_areaTable_if_missing.sql"
SAFE4="$MIG_DIR/2025-10-28_alter_objects_add_client_fields.sql"
SAFE5="$MIG_DIR/2025-11-02_alter_card_calc_add_status.sql"
SAFE6="$MIG_DIR/2025-11-02_alter_card_calc_add_period.sql"

run_sql() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo "[RUN] ${file}"
    $MYSQL_BIN -h "$HOST" -P "$PORT" -u "$USER" "${PASS_ARGS[@]}" "$DB" < "$file"
    echo "[OK] ${file}"
  else
    echo "[SKIP] Файл не найден: ${file}"
  fi
}

run_sql "$SAFE1"
run_sql "$SAFE2"
run_sql "$SAFE3"
run_sql "$SAFE4"
run_sql "$SAFE5"
run_sql "$SAFE6"

# Проверка схемы
echo "[RUN] Проверка схемы"
$MYSQL_BIN -h "$HOST" -P "$PORT" -u "$USER" "${PASS_ARGS[@]}" -e "USE ${DB}; DESCRIBE objects; DESCRIBE card_calc;" | sed 's/^/[SCHEMA] /'

echo "[DONE] Миграции применены успешно. Бэкап: ${BACKUP_FILE}"
