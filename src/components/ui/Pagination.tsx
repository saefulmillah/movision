import { Icon } from "./Icon";
import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPage: (p: number) => void;
  unit?: string;
}

/** Deret nomor halaman dengan jendela + elipsis. */
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}

export function Pagination({ page, pageCount, from, to, total, onPage, unit = "item" }: PaginationProps) {
  if (total === 0) return null;
  return (
    <div className={styles.bar}>
      <span className={styles.info}>
        Menampilkan <b>{from}</b>–<b>{to}</b> dari <b>{total}</b> {unit}
      </span>
      <span className={styles.spacer} />
      {pageCount > 1 && (
        <div className={styles.pages}>
          <button className={styles.btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Sebelumnya">
            <Icon name="arrow-left" size={14} />
          </button>
          {pageWindow(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className={styles.ellipsis}>
                …
              </span>
            ) : (
              <button key={p} className={styles.btn} data-active={p === page || undefined} onClick={() => onPage(p)}>
                {p}
              </button>
            )
          )}
          <button className={styles.btn} onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Berikutnya">
            <Icon name="arrow-left" size={14} style={{ transform: "rotate(180deg)" }} />
          </button>
        </div>
      )}
    </div>
  );
}
