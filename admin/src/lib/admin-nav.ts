export type AdminNavItem = {
  href: string;
  icon: string;
  label: string;
  sub: string;
};

/** Jediný seznam položek adminu — levý panel i dlaždice na Domů. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/orders", icon: "📦", label: "Objednávky", sub: "Všechny objednávky" },
  { href: "/platby", icon: "💸", label: "Platby", sub: "Výdělky a výplaty partnerů" },
  { href: "/faktury", icon: "🧾", label: "Faktury", sub: "Vystavené faktury" },
  { href: "/uzivatele", icon: "👥", label: "Uživatelé", sub: "Registrovaní zákazníci" },
  { href: "/newsletter", icon: "✉️", label: "Newsletter", sub: "Hromadné rozesílky" },
  { href: "/email-history", icon: "📬", label: "Historie mailů", sub: "Odeslané e-maily s náhledem" },
  { href: "/settings", icon: "⚙️", label: "Nastavení", sub: "Firma, SMTP, partneři, šablony" },
  { href: "/statistika", icon: "📊", label: "Statistika", sub: "Tržby, náklady, zisk" },
  { href: "/navstevnost", icon: "📈", label: "Návštěvnost", sub: "Zdroje, stránky, čas na webu" },
  { href: "/products", icon: "🏳️", label: "Produkty", sub: "Produkty na eshopu" },
  { href: "/recenze", icon: "⭐", label: "Recenze", sub: "Hodnocení od zákazníků" },
  { href: "/konfigurace-webu", icon: "🖼️", label: "Konfigurace webu", sub: "Fotky v konfigurátoru" },
];
