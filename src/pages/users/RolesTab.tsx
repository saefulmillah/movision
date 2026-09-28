import { Icon } from "@/components/ui";
import { ROLE_CATALOG } from "@/constants/rbac";
import type { UserRecord } from "@/types/users";
import styles from "./users.module.css";

interface RolesTabProps {
  users: UserRecord[];
}

export function RolesTab({ users }: RolesTabProps) {
  const countByRole = (code: string) => users.filter((u) => u.roles.includes(code)).length;

  return (
    <div className={styles.body} style={{ flexDirection: "column" }}>
      <div className={styles.roleGrid}>
        {ROLE_CATALOG.map((role) => (
          <div key={role.code} className={styles.roleCard}>
            <div className={styles.roleHead}>
              <span className={styles.roleIcon}>
                <Icon name={role.icon} size={19} />
              </span>
              <span style={{ minWidth: 0 }}>
                <div className={styles.roleLabel}>{role.label}</div>
                <div className={styles.roleCode}>{role.code}</div>
              </span>
              <span style={{ marginLeft: "auto", textAlign: "right" }}>
                <div className={styles.roleLabel} style={{ fontFamily: "var(--font-mono)" }}>{countByRole(role.code)}</div>
                <div className={styles.roleCode}>pengguna</div>
              </span>
            </div>
            <div className={styles.roleDesc}>{role.description}</div>
            <div className={styles.section}>
              <span className={styles.sectionLabel}>{role.permissions.length} Permission</span>
              <div className={styles.chips}>
                {role.permissions.map((p) => (
                  <span key={p} className={`${styles.chip} ${styles.chipMono}`}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.roleInfoNote}>
        <Icon name="info" size={16} />
        Role bersifat sistem — tidak dapat dibuat atau dihapus dari antarmuka. Penetapan role ke pengguna dilakukan pada tab Pengguna.
      </div>
    </div>
  );
}
