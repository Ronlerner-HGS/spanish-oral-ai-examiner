# Groq Text-to-Speech (TTS) API Research Report

**Research Date:** December 14, 2025  
**Primary Source:** https://console.groq.com/docs/text-to-speech  
**API Reference:** https://console.groq.com/docs/api-reference#audio-speech

---

## Abstract

This report documents Groq's Text-to-Speech API, which provides fast audio synthesis from text input. The API is OpenAI-compatible and powered by PlayAI's Dialog model. Groq currently supports **English and Arabic only**—**Spanish is not available** as a native TTS language. The service offers 19 English voices and 4 Arabic voices, with multiple audio output formats and configurable parameters.

---

## 1. API Endpoint

| Endpoint | URL | Method |
|----------|-----|--------|
| Speech (TTS) | `https://api.groq.com/openai/v1/audio/speech` | POST |

The endpoint follows OpenAI's audio speech API structure, making it compatible with existing OpenAI client libraries.

---

## 2. Supported Models

| Model ID | Supported Languages | Description |
|----------|---------------------|-------------|
| `playai-tts` | English | High-quality TTS model for English speech generation |
| `playai-tts-arabic` | Arabic | High-quality TTS model for Arabic speech generation |

**Important Limitation:** As of December 2025, Groq's TTS API does **not support Spanish**. Only English and Arabic are available.

---

## 3. Request Format

### 3.1 Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Model ID: `playai-tts` or `playai-tts-arabic` |
| `input` | string | Text to convert to speech. Maximum **10,000 characters** |
| `voice` | string | Voice identifier (see Available Voices section) |

### 3.2 Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `response_format` | string | `mp3` | Audio format: `flac`, `mp3`, `mulaw`, `ogg`, `wav` |
| `sample_rate` | integer | `48000` | Sample rate: `8000`, `16000`, `22050`, `24000`, `32000`, `44100`, `48000` |
| `speed` | number | `1` | Playback speed multiplier. Range: `0.5` to `5` |

---

## 4. Available Voices

### 4.1 English Voices (19 total) — Model: `playai-tts`

```
Arista-PlayAI    Atlas-PlayAI     Basil-PlayAI     Briggs-PlayAI
Calum-PlayAI     Celeste-PlayAI   Cheyenne-PlayAI  Chip-PlayAI
Cillian-PlayAI   Deedee-PlayAI    Fritz-PlayAI     Gail-PlayAI
Indigo-PlayAI    Mamaw-PlayAI     Mason-PlayAI     Mikail-PlayAI
Mitch-PlayAI     Quinn-PlayAI     Thunder-PlayAI
```

### 4.2 Arabic Voices (4 total) — Model: `playai-tts-arabic`

```
Ahmad-PlayAI     Amira-PlayAI     Khalid-PlayAI    Nasser-PlayAI
```

### 4.3 Spanish Voices

**None available.** Groq TTS does not currently support Spanish language synthesis.

---

## 5. Audio Output Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| `wav` | .wav | Uncompressed, high quality |
| `mp3` | .mp3 | Compressed, default format |
| `flac` | .flac | Lossless compression |
| `ogg` | .ogg | Ogg Vorbis container |
| `mulaw` | .wav | μ-law encoding (telephony) |

---

## 6. Exact API Call Structure

### 6.1 cURL Example

```bash
curl https://api.groq.com/openai/v1/audio/speech \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "playai-tts",
    "input": "Hello, this is a test of the Groq text-to-speech API.",
    "voice": "Fritz-PlayAI",
    "response_format": "wav",
    "sample_rate": 48000,
    "speed": 1.0
  }' \
  --output speech.wav
```

### 6.2 Python Example (using Groq SDK)

```python
import os
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

response = client.audio.speech.create(
    model="playai-tts",
    voice="Fritz-PlayAI",
    input="Hello, this is a test of the Groq text-to-speech API.",
    response_format="wav"
)

response.write_to_file("speech.wav")
```

### 6.3 Python Example (using OpenAI SDK)

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

response = client.audio.speech.create(
    model="playai-tts",
    voice="Celeste-PlayAI",
    input="This demonstrates OpenAI SDK compatibility.",
    response_format="mp3"
)

response.stream_to_file("speech.mp3")
```

### 6.4 JavaScript/Node.js Example

```javascript
import fs from "fs";
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function main() {
    const response = await groq.audio.speech.create({
        model: "playai-tts",
        voice: "Fritz-PlayAI",
        input: "Hello from Node.js!",
        response_format: "wav"
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile("speech.wav", buffer);
}

main();
```

---

## 7. Rate Limits

### 7.1 TTS-Specific Limits (Free Tier)

| Model | RPM | RPD | TPM | TPD |
|-------|-----|-----|-----|-----|
| `playai-tts` | 10 | 100 | 1,200 | 3,600 |
| `playai-tts-arabic` | 10 | 100 | 1,200 | 3,600 |

**Key:**
- **RPM:** Requests per minute
- **RPD:** Requests per day  
- **TPM:** Tokens (characters) per minute
- **TPD:** Tokens (characters) per day

### 7.2 Rate Limit Headers

| Header | Description |
|--------|-------------|
| `retry-after` | Seconds to wait (only on 429 errors) |
| `x-ratelimit-limit-requests` | Max requests per day |
| `x-ratelimit-limit-tokens` | Max tokens per minute |
| `x-ratelimit-remaining-requests` | Remaining requests today |
| `x-ratelimit-remaining-tokens` | Remaining tokens this minute |

### 7.3 Error Response

When rate limits are exceeded, the API returns HTTP status code `429 Too Many Requests`.

---

## 8. Limitations

| Limitation | Value |
|------------|-------|
| Maximum input text length | 10,000 characters |
| Supported languages | English, Arabic only |
| Spanish support | **NOT AVAILABLE** |
| Voice cloning | Not supported via Groq |
| Real-time streaming | Not documented |

---

## 9. Authentication

All requests require a valid Groq API key passed in the `Authorization` header:

```
Authorization: Bearer YOUR_GROQ_API_KEY
```

API keys can be obtained from: https://console.groq.com/keys

---

## 10. Response Format

The API returns raw audio bytes in the specified format. The response:
- Has `Content-Type` header matching the audio format (e.g., `audio/wav`, `audio/mpeg`)
- Contains the binary audio data directly in the response body
- Should be written directly to a file or audio buffer

---

## 11. Complete Request/Response Schema

### Request Body Schema (JSON)

```json
{
  "model": "playai-tts",           // Required: string
  "input": "Text to synthesize",   // Required: string (max 10K chars)
  "voice": "Fritz-PlayAI",         // Required: string
  "response_format": "wav",        // Optional: "flac"|"mp3"|"mulaw"|"ogg"|"wav"
  "sample_rate": 48000,            // Optional: 8000|16000|22050|24000|32000|44100|48000
  "speed": 1.0                     // Optional: 0.5-5.0
}
```

### Response

Binary audio data in the specified format.

---

## 12. Workaround for Spanish TTS

Since Groq does not support Spanish TTS natively, alternatives include:

1. **OpenAI TTS API** — Supports Spanish with multiple voices
2. **ElevenLabs** — Extensive multilingual support including Spanish
3. **Google Cloud TTS** — Full Spanish support with multiple regional variants
4. **Amazon Polly** — Spanish voices (Castilian, Mexican, US Spanish)
5. **Azure Cognitive Services** — Spanish support with neural voices

---

## Sources

1. Groq TTS Documentation: https://console.groq.com/docs/text-to-speech
2. Groq API Reference: https://console.groq.com/docs/api-reference#audio-speech
3. Groq Rate Limits: https://console.groq.com/docs/rate-limits
4. Groq Blog (PlayAI Partnership): https://groq.com/blog/build-fast-with-text-to-speech
