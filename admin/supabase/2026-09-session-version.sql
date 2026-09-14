-- Session version: invalidace starých session po změě hesla.
alter table customers
  add column if not exists session_version int not null default 1;
