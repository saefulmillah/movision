import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import styles from "./SosStrip.module.css";

interface SosStripProps {
  count: number;
}

/** Muncul hanya bila ada tiket SOS terbuka (handoff §SosStrip). */
export function SosStrip({ count }: SosStripProps) {
  const navigate = useNavigate();
  return (
    <div className={styles.strip} role="alert">
      <span className={styles.siren}>
        <Icon name="siren" size={18} />
      </span>
      <span className={styles.text}>
        {count} tiket SOS aktif memerlukan penanganan
      </span>
      <span className={styles.sub}>menunggu operator</span>
      <span className={styles.spacer} />
      <button className={styles.action} onClick={() => navigate("/sos")} type="button">
        <Icon name="ambulance" size={15} />
        Buka Worklist SOS
      </button>
    </div>
  );
}
