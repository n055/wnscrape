create table flights (
  id integer primary key,
  orig text not null,
  dest text not null,
  depart text not null,
  arrive text not null,
  flightnums text not null,
  unique (orig, dest, depart, arrive, flightnums)
);
create table prices (
  id integer,
  price integer,
  scrapedate text,
  foreign key (id) references flights (id)
);

create table tracked_flights (
  orig text not null,
  dest text not null,
  departdate text not null,
  leaveafter text,
  arrivebefore text
)