// Save this as: api/scrape-webpage.js

const { JSDOM } = require('jsdom');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    console.log('Fetching URL:', url);

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PodcastBot/1.0)',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Failed to fetch URL: ${response.statusText}` 
      });
    }

    const html = await response.text();
    
    // Parse HTML and extract text content
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, nav, footer, header');
    scripts.forEach(el => el.remove());

    // Try to find the main content area
    let content = '';
    
    // Look for common article containers
    const articleSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
    ];

    let mainElement = null;
    for (const selector of articleSelectors) {
      mainElement = document.querySelector(selector);
      if (mainElement) break;
    }

    // If found, extract from that element, otherwise use body
    const targetElement = mainElement || document.body;
    
    // Extract text content
    content = targetElement.textContent || '';
    
    // Clean up the content
    content = content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Remove excessive newlines
      .trim();

    if (!content || content.length < 100) {
      return res.status(400).json({ 
        error: 'Could not extract meaningful content from the webpage' 
      });
    }

    console.log('Content extracted, length:', content.length);

    return res.status(200).json({ 
      content,
      url,
      length: content.length 
    });

  } catch (error) {
    console.error('Error scraping webpage:', error);
    return res.status(500).json({ 
      error: error.message,
      details: 'Failed to scrape webpage. Make sure the URL is accessible and valid.' 
    });
  }
};
