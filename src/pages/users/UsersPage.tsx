import { useMemo, useState } from "react";
import { Button, Input, Tabs } from "@/components/ui";
import type { TabItem } from "@/components/ui";
import { useBranch } from "@/context/BranchContext";
import { usePolling } from "@/lib/usePolling";
import { fetchUsers } from "@/lib/users";
import { listRoles } from "@/lib/access";
import { UsersTab } from "./UsersTab";
import { RolesTab } from "./RolesTab";
import styles from "./users.module.css";

type TabKey = "users" | "roles";

const TABS: TabItem[] = [
  { value: "users", label: "Pengguna", icon: "users" },
  { value: "roles", label: "Role & Permission", icon: "shield" }
];

export function UsersPage() {
  const { branches } = useBranch();
  const usersQ = usePolling(fetchUsers, 0);
  const rolesQ = usePolling(listRoles, 0);

  const [tab, setTab] = useState<TabKey>("users");
  const [query, setQuery] = useState("");
  const [createFor, setCreateFor] = useState<null | TabKey>(null);

  const users = usersQ.data ?? [];
  const roleLabels = useMemo(
    () => Object.fromEntries((rolesQ.data ?? []).map((r) => [r.role_code, r.role_name])),
    [rolesQ.data]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name || "").toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} items={TABS} />
        <span className={styles.headSpacer} />
        {tab === "users" && (
          <Input
            wrapClassName={styles.search}
            icon="search"
            placeholder="Cari nama, username, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {tab === "users" && (
          <Button variant="primary" icon="plus" onClick={() => setCreateFor("users")}>
            Tambah Pengguna
          </Button>
        )}
      </div>

      {tab === "users" && (
        <UsersTab
          users={filteredUsers}
          branches={branches}
          loading={usersQ.loading}
          onRefresh={usersQ.refresh}
          openCreate={createFor === "users"}
          onCreateHandled={() => setCreateFor(null)}
          roleLabels={roleLabels}
        />
      )}
      {tab === "roles" && <RolesTab users={users} />}
    </div>
  );
}
