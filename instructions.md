# Spanish Oral AI Examiner - LLM Instructions

## Project Overview

This is a Spanish oral exam preparation tool that helps students practice speaking Spanish. The app extracts questions from study material, reads questions aloud using text-to-speech, transcribes student answers, and grades responses using AI.

## Project Structure

```
spanish-oral-ai-examiner/
├── server.js              # Express backend (API endpoints)
├── public/
│   └── index.html         # Single-page frontend (HTML + CSS + JS)
├── package.json           # Dependencies
├── .env                   # API keys (private, gitignored)
├── .env.example           # Environment variable template
├── research_reports/      # Research documentation
│   ├── groq_tts_api.md
│   ├── in_browser_tts_stt_spanish_tutor.md
│   └── inworld_tts_audio_quality.md
└── instructions.md        # This file
```

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript (no frameworks), inline CSS
- **APIs**:
  - **Groq API**: LLM (question extraction, grading) and Whisper (speech-to-text)
  - **Inworld API**: TTS-1-Max for high-quality Spanish text-to-speech

## API Endpoints

### POST `/api/extract-qa`
Extracts question-answer pairs from study material using Groq LLM.
- Input: `{ rawText: string }`
- Output: `{ questions: [{ id, question, expectedAnswer, acceptableVariations, topic, hint }] }`

### POST `/api/transcribe`
Transcribes audio to text using Groq Whisper.
- Input: FormData with `audio` file (webm)
- Output: `{ transcript: string }`

### POST `/api/grade`
Grades student answer against expected answer.
- Input: `{ question, expectedAnswer, studentAnswer, acceptableVariations }`
- Output: `{ verdict: "correct"|"partial"|"incorrect", feedback, correction, explanation }`

### POST `/api/tts`
Converts text to speech using Inworld TTS-1-Max.
- Input: `{ text: string, voiceId?: string, speed?: number }`
- Output: Audio buffer (MP3)

### GET `/api/voices`
Lists available Spanish voices from Inworld.
- Output: `{ voices: [{ voice_id, name, languages, description }] }`

## Environment Variables

```bash
GROQ_API_KEY=your_groq_api_key        # Required: For LLM and Whisper
INWORLD_API_KEY=your_inworld_api_key  # Required: Base64-encoded for TTS
INWORLD_VOICE_ID=Rafael               # Optional: Default Spanish voice
PORT=3000                             # Optional: Server port
```

## Code Conventions

- **Module format**: CommonJS (`require`/`module.exports`)
- **Indentation**: 2 spaces
- **Strings**: Single quotes in JS
- **Variable naming**: camelCase for JS, snake_case for API payloads to Inworld
- **Error handling**: Try-catch with console.error logging
- **CSS**: Inline in `<style>` tags within index.html

## Key Implementation Details

### Inworld TTS Configuration
The Inworld API uses **snake_case** field names:
```javascript
{
  text: text,
  voice_id: 'Rafael',
  model_id: 'inworld-tts-1-max',
  temperature: 0.9,  // For natural speech
  audio_config: {
    audio_encoding: 'MP3',
    sample_rate_hertz: 48000,
    speaking_rate: 0.7  // Slower for language learning
  }
}
```

### Question Hide/Reveal Feature
Questions are hidden (blurred) by default to encourage listening practice. Students can reveal the text by clicking a button. The visibility resets when moving to the next question.

### TTS Toggle
Users can switch between Inworld TTS (higher quality) and browser TTS (fallback) using a toggle switch.

### Speed Control
Speech speed is adjustable from 0.5x to 1.5x, with 0.7x as default for language learning.

## Running the Project

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start
# or
node server.js

# Open in browser
# http://localhost:3000
```

## Common Tasks

### Adding a new API endpoint
1. Add route handler in `server.js` using `app.post()` or `app.get()`
2. Follow existing patterns for error handling and response format

### Modifying the UI
1. Edit `public/index.html`
2. CSS is in the `<style>` block (lines ~7-458)
3. JavaScript is in the `<script>` block (lines ~597-1115)

### Updating TTS settings
1. Edit the `/api/tts` endpoint in `server.js` (lines ~209-265)
2. See `research_reports/inworld_tts_audio_quality.md` for best practices

## Dependencies

- `express`: Web server framework
- `cors`: Cross-origin resource sharing
- `dotenv`: Environment variable loading
- `multer`: File upload handling (for audio)

## Notes for LLM Assistants

- The frontend is a single HTML file with embedded CSS and JS - avoid splitting into separate files
- Prefer editing existing code over creating new files
- The app should work offline with browser TTS as fallback
- Keep the UI simple and focused on language learning
- Research reports in `research_reports/` contain valuable context about API decisions
