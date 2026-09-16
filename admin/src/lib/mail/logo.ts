import fs from "node:fs/promises";
import path from "node:path";
import type { MailAttachment } from "@/lib/mail/deliver";

// Logo do hlavičky mailu (wrapEmailHtml ho vkládá jako cid:provlajkylogo).
// Přibaluje se jako příloha, ne odkazem — obrázky z webu spousta klientů
// ve výchozím stavu blokuje.
let logoB64Cache: string | null | undefined;

export async function getLogoAttachment(): Promise<MailAttachment | null> {
  if (logoB64Cache === undefined) {
    try {
      const bytes = await fs.readFile(path.join(process.cwd(), "src/lib/assets/provlajky-logo.png"));
      logoB64Cache = bytes.toString("base64");
    } catch {
      logoB64Cache = null;
    }
  }
  if (!logoB64Cache) return null;
  return { filename: "logo.png", contentBase64: logoB64Cache, contentType: "image/png", cid: "provlajkylogo" };
}
