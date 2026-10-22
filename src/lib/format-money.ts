/**
 * Display format for a dollar amount that arrives as a decimal string
 * ("4.5", "1234.5", "-12"): "$1,234.50". Works on the digits as text so
 * no monetary value ever passes through a floating-point number.
 * Display only: it never changes what is stored or calculated.
 */
export function formatMoney(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return value;
  const [, sign, whole, fraction = ''] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${grouped}.${fraction.padEnd(2, '0')}`;
}
