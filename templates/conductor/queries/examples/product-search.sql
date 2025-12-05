-- Product Search Query
-- Full-text search with filtering and pagination
--
-- Parameters:
--   :searchTerm (string) - Search term for name/description
--   :category (string, optional) - Product category
--   :minPrice (number, optional) - Minimum price
--   :maxPrice (number, optional) - Maximum price
--   :inStock (boolean) - Only show in-stock items
--   :limit (number) - Results per page
--   :offset (number) - Pagination offset
--
-- Usage in member.yaml:
--   query:
--     component: queries/product-search.sql
--     binding: DB
--   params:
--     searchTerm: "{{input.query}}"
--     category: "{{input.category}}"
--     minPrice: "{{input.priceRange.min}}"
--     maxPrice: "{{input.priceRange.max}}"
--     inStock: true
--     limit: 20
--     offset: "{{input.page * 20}}"

SELECT
  id,
  name,
  description,
  price,
  category,
  inventory_count,
  rating,
  review_count,
  image_url
FROM products
WHERE
  (name LIKE '%' || :searchTerm || '%' OR description LIKE '%' || :searchTerm || '%')
  AND (category = :category OR :category IS NULL)
  AND (price >= :minPrice OR :minPrice IS NULL)
  AND (price <= :maxPrice OR :maxPrice IS NULL)
  AND (inventory_count > 0 OR :inStock = FALSE)
ORDER BY
  rating DESC,
  review_count DESC
LIMIT :limit
OFFSET :offset;
