// Number formatting shared by every screen, so money, people and time read
// the same everywhere.

/** 1_234_567_890 → "1,2 Mld" (it) / "1.2B" (en). */
export function compactNumber(value: number, locale: string, digits = 1): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: digits,
  }).format(value);
}

/** Compact currency without a symbol clash: "€ 1,2 Mld". */
export function money(value: number, locale: string, digits = 1): string {
  return `€ ${compactNumber(value, locale, digits)}`;
}

/** Signed compact number: "+12,4 Mln" / "−3,1 Mln". */
export function signed(value: number, locale: string, digits = 1): string {
  const body = compactNumber(Math.abs(value), locale, digits);
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

/** 0.264 → "26%". */
export function percent(value: number, locale: string, digits = 0): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(value);
}

/** Game ticks are weeks. Returns { years, weeks } for "2 anni e 3 sett." copy. */
export function splitWeeks(ticks: number): { years: number; weeks: number } {
  const t = Math.max(0, Math.round(ticks));
  return { years: Math.floor(t / 52), weeks: t % 52 };
}
