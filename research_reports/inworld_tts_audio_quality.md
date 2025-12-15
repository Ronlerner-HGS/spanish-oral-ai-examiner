# Inworld TTS API Audio Quality Optimization Research Report

## Executive Summary

This report presents research findings on optimizing the Inworld TTS API audio configuration for a Spanish oral exam tutor application. The research examines audio encoding formats, sample rates, temperature settings, speaking rates, and Spanish language-specific best practices based on official Inworld AI documentation retrieved via Context7.

---

## Current Implementation Analysis

The existing implementation in `server.js` uses the following configuration:

```javascript
{
  text: text,
  voiceId: 'Rafael',
  modelId: 'inworld-tts-1-max',
  audioConfig: {
    audioEncoding: 'MP3',
    sampleRateHertz: 48000,
    speakingRate: 0.7
  }
}
```

---

## Research Findings

### 1. Audio Encoding Formats

The Inworld TTS API documentation demonstrates support for the following audio encoding formats:

**LINEAR16 (PCM)**
According to the official documentation at `docs.inworld.ai/docs/quickstart-tts`, LINEAR16 is the format explicitly used in all streaming examples. The documentation shows that LINEAR16 produces 16-bit PCM audio which requires WAV container wrapping for playback. This format offers the highest quality as it is uncompressed, but results in larger file sizes.

**MP3**
The documentation shows MP3 output when using the non-streaming `/tts/v1/voice` endpoint. MP3 provides good compression while maintaining acceptable audio quality for speech synthesis. This format is suitable for web delivery and mobile applications where bandwidth is a consideration.

**Quality Hierarchy (based on documentation patterns):**
1. LINEAR16 - Highest quality, uncompressed, best for professional applications
2. MP3 - Good quality, compressed, suitable for web delivery

The documentation does not explicitly mention OGG_OPUS or FLAC support in the examples reviewed. All streaming examples use LINEAR16, while non-streaming examples show MP3 output.

**Recommendation:** For maximum quality in an educational application where clear pronunciation is critical, consider LINEAR16 for streaming scenarios. However, MP3 at 48kHz (as currently configured) provides excellent quality with practical file sizes for web delivery.

---

### 2. Sample Rate Configuration

The Inworld documentation consistently recommends **48000 Hz (48 kHz)** as the standard sample rate for TTS output. This is evidenced across multiple code examples in the official documentation:

From the Python streaming example at `docs.inworld.ai/docs/quickstart-tts`:
```python
"audio_config": {
    "audio_encoding": "LINEAR16",
    "sample_rate_hertz": 48000,
}
```

The voice cloning best practices documentation at `docs.inworld.ai/docs/tts/best-practices/voice-cloning` further confirms that professional audio quality should target:
- Sampling Frequency: 48 kHz
- Bit Rate: 24 bits
- Codec: Linear PCM (uncompressed)

For audio input (voice cloning and recording), the documentation recommends at minimum 22kHz with 16-bit depth, but 48kHz is the professional standard.

**Recommendation:** Your current `sampleRateHertz: 48000` setting is optimal and aligns with Inworld's best practices.

---

### 3. Bit Rate Configuration

The Inworld TTS API documentation does not expose explicit bit rate configuration parameters for MP3 or other compressed formats. When using MP3 encoding, the API handles bit rate selection internally to balance quality and file size.

For LINEAR16 output, the bit rate is determined by the formula:
```
Bit Rate = Sample Rate × Bit Depth × Channels
48000 Hz × 16 bits × 1 channel = 768 kbps
```

**Recommendation:** The API manages bit rate optimization internally. No explicit configuration is needed or available based on the current documentation.

---

### 4. Temperature Setting

The documentation at `docs.inworld.ai/docs/tts/capabilities/generating-audio` describes temperature as follows:

> "The 'Temperature' setting controls the randomness of the speech; higher values lead to more expressive but random results, while lower values result in more deterministic output. It's generally recommended to keep the temperature between 0.6 and 1 for stable results."

The RemoteTTSNode example at `docs.inworld.ai/docs/node/templates/tts` shows a temperature configuration:
```javascript
const ttsNode = new RemoteTTSNode({
  id: 'tts_node',
  speakerId: voiceName,
  modelId,
  sampleRate: SAMPLE_RATE,
  temperature: 1.1,
  speakingRate: 1,
});
```

**Temperature Guidelines:**
- **0.6 - 0.8**: More deterministic, consistent output. Good for educational content where clarity is paramount.
- **0.9 - 1.0**: Balanced expressiveness and consistency. Recommended range for general use.
- **1.0 - 1.2**: More expressive, natural-sounding speech with slight variability. Can add personality.

**Recommendation:** For a Spanish oral exam tutor where natural speech patterns are important for language learning, a temperature of **0.9 - 1.0** is recommended. This provides naturalness while maintaining clarity. The current implementation does not include temperature, so adding `temperature: 0.9` would be beneficial.

---

### 5. Speaking Rate Configuration

Your current implementation uses `speakingRate: 0.7`, which is excellent for language learning contexts. The documentation at `docs.inworld.ai/docs/tts/capabilities/generating-audio` states:

> "'Talking Speed' adjusts how fast the voice speaks, with 1.0 being the native speed."

The documentation does not specify exact min/max bounds, but your implementation constrains it to 0.5-1.5:
```javascript
const selectedSpeed = Math.min(1.5, Math.max(0.5, speed || 0.7));
```

**Speaking Rate Guidelines for Language Learning:**
- **0.5 - 0.7**: Slower pace, ideal for beginners or when learning new vocabulary
- **0.8 - 0.9**: Moderate pace, good for intermediate learners
- **1.0**: Native speaking pace
- **1.1 - 1.5**: Faster than native, for advanced listening practice

**Recommendation:** Your default of 0.7 is well-suited for language learning. Consider offering user-adjustable speed controls in the UI to accommodate different proficiency levels.

---

### 6. Spanish Language Best Practices

The Inworld documentation provides specific guidance for multilingual applications at `docs.inworld.ai/docs/tts/capabilities/generating-audio`:

> "Inworld's text-to-speech models support a wide range of languages including... Spanish (`es`). For multilingual applications, Inworld TTS Max is recommended due to its enhanced capabilities in pronunciation, intonation, and overall speech naturalness."

At `docs.inworld.ai/docs/tts/best-practices/generating-speech`:
> "Voices perform optimally when synthesizing text in the same language as the original voice. While cross-language synthesis is possible, you'll achieve the best quality, pronunciation, and naturalness by matching the voice's native language to your text content."

**Spanish-Specific Recommendations:**
1. **Use Rafael voice** - Already configured correctly as a Spanish-native voice
2. **Use inworld-tts-1-max** - Already configured. This model has stronger multilingual capabilities and better pronunciation/intonation for non-English languages
3. **Match voice language to content** - Ensure all Spanish text is synthesized with a Spanish voice (Rafael)

---

### 7. Audio Markups for Enhanced Speech

The documentation at `docs.inworld.ai/docs/tts/capabilities/audio-markups` reveals experimental support for audio markups that could enhance the tutoring experience:

**Emotion Markups:** `[happy]`, `[sad]`, `[angry]`, `[surprised]`, `[fearful]`, `[disgusted]`

**Delivery Style:** `[laughing]`, `[whispering]`

**Non-verbal Vocalizations:** `[breathe]`, `[clear_throat]`, `[cough]`, `[laugh]`, `[sigh]`, `[yawn]`

**Best Practice from documentation:**
> "Emotion and delivery style markups work best when placed at the beginning of text with a single markup per request."

**Potential Use Cases for Spanish Tutor:**
- Use `[happy]` prefix for encouraging feedback: `"[happy] Muy bien, tu pronunciación es perfecta!"`
- Use neutral tone for questions to maintain clarity

---

### 8. Text Formatting Best Practices

From `docs.inworld.ai/docs/tts/best-practices/generating-speech`:

**Punctuation Impact:**
> "Punctuation matters! Use exclamation points (!) to make the voice more emphatic and excited. Use ellipsis (...) or dashes (—) to insert natural pauses."

**Emphasis Markers:**
> "You can also use emphasis markers, such as asterisks around a word (e.g., `*really*`), to signal the voice to stress that word, thereby conveying tone and emotion more effectively."

**Natural Speech Patterns:**
> "Natural human conversation is not perfect. It's full of filler words, pauses, and other natural speech patterns that make it sound more human."

For educational applications, you could insert appropriate pauses using ellipsis or dashes to give students time to process Spanish phrases.

---

## Recommended Configuration

Based on this research, here is the optimized TTS configuration for your Spanish oral exam tutor:

```javascript
body: JSON.stringify({
  text: text,
  voiceId: selectedVoiceId,  // 'Rafael' for Spanish
  modelId: 'inworld-tts-1-max',
  audio_config: {
    audio_encoding: 'MP3',        // Good quality with practical file sizes
    sample_rate_hertz: 48000,     // Optimal quality (no change needed)
    speaking_rate: selectedSpeed, // 0.7 default is excellent for learning
    temperature: 0.9              // Natural speech with consistency
  }
})
```

**Note:** The API uses snake_case (`audio_config`, `audio_encoding`, `sample_rate_hertz`, `speaking_rate`) based on the documentation examples, though the current implementation uses camelCase (`audioConfig`, `audioEncoding`, `sampleRateHertz`, `speakingRate`). Verify which format your API calls are successfully using, as the official documentation examples consistently use snake_case.

---

## Implementation Recommendations

### Priority Changes

1. **Add Temperature Parameter** - Include `temperature: 0.9` for more natural Spanish speech
2. **Verify API Field Names** - Check if snake_case (`audio_config`) or camelCase (`audioConfig`) is required. The official docs use snake_case.
3. **Consider LINEAR16 for Premium Quality** - If audio quality issues arise, switch to LINEAR16 encoding with proper WAV header generation

### Optional Enhancements

1. **Add Speed Controls in UI** - Allow users to adjust speaking rate based on proficiency level
2. **Implement Audio Markups** - Use `[happy]` for positive feedback, natural punctuation for pauses
3. **Add Text Pre-processing** - Insert strategic pauses using ellipsis for complex phrases

---

## Sources

All findings in this report are derived from official Inworld AI documentation accessed via Context7:

1. `docs.inworld.ai/docs/quickstart-tts` - TTS API Quickstart and Best Practices
2. `docs.inworld.ai/docs/tts/capabilities/generating-audio` - Audio Generation Capabilities
3. `docs.inworld.ai/docs/tts/best-practices/generating-speech` - Speech Generation Best Practices
4. `docs.inworld.ai/docs/tts/best-practices/voice-cloning` - Voice Cloning Best Practices
5. `docs.inworld.ai/docs/tts/capabilities/audio-markups` - Audio Markups
6. `docs.inworld.ai/docs/tts/tts-models` - TTS Models Documentation
7. `docs.inworld.ai/docs/node/templates/tts` - Node SDK TTS Templates

---

*Report generated: December 14, 2025*
*Research tool: Context7 library documentation retrieval*
