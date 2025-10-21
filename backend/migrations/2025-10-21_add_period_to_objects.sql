-- Добавить период действия (месяц/год) к объектам
ALTER TABLE `objects`
  ADD COLUMN IF NOT EXISTS `periodMonth` TINYINT NULL,
  ADD COLUMN IF NOT EXISTS `periodYear` SMALLINT NULL;
