import { useEffect, useMemo, useState } from "react";

interface Paged<T> {
  page: number;
  setPage: (p: number) => void;
  pageCount: number;
  pageItems: T[];
  total: number;
  from: number;
  to: number;
}

/** Paginasi array di sisi klien dengan clamp otomatis saat data berubah. */
export function usePaged<T>(items: T[], pageSize: number): Paged<T> {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Jaga halaman tetap valid saat jumlah item berubah (mis. pencarian).
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return { page, setPage, pageCount, pageItems, total, from, to };
}
