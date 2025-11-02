-- Safe migration: add 'status' column to card_calc if missing
-- Will not fail if column already exists

DELIMITER $$
DROP PROCEDURE IF EXISTS add_status_to_card_calc_if_missing $$
CREATE PROCEDURE add_status_to_card_calc_if_missing()
BEGIN
  DECLARE col_count INT DEFAULT 0;
  SELECT COUNT(*) INTO col_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'card_calc'
    AND COLUMN_NAME = 'status';

  IF col_count = 0 THEN
    SET @sql := 'ALTER TABLE card_calc ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT ''draft'' AFTER customer';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
CALL add_status_to_card_calc_if_missing() $$
DROP PROCEDURE add_status_to_card_calc_if_missing $$
DELIMITER ;

-- Optional: ensure default values for status
UPDATE card_calc SET status = 'draft' WHERE status IS NULL;
