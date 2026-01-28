"""
Voice-to-Text Schemas for API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal


class VoiceTranscriptionResponse(BaseModel):
    """
    Response from the voice transcription endpoint.
    
    Attributes:
        normalized_text: The transcribed text from speech
        confidence: Confidence score between 0.0 and 1.0
        confidence_level: Categorical level - 'high', 'medium', or 'low'
        language_detected: Detected language code ('bn', 'en', etc.)
        source: Always 'voice' to indicate input source
    """
    normalized_text: str = Field(..., description="Transcribed text from audio")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0-1")
    confidence_level: Literal["high", "medium", "low"] = Field(
        ..., 
        description="Categorical confidence level for UI display"
    )
    language_detected: str = Field(..., description="Detected language code")
    source: Literal["voice"] = Field(default="voice", description="Input source identifier")


class VoiceTranscriptionError(BaseModel):
    """
    Error response for voice transcription failures.
    """
    error: str = Field(..., description="Error message")
    retry_suggested: bool = Field(default=True, description="Whether retry is recommended")
    fallback_to_text: bool = Field(default=True, description="Suggest text input fallback")
