-- Создаём PostgreSQL функцию, которая использует WITH RECURSIVE
-- для построения семейного дерева по wedding_id и опционально member_id.
-- Эту функцию можно вызывать напрямую из любого SQL-клиента (psql, DBeaver, Postman raw SQL).

CREATE OR REPLACE FUNCTION get_family_tree_recursive(
  p_wedding_id INTEGER,
  p_member_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
  id INTEGER,
  wedding_id INTEGER,
  member_id INTEGER,
  ancestor_id INTEGER,
  member_name TEXT,
  member_email TEXT,
  kinship_rank TEXT,
  custom_distance INTEGER,
  gift_obligation INTEGER,
  level BIGINT,
  lineage TEXT
)
LANGUAGE SQL
STABLE
AS $$
  WITH RECURSIVE family_hierarchy AS (
    -- Базовый случай: корневые элементы (нет ancestor_id)
    SELECT
      ft.id,
      ft.wedding_id,
      ft.member_id,
      ft.ancestor_id,
      u.full_name AS member_name,
      u.email AS member_email,
      ft.kinship_rank::TEXT,
      ft.custom_distance,
      ft.gift_obligation,
      0::BIGINT AS level,
      ARRAY[ft.member_id] AS path,
      ARRAY[u.full_name] AS path_names
    FROM family_trees ft
    JOIN users u ON u.id = ft.member_id
    WHERE ft.wedding_id = p_wedding_id
      AND ft.ancestor_id IS NULL
      AND (p_member_id IS NULL OR ft.member_id = p_member_id)

    UNION ALL

    -- Рекурсивный шаг: присоединяем детей
    SELECT
      ft.id,
      ft.wedding_id,
      ft.member_id,
      ft.ancestor_id,
      u.full_name,
      u.email,
      ft.kinship_rank::TEXT,
      ft.custom_distance,
      ft.gift_obligation,
      fh.level + 1,
      fh.path || ft.member_id,
      fh.path_names || u.full_name
    FROM family_trees ft
    JOIN users u ON u.id = ft.member_id
    JOIN family_hierarchy fh ON fh.member_id = ft.ancestor_id
    WHERE ft.wedding_id = p_wedding_id
      AND NOT (ft.member_id = ANY(fh.path))
  )
  SELECT
    fh.id,
    fh.wedding_id,
    fh.member_id,
    fh.ancestor_id,
    fh.member_name,
    fh.member_email,
    fh.kinship_rank,
    fh.custom_distance,
    fh.gift_obligation,
    fh.level,
    array_to_string(fh.path_names, ' → ') AS lineage
  FROM family_hierarchy fh
  ORDER BY fh.level, fh.member_name;
$$;

COMMENT ON FUNCTION get_family_tree_recursive(INTEGER, INTEGER) IS
  'Строит иерархию семейного дерева через WITH RECURSIVE. Принимает wedding_id и опциональный member_id (корень поддерева). Возвращает уровни, lineage (путь предков), ранги и обязательства.';
