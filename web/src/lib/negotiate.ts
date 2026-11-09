import type { ClinicRules, Deal, Round } from "./types";

const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const roundUp = (n: number, step: number) => Math.ceil(n / step - 1e-9) * step;

function buildDeal(target: number, monthly: number): Deal {
  const months = Math.ceil(target / monthly - 1e-9);
  const lastPayment = Math.round((target - monthly * (months - 1)) * 100) / 100;
  return { monthly, months, lastPayment, total: target, outcome: "agreed" };
}

// Both sides follow clear rules. This is a prototype of agent-to-agent settlement.
export function negotiate(target: number, budget: number, rules: ClinicRules) {
  const rounds: Round[] = [];
  const stretch = Math.round(budget * 1.25);

  const offerMonths = Math.ceil(target / budget - 1e-9);
  rounds.push({
    from: "patient",
    monthly: budget,
    months: offerMonths,
    message: `My patient can pay ${money(budget)} a month toward ${money(target)}. That is ${offerMonths} months.`,
  });

  if (budget < rules.min_monthly) {
    const monthly = rules.min_monthly;
    rounds.push({
      from: "clinic",
      monthly,
      months: Math.ceil(target / monthly),
      message: `Our smallest plan is ${money(monthly)} a month. We can also check financial assistance for your patient.`,
    });
    return { rounds, deal: { ...buildDeal(target, monthly), outcome: "needs_assistance" as const } };
  }

  if (offerMonths <= rules.preferred_months) {
    rounds.push({ from: "clinic", monthly: budget, months: offerMonths, message: `Accepted. ${money(budget)} a month works for us.` });
    return { rounds, deal: buildDeal(target, budget) };
  }

  if (offerMonths <= rules.max_months) {
    const counter = Math.max(roundUp(target / rules.preferred_months, rules.round_monthly_up_to), rules.min_monthly);
    const cMonths = Math.ceil(target / counter - 1e-9);
    rounds.push({
      from: "clinic",
      monthly: counter,
      months: cMonths,
      message: `We prefer plans of ${rules.preferred_months} months or less. We can offer ${money(counter)} a month for ${cMonths} months, and we will waive late fees.`,
    });
    if (counter <= stretch) {
      rounds.push({
        from: "patient",
        monthly: counter,
        months: cMonths,
        message: `${money(counter)} a month for ${cMonths} months fits my patient's budget. My patient accepts, pending their final approval.`,
      });
      return { rounds, deal: buildDeal(target, counter) };
    }
    const mid = roundUp((budget + counter) / 2, rules.round_monthly_up_to);
    rounds.push({ from: "patient", monthly: mid, months: Math.ceil(target / mid - 1e-9), message: `Could we meet at ${money(mid)} a month?` });
    rounds.push({ from: "clinic", monthly: mid, months: Math.ceil(target / mid - 1e-9), message: "Agreed." });
    return { rounds, deal: buildDeal(target, mid) };
  }

  const monthly = roundUp(target / rules.max_months, rules.round_monthly_up_to);
  rounds.push({
    from: "clinic",
    monthly,
    months: Math.ceil(target / monthly - 1e-9),
    message: `The longest plan we offer is ${rules.max_months} months, which is ${money(monthly)} a month. We can also look at financial assistance.`,
  });
  return { rounds, deal: { ...buildDeal(target, monthly), outcome: "needs_assistance" as const } };
}
