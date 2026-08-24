import { createClient } from "@/lib/supabase/server";
import GalleryManager from "./gallery-manager";

export const dynamic = "force-dynamic";

export type GalleryRow = { id: string; category: string; image: string; created_at: string };

export default async function KonfiguraceWebuPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configurator_gallery")
    .select("id, category, image, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2>Konfigurace webu</h2>
      <p className="muted">
        Fotky hotových produktů, které se zákazníkům ukazují v pravém sloupci konfigurátoru vedle vlastního
        nastavení vlajky — jde je proklikat a zvětšit.
      </p>
      {error ? (
        <p className="muted" style={{ color: "#dc2626" }}>
          Tabulka galerie ještě neexistuje — spusť prosím migraci{" "}
          <code>2026-08-configurator-gallery.sql</code> v Supabase SQL editoru.
        </p>
      ) : (
        <GalleryManager rows={(data || []) as GalleryRow[]} />
      )}
    </div>
  );
}
