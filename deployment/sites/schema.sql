-- Reference schema for the Sites port; generate equivalent Drizzle migrations
-- after copying these definitions into the Sites starter's db/schema.ts.
CREATE TABLE party_documents (
  code TEXT PRIMARY KEY NOT NULL CHECK(length(code)=4 AND code NOT GLOB '*[^0-9]*'),
  revision INTEGER NOT NULL DEFAULT 0,
  document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE party_questions (
  id TEXT PRIMARY KEY NOT NULL,
  document TEXT NOT NULL CHECK(json_valid(document))
);
