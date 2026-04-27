/**
 * Symptom → Doctor Matching Engine
 * Maps patient-described symptoms to the most relevant doctor specializations.
 */

// Symptom keyword → specialization mapping
const SYMPTOM_SPECIALIZATION_MAP = {
    // General / Allopathy
    'fever': 'Allopathy',
    'cold': 'Allopathy',
    'cough': 'Allopathy',
    'flu': 'Allopathy',
    'infection': 'Allopathy',
    'vomiting': 'Allopathy',
    'nausea': 'Allopathy',
    'diarrhea': 'Allopathy',
    'headache': 'Allopathy',
    'body pain': 'Allopathy',
    'weakness': 'Allopathy',
    'fatigue': 'Allopathy',
    'sore throat': 'Allopathy',
    'breathing': 'Allopathy',
    'chest pain': 'Allopathy',
    'stomach': 'Allopathy',
    'abdominal': 'Allopathy',
    'skin rash': 'Allopathy',
    'allergy': 'Allopathy',
    'blood pressure': 'Allopathy',
    'diabetes': 'Allopathy',
    'thyroid': 'Allopathy',
    'asthma': 'Allopathy',
    'wound': 'Allopathy',
    'injury': 'Allopathy',
    'swelling': 'Allopathy',
    'pain': 'Allopathy',
    'ear': 'Allopathy',
    'eye': 'Allopathy',
    'nose': 'Allopathy',
    'viral': 'Allopathy',
    'bacterial': 'Allopathy',
    'malaria': 'Allopathy',
    'dengue': 'Allopathy',
    'typhoid': 'Allopathy',

    // Homeopathy
    'chronic': 'Homeopathic',
    'recurring': 'Homeopathic',
    'long term': 'Homeopathic',
    'immunity': 'Homeopathic',
    'seasonal': 'Homeopathic',
    'sinusitis': 'Homeopathic',
    'migraine': 'Homeopathic',
    'eczema': 'Homeopathic',
    'psoriasis': 'Homeopathic',
    'arthritis': 'Homeopathic',
    'tonsils': 'Homeopathic',
    'digestive': 'Homeopathic',
    'acidity': 'Homeopathic',
    'gas': 'Homeopathic',
    'hair loss': 'Homeopathic',
    'warts': 'Homeopathic',
    'piles': 'Homeopathic',

    // Mental health / Counseling
    'stress': 'Mental',
    'anxiety': 'Mental',
    'depression': 'Mental',
    'insomnia': 'Mental',
    'sleep': 'Mental',
    'panic': 'Mental',
    'counseling': 'Mental',
    'mental': 'Mental',
    'emotional': 'Mental',
    'mood': 'Mental',
    'anger': 'Mental',
    'trauma': 'Mental',
    'addiction': 'Mental',
    'loneliness': 'Mental',
    'suicidal': 'Mental',
    'self harm': 'Mental',
    'nervous': 'Mental',
    'overthinking': 'Mental',
    'burnout': 'Mental',
};

// Severity keywords for auto-priority detection
const SEVERITY_KEYWORDS = {
    emergency: [
        'chest pain', 'unconscious', 'bleeding heavily', 'severe bleeding',
        'difficulty breathing', 'cannot breathe', 'heart attack', 'stroke',
        'seizure', 'convulsion', 'suicidal', 'self harm', 'poisoning',
        'accident', 'fracture', 'severe pain', 'fainted', 'collapsed'
    ],
    high: [
        'high fever', 'persistent fever', 'blood in', 'sharp pain',
        'severe headache', 'vomiting blood', 'chest tightness',
        'swollen', 'infected wound', 'allergic reaction', 'rash spreading',
        'breathing difficulty', 'continuous vomiting', 'dehydration',
        'blurred vision', 'numbness', 'severe diarrhea'
    ],
    normal: [] // default
};

/**
 * Match doctors based on patient symptoms.
 * @param {string} symptomText - Raw symptom description from patient
 * @param {Array} doctors - Array of doctor objects (with specialization and symptom_tags)
 * @returns {Array} Doctors sorted by relevance score (highest first), each with a `matchScore` property
 */
function matchDoctors(symptomText, doctors) {
    if (!symptomText || !doctors || doctors.length === 0) {
        return doctors || [];
    }

    const lowerSymptoms = symptomText.toLowerCase();

    const scoredDoctors = doctors.map(doctor => {
        let score = 0;
        const matchedKeywords = [];

        // Check symptom_tags (direct match from DB)
        if (doctor.symptom_tags && Array.isArray(doctor.symptom_tags)) {
            doctor.symptom_tags.forEach(tag => {
                if (lowerSymptoms.includes(tag.toLowerCase())) {
                    score += 3; // Higher weight for direct tag match
                    matchedKeywords.push(tag);
                }
            });
        }

        // Check specialization mapping
        const specLower = (doctor.specialization || '').toLowerCase();
        Object.entries(SYMPTOM_SPECIALIZATION_MAP).forEach(([keyword, specMatch]) => {
            if (lowerSymptoms.includes(keyword)) {
                if (specLower.includes(specMatch.toLowerCase())) {
                    score += 2;
                    matchedKeywords.push(keyword);
                }
            }
        });

        return {
            ...doctor,
            matchScore: score,
            matchedKeywords: [...new Set(matchedKeywords)]
        };
    });

    // Sort: highest score first, then by name for ties
    scoredDoctors.sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return a.name.localeCompare(b.name);
    });

    return scoredDoctors;
}

/**
 * Detect severity from symptom text
 * @param {string} symptomText
 * @returns {'emergency'|'high'|'normal'} severity level
 */
function detectSeverity(symptomText) {
    if (!symptomText) return 'normal';
    const lower = symptomText.toLowerCase();

    for (const keyword of SEVERITY_KEYWORDS.emergency) {
        if (lower.includes(keyword)) return 'emergency';
    }
    for (const keyword of SEVERITY_KEYWORDS.high) {
        if (lower.includes(keyword)) return 'high';
    }
    return 'normal';
}

/**
 * Calculate appointment priority based on patient attributes and symptoms.
 * @param {Object} params
 * @param {string} params.symptoms - Symptom description
 * @param {string} params.userType - 'student', 'faculty', 'staff'
 * @param {boolean} params.isHandicapped
 * @param {string|Date} params.dateOfBirth
 * @param {string} params.manualPriority - Priority set manually by patient
 * @returns {{ priority: string, reasons: string[] }}
 */
function calculatePriority({ symptoms, userType, isHandicapped, dateOfBirth, manualPriority }) {
    const reasons = [];
    let priorityLevel = 0; // 0=low, 1=normal, 2=high, 3=emergency

    // Severity-based
    const severity = detectSeverity(symptoms);
    if (severity === 'emergency') {
        priorityLevel = Math.max(priorityLevel, 3);
        reasons.push('Severe/emergency symptoms detected');
    } else if (severity === 'high') {
        priorityLevel = Math.max(priorityLevel, 2);
        reasons.push('High-severity symptoms detected');
    }

    // Senior citizen (age >= 60)
    if (dateOfBirth) {
        const dob = new Date(dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        if (age >= 60) {
            priorityLevel = Math.max(priorityLevel, 2);
            reasons.push('Senior citizen (age 60+)');
        }
    }

    // Handicapped
    if (isHandicapped) {
        priorityLevel = Math.max(priorityLevel, 2);
        reasons.push('Person with disability');
    }

    // Faculty
    if (userType === 'faculty') {
        priorityLevel = Math.max(priorityLevel, 2);
        reasons.push('Faculty member');
    }

    // Manual override (only escalate, never de-escalate)
    if (manualPriority === 'emergency') {
        priorityLevel = Math.max(priorityLevel, 3);
    } else if (manualPriority === 'high') {
        priorityLevel = Math.max(priorityLevel, 2);
    }

    const priorityMap = { 0: 'low', 1: 'normal', 2: 'high', 3: 'emergency' };
    const finalPriority = priorityMap[priorityLevel] || 'normal';

    if (reasons.length === 0) reasons.push('Standard priority');

    return { priority: finalPriority, reasons };
}

module.exports = {
    matchDoctors,
    detectSeverity,
    calculatePriority,
    SYMPTOM_SPECIALIZATION_MAP
};
