require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const INWORLD_API_KEY = process.env.INWORLD_API_KEY;

// Default Inworld voice ID - Rafael is a Spanish voice
const INWORLD_VOICE_ID = process.env.INWORLD_VOICE_ID || 'Rafael';

// Extract Q&A from raw text using Groq GPT-OSS-120B
app.post('/api/extract-qa', async (req, res) => {
  try {
    const { rawText } = req.body;
    
    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const systemPrompt = `You are a Spanish oral exam tutor. Analyze the provided study material and extract question-answer pairs suitable for an oral exam.

Rules:
1. Create questions that test the student's ability to respond verbally in Spanish
2. Questions can be in Spanish or English depending on the material
3. Expected answers should be in Spanish
4. Include vocabulary, verb conjugations, translations, and conversational responses
5. Make questions clear and specific
6. For vocabulary: ask "How do you say X in Spanish?" or "What does X mean?"
7. For conjugations: ask "Conjugate [verb] in [tense] for [subject]"
8. For conversations: create realistic prompts the student might hear

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "id": "1",
      "question": "The question to ask verbally",
      "expectedAnswer": "The expected Spanish response",
      "acceptableVariations": ["other acceptable answers"],
      "topic": "vocabulary|conjugation|translation|conversation",
      "hint": "optional hint if stuck"
    }
  ]
}

Extract as many relevant questions as the material supports (aim for 10-30 questions).`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is my study material:\n\n${rawText}` }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq LLM error:', errorText);
      return res.status(500).json({ error: 'Failed to extract questions' });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse LLM response:', content);
      return res.status(500).json({ error: 'Invalid response format from LLM' });
    }

    res.json(parsed);
  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Transcribe audio using Groq Whisper
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'es');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq transcription error:', errorText);
      return res.status(500).json({ error: 'Transcription failed' });
    }

    const data = await response.json();
    res.json({ transcript: data.text });
  } catch (error) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Grade student answer using Groq GPT-OSS-120B
app.post('/api/grade', async (req, res) => {
  try {
    const { question, expectedAnswer, studentAnswer, acceptableVariations } = req.body;

    if (!question || !expectedAnswer || !studentAnswer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const systemPrompt = `You are a lenient Spanish oral exam grader. Your job is to evaluate if the student's spoken answer is acceptable.

Grading rules:
1. Focus on MEANING, not exact wording
2. Accept synonyms and paraphrases
3. Minor grammar mistakes that don't change meaning = still correct
4. Accent marks missing in transcription = ignore
5. Slight word order differences = usually acceptable
6. Be encouraging but honest

Return a JSON object:
{
  "verdict": "correct" | "partial" | "incorrect",
  "feedback": "Brief encouraging feedback in English",
  "correction": "If wrong/partial, show the correct answer",
  "explanation": "Why this grade was given"
}`;

    const userPrompt = `Question asked: "${question}"
Expected answer: "${expectedAnswer}"
${acceptableVariations?.length ? `Also acceptable: ${acceptableVariations.join(', ')}` : ''}

Student said: "${studentAnswer}"

Grade this response:`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq grade error:', errorText);
      return res.status(500).json({ error: 'Grading failed' });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse grade response:', content);
      return res.status(500).json({ error: 'Invalid grading response' });
    }

    res.json(parsed);
  } catch (error) {
    console.error('Grade error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Text-to-Speech using Inworld TTS-1-Max
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceId, speed } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }

    if (!INWORLD_API_KEY) {
      return res.status(500).json({ error: 'Inworld API key not configured' });
    }

    const selectedVoiceId = voiceId || INWORLD_VOICE_ID;
    // Speed: 0.5 (slowest) to 1.5 (fastest), default 0.7 for language learning
    const selectedSpeed = Math.min(1.5, Math.max(0.5, speed || 0.7));

    const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INWORLD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        voice_id: selectedVoiceId,
        model_id: 'inworld-tts-1-max',
        temperature: 0.9,
        audio_config: {
          audio_encoding: 'MP3',
          sample_rate_hertz: 48000,
          speaking_rate: selectedSpeed
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Inworld TTS error:', errorText);
      return res.status(500).json({ error: 'Text-to-speech failed' });
    }

    const data = await response.json();

    // Decode base64 audio content
    const audioBuffer = Buffer.from(data.audioContent, 'base64');

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length
    });

    res.send(audioBuffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available Inworld voices
app.get('/api/voices', async (req, res) => {
  try {
    if (!INWORLD_API_KEY) {
      return res.status(500).json({ error: 'Inworld API key not configured' });
    }

    // Filter for Spanish voices
    const response = await fetch('https://api.inworld.ai/tts/v1/voices?filter=language=es', {
      headers: {
        'Authorization': `Basic ${INWORLD_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Inworld voices error:', errorText);
      return res.status(500).json({ error: 'Failed to fetch voices' });
    }

    const data = await response.json();

    res.json({
      voices: (data.voices || []).map(voice => ({
        voice_id: voice.voiceId,
        name: voice.voiceId,
        languages: voice.languages,
        description: voice.description || ''
      }))
    });
  } catch (error) {
    console.error('Voices error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Spanish Tutor server running on http://localhost:${PORT}`);
});
