# Healthcare Platform - LLM Prompts & AI Triage Specification

## 1. Architecture & Provider Abstraction
The system utilizes a 3-tier resilient provider pipeline defined in `server/services/llmService.js`:

```
┌────────────────────────────────────────────────────────┐
│               LLM Service Pipeline                     │
├───────────────────────┬────────────────────────────────┤
│ 1. Local Ollama       │ Gemma 3 4B (http://localhost:11434)
│ 2. Cloud LLM          │ Google Gemini 1.5 Flash (API Key)│
│ 3. Built-in Fallback  │ Clinical NLP Domain Triage Engine│
└───────────────────────┴────────────────────────────────┘
```
If the primary provider is unavailable, times out, or returns malformed JSON, the pipeline immediately falls back to the next tier without breaking the appointment booking transaction.

---

## 2. Pre-Visit AI Triage Prompt Contract

### Prompt Template
```text
System: You are an expert clinical triage assistant. Analyze patient-reported symptoms and return a strictly valid JSON object. Do not include markdown blocks or conversational preamble.

User Prompt:
"Analyse these symptoms and return:
urgency level (Low / Medium / High / Critical),
chief complaint,
and exactly three suggested questions for the doctor.

Symptoms:
{{symptoms}}
Duration: {{duration}}
Reported Severity: {{severity}}/10"
```

### Required JSON Output Schema
```json
{
  "urgency_level": "Low | Medium | High | Critical",
  "chief_complaint": "Concise summary of patient symptoms",
  "symptom_cause": "Primary likely medical etiology",
  "initial_care": "Immediate safe home care instructions",
  "prevention_tips": "Preventative guidance and lifestyle care",
  "medicines_to_avoid": "Specific contraindications",
  "red_flags": "Emergency warning signs requiring urgent care",
  "suggested_questions": [
    "Question 1 for doctor",
    "Question 2 for doctor",
    "Question 3 for doctor"
  ]
}
```

---

## 3. Post-Visit Patient-Friendly Summary Prompt Contract

### Prompt Template
```text
System: You are a compassionate medical communicator. Convert doctor consultation notes and medication orders into an easy-to-understand patient summary. Do not alter drug dosages or clinical instructions.

User Prompt:
"Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps:

Clinical Notes: {{clinicalNotes}}
Diagnosis: {{diagnosis}}
Vitals: {{vitals}}
Prescriptions: {{prescriptions}}"
```

### Required JSON Output Schema
```json
{
  "patient_friendly_summary": "Clear, accessible explanation of the diagnosis and doctor recommendations.",
  "medication_schedule": [
    {
      "time": "08:00 AM",
      "medication": "Paracetamol (500 mg)",
      "instructions": "Take 1 tablet after breakfast"
    }
  ],
  "follow_up_steps": [
    "Step 1",
    "Step 2",
    "Step 3"
  ]
}
```

---

## 4. Clinical Safety & Disclaimers
* AI pre-visit outputs are labeled as **Clinical Decision Support Only** and are never presented as authoritative medical diagnoses.
* Doctor-entered prescriptions are immutable; the LLM is restricted from inventing, altering, or substituting prescribed medications.
