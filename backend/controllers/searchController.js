const searchModel = require('../models/searchModel');

const findMatchedSection = (contentStr, keyword) => {
  let sections;
  try {
    sections = JSON.parse(contentStr);
  } catch (e) {
    // Fallback for old non-JSON content
    return {
      sectionTitle: 'Content',
      preview: contentStr ? contentStr.substring(0, 300) : '',
      fullContent: contentStr || ''
    };
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    return { sectionTitle: 'Content', preview: '', fullContent: '' };
  }

  const kw = keyword.toLowerCase();

  // 1. Check section headings first
  for (const section of sections) {
    if (section.heading && section.heading.toLowerCase().includes(kw)) {
      return {
        sectionTitle: section.heading,
        preview: section.content.substring(0, 300),
        fullContent: section.content
      };
    }
  }

  // 2. Check section content
  for (const section of sections) {
    if (section.content && section.content.toLowerCase().includes(kw)) {
      const pos = section.content.toLowerCase().indexOf(kw);
      const start = Math.max(pos - 100, 0);
      return {
        sectionTitle: section.heading,
        preview: section.content.substring(start, start + 300),
        fullContent: section.content
      };
    }
  }

  // 3. Fallback to first section
  return {
    sectionTitle: sections[0].heading,
    preview: sections[0].content.substring(0, 300),
    fullContent: sections[0].content
  };
};

const search = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Search keyword is required' });
    }

    const keyword = q.toLowerCase().replace(/[^\w\s]/g, '').trim();

    if (!keyword) {
      return res.status(400).json({ error: 'Invalid search keyword' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { rows, totalCount } = await searchModel.searchByKeyword(keyword, limit, offset);

    // Map to expected response format with section-aware results
    const formattedResults = rows.map(row => {
      const matched = findMatchedSection(row.fullcontent, keyword);
      return {
        title: row.title || 'No Title',
        url: row.url,
        score: row.score,
        sectionTitle: matched.sectionTitle,
        preview: matched.preview,
        fullContent: matched.fullContent
      };
    });

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.json({
      results: formattedResults,
      totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Server error during search' });
  }
};

module.exports = {
  search
};
