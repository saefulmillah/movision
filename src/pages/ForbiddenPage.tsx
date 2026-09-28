import { EmptyState } from "@/components/ui/EmptyState";

/** State 403 — pengguna tidak berwenang mengakses layar ini. */
export function ForbiddenPage() {
  return (
    <EmptyState
      icon="shield"
      title="Akses ditolak"
      description="Anda tidak memiliki hak akses untuk membuka halaman ini. Hubungi administrator bila menurut Anda ini keliru."
    />
  );
}
