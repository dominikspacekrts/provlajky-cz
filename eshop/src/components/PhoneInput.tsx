"use client";

// Telefon se navenek ukládá jako jediný string ve tvaru "+420605981155" (do
// existujícího CustomerAddress.phone) — žádná změna typu, žádný zásah do
// adminu/e-mailů/PDF, ty pole dál čtou jako obyčejný string. Komponenta jen
// rozkládá tenhle string na předvolbu + číslice pro pohodlnější zadávání.

import { useMemo } from "react";
import { DIAL_CODES, DIAL_CODE_BY_ISO, DEFAULT_DIAL_ISO, parsePhoneValue } from "@/lib/dial-codes";
import { flagSrc } from "@/lib/countries";

export default function PhoneInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
}) {
  const parsed = useMemo(() => parsePhoneValue(value), [value]);

  function compose(iso: string, digits: string) {
    return digits ? `+${DIAL_CODE_BY_ISO[iso] ?? DIAL_CODE_BY_ISO[DEFAULT_DIAL_ISO]}${digits}` : "";
  }

  return (
    <div className="phone-input">
      <div className="phone-input-dial">
        <span className="phone-input-flag" style={{ backgroundImage: `url(${flagSrc(parsed.iso)})` }} aria-hidden />
        <select
          aria-label={`Předvolba: ${DIAL_CODES.find((d) => d.iso === parsed.iso)?.name ?? ""} +${DIAL_CODE_BY_ISO[parsed.iso] ?? ""}`}
          value={parsed.iso}
          onChange={(e) => onChange(compose(e.target.value, parsed.digits))}
        >
          {DIAL_CODES.map((d) => (
            <option key={d.iso} value={d.iso} title={d.name}>
              +{d.dial}
            </option>
          ))}
        </select>
      </div>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="605 981 155"
        value={parsed.digits}
        onChange={(e) => onChange(compose(parsed.iso, e.target.value.replace(/\D/g, "")))}
      />
    </div>
  );
}
