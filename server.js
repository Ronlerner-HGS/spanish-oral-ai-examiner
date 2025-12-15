require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const INWORLD_API_KEY = process.env.INWORLD_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// Default Inworld voice ID - Rafael is a Spanish voice
const INWORLD_VOICE_ID = process.env.INWORLD_VOICE_ID || 'Rafael';

// Load system prompt from instructions.md
const EXTRACT_QA_PROMPT = fs.readFileSync(path.join(__dirname, 'instructions.md'), 'utf-8');

// PostgreSQL connection
let pool;
let dbConnected = false;
let dbError = null;

async function connectToDatabase() {
  if (!DATABASE_URL) {
    dbError = 'DATABASE_URL not configured';
    console.warn('⚠️  DATABASE_URL not configured - sessions will not be saved');
    console.warn('   Set DATABASE_URL to your Supabase PostgreSQL connection string');
    return;
  }
  
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    console.log('   Node.js version:', process.version);
    
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false  // Required for Supabase
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    // Test the connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Create sessions table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        questions JSONB NOT NULL,
        stats JSONB DEFAULT '{"correct": 0, "partial": 0, "incorrect": 0}',
        raw_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create index on created_at for sorting
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC)
    `);
    
    client.release();
    dbConnected = true;
    console.log('✅ Sessions table ready');
  } catch (error) {
    dbError = error.message;
    console.error('❌ PostgreSQL connection failed:', error.message);
  }
}

connectToDatabase();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: { connected: dbConnected, error: dbError }
  });
});

// ============ SESSION ENDPOINTS ============

// Save a new session
app.post('/api/sessions', async (req, res) => {
  try {
    if (!pool || !dbConnected) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { name, questions, stats, rawText } = req.body;

    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'No questions to save' });
    }

    const sessionName = name || `Session ${new Date().toLocaleDateString()}`;
    const sessionStats = stats || { correct: 0, partial: 0, incorrect: 0 };

    const result = await pool.query(
      `INSERT INTO sessions (name, questions, stats, raw_text)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, questions, stats, raw_text, created_at, updated_at`,
      [sessionName, JSON.stringify(questions), JSON.stringify(sessionStats), rawText || '']
    );

    const session = result.rows[0];
    
    res.json({ 
      success: true, 
      sessionId: session.id,
      session: {
        _id: session.id,
        name: session.name,
        questions: session.questions,
        stats: session.stats,
        rawText: session.raw_text,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      }
    });
  } catch (error) {
    console.error('Save session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    if (!pool || !dbConnected) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const result = await pool.query(
      `SELECT id, name, stats, created_at,
              jsonb_array_length(questions) as question_count
       FROM sessions
       ORDER BY created_at DESC`
    );

    const sessions = result.rows.map(row => ({
      _id: row.id,
      name: row.name,
      stats: row.stats,
      createdAt: row.created_at,
      questionCount: row.question_count
    }));

    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single session by ID
app.get('/api/sessions/:id', async (req, res) => {
  try {
    if (!pool || !dbConnected) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { id } = req.params;
    
    // Validate ID is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const result = await pool.query(
      `SELECT id, name, questions, stats, raw_text, created_at, updated_at
       FROM sessions
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result.rows[0];
    const session = {
      _id: row.id,
      name: row.name,
      questions: row.questions,
      stats: row.stats,
      rawText: row.raw_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update session stats
app.patch('/api/sessions/:id', async (req, res) => {
  try {
    if (!pool || !dbConnected) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { id } = req.params;
    const { stats, name } = req.body;

    if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (stats) {
      updates.push(`stats = $${paramCount}`);
      values.push(JSON.stringify(stats));
      paramCount++;
    }
    if (name) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    if (!pool || !dbConnected) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { id } = req.params;

    if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const result = await pool.query(
      'DELETE FROM sessions WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ EXISTING ENDPOINTS ============

// Extract Q&A from raw text using Groq GPT-OSS-120B
app.post('/api/extract-qa', async (req, res) => {
  try {
    const { rawText } = req.body;
    
    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: EXTRACT_QA_PROMPT },
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
