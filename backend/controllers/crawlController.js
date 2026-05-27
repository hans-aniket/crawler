const axios = require('axios');
const cheerio = require('cheerio');
const crawlModel = require('../models/crawlModel');
const { sendCrawlJob } = require('../services/sqsService');
const pool = require('../db');
const crawlPage = async (req, res) => {
  const { url, depth = 1 } = req.body;
  const userId = req.user.userId;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // 1. Create a crawl job
  let job;
  try {
    job = await crawlModel.createCrawlJob(userId, url, depth);
  } catch (error) {
    console.error('Error creating job:', error);
    return res.status(500).json({ error: 'Failed to create crawl job' });
  }

  try {
    // 2. Send job to SQS
    await sendCrawlJob({
      jobId: job.id,
      url: url,
      userId: userId
    });

    // 3. Return immediately
    return res.json({
      message: "Crawl job queued",
      jobId: job.id
    });
  } catch (error) {
    console.error('Error queueing job to SQS:', error);
    return res.status(500).json({ error: 'Failed to queue crawl job' });
  }
};

const executeCrawl = async (jobId, startUrl, userId) => {
  try {
    const job = await crawlModel.getJobById(jobId);
    if (!job) throw new Error('Job not found');
    
    const maxDepth = job.depth || 1;
    const MAX_PAGES = 50;
    
    // BFS Queue: { url, depth }
    const queue = [{ url: startUrl, depth: 1 }];
    const visited = new Set();
    
    let pagesCrawled = 0;
    let startDomain = '';
    try {
      startDomain = new URL(startUrl).hostname;
    } catch (e) {
      throw new Error('Invalid starting URL');
    }

    // Update job status to running
    await crawlModel.updateCrawlJobStatus(jobId, 'running');

    while (queue.length > 0 && pagesCrawled < MAX_PAGES) {
      const currentItem = queue.shift();
      const currentUrl = currentItem.url;
      const currentDepth = currentItem.depth;

      if (visited.has(currentUrl)) continue;

      // URL filtering
      if (
        currentUrl.includes('javascript:') ||
        currentUrl.includes('mailto:') ||
        currentUrl.includes('#') ||
        currentUrl.match(/\.(png|jpg|jpeg|gif|svg|pdf)$/i)
      ) {
        continue;
      }

      try {
        const urlObj = new URL(currentUrl);
        if (urlObj.hostname !== startDomain) {
          continue; // Skip external domains
        }
      } catch (e) {
        continue; // Invalid URL
      }

      visited.add(currentUrl);

      try {
        // Fetch webpage
        const response = await axios.get(currentUrl, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
          }
        });
        const html = response.data;

        // Parse HTML
        const $ = cheerio.load(html);
        const title = $('title').text() || 'No Title';
        
        // Remove unwanted elements
        $('script, style, nav, header, footer, aside, noscript').remove();
        $('.navbox').remove();
        $('.sidebar').remove();
        $('.metadata').remove();
        $('.mw-editsection').remove();
        $('.mw-jump-link').remove();
        $('.mw-navigation').remove();
        $('.toc').remove();
        $('.vector-header').remove();
        $('.vector-column-start').remove();
        $('.reflist').remove();
        $('.infobox').remove();
        $('.reference').remove();
        $('.references').remove();
        $('.thumb').remove();
        $('.hatnote').remove();
        $('.noprint').remove();
        $('.catlinks').remove();
        $('.mw-hidden-catlinks').remove();
        $('table').remove();

        // Extract sections with headings
        let contentContainer = null;
        const selectors = ['.mw-parser-output', 'article', 'main', '#content', 'body'];
        for (const selector of selectors) {
          const el = $(selector);
          if (el.length > 0 && el.text().trim()) {
            contentContainer = el;
            break;
          }
        }

        const sections = [];
        if (contentContainer) {
          let currentSection = { heading: 'Introduction', content: '' };
          
          contentContainer.children().each((_, child) => {
            const el = $(child);
            const tagName = (child.tagName || '').toLowerCase();
            const className = el.attr('class') || '';
            
            // Detect headings: raw h1/h2 OR Wikipedia's div.mw-heading1/2 wrappers
            const isRawHeading = ['h1','h2'].includes(tagName);
            const isWikiHeading = tagName === 'div' && /(mw-heading1|mw-heading2)\s/.test(className + ' ');
            
            if (isRawHeading || isWikiHeading) {
              // Save previous section if it has content
              if (currentSection.content.trim()) {
                sections.push({
                  heading: currentSection.heading,
                  content: currentSection.content
                    .replace(/\s+/g, ' ')
                    .replace(/[^\x20-\x7E]/g, ' ')
                    .trim()
                });
              }
              // For wiki headings, get the text of the inner h2/h3; strip [edit] suffix
              let headingText = el.text().trim().replace(/\[edit\]\s*$/i, '').trim();
              currentSection = { heading: headingText, content: '' };
            } else {
              const text = el.text().trim();
              if (text) {
                currentSection.content += ' ' + text;
              }
            }
          });
          
          // Push last section
          if (currentSection.content.trim()) {
            sections.push({
              heading: currentSection.heading,
              content: currentSection.content
                .replace(/\s+/g, ' ')
                .replace(/[^\x20-\x7E]/g, ' ')
                .trim()
            });
          }
        }

        // Store as JSON
        const content = JSON.stringify(sections);
        
        // Build flat text for word indexing from all sections
        const flatText = sections.map(s => s.heading + ' ' + s.content).join(' ');

        console.log("Sections extracted:", sections.length);
        console.log("Final content length:", content.length);

        // Stop-word filtering
        const stopWords = [
          "the","a","an","is","are","of","to",
          "in","for","on","by","and","or","as",
          "with","from","at","that","this","be",
          "it","was","were","has","have"
        ];
        
        let rawWords = flatText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        rawWords = rawWords.filter(word => word && !stopWords.includes(word));
        
        const wordFrequencies = {};
        rawWords.forEach(word => {
          wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
        });

        // Extract links
        const extractedLinks = [];
        $('a').each((i, link) => {
          let href = $(link).attr('href');
          if (href) {
            try {
              // Resolve relative URLs
              href = new URL(href, currentUrl).href;
              extractedLinks.push(href);
              
              // Queue for next depth if within maxDepth
              if (currentDepth < maxDepth) {
                queue.push({ url: href, depth: currentDepth + 1 });
              }
            } catch (e) {
              // ignore invalid links
            }
          }
        });

        const linksCount = extractedLinks.length;

        // Save extracted page info
        const savedPage = await crawlModel.savePage(jobId, currentUrl, title, content, linksCount);
        
        // Save links into page_links
        await crawlModel.savePageLinks(savedPage.id, extractedLinks);

        // Save word index
        await crawlModel.saveWordIndex(savedPage.id, wordFrequencies);

        pagesCrawled++;
        
      } catch (err) {
        console.error(`Failed to crawl ${currentUrl}:`, err.message);
        // Continue to next URL in queue
      }
    }

    // Update job status to completed
    await crawlModel.updateCrawlJobStatus(jobId, 'completed');

    return {
      message: 'Crawl finished successfully',
      pagesCrawled
    };

  } catch (error) {
    console.error('Crawling error:', error.message);
    // Update job status to failed
    await crawlModel.updateCrawlJobStatus(jobId, 'failed');
    throw new Error(error.message || 'Failed to execute crawl job');
  }
};

const getJobStatus = async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user.userId;

  try {
    const job = await crawlModel.getJobStatus(jobId, userId);
    
    console.log("Fetching job status:", jobId);
    console.log(job);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      id: job.id,
      status: job.status,
      pagesProcessed: parseInt(job.pages_processed, 10) || 0,
      maxPages: 50,
      title: job.title,
      linksCount: job.links_count,
      preview: (() => {
        try {
          const sections = JSON.parse(job.content);
          if (Array.isArray(sections) && sections.length > 0) {
            return sections[0].content.substring(0, 500);
          }
        } catch (e) {}
        return job.content ? job.content.substring(0, 500) : '';
      })()
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return res.status(500).json({ error: 'Failed to fetch job status' });
  }
};

const getRecentJobs = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
        `
        SELECT
            cj.id,
            cj.url,
            cj.status,
            cj.depth,
            cj.created_at,
            COUNT(p.id) AS pages_crawled
        FROM crawl_jobs cj
        LEFT JOIN pages p
        ON cj.id = p.job_id
        WHERE cj.user_id=$1
        GROUP BY cj.id
        ORDER BY cj.created_at DESC
        LIMIT 10
        `,
        [userId]
        );

        res.json(result.rows);

    } catch(err){
        console.error(err);
        res.status(500).json({
            error:'Failed to fetch crawl history'
        });
    }
};

const getAllJobs = async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const result = await pool.query(
        `
        SELECT
            cj.id,
            cj.url,
            cj.status,
            cj.depth,
            cj.created_at,
            COUNT(p.id) as pages_crawled
        FROM crawl_jobs cj
        LEFT JOIN pages p
        ON cj.id=p.job_id
        WHERE cj.user_id=$1
        GROUP BY cj.id
        ORDER BY cj.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [userId, limit, offset]
        );

        const countResult = await pool.query(
          `SELECT COUNT(*) as total FROM crawl_jobs WHERE user_id=$1`,
          [userId]
        );
        const totalCount = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(totalCount / limit) || 1;

        res.json({
            jobs: result.rows,
            totalPages,
            currentPage: page
        });

    } catch(err) {
        console.error(err);
        res.status(500).json({
            error:'Failed to fetch jobs'
        });
    }
};

const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const analyticsData = await crawlModel.getAnalytics(userId);
    res.json(analyticsData);
  } catch(error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch crawl analytics' });
  }
};

module.exports = {
  crawlPage,
  executeCrawl,
  getJobStatus,
  getRecentJobs,
  getAllJobs,
  getAnalytics
};
