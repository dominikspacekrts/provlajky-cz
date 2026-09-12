// Sdílená validace pro formuláře, kterými zákazník posílá kontaktní údaje
// (checkout, kontakt, registrace). Cíl je "blbuvzdorné" ověření formátu, ne
// dokonalé ověření existence — proto např. telefon kontroluje jen rozumný
// počet číslic, ne plné E.164 párování.

import { parsePhoneValue } from "./dial-codes";

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// České PSČ: 5 číslic, volitelně s mezerou za třetí (137 01).
export const CZ_PSC_REGEX = /^\d{3}\s?\d{2}$/;

export function isValidPsc(psc: string): boolean {
  return CZ_PSC_REGEX.test(psc.trim());
}

/** Vloží mezeru za třetí číslicí za psaní, ignoruje nečíselné znaky. */
export function formatPsc(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 5);
  return digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
}

// Rozumná délka národního čísla podle předvolby — cíl je odchytit překlepy
// (moc krátké/dlouhé číslo), ne validovat existenci čísla.
const PHONE_DIGIT_RANGE: Record<string, [number, number]> = {
  cz: [9, 9],
  sk: [9, 9],
};

export function isValidPhoneDigits(digits: string, dialIso: string): boolean {
  const clean = digits.replace(/\D/g, "");
  const [min, max] = PHONE_DIGIT_RANGE[dialIso] ?? [4, 15];
  return clean.length >= min && clean.length <= max;
}

/** Ověří telefon uložený jako "+420605981155" (viz PhoneInput/CustomerAddress.phone). */
export function isValidPhone(value: string): boolean {
  const { iso, digits } = parsePhoneValue(value);
  return isValidPhoneDigits(digits, iso);
}

// Klíče odpovídají polím CustomerAddress — klient je prefixuje billing/shipping
// (billingEmail, shippingPsc, …), server bere první hlášku jako 400.
export type AddressFields = {
  company?: string;
  name?: string;
  street?: string;
  psc?: string;
  city?: string;
  ico?: string;
  email?: string;
  phone?: string;
  isCompany?: boolean;
};

export function billingFieldErrors(addr: AddressFields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(addr.name?.trim() || addr.company?.trim())) errors.name = "Vyplňte jméno nebo firmu.";
  if (!addr.email?.trim() || !isValidEmail(addr.email)) errors.email = "Zadejte platný e-mail.";
  if (!isValidPhone(addr.phone ?? "")) errors.phone = "Zadejte platné telefonní číslo.";
  if (!addr.street?.trim()) errors.street = "Vyplňte ulici a č.p.";
  if (!addr.city?.trim()) errors.city = "Vyplňte město.";
  if (!addr.psc?.trim() || !isValidPsc(addr.psc)) errors.psc = "PSČ musí mít tvar 137 01.";
  if (addr.isCompany && !addr.ico?.trim()) errors.ico = "Nákup na firmu vyžaduje IČO.";
  return errors;
}

export function shippingFieldErrors(addr: AddressFields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!addr.street?.trim()) errors.street = "Vyplňte ulici a č.p.";
  if (!addr.city?.trim()) errors.city = "Vyplňte město.";
  if (!addr.psc?.trim() || !isValidPsc(addr.psc)) errors.psc = "PSČ musí mít tvar 137 01.";
  return errors;
}

export function firstFieldError(errors: Record<string, string>): string | undefined {
  return Object.values(errors)[0];
}
