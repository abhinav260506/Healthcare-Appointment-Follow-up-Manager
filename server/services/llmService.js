import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

let aiClient = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY') {
    try {
      return new GoogleGenerativeAI(apiKey);
    } catch (err) {
      console.warn('[LLM Service] Failed to initialize Gemini API client:', err.message);
    }
  }
  return null;
}

/**
 * Call Ollama Local LLM (Gemma 3 4B model)
 */
async function callOllamaModel(prompt) {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const modelName = process.env.OLLAMA_MODEL || 'gemma3:4b';

  try {
    const res = await axios.post(`${ollamaUrl}/api/generate`, {
      model: modelName,
      prompt,
      stream: false,
      format: 'json'
    }, { timeout: 8000 });

    if (res.data?.response) {
      return res.data.response;
    }
  } catch (err) {
    // Ollama not running locally - proceed to cloud/fallback providers silently
  }
  return null;
}

/**
 * Pre-visit Summary LLM Generator — Extended Analysis
 */
export async function generatePreVisitSummary(symptoms, duration = '3 days', severity = 5) {
  const prompt = `You are a clinical triage AI. A patient reports the following symptoms:

Symptoms: ${symptoms}
Duration: ${duration}
Self-rated severity: ${severity}/10

Analyse thoroughly and return ONLY a valid JSON object:
{
  "urgency_level": "Low" | "Medium" | "High" | "Critical",
  "chief_complaint": "One clear sentence summarizing the main medical concern",
  "symptom_cause": "Brief explanation of likely causes or triggers for these symptoms",
  "prevention_tips": "Key preventive steps the patient should follow",
  "initial_care": "Immediate home care steps the patient can safely take before the doctor visit",
  "medicines_to_avoid": "List any medicines or substances that could worsen these symptoms",
  "red_flags": "Warning signs that mean the patient must seek emergency care immediately",
  "suggested_next_visit": "Recommended follow-up timeline (e.g. 'Return in 2 weeks', 'Follow up in 1 month')",
  "suggested_questions": [
    "Question 1 the doctor should ask",
    "Question 2 the doctor should ask",
    "Question 3 the doctor should ask"
  ]
}

IMPORTANT: Urgency must correctly reflect severity. Severity 1-3 = Low, 4-5 = Medium, 6-7 = High, 8-10 = Critical (unless symptoms are mild irrespective of score).`;

  // 1. Try Ollama (Gemma 3 4B) Provider
  const ollamaText = await callOllamaModel(prompt);
  if (ollamaText) {
    try {
      const jsonMatch = ollamaText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[LLM Service] Pre-visit summary generated via local Ollama Gemma 3 4B.');
        return buildPreVisitResult(parsed, symptoms, duration, severity, ollamaText, 'ollama-gemma-3-4b');
      }
    } catch (e) {}
  }

  // 2. Try Google Gemini Provider
  const ai = getGeminiClient();
  if (ai) {
    try {
      console.log('[LLM Service] Calling Gemini API for Pre-Visit Summary...');
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text() || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return buildPreVisitResult(parsed, symptoms, duration, severity, text, 'gemini-1.5-flash');
      }
    } catch (err) {
      console.warn('[LLM Service] Gemini API call failed for pre-visit summary. Falling back:', err.message);
    }
  }

  // 3. Graceful Fallback Engine (Never crashes!)
  return generateFallbackPreVisitSummary(symptoms, duration, severity);
}

function buildPreVisitResult(parsed, symptoms, duration, severity, rawText, provider) {
  const validUrgency = ['Low', 'Medium', 'High', 'Critical'];
  // Override urgency based on severity score if LLM gives wrong rating
  let urgency = validUrgency.includes(parsed.urgency_level) ? parsed.urgency_level : deriveSeverityLevel(severity);
  // Severity score override (trust score over LLM if mismatch is major)
  if (severity >= 8 && urgency === 'Low') urgency = 'High';
  if (severity >= 9 && urgency !== 'Critical') urgency = 'Critical';
  if (severity <= 2 && urgency === 'Critical') urgency = 'Medium';

  return {
    urgency_level: urgency,
    chief_complaint: parsed.chief_complaint || `Patient reports: ${symptoms.substring(0, 120)}`,
    symptom_cause: parsed.symptom_cause || 'Cause analysis pending physician review.',
    prevention_tips: parsed.prevention_tips || 'Maintain adequate rest, hydration, and follow prescribed treatment.',
    initial_care: parsed.initial_care || 'Rest, stay hydrated, avoid strenuous activity. Take OTC pain relief if appropriate.',
    medicines_to_avoid: parsed.medicines_to_avoid || 'Consult doctor before taking any new medications.',
    red_flags: parsed.red_flags || 'Seek emergency care if symptoms worsen dramatically or new severe symptoms appear.',
    suggested_next_visit: parsed.suggested_next_visit || suggestNextVisit(urgency),
    suggested_questions: Array.isArray(parsed.suggested_questions) && parsed.suggested_questions.length >= 3
      ? parsed.suggested_questions.slice(0, 3)
      : getDefaultQuestions(symptoms),
    raw_llm_output: rawText,
    status: 'success',
    provider
  };
}

function deriveSeverityLevel(severity) {
  if (severity >= 8) return 'Critical';
  if (severity >= 6) return 'High';
  if (severity >= 4) return 'Medium';
  return 'Low';
}

function suggestNextVisit(urgency) {
  if (urgency === 'Critical') return 'Immediate follow-up or emergency care required';
  if (urgency === 'High') return 'Follow up within 3-5 days';
  if (urgency === 'Medium') return 'Follow up in 1-2 weeks';
  return 'Follow up in 4 weeks if symptoms persist';
}


/**
 * Post-visit Summary LLM Generator
 * Spec Contract: "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"
 */
export async function generatePostVisitSummary(clinicalNotes, diagnosis, vitals, prescriptions) {
  const notesText = `Clinical Notes: ${clinicalNotes}. Diagnosis: ${diagnosis}. Vitals: ${JSON.stringify(vitals)}. Prescriptions: ${JSON.stringify(prescriptions)}`;
  
  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notesText}

Return ONLY a valid JSON object in this format:
{
  "patient_friendly_summary": "Clear, encouraging, non-jargon explanation of the diagnosis and care plan",
  "medication_schedule": [
    { "time": "08:00 AM", "medication": "Drug Name & Dose", "instructions": "How to take" }
  ],
  "follow_up_steps": [
    "Step 1 recommendation",
    "Step 2 recommendation",
    "Step 3 recommendation"
  ]
}`;

  // 1. Try Ollama (Gemma 3 4B) Provider
  const ollamaText = await callOllamaModel(prompt);
  if (ollamaText) {
    try {
      const jsonMatch = ollamaText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[LLM Service] Successfully generated post-visit summary using local Ollama Gemma 3 4B model.');
        return {
          patient_friendly_summary: parsed.patient_friendly_summary || `Summary for ${diagnosis}`,
          medication_schedule: Array.isArray(parsed.medication_schedule) ? parsed.medication_schedule : [],
          follow_up_steps: Array.isArray(parsed.follow_up_steps) ? parsed.follow_up_steps : [],
          raw_llm_output: ollamaText,
          status: 'success',
          provider: 'ollama-gemma-3-4b'
        };
      }
    } catch (e) {}
  }

  // 2. Try Google Gemini Provider
  const ai = getGeminiClient();
  if (ai) {
    try {
      console.log('[LLM Service] Calling Gemini API for Post-Visit Summary...');
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text() || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          patient_friendly_summary: parsed.patient_friendly_summary || `Summary for ${diagnosis}`,
          medication_schedule: Array.isArray(parsed.medication_schedule) ? parsed.medication_schedule : [],
          follow_up_steps: Array.isArray(parsed.follow_up_steps) ? parsed.follow_up_steps : [],
          raw_llm_output: text,
          status: 'success',
          provider: 'gemini-1.5-flash'
        };
      }
    } catch (err) {
      console.warn('[LLM Service] Gemini API call failed for post-visit summary. Operating with fallback:', err.message);
    }
  }

  // 3. Graceful Fallback Engine
  return generateFallbackPostVisitSummary(clinicalNotes, diagnosis, vitals, prescriptions);
}

// --------------------------------------------------------------------------
// Graceful Fallback LLM Heuristic Generators
// --------------------------------------------------------------------------

function generateFallbackPreVisitSummary(symptoms, duration, severity) {
  const lower = symptoms.toLowerCase();
  let urgency = deriveSeverityLevel(severity);

  // Clinical Domain Keyword Weight Tables
  const domains = [
    {
      id: 'cardiac',
      primary: ['chest pain', 'chest tightness', 'chest pressure', 'heart', 'angina', 'palpitation', 'palpitations', 'cardiac', 'myocardial', 'racing heart'],
      secondary: ['crushing', 'radiating to jaw', 'radiating to arm', 'chest discomfort', 'tachycardia', 'irregular beat']
    },
    {
      id: 'respiratory',
      primary: ['cough', 'coughing', 'wheez', 'wheezing', 'asthma', 'shortness of breath', 'breathlessness', 'bronchitis', 'phlegm', 'mucus', 'lungs', 'gasping'],
      secondary: ['heavy breathing', 'inhaler', 'breathing difficulty', 'dry cough', 'productive cough']
    },
    {
      id: 'gastrointestinal',
      primary: ['stomach', 'abdomen', 'abdominal', 'vomit', 'vomiting', 'diarrhea', 'acid reflux', 'heartburn', 'constipat', 'bloat', 'bloating', 'gastric', 'gerd', 'nausea'],
      secondary: ['cramps in stomach', 'food poisoning', 'belly pain', 'indigestion', 'burning in chest', 'loose stools', 'acidity']
    },
    {
      id: 'neurological',
      primary: ['headache', 'migraine', 'dizz', 'dizziness', 'vertigo', 'numbness', 'tingling', 'faint', 'fainting', 'syncope', 'seizure', 'aura', 'throbbing head'],
      secondary: ['lightheaded', 'visual aura', 'pins and needles', 'head throbbing', 'loss of balance']
    },
    {
      id: 'dermatology',
      primary: ['rash', 'itch', 'itching', 'itchy', 'hives', 'skin', 'eczema', 'psoriasis', 'urticaria', 'blister', 'boil', 'acne', 'spots on skin', 'welts'],
      secondary: ['red spots', 'scaling skin', 'flaking', 'skin redness', 'raised bumps']
    },
    {
      id: 'ent',
      primary: ['sore throat', 'throat pain', 'ear pain', 'sinus', 'tonsil', 'tonsillitis', 'swallow', 'ear discharge', 'nasal congestion', 'hoarse voice', 'ear infection'],
      secondary: ['runny nose', 'stuffy nose', 'ear ache', 'throat irritation', 'loss of smell']
    },
    {
      id: 'fever_infection',
      primary: ['fever', 'high temperature', 'chills', 'flu', 'sweating at night', 'shivering', 'viral', 'body aches', 'infection'],
      secondary: ['feeling sick', 'hot and cold', 'muscle ache with fever', 'high fever']
    },
    {
      id: 'musculoskeletal',
      primary: ['back pain', 'lower back', 'joint pain', 'knee pain', 'neck pain', 'sprain', 'shoulder pain', 'arthritis', 'muscle pull', 'sciatica', 'hip pain', 'ankle sprain'],
      secondary: ['stiffness in joint', 'swollen knee', 'strained back', 'back spasm', 'knee swelling']
    },
    {
      id: 'urinary',
      primary: ['urination', 'burning urine', 'burning sensation when urinating', 'frequent urination', 'bladder', 'kidney stone', 'uti', 'blood in urine', 'flank pain', 'pelvic pain'],
      secondary: ['urine color', 'urinary tract', 'groin pain']
    },
    {
      id: 'mental',
      primary: ['anxiety', 'panic attack', 'insomnia', 'sleep problem', 'cannot sleep', 'depression', 'stress', 'racing thoughts', 'nervousness', 'exhaustion'],
      secondary: ['overwhelmed', 'restless', 'poor sleep', 'panic']
    }
  ];

  // Score each domain based on keyword presence
  let bestDomain = 'general';
  let highestScore = 0;

  for (const dom of domains) {
    let score = 0;
    for (const kw of dom.primary) {
      if (lower.includes(kw)) score += 3;
    }
    for (const kw of dom.secondary) {
      if (lower.includes(kw)) score += 1.5;
    }
    if (score > highestScore) {
      highestScore = score;
      bestDomain = dom.id;
    }
  }

  // Clinical profile builder based on identified domain
  let cause = '';
  let prevention = '';
  let initialCare = '';
  let medicinesAvoid = '';
  let redFlags = '';
  let nextVisit = '';
  let questions = [];

  switch (bestDomain) {
    case 'cardiac':
      if (severity >= 6 || lower.includes('crush') || lower.includes('radiat') || lower.includes('breath') || lower.includes('tight')) {
        urgency = 'Critical';
      } else {
        urgency = 'High';
      }
      cause = 'Chest and cardiac symptoms may indicate myocardial ischemia, angina pectoris, pericardial irritation, costochondritis, or gastroesophageal acid reflux.';
      prevention = 'Manage blood pressure and cholesterol, reduce dietary sodium and saturated fats, eliminate smoking, and avoid sudden unconditioned physical strain.';
      initialCare = 'Sit down and rest immediately in an upright position. Loosen tight clothing. Avoid all physical exertion and maintain calm, steady breathing.';
      medicinesAvoid = 'Avoid decongestants (pseudoephedrine), energy drinks, high doses of NSAIDs, and sudden cessation of prescribed cardiovascular drugs.';
      redFlags = 'CALL EMERGENCY (911) IMMEDIATELY if chest pain is crushing, radiates to jaw/arm/back, or occurs with cold sweats, dizziness, or vomiting.';
      nextVisit = urgency === 'Critical' ? 'Immediate emergency medical care' : 'Urgent consultation within 24 to 48 hours';
      questions = [
        'Does the chest discomfort radiate to your left arm, shoulder, neck, or jaw?',
        'Is the sensation aggravated by physical exertion and relieved by sitting or resting?',
        'Have you noticed accompanying shortness of breath, sweating, or lightheadedness?'
      ];
      break;

    case 'respiratory':
      if (lower.includes('shortness') || lower.includes('gasp') || severity >= 8) {
        urgency = 'Critical';
      } else if (severity >= 5) {
        urgency = 'High';
      } else {
        urgency = 'Medium';
      }
      cause = 'Respiratory symptoms typically stem from viral/bacterial airway infections, allergic airway hyperreactivity, bronchitis, or asthma exacerbation.';
      prevention = 'Avoid secondhand smoke, chemical fumes, cold dry air exposure, and dust mites. Keep living spaces well-ventilated and consider air purification.';
      initialCare = 'Practice steam inhalation for 10-15 minutes, elevate your head with extra pillows while sleeping, stay hydrated with warm fluids, and use prescribed inhalers if applicable.';
      medicinesAvoid = 'Avoid aspirin if you have asthma, unprescribed cough suppressants when productive mucus is present, and respiratory depressants.';
      redFlags = 'Seek emergency care immediately if you experience persistent wheezing unresponsive to inhalers, blue lips/fingertips, or inability to speak in full sentences.';
      nextVisit = urgency === 'Critical' ? 'Emergency evaluation immediately' : 'Follow up within 3 to 5 days';
      questions = [
        'Is the cough dry and hacking, or productive with discolored phlegm?',
        'Do you notice any wheezing sound or tightness when exhaling?',
        'Have you been exposed to allergens, smoke, or viral infections recently?'
      ];
      break;

    case 'gastrointestinal':
      if (severity >= 8 || lower.includes('blood') || lower.includes('severe cramp')) {
        urgency = 'High';
      } else if (severity >= 5) {
        urgency = 'Medium';
      } else {
        urgency = 'Low';
      }
      cause = 'Abdominal symptoms are commonly associated with acute gastroenteritis, dietary intolerance, gastritis, GERD acid reflux, or irritable bowel changes.';
      prevention = 'Eat smaller, frequent bland meals (BRAT diet), avoid spicy/greasy foods, avoid lying down within 3 hours after eating, and maintain good hand hygiene.';
      initialCare = 'Sip Oral Rehydration Solution (ORS) or electrolyte water in small amounts. Apply a warm compress to the abdomen. Stick to clear broths and crackers.';
      medicinesAvoid = 'Avoid NSAID painkillers (ibuprofen, naproxen) which can irritate stomach lining. Avoid antidiarrheals if accompanied by high fever or bloody stool.';
      redFlags = 'Seek urgent care if you experience severe localized right lower abdominal pain, vomiting blood, black tarry stools, or inability to keep fluids down for 24 hours.';
      nextVisit = urgency === 'High' ? 'Consult doctor within 24 hours' : 'Follow up in 5 to 7 days if symptoms persist';
      questions = [
        'Where exactly is the pain located (upper, lower, right, left), and does it radiate to the back?',
        'Have you experienced vomiting, diarrhea, or difficulty keeping liquids down?',
        'Does eating food relieve the discomfort or make it significantly worse?'
      ];
      break;

    case 'neurological':
      if (lower.includes('thunderclap') || lower.includes('sudden') || lower.includes('numb') || severity >= 8) {
        urgency = 'Critical';
      } else if (severity >= 5) {
        urgency = 'High';
      } else {
        urgency = 'Medium';
      }
      cause = 'Headaches and neurological sensations can be triggered by muscle tension, vascular migraine spasms, dehydration, visual strain, or inner ear vestibular imbalances.';
      prevention = 'Establish regular sleep hours, limit continuous screen time, practice ergonomic neck posture, stay properly hydrated, and manage daily emotional stress.';
      initialCare = 'Rest in a quiet, dark, well-ventilated room. Apply a cool gel pack to forehead or warm pack to the back of the neck. Drink plenty of water.';
      medicinesAvoid = 'Avoid overuse of combination painkillers (to prevent rebound medication-overuse headaches), excessive caffeine, and alcohol.';
      redFlags = 'Seek emergency care for sudden "thunderclap" headache, facial drooping, one-sided arm weakness, slurred speech, or headache with fever and stiff neck.';
      nextVisit = urgency === 'Critical' ? 'Immediate emergency medical screening' : 'Follow up in 3 to 7 days';
      questions = [
        'Is the headache throbbing on one side, or a tight band-like pressure all around?',
        'Are you experiencing nausea, sensitivity to light/sound, or visual aura spots?',
        'Did the headache begin suddenly like a thunderclap or build up gradually?'
      ];
      break;

    case 'dermatology':
      if (lower.includes('lip') || lower.includes('tongue') || lower.includes('throat swelling') || severity >= 8) {
        urgency = 'Critical';
      } else if (severity >= 5) {
        urgency = 'Medium';
      } else {
        urgency = 'Low';
      }
      cause = 'Dermatological symptoms can indicate contact dermatitis, allergic urticaria, viral exanthem, fungal dermatophytosis, or eczema flare.';
      prevention = 'Use hypoallergenic fragrance-free cleansers, moisturize skin immediately after bathing, and avoid known contact allergens or harsh laundry detergents.';
      initialCare = 'Apply a cool, damp compress to soothe the itch. Apply a mild calamine or hypoallergenic ceramide moisturizer. Keep fingernails short to prevent skin breakage.';
      medicinesAvoid = 'Avoid scratching which can introduce secondary bacterial infections. Avoid strong topical steroid creams on the face without a doctor prescription.';
      redFlags = 'Seek emergency care immediately if rash is accompanied by facial/lip/tongue swelling, wheezing, or dizziness (anaphylaxis warning).';
      nextVisit = urgency === 'Critical' ? 'Immediate emergency medical care' : 'Follow up in 1 to 2 weeks';
      questions = [
        'When did the rash first appear, and has it spread to other body areas?',
        'Have you recently started any new medications, cosmetics, soaps, or foods?',
        'Does the rash blister, ooze, itch intensely, or feel tender and hot to touch?'
      ];
      break;

    case 'ent':
      if (severity >= 8 || lower.includes('cannot swallow') || lower.includes('breathing')) {
        urgency = 'High';
      } else {
        urgency = 'Medium';
      }
      cause = 'ENT symptoms are frequently caused by pharyngitis, tonsillar inflammation, middle ear effusion, or acute rhinosinusitis congestion.';
      prevention = 'Use saline nasal rinses during dry weather, avoid vocal strain, and avoid inserting cotton swabs or foreign objects into the ear canal.';
      initialCare = 'Gargle with warm salt water (1/2 tsp salt in 1 cup warm water) 3-4 times daily. Drink warm honey lemon water. Use a room cool-mist humidifier.';
      medicinesAvoid = 'Avoid decongestant nasal sprays for more than 3 consecutive days (to prevent rebound rhinitis medicamentosa) and unprescribed ear drops if eardrum may be perforated.';
      redFlags = 'Seek immediate care if you develop inability to swallow your own saliva, difficulty opening your mouth (trismus), or neck swelling.';
      nextVisit = 'Follow up within 4 to 7 days';
      questions = [
        'Is swallowing painful, and have you noticed white patches on your tonsils?',
        'Do you have ear pain, fluid drainage, or reduced hearing in either ear?',
        'Do you feel facial pressure or tenderness above your eyebrows or under your eyes?'
      ];
      break;

    case 'fever_infection':
      if (severity >= 8 || lower.includes('high fever') || lower.includes('104')) {
        urgency = 'High';
      } else if (severity >= 4) {
        urgency = 'Medium';
      } else {
        urgency = 'Low';
      }
      cause = 'Fever reflects an active immunological defense response to viral, bacterial, or inflammatory processes in the body.';
      prevention = 'Practice frequent hand hygiene with soap and water, stay up to date with seasonal immunizations, and ensure adequate physical rest during recovery.';
      initialCare = 'Take paracetamol/acetaminophen for temperature comfort as directed. Dress in light breathable layers. Drink water, soups, and electrolyte solutions frequently.';
      medicinesAvoid = 'Avoid aspirin in children and teenagers. Do not self-prescribe leftover antibiotics without medical confirmation of a bacterial infection.';
      redFlags = 'Seek immediate medical attention if fever exceeds 103°F (39.5°C), lasts over 3 days, or is accompanied by confusion, stiff neck, or petechial rash.';
      nextVisit = urgency === 'High' ? 'See doctor within 24-48 hours' : 'Follow up in 3 to 5 days';
      questions = [
        'What has your highest recorded body temperature been, and at what time of day?',
        'Are you experiencing other symptoms like sore throat, cough, urinary burning, or rash?',
        'Have you recently traveled or been in close contact with someone who was sick?'
      ];
      break;

    case 'musculoskeletal':
      if (severity >= 8 || lower.includes('cannot walk') || lower.includes('incontinence')) {
        urgency = 'High';
      } else if (severity >= 5) {
        urgency = 'Medium';
      } else {
        urgency = 'Low';
      }
      cause = 'Musculoskeletal discomfort typically arises from ligamentous sprains, postural strain, myofascial trigger points, joint degeneration, or disc compression.';
      prevention = 'Maintain core muscle strength, practice correct lifting techniques with bent knees, take ergonomic stretch breaks, and wear supportive footwear.';
      initialCare = 'Apply cold packs for acute injuries (first 48h) or gentle moist heat for chronic tightness. Perform gentle range-of-motion stretching without forcing through sharp pain.';
      medicinesAvoid = 'Avoid prolonged total bed rest (which stiffens joints) and avoid high-dose NSAIDs if you have a history of ulcers or kidney issues.';
      redFlags = 'Seek urgent care if you experience sudden loss of bowel/bladder control, progressive foot drop or leg numbness, or joint swelling with high fever.';
      nextVisit = urgency === 'High' ? 'Medical evaluation within 48 hours' : 'Consult doctor in 1 to 2 weeks';
      questions = [
        'Did this pain begin after a specific lifting event or trauma, or develop progressively?',
        'Does the pain shoot or tingle down into your leg, buttock, or fingers?',
        'Is stiffness worst in the morning when getting out of bed, and does gentle motion help?'
      ];
      break;

    case 'urinary':
      if (severity >= 8 || lower.includes('blood') || lower.includes('flank pain')) {
        urgency = 'High';
      } else {
        urgency = 'Medium';
      }
      cause = 'Urinary discomfort commonly points to lower urinary tract infections (cystitis), urethral irritation, or renal calculus (kidney stone) transit.';
      prevention = 'Drink 2 to 3 liters of water daily, do not delay urination when the urge arises, and wipe front-to-back.';
      initialCare = 'Increase fluid intake with plenty of water to help flush the urinary tract. Avoid caffeinated, carbonated, and alcoholic beverages.';
      medicinesAvoid = 'Avoid unprescribed antibiotics (which cause resistant strains) and avoid high doses of calcium or vitamin C supplements if stones are suspected.';
      redFlags = 'Seek prompt medical care if you develop high fever with chills, severe one-sided flank/back pain, or visible red blood in the urine.';
      nextVisit = 'Consult doctor within 24 to 48 hours';
      questions = [
        'Do you feel a burning sensation during urination or an urgent need to urinate frequently?',
        'Have you noticed any blood or cloudy discoloration in your urine?',
        'Do you have back/side pain accompanied by fever or nausea?'
      ];
      break;

    case 'mental':
      urgency = severity >= 8 ? 'High' : severity >= 5 ? 'Medium' : 'Low';
      cause = 'Psychological and sleep symptoms are frequently linked to autonomic nervous system overarousal, circadian rhythm disruption, or prolonged emotional exhaustion.';
      prevention = 'Maintain a fixed sleep-wake schedule, establish a 30-minute tech-free winding down routine, and engage in daily aerobic exercise.';
      initialCare = 'Practice 4-7-8 rhythmic diaphragmatic breathing, write down worries before bedtime, and take brief restful pauses throughout the workday.';
      medicinesAvoid = 'Avoid over-the-counter sleep aids containing sedating antihistamines for long periods, and avoid late afternoon caffeine or evening alcohol.';
      redFlags = 'Seek immediate medical support if you feel overwhelmed, experience uncontrollable panic attacks with chest pain, or have thoughts of self-harm.';
      nextVisit = 'Schedule consultation within 1 to 2 weeks';
      questions = [
        'How many hours of restful sleep are you getting per night on average?',
        'Do you experience physical symptoms like racing heartbeat, shakiness, or muscle tension during stress?',
        'How significantly are these feelings impacting your work, appetite, and daily activities?'
      ];
      break;

    default:
      cause = 'Symptoms may arise from localized inflammation, physical fatigue, seasonal changes, or physiological imbalance.';
      prevention = 'Maintain balanced nutrition, stay properly hydrated, ensure adequate sleep, and monitor for changes.';
      initialCare = 'Rest in a comfortable position, hydrate adequately with water and electrolytes, and avoid physical or mental stressors.';
      medicinesAvoid = 'Avoid unprescribed antibiotics or taking multiple new over-the-counter medicines simultaneously.';
      redFlags = 'Seek emergency medical evaluation if you develop sudden breathlessness, severe pain, fainting, or high fever.';
      nextVisit = suggestNextVisit(urgency);
      questions = [
        'When did you first notice these symptoms, and have they worsened over time?',
        'Are there specific triggers or activities that aggravate or relieve your discomfort?',
        'Have you taken any over-the-counter medications for this, and did they provide relief?'
      ];
      break;
  }

  return {
    urgency_level: urgency,
    chief_complaint: `Patient presents with ${symptoms.toLowerCase()} lasting approximately ${duration} (Severity: ${severity}/10).`,
    symptom_cause: cause,
    prevention_tips: prevention,
    initial_care: initialCare,
    medicines_to_avoid: medicinesAvoid,
    red_flags: redFlags,
    suggested_next_visit: nextVisit,
    suggested_questions: questions,
    raw_llm_output: `Built-in clinical NLP engine [Domain: ${bestDomain}]. Detailed triage report generated.`,
    status: 'success',
    provider: 'built-in-clinical-nlp'
  };
}

function getDefaultQuestions(symptoms) {
  const lower = symptoms.toLowerCase();
  if (lower.includes('chest') || lower.includes('heart') || lower.includes('breath')) {
    return [
      'Do symptoms increase during physical activity or stress?',
      'Does the pain radiate to your shoulder, back, or neck?',
      'Have you noticed any swelling in your legs or ankles?'
    ];
  } else if (lower.includes('skin') || lower.includes('rash') || lower.includes('itch')) {
    return [
      'Have you come into contact with any new skincare products or allergens recently?',
      'Does the area itch, burn, or spread at night?',
      'Have you noticed any fever or joint discomfort alongside the rash?'
    ];
  } else if (lower.includes('stomach') || lower.includes('abdom') || lower.includes('nausea')) {
    return [
      'Where is the pain located and does it worsen after eating?',
      'Have you experienced vomiting, diarrhea, or difficulty keeping fluids down?',
      'Are you having acid reflux or heartburn sensations?'
    ];
  } else {
    return [
      'When did you first notice these symptoms, and have they worsened over time?',
      'Are there specific triggers or activities that aggravate or relieve your discomfort?',
      'Have you taken any over-the-counter medications for this, and did they provide relief?'
    ];
  }
}

function generateFallbackPostVisitSummary(clinicalNotes, diagnosis, vitals, prescriptions = []) {
  const parsedRx = Array.isArray(prescriptions) ? prescriptions : [];

  const schedule = parsedRx.map((rx, idx) => {
    const times = ['08:00 AM', '08:00 PM', '02:00 PM'];
    return {
      time: times[idx % times.length],
      medication: `${rx.drug || rx.medication_name || 'Prescription'} (${rx.dosage || '1 dose'})`,
      instructions: rx.frequency || 'Take as directed by doctor'
    };
  });

  if (schedule.length === 0) {
    schedule.push({
      time: '08:00 AM',
      medication: 'Prescribed medication',
      instructions: 'Take 1 tablet daily with food.'
    });
  }

  return {
    patient_friendly_summary: `During today's appointment, your doctor diagnosed: ${diagnosis}. ${clinicalNotes}. Please follow the treatment plan outlined below carefully and contact our clinic if symptoms persist.`,
    medication_schedule: schedule,
    follow_up_steps: [
      'Take all prescribed medications according to the schedule provided.',
      'Stay well-hydrated and rest as needed.',
      'Schedule a follow-up consultation in 2 weeks or if symptoms change.'
    ],
    raw_llm_output: 'Built-in LLM Heuristic Fallback post-visit summary generated.',
    status: 'fallback',
    provider: 'built-in-heuristic'
  };
}

