import { api } from "@/lib/api";
import type { Camera } from "@/types/cctv";

/** Daftar kamera. Pakai endpoint list `/cameras` (bukan `/cameras/branch/:id` yang
 *  di-hard-code 20/halaman & hanya kamera aktif) agar SEMUA kamera ruas tampil
 *  termasuk yang offline. branch_id memfilter per ruas; limit 500 (maks backend). */
export function fetchCameras(branchId: number | null): Promise<Camera[]> {
  if (branchId != null) {
    return api.get<Camera[]>(`/cameras?branch_id=${branchId}&limit=500`);
  }
  return api.get<Camera[]>("/cameras?limit=500");
}
