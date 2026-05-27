const pool = require('../db');

const createCrawlJob = async (userId, url, depth) => {
  const result = await pool.query(
    `INSERT INTO crawl_jobs (user_id, url, depth, status) 
     VALUES ($1, $2, $3, 'pending') 
     RETURNING *`,
    [userId, url, depth]
  );
  return result.rows[0];
};

const updateCrawlJobStatus = async (jobId, status) => {
  const result = await pool.query(
    `UPDATE crawl_jobs 
     SET status = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2 
     RETURNING *`,
    [status, jobId]
  );
  return result.rows[0];
};

const savePage = async (jobId, url, title, content, linksCount) => {
  const existing = await pool.query(`SELECT id FROM pages WHERE url = $1`, [url]);
  
  if (existing.rows.length > 0) {
    const pageId = existing.rows[0].id;
    const result = await pool.query(
      `UPDATE pages 
       SET job_id = $1, title = $2, content = $3, links_count = $4, crawled_at = CURRENT_TIMESTAMP
       WHERE id = $5 
       RETURNING *`,
      [jobId, title, content, linksCount, pageId]
    );
    return result.rows[0];
  } else {
    const result = await pool.query(
      `INSERT INTO pages (job_id, url, title, content, links_count) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [jobId, url, title, content, linksCount]
    );
    return result.rows[0];
  }
};

const savePageLinks = async (pageId, links) => {
  if (!links || links.length === 0) return;
  
  await pool.query(`DELETE FROM page_links WHERE page_id = $1`, [pageId]);
  
  const values = [];
  const params = [];
  
  links.forEach((link, index) => {
    values.push(`($1, $${index + 2})`);
    params.push(link);
  });
  
  const query = `INSERT INTO page_links (page_id, link_url) VALUES ${values.join(', ')}`;
  await pool.query(query, [pageId, ...params]);
};

const saveWordIndex = async (pageId, wordFrequencies) => {
  const entries = Object.entries(wordFrequencies);
  if (entries.length === 0) return;

  await pool.query(`DELETE FROM word_index WHERE page_id = $1`, [pageId]);

  const values = [];
  const params = [];
  
  entries.forEach(([word, freq], index) => {
    values.push(`($1, $${index * 2 + 2}, $${index * 2 + 3})`);
    params.push(word, freq);
  });
  
  // Use ON CONFLICT DO NOTHING just in case, though it shouldn't happen per page crawl
  const query = `
    INSERT INTO word_index (page_id, word, frequency) 
    VALUES ${values.join(', ')}
    ON CONFLICT (word, page_id) DO UPDATE SET frequency = EXCLUDED.frequency
  `;
  
  await pool.query(query, [pageId, ...params]);
};

const getJobStatus = async (jobId, userId) => {
  const result = await pool.query(
    `SELECT c.id, c.status, p.title, p.links_count, p.content,
            (SELECT COUNT(*) FROM pages WHERE job_id = c.id) as pages_processed
     FROM crawl_jobs c
     LEFT JOIN pages p ON c.id = p.job_id AND p.url = c.url
     WHERE c.id = $1 AND c.user_id = $2`,
    [jobId, userId]
  );
  return result.rows[0];
};

const getJobById = async (jobId) => {
  const result = await pool.query(`SELECT * FROM crawl_jobs WHERE id = $1`, [jobId]);
  return result.rows[0];
};

const getAnalytics = async (userId) => {
  const jobsStats = await pool.query(`
    SELECT 
      COUNT(id) as total_jobs,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
      COALESCE(AVG(depth), 1) as average_depth
    FROM crawl_jobs
    WHERE user_id = $1
  `, [userId]);

  const pagesStats = await pool.query(`
    SELECT COUNT(p.id) as total_pages
    FROM pages p
    JOIN crawl_jobs c ON c.id = p.job_id
    WHERE c.user_id = $1
  `, [userId]);

  const topDomains = await pool.query(`
    SELECT 
      split_part(regexp_replace(url, '^https?://(www\\.)?', ''), '/', 1) as domain,
      COUNT(*) as count
    FROM crawl_jobs
    WHERE user_id = $1
    GROUP BY domain
    ORDER BY count DESC
    LIMIT 5
  `, [userId]);

  const totalJobs = parseInt(jobsStats.rows[0].total_jobs, 10) || 0;
  const totalPagesIndexed = parseInt(pagesStats.rows[0].total_pages, 10) || 0;
  const completedJobs = parseInt(jobsStats.rows[0].completed_jobs, 10) || 0;
  const failedJobs = parseInt(jobsStats.rows[0].failed_jobs, 10) || 0;
  const averageDepth = parseFloat(jobsStats.rows[0].average_depth) || 0;
  
  const averagePagesPerJob = totalJobs > 0 ? (totalPagesIndexed / totalJobs) : 0;

  return {
    totalJobs,
    totalPagesIndexed,
    averagePagesPerJob: averagePagesPerJob.toFixed(1),
    completedJobs,
    failedJobs,
    averageDepth: averageDepth.toFixed(1),
    topDomains: topDomains.rows.map(r => ({ domain: r.domain, count: parseInt(r.count, 10) }))
  };
};

module.exports = {
  createCrawlJob,
  updateCrawlJobStatus,
  savePage,
  savePageLinks,
  saveWordIndex,
  getJobStatus,
  getJobById,
  getAnalytics
};
