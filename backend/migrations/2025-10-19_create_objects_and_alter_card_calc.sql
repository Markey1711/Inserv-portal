-- Создать таблицу objects и добавить поля в card_calc
-- Запустите этот файл в вашей MySQL базе (например: mysql -u root -p tmcdb < ...)

-- 1) Создаём таблицу объектов
CREATE TABLE IF NOT EXISTS `objects` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `codeBase` INT NOT NULL UNIQUE,       -- уникальный числовой код объекта (1,2,3...)
  `name` VARCHAR(255) NOT NULL UNIQUE, -- уникальное название объекта
  `calcCount` INT NOT NULL DEFAULT 0,  -- кол-во расчётов для этого объекта
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Добавляем поля в card_calc: objectId и objectCodeFull
ALTER TABLE `card_calc`
  ADD COLUMN IF NOT EXISTS `objectId` INT NULL,
  ADD COLUMN IF NOT EXISTS `objectCodeFull` VARCHAR(64) NULL;

-- 3) (опционально) FK — если хотите включить foreign key, раскомментируйте:
-- ALTER TABLE `card_calc`
--   ADD CONSTRAINT `fk_card_calc_object` FOREIGN KEY (`objectId`) REFERENCES `objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;