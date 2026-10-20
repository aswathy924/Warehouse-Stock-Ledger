export function formatISTDateTime(utcString: string | null | undefined): string {
  if (!utcString) return '—';

  try {
    const date = new Date(utcString);
    if (isNaN(date.getTime())) return utcString;

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date) + ' IST';
  } catch {
    return utcString;
  }
}

export function formatCurrencyINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(val)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatQuantity(qty: number | string | null | undefined, unit: string = ''): string {
  if (qty === null || qty === undefined || qty === '') return `0.000 ${unit}`.trim();
  const val = typeof qty === 'string' ? parseFloat(qty) : qty;
  if (isNaN(val)) return `0.000 ${unit}`.trim();

  return `${val.toLocaleString('en-IN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} ${unit}`.trim();
}
