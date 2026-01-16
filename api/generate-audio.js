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
    const { elevenLabsKey, text } = req.body;

    console.log('Received request:', {
      hasKey: !!elevenLabsKey,
      textLength: text?.length
    });

    if (!elevenLabsKey || !text) {
      return res.status(400).json({ error: 'Missing required parameters: elevenLabsKey or text' });
    }

    console.log('Calling ElevenLabs API...');
    
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        },
      }),
    });

    console.log('ElevenLabs response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', errorText);
      return res.status(response.status).json({ 
        error: `ElevenLabs API error (${response.status}): ${errorText}`,
        details: errorText 
      });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    console.log('Audio generated successfully, size:', base64Audio.length);

    return res.status(200).json({ audio: base64Audio });

  } catch (error) {
    console.error('Error in generate-audio:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
