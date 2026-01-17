// Save this as: api/parse-ppt.js

const officegen = require('officegen');
const JSZip = require('jszip');
const { DOMParser } = require('xmldom');

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
    zip.forEach((relativePath, file) => {
      if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
        slideFiles.push({ path: relativePath, file });
      }
    });
    
    // Sort slides by number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.path.match(/slide(\d+)\.xml/)[1]);
      const numB = parseInt(b.path.match(/slide(\d+)\.xml/)[1]);
      return numA - numB;
    });
    
    // Extract text from each slide
    for (const slideFile of slideFiles) {
      const slideXml = await slideFile.file.async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXml, 'text/xml');
      
      // Extract all text elements
      const textElements = xmlDoc.getElementsByTagName('a:t');
      const slideTexts = [];
      
      for (let i = 0; i < textElements.length; i++) {
        const text = textElements[i].textContent.trim();
        if (text) {
          slideTexts.push(text);
        }
      }
      
      if (slideTexts.length > 0) {
        fullText += slideTexts.join(' ') + '\n\n';
      }
    }
    
    if (!fullText.trim()) {
      return res.status(400).json({ 
        error: 'No text content found in PowerPoint file' 
      });
    }

    console.log('Extracted text length:', fullText.length);

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
