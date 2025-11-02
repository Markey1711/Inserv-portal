-- Safe migration: add periodMonth and periodYear to card_calc if missing

DELIMITER $$
DROP PROCEDURE IF EXISTS add_period_fields_to_card_calc $$
CREATE PROCEDURE add_period_fields_to_card_calc()
BEGIN
  DECLARE c1 INT DEFAULT 0;
  DECLARE c2 INT DEFAULT 0;

  SELECT COUNT(*) INTO c1 FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'card_calc' AND COLUMN_NAME = 'periodMonth';
  IF c1 = 0 THEN
    SET @sql1 := 'ALTER TABLE card_calc ADD COLUMN periodMonth TINYINT NULL AFTER customer';
    PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;
  END IF;

  SELECT COUNT(*) INTO c2 FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'card_calc' AND COLUMN_NAME = 'periodYear';
  IF c2 = 0 THEN
    SET @sql2 := 'ALTER TABLE card_calc ADD COLUMN periodYear SMALLINT NULL AFTER periodMonth';
    PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;
  END IF;
END $$
CALL add_period_fields_to_card_calc() $$
DROP PROCEDURE add_period_fields_to_card_calc $$
DELIMITER ;
