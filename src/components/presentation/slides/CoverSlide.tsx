import styles from "./CoverSlide.module.css";

export interface Fact {
  k: string;
  v: string;
}

interface CoverSlideProps {
  kicker: string;
  title: string;
  sub: string;
  facts: Fact[];
}

export function CoverSlide({ kicker, title, sub, facts }: CoverSlideProps) {
  return (
    <div className={styles.cover}>
      <span className={styles.kicker}>{kicker}</span>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.sub}>{sub}</div>
      {facts.length > 0 && (
        <div className={styles.facts}>
          {facts.map((f) => (
            <div key={f.k} className={styles.fact}>
              <span className={styles.factKey}>{f.k}</span>
              <span className={styles.factVal}>{f.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
