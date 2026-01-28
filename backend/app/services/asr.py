"""
Voice-to-Text ASR Service using faster-whisper (Whisper-Small)

This service provides speech-to-text transcription for the AI doctor search feature.
It uses faster-whisper for efficient inference with the Whisper-Small model.

Key responsibilities:
- Transcribe speech to raw text
- Detect language (Bangla, English, or mixed)
- Calculate confidence score from token probabilities
- Handle audio format conversion if needed

This service does NOT:
- Summarize or interpret symptoms
- Normalize medical terms
- Make any medical decisions

MODEL CACHING:
- Model is downloaded on first use from Hugging Face Hub
- Cached at: ~/.cache/huggingface/hub/models--Systran--faster-whisper-small/
- On Windows: C:\\Users\\<username>\\.cache\\huggingface\\hub\\
- Subsequent loads are from local cache (fast)
- First load on new machine: ~500MB download, takes 1-2 minutes
- Cached load: ~5-10 seconds

LANGUAGE DETECTION STRATEGY:
- Transcribe with both English and Bangla
- Compare confidence scores
- Return the higher confidence result
- This ensures proper language detection for Bangladesh context
"""

import os
import tempfile
import math
import logging
import re
from typing import Optional, Tuple, Literal, NamedTuple
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# Lazy loading - model is loaded on first use
_model: Optional[WhisperModel] = None


class TranscriptionResult(NamedTuple):
    """Result of a single transcription attempt"""
    text: str
    confidence: float
    language: str


def get_whisper_model() -> WhisperModel:
    """
    Get or initialize the Whisper-Small model.
    Uses lazy loading to avoid memory overhead until needed.
    """
    global _model
    if _model is None:
        logger.info("Loading Whisper-Small model (first load may take a minute)...")
        
        _model = WhisperModel(
            "small",
            device="cpu",
            compute_type="int8",
            cpu_threads=4,
            num_workers=2
        )
        logger.info("Whisper model loaded successfully")
    return _model


def preload_model():
    """Preload the model at application startup."""
    get_whisper_model()


def calculate_confidence(segments: list) -> float:
    """Calculate overall transcription confidence from segment-level data."""
    if not segments:
        return 0.0
    
    total_prob = 0.0
    total_duration = 0.0
    
    for segment in segments:
        duration = segment.end - segment.start
        if duration > 0:
            prob = math.exp(segment.avg_logprob)
            total_prob += prob * duration
            total_duration += duration
    
    if total_duration == 0:
        return 0.0
    
    avg_prob = total_prob / total_duration
    return max(0.0, min(1.0, avg_prob))


def is_bengali_script(text: str) -> bool:
    """Check if text contains Bengali script characters."""
    # Bengali Unicode range: U+0980 to U+09FF
    bengali_pattern = re.compile(r'[\u0980-\u09FF]')
    return bool(bengali_pattern.search(text))


def is_devanagari_script(text: str) -> bool:
    """Check if text contains Devanagari (Hindi) script characters."""
    # Devanagari Unicode range: U+0900 to U+097F
    devanagari_pattern = re.compile(r'[\u0900-\u097F]')
    return bool(devanagari_pattern.search(text))


def is_garbage_script(text: str) -> bool:
    """
    Check if text contains garbage/unsupported scripts.
    This includes Khmer, Thai, Myanmar, and other scripts that shouldn't appear
    in Bangla or English transcription.
    """
    # Scripts that indicate garbage output:
    # - Khmer: U+1780 to U+17FF (្្្្្)
    # - Thai: U+0E00 to U+0E7F
    # - Myanmar: U+1000 to U+109F
    # - Lao: U+0E80 to U+0EFF
    # - Tibetan: U+0F00 to U+0FFF
    # - Georgian: U+10A0 to U+10FF
    # - Armenian: U+0530 to U+058F
    garbage_patterns = [
        r'[\u1780-\u17FF]',  # Khmer
        r'[\u0E00-\u0E7F]',  # Thai
        r'[\u1000-\u109F]',  # Myanmar
        r'[\u0E80-\u0EFF]',  # Lao
        r'[\u0F00-\u0FFF]',  # Tibetan
        r'[\u10A0-\u10FF]',  # Georgian
        r'[\u0530-\u058F]',  # Armenian
        r'[\u3040-\u309F]',  # Hiragana
        r'[\u30A0-\u30FF]',  # Katakana
        r'[\u4E00-\u9FFF]',  # CJK
        r'[\uAC00-\uD7AF]',  # Korean Hangul
    ]
    combined_pattern = re.compile('|'.join(garbage_patterns))
    return bool(combined_pattern.search(text))


def is_latin_script(text: str) -> bool:
    """Check if text is primarily Latin (English) characters."""
    # Check if most characters are Latin letters
    latin_chars = len(re.findall(r'[a-zA-Z]', text))
    total_letters = len(re.findall(r'\w', text))
    if total_letters == 0:
        return False
    return latin_chars / total_letters > 0.7


def is_usable_text(text: str) -> bool:
    """
    Check if text is usable (Bengali, Latin/Banglish, or English).
    Rejects garbage scripts like Khmer, Thai, etc.
    """
    if not text or not text.strip():
        return False
    
    # If it contains garbage scripts, it's not usable
    if is_garbage_script(text):
        return False
    
    # If it contains Devanagari (Hindi) but no Bengali, it's likely wrong
    if is_devanagari_script(text) and not is_bengali_script(text):
        return False
    
    # Bengali script is usable
    if is_bengali_script(text):
        return True
    
    # Latin script (English or Banglish) is usable
    if is_latin_script(text):
        return True
    
    return False


def transcribe_with_language(tmp_path: str, language: str, model: WhisperModel) -> TranscriptionResult:
    """
    Transcribe audio with a specific language setting.
    
    Args:
        tmp_path: Path to audio file
        language: Language code ('en' or 'bn')
        model: Whisper model instance
        
    Returns:
        TranscriptionResult with text, confidence, and language
    """
    try:
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=3,
            best_of=3,
            patience=1.0,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=300,
                speech_pad_ms=100
            ),
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
            log_prob_threshold=-1.0,
        )
        
        segment_list = list(segments)
        text = " ".join(seg.text.strip() for seg in segment_list).strip()
        confidence = calculate_confidence(segment_list)
        
        logger.info(f"[{language}] Transcription: '{text[:50]}...' conf={confidence:.2f}")
        
        return TranscriptionResult(text=text, confidence=confidence, language=language)
        
    except Exception as e:
        logger.error(f"Transcription failed for language {language}: {e}")
        return TranscriptionResult(text="", confidence=0.0, language=language)


async def transcribe_audio(
    audio_content: bytes, 
    filename: str,
    language_hint: Optional[Literal["bn", "en", "auto"]] = "auto"
) -> Tuple[str, float, str]:
    """
    Transcribe audio content to text using Whisper-Small.
    
    For "auto" mode (default), transcribes with both English and Bangla,
    then returns the result with higher confidence.
    
    Args:
        audio_content: Raw audio bytes from uploaded file
        filename: Original filename for format detection
        language_hint: Language hint
            - "auto": Try both English and Bangla, pick best (default)
            - "bn": Force Bangla only
            - "en": Force English only
        
    Returns:
        Tuple of (transcribed_text, confidence_score, detected_language)
    """
    suffix = os.path.splitext(filename)[1] or '.webm'
    
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_file:
        tmp_file.write(audio_content)
        tmp_path = tmp_file.name
    
    try:
        model = get_whisper_model()
        
        if language_hint == "auto":
            # Try both languages and pick the best result
            logger.info("Auto-detecting language: trying both English and Bangla...")
            
            # Transcribe with English FIRST (usually produces Banglish for Bangla speech)
            en_result = transcribe_with_language(tmp_path, "en", model)
            
            # Transcribe with Bangla
            bn_result = transcribe_with_language(tmp_path, "bn", model)
            
            # Check if results are usable (no garbage scripts)
            en_usable = is_usable_text(en_result.text)
            bn_usable = is_usable_text(bn_result.text)
            
            logger.info(f"EN usable: {en_usable}, BN usable: {bn_usable}")
            
            # If Bangla produces garbage (Khmer, Devanagari, etc.), it's not usable
            if bn_result.text and is_garbage_script(bn_result.text):
                logger.warning(f"Bangla transcription contains garbage script, discarding")
                bn_usable = False
            
            if bn_result.text and is_devanagari_script(bn_result.text) and not is_bengali_script(bn_result.text):
                logger.warning("Bangla transcription contains Devanagari (Hindi) instead of Bengali, discarding")
                bn_usable = False
            
            # Calculate adjusted confidence scores
            if en_usable and is_latin_script(en_result.text):
                en_confidence_adjusted = en_result.confidence * 1.1
            else:
                en_confidence_adjusted = en_result.confidence if en_usable else 0.0
            
            if bn_usable and is_bengali_script(bn_result.text):
                # Proper Bengali script - keep full confidence
                bn_confidence_adjusted = bn_result.confidence
            else:
                # Not usable or not proper Bengali
                bn_confidence_adjusted = 0.0
            
            logger.info(f"EN: conf={en_result.confidence:.2f} (adj={en_confidence_adjusted:.2f}, usable={en_usable})")
            logger.info(f"BN: conf={bn_result.confidence:.2f} (adj={bn_confidence_adjusted:.2f}, usable={bn_usable})")
            
            # Decision logic:
            # 1. If Bangla is usable with proper Bengali script and higher confidence, use it
            # 2. Otherwise, use English (which often produces Banglish for Bangla speech)
            # 3. Banglish is preferable over garbage characters
            
            if not en_usable and not bn_usable:
                # Last resort: return English result even if low quality
                # It's better than garbage characters
                if en_result.text.strip():
                    logger.warning("Both results unusable, falling back to English transcription")
                    return en_result.text, en_result.confidence, "en"
                raise ValueError("No speech detected in audio. Please try again.")
            
            if bn_usable and bn_confidence_adjusted > en_confidence_adjusted:
                # Bangla is usable with proper Bengali script and higher confidence
                best = bn_result
                best_lang = "bn"
            else:
                # Default to English (Banglish for Bangla speech)
                best = en_result
                best_lang = "en"
            
            logger.info(f"Selected: {best_lang} with confidence {best.confidence:.2f}")
            
            # For Banglish output, mark it appropriately
            if best_lang == "en" and not en_result.text.strip().isascii():
                # Contains some non-ASCII but is Latin-based (Banglish)
                best_lang = "banglish"
            
            return best.text, best.confidence, best_lang
            
        else:
            # Single language mode
            logger.info(f"Transcribing with forced language: {language_hint}")
            result = transcribe_with_language(tmp_path, language_hint, model)
            
            if not result.text.strip():
                raise ValueError("No speech detected in audio. Please try again.")
            
            return result.text, result.confidence, result.language
        
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def get_confidence_level(confidence: float) -> str:
    """Categorize confidence score into levels for frontend display."""
    if confidence >= 0.75:
        return 'high'
    elif confidence >= 0.6:
        return 'medium'
    else:
        return 'low'
