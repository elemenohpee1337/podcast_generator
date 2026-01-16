// Save this as: api/generate-audio.js

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
    const { speechifyKey, text } = req.body;

    console.log('Received request:', {
      hasKey: !!speechifyKey,
      textLength: text?.length
    });

    if (!speechifyKey || !text) {
      return res.status(400).json({ error: 'Missing required parameters: speechifyKey or text' });
    }

    console.log('Calling Speechify API...');
    
    const response = await fetch('https://api.sws.speechify.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${speechifyKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        voice_id: 'henry',
        audio_format: 'mp3',
        model: 'simba-english',
      }),
    });

    console.log('Speechify response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Speechify error:', errorText);
      return res.status(response.status).json({ 
        error: `Speechify API error (${response.status}): ${errorText}`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Speechify data received:', !!data.audio_data);
    
    if (!data.audio_data) {
      return res.status(500).json({ error: 'No audio data received from Speechify' });
    }

    return res.status(200).json({ audio: data.audio_data });

  } catch (error) {
    console.error('Error in generate-audio:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
