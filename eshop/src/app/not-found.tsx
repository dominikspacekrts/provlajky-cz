import NotFoundContent from "@/components/NotFoundContent";

// 404 uvnitř aplikace — když routa zavolá notFound() (neexistující produkt
// nebo kategorie). Renderuje se v layoutu, takže má hlavičku i patičku.
export default function NotFound() {
  return <NotFoundContent />;
}
