// Plain-language meanings for charge codes used in the sample bills (all fictional).
const MEANINGS: Record<string, string> = {
  "ER-TRAUMA": "The hospital's fee for having a trauma team ready the moment you arrive after a serious accident.",
  "ER-PHY-TR": "The emergency doctor who examined you after the accident.",
  "ER-FAC-3": "The hospital's fee for using its emergency room.",
  "ER-PHY-3": "The emergency doctor who examined you.",
  "RAD-CT3": "A CT scan: a detailed 3D X-ray used to look for injuries inside your head, chest and belly.",
  "OR-FEM": "The surgeon's work repairing your broken thigh bone with metal hardware.",
  "ANES": "The doctors who put you to sleep and watched over you during surgery.",
  "OR-IMPL": "Operating room supplies and the metal implant that holds the bone in place.",
  "OR-SRG": "The surgery itself.",
  "OR-SUP": "Supplies used in the operating room.",
  "RM-SEMI": "Your hospital bed and nursing care. This is charged per night.",
  "RX-INP": "Medicines you were given while in the hospital.",
  "PT-EVAL": "A therapist checking how you move, to plan your recovery.",
  "PT-SES": "A physical therapy session.",
  "CARD-ECG": "An ECG: a quick test that records your heart's electrical activity.",
  "LAB-TROP": "A blood test that checks for heart damage.",
  "RAD-CXR": "A chest X-ray.",
  "UC-VISIT": "The urgent care visit with a clinician.",
  "RAD-ANK3": "An X-ray of your ankle from three angles.",
  "DME-SPL": "A splint to support your ankle while it heals.",
  "PC-PREV": "A routine yearly checkup.",
  "LAB-PNL": "A routine blood test panel.",
  "IMM-FLU": "A flu shot.",
  "MRI-LSP": "An MRI scan of your lower back.",
  "RAD-READ": "The radiologist who reads your scan and writes the report.",
  "CON-GAD": "A contrast dye that makes parts of the scan easier to see.",
  "LAB-INP": "Blood and other lab tests during your stay.",
  "PC-FUP": "A follow-up visit with your doctor.",
  "LAB-A1C": "A blood test that shows your average blood sugar over three months.",
  "LAB-LIP": "A blood test that checks your cholesterol.",
  "GI-COL": "A colonoscopy: a camera exam of the colon.",
  "PATH": "A lab checking any tissue taken during the exam.",
  "FAC": "The center's fee for using its procedure room and equipment.",
};

export function explainLine(code: string, description: string) {
  return MEANINGS[code] ?? `A charge for: ${description}.`;
}

// Optional: let a free AI model polish the wording. The app works without a key.
export async function polish(text: string, role: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return text;
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are ${role}. Rewrite the message below in warm, plain English, 2 sentences at most. Keep every number and fact exactly as written. Do not add medical or legal advice.\n\n${text}`,
              },
            ],
          },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return text;
    const data = await res.json();
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return out || text;
  } catch {
    return text;
  }
}
