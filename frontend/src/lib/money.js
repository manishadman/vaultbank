export function formatCad(minor) {
  const value = BigInt(minor ?? 0);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const dollars = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${dollars}.${cents}`;
}

export function formatWhen(value) {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function bpsToPercent(bps) {
  const value = Number(bps || 0);
  return `${(value / 100).toFixed(2)}%`;
}

export function newIdempotencyKey() {
  return `web-${crypto.randomUUID()}`;
}
