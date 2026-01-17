// Save this as: api/parse-ppt.js

const JSZip = require('jszip');

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
    const { data, filename } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Missing PowerPoint data' });
    }

    console.log('Parsing PowerPoint file:', filename);

    // Decode base64 to buffer
    const buffer = Buffer.from(data, 'base64');
    
    // Load the PPTX file as a ZIP
    const zip = await JSZip.loadAsync(buffer);
    
    let fullText = '';
    const slideFiles = [];
    
    // Find all slide XML files
    Object.keys(zip.files).forEach((filename) => {
      if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
        slideFiles.push({ path: filename, file: zip.files[filename] });
      }
    });
    
    // Sort slides by number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.path.match(/slide(\d+)\.xml/)?.[1] || 0);
      const numB = parseInt(b.path.match(/slide(\d+)\.xml/)?.[1] || 0);
      return numA - numB;
    });
    
    // Extract text from each slide
    for (const slideFile of slideFiles) {
      const slideXml = await slideFile.file.async('string');
      
      // Extract all text between <a:t> tags using regex
      const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g);
      
      if (textMatches) {
        const slideTexts = textMatches.map(match => {
          const text = match.replace(/<a:t>|<\/a:t>/g, '').trim();
          return text;
        }).filter(text => text.length > 0);
        
        if (slideTexts.length > 0) {
          fullText += slideTexts.join(' ') + '\n\n';
        }
      }
    }
    
    if (!fullText.trim()) {
      return res.status(400).json({ 
        error: 'No text content found in PowerPoint file' 
      });
    }

    console.log('Extracted text from', slideFiles.length, 'slides, length:', fullText.length);

    return res.status(200).json({ 
      text: fullText.trim(),
      slideCount: slideFiles.length
    });

  } catch (error) {
    console.error('Error parsing PowerPoint:', error);
    return res.status(500).json({ 
      error: error.message,
      details: 'Failed to parse PowerPoint file. Make sure it is a valid PPTX file.' 
    });
  }
};
