create table dog_votes
	(breed_id serial primary key,
     dog_breed varchar(255) not null,
     votes int not null default 0);