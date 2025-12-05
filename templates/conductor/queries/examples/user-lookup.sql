-- User Lookup Query
-- Find users by email or ID with optional filtering
--
-- Parameters:
--   :email (string, optional) - User email address
--   :userId (string, optional) - User ID
--   :status (string, optional) - Account status filter
--
-- Usage in member.yaml:
--   query:
--     component: queries/user-lookup.sql
--     binding: DB
--   params:
--     email: "{{input.email}}"
--     userId: "{{input.userId}}"
--     status: "active"

SELECT
  id,
  email,
  name,
  status,
  created_at,
  last_login
FROM users
WHERE
  (email = :email OR :email IS NULL)
  AND (id = :userId OR :userId IS NULL)
  AND (status = :status OR :status IS NULL)
ORDER BY created_at DESC
LIMIT 100;
