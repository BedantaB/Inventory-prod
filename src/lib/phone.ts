/**
 * Indian mobile numbers. Stored as +91XXXXXXXXXX (10 digits starting 6–9).
 * Accepts what people actually type: "98290 12345", "+91-98290-12345", "098290 12345", "919829012345".
 */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+919829012345" → "+91 98290 12345" */
export function formatPhone(stored: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(stored);
  return match ? `+91 ${match[1]} ${match[2]}` : stored;
}
