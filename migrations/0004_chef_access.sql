CREATE TABLE pos_chef_access (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  salt TEXT NOT NULL,
  digest TEXT NOT NULL
);
