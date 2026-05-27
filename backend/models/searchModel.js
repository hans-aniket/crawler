const pool = require('../db');

const searchByKeyword = async (keyword, limit = 10, offset = 0) => {
  const query = `
    WITH matched_pages AS (
      SELECT
        p.id,
        p.title,
        p.url,
        p.content,
        MAX(w.frequency) as freq
      FROM word_index w
      JOIN pages p ON p.id = w.page_id
      WHERE LOWER(w.word) = LOWER($1)
      GROUP BY p.id
    )
    SELECT
      id,
      title,
      url,
      content AS fullcontent,
      freq
      +
      CASE
          WHEN LOWER(title)=LOWER($1) THEN 100
          WHEN LOWER(title) LIKE '%' || LOWER($1) || '%' THEN 50
          ELSE 0
      END
      +
      CASE
          WHEN content LIKE '[{%' AND EXISTS (
              SELECT 1 FROM jsonb_array_elements((CASE WHEN content LIKE '[{%' THEN content ELSE '[]' END)::jsonb) AS elem
              WHERE LOWER(elem->>'heading') = LOWER($1)
          ) THEN 40
          WHEN content LIKE '[{%' AND EXISTS (
              SELECT 1 FROM jsonb_array_elements((CASE WHEN content LIKE '[{%' THEN content ELSE '[]' END)::jsonb) AS elem
              WHERE LOWER(elem->>'heading') LIKE '%' || LOWER($1) || '%'
          ) THEN 25
          ELSE 0
      END AS score
    FROM matched_pages
    ORDER BY score DESC
    LIMIT $2 OFFSET $3;
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT p.id) as total
    FROM word_index w
    JOIN pages p
      ON p.id = w.page_id
    WHERE LOWER(w.word)=LOWER($1)
  `;

  const result = await pool.query(query, [keyword, limit, offset]);
  const countResult = await pool.query(countQuery, [keyword]);
  const totalCount = parseInt(countResult.rows[0].total, 10);

  return { rows: result.rows, totalCount };
};

module.exports = {
  searchByKeyword
};