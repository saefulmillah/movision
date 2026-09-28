import { api } from "@/lib/api";
import type { Camera } from "@/types/cctv";

/** Daftar kamera. Bila ada ruas aktif → per ruas; jika "Semua Ruas" → dibatasi. */
export function fetchCameras(branchId: number | null): Promise<Camera[]> {
  if (branchId != null) {
    return api.get<Camera[]>(`/cameras/branch/${branchId}`);
  }
  return api.get<Camera[]>("/cameras?limit=200");
}
