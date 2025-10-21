-- Safely add objectId and objectCodeFull to card_calc if missing
-- This script is idempotent and won't fail if columns exist or table missing.

-- Check table exists
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'card_calc'
);

-- Add objectId if missing
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'card_calc' AND column_name = 'objectId'
);
SET @ddl := IF(@tbl_exists = 1 AND @col_exists = 0,
  'ALTER TABLE `card_calc` ADD COLUMN `objectId` INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add objectCodeFull if missing
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'card_calc' AND column_name = 'objectCodeFull'
);
SET @ddl := IF(@tbl_exists = 1 AND @col_exists = 0,
  'ALTER TABLE `card_calc` ADD COLUMN `objectCodeFull` VARCHAR(64) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
