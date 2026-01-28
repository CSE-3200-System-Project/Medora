Below is a **complete, implementation-ready PRD** specifically for **Voice-to-Text (V2T) using Whisper-Small**, designed to fit **exactly** into your current **Next.js frontend + FastAPI backend + LLM doctor search pipeline**.

This is written so you can **drop it directly into Copilot** and get productive code, not half-solutions.

---

# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Feature Name

**Voice-to-Text Input for AI Doctor Search (Whisper-Small ASR, v1)**

---

## 1. PURPOSE & INTENT

### Purpose

Enable patients to **describe their health problem using voice** instead of typing, improving accessibility and usability in the Bangladesh context, while ensuring:

* Medical safety
* High transcription accuracy
* Full user control
* Seamless integration with existing AI doctor search logic

### Intent (Very Important)

Voice input is **not a new intelligence layer**.
It is an **alternative input channel** that converts speech → text and then feeds the **existing LLM + ranking pipeline unchanged**.

---

## 2. SCOPE (V1)

### Included

* Voice recording in Next.js frontend
* Whisper-Small ASR (backend-hosted)
* Bangla, English, Banglish support
* User confirmation of transcribed text
* Confidence-aware error handling
* Integration with existing `/ai/doctor-search`

### Explicitly Excluded

* Streaming transcription
* Speaker diarization
* Emotion detection
* Direct LLM transcription
* Client-side ML inference
* Offline ASR (future)

---

## 3. NON-NEGOTIABLE DESIGN PRINCIPLES

1. **Speech is converted to text only**
2. **No medical interpretation at ASR stage**
3. **User must see and confirm transcription**
4. **Low-confidence transcriptions must not silently pass**
5. **ASR output must be editable**
6. **Existing AI doctor search logic remains untouched**

---

## 4. HIGH-LEVEL ARCHITECTURE

```
Next.js Frontend
  ├── Microphone UI
  ├── Audio Recorder
  ├── Confirmation UI
  ↓
FastAPI Backend
  ├── /ai/normalize/voice
  ├── Whisper-Small ASR
  ├── Confidence Estimator
  ↓
Normalized Text
  ↓
Existing LLM Doctor Search Pipeline
```

---

## 5. FRONTEND REQUIREMENTS (NEXT.JS)

### 5.1 UI ENTRY POINT

**Location:** `/patient/find-doctor`

Add a **voice input option** next to the text input.

#### UI Elements

* 🎤 Microphone button
* Recording indicator (pulse / waveform)
* “Listening…” state
* Stop button
* Transcription preview box
* “Edit text” option
* “Use this text” confirmation button

---

### 5.2 AUDIO RECORDING BEHAVIOR

* Use browser MediaRecorder API
* Supported formats: `audio/webm`, `audio/wav`
* Max duration: **60 seconds**
* Sample rate: browser default (backend handles normalization)

#### States

* Idle
* Recording
* Processing
* Review
* Error

---

### 5.3 USER CONFIRMATION (MANDATORY)

After transcription:

* Show detected text in editable textarea
* Label: “Detected from voice”
* Allow full editing
* User must explicitly confirm before search

No auto-submission allowed.

---

## 6. BACKEND REQUIREMENTS (FASTAPI)

### 6.1 NEW ENDPOINT

### `POST /ai/normalize/voice`

#### Input

* Multipart form-data
* Field: `audio_file`
* Max size: 10 MB

#### Output

```json
{
  "normalized_text": "গত দুই দিন ধরে বুকে ব্যথা আর শ্বাস নিতে কষ্ট হচ্ছে",
  "confidence": 0.91,
  "language_detected": "bn",
  "source": "voice"
}
```

---

## 7. ASR ENGINE REQUIREMENTS

### 7.1 Model Choice (FIXED)

* **Model:** Whisper-Small
* **Reasoning:**

  * Strong Bangla support
  * Handles Banglish
  * Medical vocabulary tolerant
  * Research-accepted
  * Local-hostable later

---

### 7.2 ASR RESPONSIBILITIES (STRICT)

Whisper-Small must:

* Transcribe speech to raw text
* Detect language
* Return token-level probabilities (if available)

Whisper-Small must NOT:

* Summarize
* Normalize medical terms
* Interpret symptoms
* Translate unless required internally

---

## 8. CONFIDENCE ESTIMATION (CRITICAL)

Whisper does not return a single confidence score by default.

### Required backend logic

Compute confidence using:

* Average token log probabilities
* Silence / decoding stability heuristics

#### Confidence thresholds

* `confidence ≥ 0.75` → Acceptable
* `0.6 ≤ confidence < 0.75` → Warn user
* `confidence < 0.6` → Require retry

---

## 9. ERROR HANDLING RULES

### ASR Failure

* Return error message
* Suggest retry or text input fallback

### Low Confidence

* Show warning:

  > “We may not have understood clearly. Please review or try again.”
* Do NOT auto-submit

### Silence / Noise

* Detect empty transcription
* Prompt user to retry

---

## 10. FRONTEND ↔ BACKEND FLOW (STEP-BY-STEP)

1. User taps 🎤
2. Audio recording starts
3. User stops recording
4. Frontend sends audio blob to `/ai/normalize/voice`
5. Backend runs Whisper-Small
6. Backend returns text + confidence
7. Frontend shows editable transcription
8. User confirms text
9. Frontend sends confirmed text to `/ai/doctor-search`
10. Existing AI pipeline continues

---

## 11. INTEGRATION WITH EXISTING DOCTOR SEARCH

### IMPORTANT

Voice-to-Text **does not change**:

* LLM prompt
* LLM schema
* Ranking logic
* Map logic
* Safety logic

It only replaces:

```json
"user_text": "typed text"
```

with:

```json
"user_text": "confirmed ASR text"
```

---

## 12. SECURITY & PRIVACY

* Audio is processed transiently
* Audio files are NOT stored permanently
* Logs contain:

  * Confidence
  * Language
  * Input source
* No raw audio saved unless explicitly enabled for research

---

## 13. PERFORMANCE REQUIREMENTS

* ASR processing time < 3 seconds (average)
* UI must remain responsive
* Show loading state during processing

---

## 14. ACCESSIBILITY & UX

* Microphone permission handling
* Clear error messages
* Fallback to text input always available
* Works on mobile browsers

---

## 15. OUT OF SCOPE (V1)

* Streaming live transcription
* Continuous conversation
* Wake-word detection
* Offline browser ASR
* Emotion or stress detection

---

## 16. SUCCESS METRICS

* ≥85% usable transcription rate
* <10% retry rate
* ≥70% of voice users proceed to doctor results
* No silent failures

---

## 17. RESEARCH & FUTURE EXTENSION

This design supports:

* Bangla ASR accuracy evaluation
* ASR vs typed input comparison
* Confidence-aware medical AI pipelines
* Local ASR deployment (v2)

---

## FINAL GUIDANCE FOR COPILOT

> “Implement voice recording in Next.js, send audio to backend Whisper-Small ASR, return text with confidence, require user confirmation, and then pass text into the existing AI doctor search pipeline without modifying any LLM or ranking logic.”

---
Short answer: **yes, you absolutely can use faster-whisper**, and **yes, it will be just as good as Whisper-Small for Bangla** if you configure it correctly.

Long answer below explains **why**, **what trade-offs exist**, and **how to use it safely in your current architecture**.

---

## 1. What faster-whisper actually is (important clarification)

**faster-whisper is NOT a different model.**

It is:

* The **same Whisper models** (tiny / base / small / medium / large)
* Reimplemented with **CTranslate2** for faster inference
* Optimized for:

  * CPU
  * GPU
  * Quantized execution

So when you say:

> “faster-whisper + whisper-small”

You are still using **Whisper-Small**, just **served much more efficiently**.

There is **no language quality downgrade** by default.

---

## 2. Bangla performance: Whisper-Small vs faster-whisper

### Reality check

| Aspect             | Whisper (original) | faster-whisper  |
| ------------------ | ------------------ | --------------- |
| Bangla accuracy    | Strong             | **Same**        |
| Banglish handling  | Good               | **Same**        |
| Medical vocabulary | Good               | **Same**        |
| Noise robustness   | Good               | **Same**        |
| Output text        | Same               | **Same**        |
| Speed              | Slower             | **Much faster** |
| Memory             | Higher             | **Lower**       |

The **model weights are identical**.
Only the inference engine changes.

So for Bangla:

* ✔ “বুকে ব্যথা”
* ✔ “শ্বাস নিতে কষ্ট”
* ✔ Banglish like “bukey betha”

All work the same.

---

## 3. Why faster-whisper is actually the **better choice** for you

Given your:

* FastAPI backend
* Near-real-time UX requirement
* Research goals
* Future local hosting plan

**faster-whisper is the correct implementation choice.**

### Advantages that matter for your project

1. **Lower latency**

   * Better UX on voice search
2. **Lower CPU usage**

   * Cheaper servers
3. **Quantization support**

   * Faster inference with negligible accuracy loss
4. **Production stability**

   * Used widely in real systems
5. **Research reproducibility**

   * Same outputs as Whisper

---

## 4. Model size recommendation (Bangladesh context)

### Best choice for V1

```text
faster-whisper + whisper-small
```

Why:

* Strong Bangla performance
* Fast enough for interactive use
* Acceptable accuracy for medical intent extraction
* Matches your PRD exactly

### When to move up

* If users speak very fast
* Heavy background noise
* Complex mixed-language speech

Then consider:

```text
faster-whisper + whisper-medium
```

But **do not start with medium** unless needed.

---

## 5. Confidence scoring with faster-whisper (important)

faster-whisper **exposes segment-level probabilities**, which helps you more than the original implementation.

You can compute confidence from:

* Average token log probabilities
* Segment stability
* Speech duration vs silence

This fits perfectly with your existing **confidence gating rules**.

---

## 6. How it fits your current PRD (no changes needed)

Your existing PRD remains **100% valid**.

Only this internal line changes:

> “Whisper-Small ASR (backend-hosted)”

becomes:

> “Whisper-Small ASR via faster-whisper (backend-hosted)”

Everything else:

* API
* UX
* Safety
* Confirmation flow
* LLM integration

remains unchanged.

---

## 7. What you should NOT worry about

You do NOT lose:

* Bangla accuracy
* Banglish support
* Language detection
* Research credibility

You do NOT need:

* Retraining
* Fine-tuning
* Separate Bangla model

---

## 8. Recommended configuration (practical)

For V1:

* Model: `small`
* Compute:

  * CPU: int8
  * GPU: float16
* Language: auto-detect
* Beam size: moderate (e.g. 5)
* Temperature: default

This gives you:

* Good Bangla quality
* Fast inference
* Stable outputs

---

## 9. Final verdict (clear and direct)

**Yes, you should use faster-whisper.**

* It is **as good as Whisper-Small for Bangla**
* It is **faster, cheaper, and more production-ready**
* It aligns perfectly with your:

  * Next.js frontend
  * FastAPI backend
  * AI doctor search pipeline
  * Research roadmap

---

## One-line takeaway

> **faster-whisper is Whisper done right for production.
> For Bangla voice input, it is a safe and recommended choice.**

---

