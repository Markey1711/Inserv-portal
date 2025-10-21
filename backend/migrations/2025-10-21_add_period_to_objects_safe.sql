-- Safely add periodMonth and periodYear to objects, create table if missing

-- Create objects table if not exists
CREATE TABLE IF NOT EXISTS `objects` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `codeBase` INT NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `calcCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add periodMonth if missing
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'objects' AND column_name = 'periodMonth'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `objects` ADD COLUMN `periodMonth` TINYINT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add periodYear if missing
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'objects' AND column_name = 'periodYear'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `objects` ADD COLUMN `periodYear` SMALLINT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
