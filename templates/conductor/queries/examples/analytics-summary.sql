-- Analytics Summary Query
-- Aggregate metrics for a date range
--
-- Parameters:
--   :startDate (string) - Start date (YYYY-MM-DD)
--   :endDate (string) - End date (YYYY-MM-DD)
--   :groupBy (string) - Grouping dimension (day, week, month)
--
-- Usage in member.yaml:
--   query:
--     component: queries/analytics-summary.sql
--     binding: ANALYTICS_DB
--   params:
--     startDate: "{{input.startDate}}"
--     endDate: "{{input.endDate}}"
--     groupBy: "day"

SELECT
  DATE(event_time) as date,
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(value) as avg_value,
  SUM(value) as total_value
FROM events
WHERE
  event_time >= :startDate
  AND event_time <= :endDate
GROUP BY
  DATE(event_time),
  event_type
ORDER BY
  date DESC,
  event_count DESC;
