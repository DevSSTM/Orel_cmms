-- The foundation tables are protected by row-level security. Allow signed-in
-- users to access the schema through the Data API; individual table grants and
-- policies in the foundation migration still determine what they can do.
grant usage on schema public to authenticated;
