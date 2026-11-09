export type Line = {
  line: number;
  internal_code: string;
  description: string;
  quantity: number;
  charge: number;
};

export type ClinicRules = {
  min_monthly: number;
  max_months: number;
  preferred_months: number;
  round_monthly_up_to: number;
  interest: number;
  can_waive_late_fees: boolean;
  financial_assistance_available: boolean;
};

export type Bill = {
  bill_id: string;
  title: string;
  patient: { name: string; age: number; occupation: string; insurance: string };
  provider: { name: string; type: string };
  date_of_service: string;
  discharge_date?: string;
  line_items: Line[];
  total_charges: number;
  insurance: { note: string; paid: number; contractual_adjustment: number };
  patient_responsibility_as_billed: number;
  bill_notes: string;
  correct_patient_responsibility: number | null;
  negotiation_context: { patient_monthly_budget: number; clinic_rules: ClinicRules };
  // answer_key is for testing only and is stripped before anything reaches the browser
  answer_key?: unknown;
};

export type Finding = {
  id: string;
  type: string;
  title: string;
  lines: number[];
  confidence: "high" | "medium";
  explain: string;
  fix: string;
  savings: number | null;
  source?: "rules" | "ai";
};

export type Round = {
  from: "patient" | "clinic";
  monthly: number;
  months: number;
  message: string;
};

export type Deal = {
  monthly: number;
  months: number;
  lastPayment: number;
  total: number;
  outcome: "agreed" | "needs_assistance";
};
