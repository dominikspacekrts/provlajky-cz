"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GalleryCategory = "plazove-vlajky" | "vlajky-na-zakazku";

export async function addGalleryPhoto(category: GalleryCategory, image: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("configurator_gallery").insert({ category, image });
  if (error) throw new Error(error.message);
  revalidatePath("/konfigurace-webu");
}

export async function deleteGalleryPhoto(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("configurator_gallery").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/konfigurace-webu");
}
