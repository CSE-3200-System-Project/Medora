"""
Specialty matching utilities for AI doctor search.
Handles exact matches, synonyms, fuzzy matching, and semantic similarity.
"""

import re
from typing import List, Dict, Optional, Tuple
from difflib import SequenceMatcher
import unicodedata


# Specialty synonym mapping for common variations
SPECIALTY_SYNONYMS: Dict[str, str] = {
    # Cardiology variations
    "heart specialist": "Cardiologist",
    "heart doctor": "Cardiologist",
    "cardiology": "Cardiologist",
    "cardiac specialist": "Cardiologist",

    # Dermatology variations
    "skin specialist": "Dermatologist",
    "skin doctor": "Dermatologist",
    "dermatology": "Dermatologist",

    # Gynecology variations
    "gynecologist": "Gynecologists",
    "gynaecologist": "Gynecologists",
    "women specialist": "Gynecologists",
    "women doctor": "Gynecologists",
    "obstetrics": "Gynecologists",
    "obstetrician": "Gynecologists",

    # Pediatrics variations
    "child specialist": "Pediatrician",
    "children doctor": "Pediatrician",
    "child doctor": "Pediatrician",
    "pediatrics": "Pediatrician",

    # Orthopedics variations
    "bone specialist": "Orthopedist",
    "bone doctor": "Orthopedist",
    "orthopedic": "Orthopedic Surgeon",
    "orthopaedics": "Orthopedic Surgeon",

    # Neurology variations
    "brain specialist": "Neurologist",
    "nerve specialist": "Neurologist",
    "neurology": "Neurologist",

    # General Medicine variations
    "general physician": "General Physician",
    "family doctor": "Family Medicine Specialist",
    "gp": "General Physician",
    "medical officer": "General Physician",

    # Surgery variations
    "surgeon": "Surgeon",
    "general surgeon": "General Surgeon",

    # ENT variations
    "ear nose throat": "Otolaryngologists (ENT)",
    "ent specialist": "Otolaryngologists (ENT)",
    "ent doctor": "Otolaryngologists (ENT)",

    # Eye variations
    "eye specialist": "Ophthalmologist",
    "eye doctor": "Ophthalmologist",
    "ophthalmology": "Ophthalmologist",

    # Diabetes variations
    "diabetes specialist": "Diabetologist",
    "diabetes doctor": "Diabetologist",

    # Mental Health variations
    "psychiatrist": "Psychiatrist",
    "mental health": "Psychiatrist",
    "psychology": "Psychologist",

    # Dental variations
    "dentist": "Dentist",
    "dental": "Dentist",

    # Cancer variations
    "cancer specialist": "Oncologist",
    "oncology": "Oncologist",

    # Kidney variations
    "kidney specialist": "Nephrologist",
    "renal specialist": "Nephrologist",

    # Liver variations
    "liver specialist": "Hepatologist",

    # Chest/Lung variations
    "chest specialist": "Chest Specialist",
    "lung specialist": "Pulmonologist",
    "respiratory": "Pulmonologist",

    # Blood variations
    "blood specialist": "Hematologist",

    # Stomach/Digestive variations
    "stomach specialist": "Gastroenterologist",
    "digestive": "Gastroenterologist",
    "gastro": "Gastroenterologist",

    # Thyroid/Hormone variations
    "thyroid specialist": "Endocrinologist",
    "hormone specialist": "Endocrinologist",
    "endocrine": "Endocrinologist",

    # Allergy variations
    "allergy specialist": "Allergy Skin-VD",

    # Pain variations
    "pain specialist": "Pain Management Specialist",

    # Emergency variations
    "emergency doctor": "Medicine Specialist",
    "critical care": "Critical Care Specialist",

    # Additional common variations
    "kidney doctor": "Nephrologist",
    "liver doctor": "Hepatologist",
    "lung doctor": "Pulmonologist",
    "blood doctor": "Hematologist",
    "cancer doctor": "Oncologist",
    "teeth": "Dentist",
    "eye doctor": "Ophthalmologist",
    "throat specialist": "Otolaryngologists (ENT)",
    "sugar specialist": "Diabetologist",
    "thyroid doctor": "Endocrinologist",
    "allergy doctor": "Allergy Skin-VD",
    "pain doctor": "Pain Management Specialist",
    "nutritionist": "Nutritionist",
    "dietitian": "Nutritionist",
    "physiotherapist": "Physiotherapist",
    "physical therapist": "Physiotherapist",
    "physio": "Physiotherapist",
}


def normalize_text(text: str) -> str:
    """Normalize text for better matching."""
    if not text:
        return ""

    # Convert to lowercase
    text = text.lower()

    # Remove accents and normalize unicode
    text = unicodedata.normalize('NFD', text).encode('ascii', 'ignore').decode('ascii')

    # Remove extra whitespace and punctuation
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def find_best_specialty_match(
    input_specialty: str,
    available_specialties: List[str],
    confidence_threshold: float = 0.6
) -> Tuple[Optional[str], float]:
    """
    Find the best matching specialty from available options.

    Returns:
        Tuple of (matched_specialty_name, confidence_score) or (None, 0.0)
    """
    if not input_specialty or not available_specialties:
        return None, 0.0

    input_normalized = normalize_text(input_specialty)

    # 1. Check for exact synonym match
    synonym_match = SPECIALTY_SYNONYMS.get(input_normalized)
    if synonym_match and synonym_match in available_specialties:
        return synonym_match, 1.0

    # 2. Check for exact match in available specialties
    for specialty in available_specialties:
        if normalize_text(specialty) == input_normalized:
            return specialty, 1.0

    # 3. Check for partial matches (contains/contained in)
    for specialty in available_specialties:
        specialty_normalized = normalize_text(specialty)

        # Check if input contains specialty name
        if specialty_normalized in input_normalized:
            return specialty, 0.9

        # Check if specialty contains input
        if input_normalized in specialty_normalized:
            return specialty, 0.8

    # 4. Fuzzy string matching
    best_match = None
    best_score = 0.0

    for specialty in available_specialties:
        specialty_normalized = normalize_text(specialty)
        score = SequenceMatcher(None, input_normalized, specialty_normalized).ratio()

        if score > best_score and score >= confidence_threshold:
            best_match = specialty
            best_score = score

    if best_match:
        return best_match, best_score

    # 5. Keyword-based matching for complex specialties
    input_words = set(input_normalized.split())
    for specialty in available_specialties:
        specialty_words = set(normalize_text(specialty).split())

        # Calculate word overlap
        if input_words and specialty_words:
            overlap = len(input_words.intersection(specialty_words))
            total_words = len(input_words.union(specialty_words))

            if total_words > 0:
                score = overlap / total_words
                if score >= confidence_threshold and score > best_score:
                    best_match = specialty
                    best_score = score

    return best_match, best_score


def match_specialties_from_llm_response(
    llm_specialties: List[Dict],
    available_specialties: List[str],
    min_confidence: float = 0.3
) -> List[Tuple[str, float]]:
    """
    Match LLM-extracted specialties against available database specialties.

    Args:
        llm_specialties: List of dicts with 'name' and 'confidence' keys
        available_specialties: List of available specialty names from database
        min_confidence: Minimum confidence score to accept a match

    Returns:
        List of tuples (matched_specialty_name, combined_confidence)
    """
    matched_specialties = []

    for llm_specialty in llm_specialties:
        specialty_name = llm_specialty.get('name', '').strip()
        llm_confidence = llm_specialty.get('confidence', 0.5)

        if not specialty_name:
            continue

        # Find best match
        matched_name, match_confidence = find_best_specialty_match(
            specialty_name,
            available_specialties,
            confidence_threshold=min_confidence
        )

        if matched_name:
            # Combine LLM confidence with match confidence
            combined_confidence = (llm_confidence + match_confidence) / 2
            matched_specialties.append((matched_name, combined_confidence))

    # Remove duplicates and sort by confidence
    seen = set()
    unique_matches = []
    for name, confidence in sorted(matched_specialties, key=lambda x: x[1], reverse=True):
        if name not in seen:
            seen.add(name)
            unique_matches.append((name, confidence))

    return unique_matches


def get_fallback_specialties(
    symptoms: List[str],
    available_specialties: List[str]
) -> List[str]:
    """
    Get fallback specialties based on symptoms when LLM fails to extract specialties.
    """
    fallback_mapping = {
        # Common symptoms to specialties
        'chest pain': ['Cardiologist', 'Chest Specialist'],
        'heart': ['Cardiologist'],
        'skin': ['Dermatologist'],
        'rash': ['Dermatologist', 'Allergy Skin-VD'],
        'stomach': ['Gastroenterologist'],
        'headache': ['Neurologist', 'General Physician'],
        'fever': ['General Physician', 'Internal Medicine'],
        'cough': ['Chest Specialist', 'Pulmonologist'],
        'diabetes': ['Diabetologist', 'Endocrinologist'],
        'blood pressure': ['Cardiologist', 'Internal Medicine'],
        'pregnancy': ['Gynecologists'],
        'child': ['Pediatrician'],
        'bone': ['Orthopedist', 'Orthopedic Surgeon'],
        'eye': ['Ophthalmologist'],
        'ear': ['Otolaryngologists (ENT)'],
        'tooth': ['Dentist'],
        'mental': ['Psychiatrist', 'Psychologist'],
        'cancer': ['Oncologist'],
        'kidney': ['Nephrologist'],
        'liver': ['Hepatologist', 'Gastroenterologist'],
        'thyroid': ['Endocrinologist'],
        'allergy': ['Allergy Skin-VD'],
        'pain': ['Pain Management Specialist', 'Orthopedist'],
    }

    matched_specialties = set()

    for symptom in symptoms:
        symptom_lower = normalize_text(symptom)
        for keyword, specialties in fallback_mapping.items():
            if keyword in symptom_lower:
                matched_specialties.update(specialties)

    # Filter to only available specialties
    return [s for s in matched_specialties if s in available_specialties]