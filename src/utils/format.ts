const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(Math.round(v));
  return `${sign}$${abs.toLocaleString()}`;
}

export function formatSimDate(simDay: number): string {
  const startYear = 2000;
  const dayOfYear = simDay % 365;
  const year = startYear + Math.floor(simDay / 365);
  const month = Math.min(11, Math.floor(dayOfYear / 30.42));
  const day = Math.floor(dayOfYear - month * 30.42) + 1;
  return `${MONTHS[month]} ${day}, ${year}`;
}

export function formatNumber(v: number): string {
  return Math.round(v).toLocaleString();
}
