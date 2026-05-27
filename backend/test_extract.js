const cheerio = require('cheerio');
const axios = require('axios');

(async () => {
  const response = await axios.get('https://en.wikipedia.org/wiki/Expressways_of_India', {
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5"
    }
  });
  const $ = cheerio.load(response.data);
  
  $('script, style, nav, header, footer, aside, noscript').remove();
  $('.navbox, .sidebar, .metadata, .mw-editsection, .mw-jump-link, .mw-navigation, .toc').remove();
  $('.vector-header, .vector-column-start, .reflist').remove();
  $('.infobox, .reference, .references, .thumb, .hatnote, .noprint, .catlinks, .mw-hidden-catlinks').remove();
  $('table').remove();

  const container = $('.mw-parser-output');
  
  const sections = [];
  let currentSection = { heading: 'Introduction', content: '' };
  
  container.children().each((_, child) => {
    const el = $(child);
    const tagName = (child.tagName || '').toLowerCase();
    const className = el.attr('class') || '';
    
    // Only split on h1 and h2 (mw-heading1, mw-heading2)
    const isRawHeading = ['h1','h2'].includes(tagName);
    const isWikiHeading = tagName === 'div' && /(mw-heading1|mw-heading2)\s/.test(className + ' ');
    
    if (isRawHeading || isWikiHeading) {
      if (currentSection.content.trim()) {
        sections.push({
          heading: currentSection.heading,
          content: currentSection.content.replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, ' ').trim()
        });
      }
      let headingText = el.text().trim().replace(/\[edit\]\s*$/i, '').trim();
      currentSection = { heading: headingText, content: '' };
    } else {
      const text = el.text().trim();
      if (text) {
        currentSection.content += ' ' + text;
      }
    }
  });
  
  if (currentSection.content.trim()) {
    sections.push({
      heading: currentSection.heading,
      content: currentSection.content.replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, ' ').trim()
    });
  }

  console.log('Sections extracted:', sections.length);
  console.log('\n--- Section headings ---');
  sections.forEach((s, i) => {
    console.log(`[${i}] "${s.heading}" (${s.content.length} chars)`);
  });
})();
