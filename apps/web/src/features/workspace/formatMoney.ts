const formatters = new Map<string, Intl.NumberFormat>();

const formatterFor = (currency: string): Intl.NumberFormat => {
  const cached = formatters.get(currency);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  formatters.set(currency, formatter);
  return formatter;
};

/** Formats integer minor units without converting them through an imprecise Number. */
export const formatMoney = (minor: string, currency: string): string => {
  const value = BigInt(minor);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");

  return formatterFor(currency)
    .formatToParts(whole)
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("")
    .replace(/\u00a0/gu, " ");
};
