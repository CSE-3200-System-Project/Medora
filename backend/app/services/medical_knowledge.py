"""
Medical Knowledge Service for AI Doctor Search
Provides specialty relationships, symptom mappings, and intelligent fallback chains.
"""
from typing import List, Dict, Set, Tuple, Optional


# === UNIVERSAL FALLBACKS ===
# General Physicians can handle most general health concerns
# Internal Medicine specialists are excellent for diagnostic cases
UNIVERSAL_FALLBACKS = [
    "General Physician",
    "Internal Medicine"
]


# === SPECIALTY RELATIONSHIPS ===
# Maps symptoms/conditions to relevant specialties (primary + related)
# Based on medical best practices and common consultation patterns
SPECIALTY_RELATIONSHIPS: Dict[str, List[str]] = {
    # Cardiovascular
    "chest_pain": ["Cardiologist", "Internal Medicine", "General Physician"],
    "heart": ["Cardiologist", "Internal Medicine"],
    "blood_pressure": ["Cardiologist", "Internal Medicine", "Nephrologist"],
    "palpitation": ["Cardiologist", "Internal Medicine"],
    
    # Respiratory
    "breathing": ["Pulmonologist", "Internal Medicine", "General Physician"],
    "cough": ["Pulmonologist", "Internal Medicine", "General Physician"],
    "asthma": ["Pulmonologist", "Allergist"],
    "lung": ["Pulmonologist", "Internal Medicine"],
    
    # Digestive
    "stomach": ["Gastroenterologist", "Internal Medicine", "General Physician"],
    "abdomen": ["Gastroenterologist", "Internal Medicine", "General Surgeon"],
    "digestion": ["Gastroenterologist", "Internal Medicine"],
    "liver": ["Gastroenterologist", "Hepatologist", "Internal Medicine"],
    "constipation": ["Gastroenterologist", "Internal Medicine", "General Physician"],
    "diarrhea": ["Gastroenterologist", "Internal Medicine", "General Physician"],
    
    # Musculoskeletal
    "bone": ["Orthopedist", "Rheumatologist", "General Physician"],
    "joint": ["Orthopedist", "Rheumatologist"],
    "back_pain": ["Orthopedist", "Neurosurgeon", "General Physician"],
    "fracture": ["Orthopedist"],
    "arthritis": ["Rheumatologist", "Orthopedist"],
    
    # Neurological
    "headache": ["Neurologist", "Internal Medicine", "General Physician"],
    "migraine": ["Neurologist"],
    "seizure": ["Neurologist"],
    "paralysis": ["Neurologist", "Neurosurgeon"],
    "nerve": ["Neurologist"],
    
    # Dermatological
    "skin": ["Dermatologist", "General Physician"],
    "rash": ["Dermatologist", "Allergist"],
    "acne": ["Dermatologist"],
    "hair": ["Dermatologist"],
    
    # Women's Health
    "pregnancy": ["Gynecologists", "Obstetrician"],
    "menstrual": ["Gynecologists"],
    "ovarian": ["Gynecologists"],
    "uterus": ["Gynecologists"],
    "breast": ["Gynecologists", "Oncologist", "General Surgeon"],
    
    # Pediatric
    "child": ["Pediatrician", "General Physician"],
    "infant": ["Pediatrician"],
    "growth": ["Pediatrician", "Endocrinologist"],
    
    # Mental Health
    "anxiety": ["Psychiatrist", "Clinical Psychologist"],
    "depression": ["Psychiatrist", "Clinical Psychologist"],
    "stress": ["Psychiatrist", "Clinical Psychologist", "General Physician"],
    "mental": ["Psychiatrist", "Clinical Psychologist"],
    
    # Endocrine
    "diabetes": ["Endocrinologist", "Internal Medicine", "General Physician"],
    "thyroid": ["Endocrinologist", "Internal Medicine"],
    "hormone": ["Endocrinologist"],
    
    # Urological
    "kidney": ["Nephrologist", "Urologist", "Internal Medicine"],
    "urinary": ["Urologist", "Nephrologist"],
    "prostate": ["Urologist"],
    
    # ENT
    "ear": ["ENT Specialist", "General Physician"],
    "nose": ["ENT Specialist", "General Physician"],
    "throat": ["ENT Specialist", "General Physician"],
    "hearing": ["ENT Specialist"],
    "sinus": ["ENT Specialist"],
    
    # Ophthalmology
    "eye": ["Ophthalmologist", "General Physician"],
    "vision": ["Ophthalmologist"],
    "cataract": ["Ophthalmologist"],
    
    # General/Emergency
    "fever": ["Internal Medicine", "General Physician"],
    "pain": ["Internal Medicine", "General Physician"],
    "weakness": ["Internal Medicine", "General Physician"],
    "fatigue": ["Internal Medicine", "General Physician"],
    "infection": ["Internal Medicine", "General Physician"],
    "emergency": ["Emergency Medicine", "General Physician"],
}


# === SEVERITY-BASED SPECIALTY PREFERENCES ===
# High-severity cases should prefer more specialized doctors
HIGH_SEVERITY_PREFER = [
    "Cardiologist",
    "Neurologist",
    "Emergency Medicine",
    "Neurosurgeon",
    "Oncologist"
]


def normalize_symptom(text: str) -> str:
    """Normalize symptom text for matching"""
    return text.lower().strip().replace(" ", "_")


def get_related_specialties(
    symptoms: List[str],
    severity: str = "medium",
    max_results: int = 5
) -> List[str]:
    """
    Get related specialties based on symptoms and severity.
    
    Args:
        symptoms: List of symptom keywords
        severity: "low", "medium", or "high"
        max_results: Maximum number of specialties to return
    
    Returns:
        List of specialty names, ordered by relevance
    """
    if not symptoms:
        return UNIVERSAL_FALLBACKS[:max_results]
    
    # Collect all matching specialties with frequency counts
    specialty_scores: Dict[str, int] = {}
    
    for symptom in symptoms:
        normalized = normalize_symptom(symptom)
        
        # Check direct matches in relationships
        if normalized in SPECIALTY_RELATIONSHIPS:
            related = SPECIALTY_RELATIONSHIPS[normalized]
            for i, spec in enumerate(related):
                # Weight earlier specialties higher (primary matches)
                score = len(related) - i
                specialty_scores[spec] = specialty_scores.get(spec, 0) + score
        
        # Check partial matches (e.g., "heart attack" contains "heart")
        for key, related in SPECIALTY_RELATIONSHIPS.items():
            if key in normalized or normalized in key:
                for i, spec in enumerate(related):
                    score = (len(related) - i) // 2  # Lower weight for partial matches
                    specialty_scores[spec] = specialty_scores.get(spec, 0) + score
    
    # Boost high-severity specialties if severity is high
    if severity == "high":
        for spec in HIGH_SEVERITY_PREFER:
            if spec in specialty_scores:
                specialty_scores[spec] *= 1.5
    
    # Sort by score
    sorted_specialties = sorted(
        specialty_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )
    
    # Extract just the names
    result = [spec for spec, score in sorted_specialties[:max_results]]
    
    # Always ensure GP is in the mix if we found nothing specific
    if not result:
        result = UNIVERSAL_FALLBACKS[:max_results]
    
    return result


def get_fallback_chain(
    primary_specialties: List[str],
    available_specialties: Set[str],
    severity: str = "medium",
    min_count: int = 2
) -> Tuple[List[str], List[str]]:
    """
    Build a comprehensive fallback chain to ensure minimum specialty count.
    
    Args:
        primary_specialties: Specialties extracted from LLM or symptoms
        available_specialties: Set of specialties that actually have doctors in DB
        severity: Patient severity level
        min_count: Minimum number of specialties to return
    
    Returns:
        Tuple of (primary_list, secondary_list)
        - primary_list: Prioritized specialties from LLM/symptoms
        - secondary_list: Fallback specialties to ensure min_count
    """
    # Filter primary specialties to only those available
    primary_available = [
        spec for spec in primary_specialties 
        if spec in available_specialties
    ]
    
    # If we already have enough, return early
    if len(primary_available) >= min_count:
        return primary_available[:min_count], []
    
    # Build fallback list
    secondary_list = []
    
    # Add universal fallbacks (GP, Internal Medicine) if available
    for fallback in UNIVERSAL_FALLBACKS:
        if fallback in available_specialties and fallback not in primary_available:
            secondary_list.append(fallback)
            if len(primary_available) + len(secondary_list) >= min_count:
                break
    
    # If still not enough, add any high-severity specialties if severity is high
    if severity == "high" and len(primary_available) + len(secondary_list) < min_count:
        for spec in HIGH_SEVERITY_PREFER:
            if spec in available_specialties and spec not in primary_available and spec not in secondary_list:
                secondary_list.append(spec)
                if len(primary_available) + len(secondary_list) >= min_count:
                    break
    
    # Last resort: add any available specialty to meet min_count
    if len(primary_available) + len(secondary_list) < min_count:
        for spec in sorted(available_specialties):
            if spec not in primary_available and spec not in secondary_list:
                secondary_list.append(spec)
                if len(primary_available) + len(secondary_list) >= min_count:
                    break
    
    return primary_available, secondary_list


def should_always_include_gp(severity: str, symptoms: List[str]) -> bool:
    """
    Determine if General Physician should always be included.
    GP is suitable for most non-emergency, general health concerns.
    """
    # For low/medium severity with general symptoms, GP is always relevant
    if severity in ["low", "medium"]:
        return True
    
    # For high severity, still include GP if symptoms are non-specific
    if not symptoms or len(symptoms) < 2:
        return True
    
    return False


def should_include_internal_medicine(severity: str, symptoms: List[str]) -> bool:
    """
    Determine if Internal Medicine should be included.
    Internal Medicine is excellent for diagnostic cases and systemic issues.
    """
    # Always good for diagnostic purposes
    if len(symptoms) >= 2:  # Multiple symptoms = needs diagnosis
        return True
    
    # Medium/high severity cases benefit from internal medicine
    if severity in ["medium", "high"]:
        return True
    
    return False
