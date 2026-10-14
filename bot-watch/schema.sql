CREATE TABLE IF NOT EXISTS daily (
 app TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('web','discord')),
 day TEXT NOT NULL, launches INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(app,source,day)
);
CREATE TABLE IF NOT EXISTS sessions (
 app TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('web','discord')),
 sid TEXT NOT NULL, seen INTEGER NOT NULL,
 PRIMARY KEY(app,source,sid)
);
CREATE INDEX IF NOT EXISTS sessions_seen ON sessions(seen);
