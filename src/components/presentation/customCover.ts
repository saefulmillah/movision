/* Util id slide sampul kustom yang dibuat user di builder: "cover:<unik>".
   Judulnya memakai peta override judul (titles) di PresentationContext. */

export const CUSTOM_COVER_PREFIX = "cover:";

export function isCustomCover(id: string): boolean {
  return id.startsWith(CUSTOM_COVER_PREFIX);
}

export function makeCustomCoverId(): string {
  return `${CUSTOM_COVER_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
