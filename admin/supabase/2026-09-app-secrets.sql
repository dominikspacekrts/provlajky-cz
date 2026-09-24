-- Tajné klíče služeb (Resend API klíč apod.) zadané v adminu → Nastavení.
-- Hodnota je zašifrovaná AES-256-GCM na serveru adminu. Tabulka nemá žádnou
-- RLS policy, takže ji přes přihlášení (anon/authenticated) nejde číst ani
-- měnit — pracuje s ní jen server adminu přes service role klíč.

create table if not exists app_secrets (
  name text primary key,
  value text not null,
  hint text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;
