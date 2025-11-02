-- Safe migration: add address, contacts, clientCompany to objects if missing

SET @db := DATABASE();

-- address
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'objects' AND COLUMN_NAME = 'address'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE objects ADD COLUMN address VARCHAR(255) NULL AFTER name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'objects' AND COLUMN_NAME = 'contacts'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE objects ADD COLUMN contacts VARCHAR(255) NULL AFTER address',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- clientCompany (legal entity)
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'objects' AND COLUMN_NAME = 'clientCompany'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE objects ADD COLUMN clientCompany VARCHAR(255) NULL AFTER contacts',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
