const Anthropic = require("@anthropic-ai/sdk");

const isLive = () => process.env.LLM_MODE === "live" && !!process.env.ANTHROPIC_API_KEY;

let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function extractJson(text) {
  // Strip markdown code fences if the model wraps its JSON in them.
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in LLM response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Pre-visit summary: urgency level, chief complaint, suggested questions.
 * Prompt per assignment spec.
 */
async function generatePreVisitSummary(symptomText) {
  const prompt = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptomText}

Respond ONLY with a raw JSON object (no markdown, no preamble) in exactly this shape:
{
  "urgencyLevel": "Low" | "Medium" | "High",
  "chiefComplaint": "string, one sentence",
  "suggestedQuestions": ["string", "string", "string"]
}`;

  if (!isLive()) {
    return mockPreVisitSummary(symptomText);
  }

  try {
    const resp = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    const parsed = extractJson(text);
    return {
      urgencyLevel: parsed.urgencyLevel || "Medium",
      chiefComplaint: parsed.chiefComplaint || symptomText.slice(0, 140),
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.slice(0, 3) : [],
      generatedAt: new Date(),
      raw: text,
      failed: false,
    };
  } catch (err) {
    // Graceful degradation: never let an LLM failure block the booking flow.
    console.error("LLM pre-visit summary failed:", err.message);
    return {
      ...mockPreVisitSummary(symptomText),
      failed: true,
      raw: `LLM error: ${err.message}`,
    };
  }
}

/**
 * Post-visit summary: patient-friendly version of clinical notes.
 */
async function generatePostVisitSummary(clinicalNotes, prescription = []) {
  const prescriptionText = prescription
    .map((p) => `${p.medicine} ${p.dosage}, ${p.frequencyPerDay}x/day for ${p.durationDays} days. ${p.instructions || ""}`)
    .join("; ");

  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${clinicalNotes}
Prescription: ${prescriptionText}

Respond ONLY with a raw JSON object (no markdown, no preamble) in exactly this shape:
{
  "summaryText": "string, 2-4 sentences in plain language",
  "medicationSchedule": ["string", "..."],
  "followUpSteps": ["string", "..."]
}`;

  if (!isLive()) {
    return mockPostVisitSummary(clinicalNotes, prescription);
  }

  try {
    const resp = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    const parsed = extractJson(text);
    return {
      summaryText: parsed.summaryText || clinicalNotes,
      medicationSchedule: parsed.medicationSchedule || [],
      followUpSteps: parsed.followUpSteps || [],
      generatedAt: new Date(),
      raw: text,
      failed: false,
    };
  } catch (err) {
    console.error("LLM post-visit summary failed:", err.message);
    return {
      ...mockPostVisitSummary(clinicalNotes, prescription),
      failed: true,
      raw: `LLM error: ${err.message}`,
    };
  }
}

// --- Mock generators (used when LLM_MODE !== "live", or as a safe fallback on error) ---

function mockPreVisitSummary(symptomText) {
  const lower = (symptomText || "").toLowerCase();
  const highUrgencyKeywords = ["chest pain", "difficulty breathing", "severe bleeding", "unconscious", "stroke"];
  const urgencyLevel = highUrgencyKeywords.some((k) => lower.includes(k)) ? "High" : "Medium";
  return {
    urgencyLevel,
    chiefComplaint: (symptomText || "Unspecified symptoms").slice(0, 140),
    suggestedQuestions: [
      "When did the symptoms first start, and have they gotten worse?",
      "Are there any other symptoms you haven't mentioned yet?",
      "Are you currently taking any medications or have relevant medical history?",
    ],
    generatedAt: new Date(),
    raw: "[MOCK MODE] Deterministic placeholder summary — set LLM_MODE=live and ANTHROPIC_API_KEY to enable real generation.",
    failed: false,
  };
}

function mockPostVisitSummary(clinicalNotes, prescription) {
  return {
    summaryText: `Here's a simple summary of your visit: ${clinicalNotes || "The doctor reviewed your condition and provided guidance."} Please follow the medication schedule below and reach out if symptoms worsen.`,
    medicationSchedule: (prescription || []).map(
      (p) => `${p.medicine}: take ${p.dosage}, ${p.frequencyPerDay}x/day for ${p.durationDays} days`
    ),
    followUpSteps: ["Complete the full course of medication", "Rest and stay hydrated", "Contact the clinic if symptoms persist beyond a few days"],
    generatedAt: new Date(),
    raw: "[MOCK MODE] Deterministic placeholder summary — set LLM_MODE=live and ANTHROPIC_API_KEY to enable real generation.",
    failed: false,
  };
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
