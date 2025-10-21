-- Safely add areaTable JSON column to card_calc if missing

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'card_calc'
);

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'card_calc' AND column_name = 'areaTable'
);

SET @ddl := IF(@tbl_exists = 1 AND @col_exists = 0,
  'ALTER TABLE `card_calc` ADD COLUMN `areaTable` JSON',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
