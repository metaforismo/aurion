import { money } from '../../../lib/format';

/** "+€ 12,4 Mln" / "−€ 3,1 Mln" — money with an explicit direction. */
export function signedMoney(value: number, locale: string, digits = 1): string {
  const body = money(Math.abs(value), locale, digits);
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}
