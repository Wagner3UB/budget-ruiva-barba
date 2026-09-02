-- Migração 21: carimbo de lote no import (permite "desfazer último import")
alter table expenses add column if not exists import_batch text;
alter table incomes  add column if not exists import_batch text;
