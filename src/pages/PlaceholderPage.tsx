import { EmptyState } from "@/components/ui/EmptyState";

interface PlaceholderPageProps {
  icon: string;
  title: string;
  description: string;
}

/** Layar yang belum dibangun pada fase kerangka. Diganti per fase berikutnya. */
export function PlaceholderPage({ icon, title, description }: PlaceholderPageProps) {
  return <EmptyState icon={icon} title={title} description={description} badge="Segera hadir" />;
}
