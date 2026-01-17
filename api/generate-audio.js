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

    // Parse script to identify speakers and their lines
    const lines = text.split('\n').filter(line => line.trim());
    const segments = [];
    
    // Voice mapping for different speakers
    const voiceMap = {
      'lily': '21m00Tcm4TlvDq8ikWAM', // Lily
      'simon': 'rIiq4A6kQujGi4SUmYhQ', // Simon
      'host 1': '21m00Tcm4TlvDq8ikWAM', // Lily (fallback)
      'host 2': 'rIiq4A6kQujGi4SUmYhQ', // Simon (fallback)
      'narrator': '21m00Tcm4TlvDq8ikWAM', // Lily
      'interviewer': 'rIiq4A6kQujGi4SUmYhQ', // Simon
      'expert': '21m00Tcm4TlvDq8ikWAM', // Lily
      'default': '21m00Tcm4TlvDq8ikWAM' // Default voice
    };

    // Parse each line to extract speaker and content
    for (const line of lines) {
      // Skip lines that are purely stage directions (in brackets or asterisks)
      if (line.match(/^\s*[\[\*]+.*[\]\*]+\s*$/)) {
        continue;
      }
      
      // Skip markdown headers
      if (line.match(/^#+\s/)) {
        continue;
      }
      
      const speakerMatch = line.match(/^\*?\*?(.*?):\*?\*?\s*(.+)$/);
      if (speakerMatch) {
        const speaker = speakerMatch[1].toLowerCase().trim();
        
        // Skip if the speaker label itself is a stage direction
        if (speaker.match(/[\[\]]/)) {
          continue;
        }
        
        let content = speakerMatch[2].trim();
        
        // Remove stage directions in square brackets only: [SOUND EFFECT: ...], [INTRO MUSIC: ...]
        content = content.replace(/\[[^\]]+\]/g, '');
        
        // Remove stage directions in asterisks ONLY if they look like actions (multiple words, descriptive)
        // This preserves emphasis like *the* or *an* but removes *laughs*, *dramatic pause*, etc.
        content = content.replace(/\*([a-z\s]{2,})\*/gi, (match, inner) => {
          // If it's 2+ words or looks like an action, remove it
          if (inner.trim().split(/\s+/).length > 1 || inner.match(/laugh|pause|sigh|chuckle|gasp/i)) {
            return '';
          }
          // Otherwise keep it (it's emphasis)
          return match;
        });
        
        // Remove double asterisks for bold (but keep the text)
        content = content.replace(/\*\*([^*]+)\*\*/g, '$1');
        
        content = content.trim();
        
        // Skip empty lines after removing stage directions
        if (!content) continue;
        
        // Find matching voice
        let voiceId = voiceMap.default;
        for (const [key, value] of Object.entries(voiceMap)) {
          if (speaker.includes(key)) {
            voiceId = value;
            break;
          }
        }
        
        segments.push({ voiceId, text: content });
      } else if (line.trim() && !line.match(/^\s*[\[\*]/)) {
        // No speaker label, use default voice (but skip stage direction lines)
        let content = line.trim();
        
        // Remove stage directions
        content = content.replace(/\[[^\]]+\]/g, '');
        content = content.replace(/\*([a-z\s]{2,})\*/gi, (match, inner) => {
          if (inner.trim().split(/\s+/).length > 1 || inner.match(/laugh|pause|sigh|chuckle|gasp/i)) {
            return '';
          }
          return match;
        });
        content = content.replace(/\*\*([^*]+)\*\*/g, '$1');
        content = content.trim();
        
        if (content) {
          segments.push({ voiceId: voiceMap.default, text: content });
        }
      }
    }

    console.log(`Parsed ${segments.length} segments from script`);

    // Generate audio for each segment
    const audioSegments = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      console.log(`Generating audio for segment ${i + 1}/${segments.length} with voice ${segment.voiceId}`);
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${segment.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey,
        },
        body: JSON.stringify({
          text: segment.text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs error for segment ${i}:`, errorText);
        return res.status(response.status).json({ 
          error: `ElevenLabs API error (${response.status}): ${errorText}`,
          details: errorText 
        });
      }

      const audioBuffer = await response.arrayBuffer();
      audioSegments.push(Buffer.from(audioBuffer));
    }

    // Concatenate all audio segments
    const fullAudio = Buffer.concat(audioSegments);
    const base64Audio = fullAudio.toString('base64');
    
    console.log('Audio generated successfully, total size:', base64Audio.length);

    return res.status(200).json({ audio: base64Audio });

  } catch (error) {
    console.error('Error in generate-audio:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
