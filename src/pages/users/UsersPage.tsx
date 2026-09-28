import { useMemo, useState } from "react";
import { Button, Input, Tabs } from "@/components/ui";
import type { TabItem } from "@/components/ui";
import { useBranch } from "@/context/BranchContext";
import { usePolling } from "@/lib/usePolling";
import { fetchAdminMenus, fetchUsers } from "@/lib/users";
import { UsersTab } from "./UsersTab";
import { RolesTab } from "./RolesTab";
import { MenusTab } from "./MenusTab";
import styles from "./users.module.css";

type TabKey = "users" | "roles" | "menus";

const TABS: TabItem[] = [
  { value: "users", label: "Pengguna", icon: "users" },
  { value: "roles", label: "Role & Permission", icon: "shield" },
  { value: "menus", label: "Hak Akses Menu", icon: "list-tree" }
];

export function UsersPage() {
  const { branches } = useBranch();
  const usersQ = usePolling(fetchUsers, 0);
  const menusQ = usePolling(fetchAdminMenus, 0);

  const [tab, setTab] = useState<TabKey>("users");
  const [query, setQuery] = useState("");
  const [createFor, setCreateFor] = useState<null | TabKey>(null);

  const users = usersQ.data ?? [];
  const menus = menusQ.data ?? [];

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

  const filteredMenus = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menus;
    return menus.filter((m) => m.menu_name.toLowerCase().includes(q) || m.menu_code.toLowerCase().includes(q));
  }, [menus, query]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} items={TABS} />
        <span className={styles.headSpacer} />
        {tab !== "roles" && (
          <Input
            wrapClassName={styles.search}
            icon="search"
            placeholder={tab === "users" ? "Cari nama, username, email…" : "Cari menu…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {tab === "users" && (
          <Button variant="primary" icon="plus" onClick={() => setCreateFor("users")}>
            Tambah Pengguna
          </Button>
        )}
        {tab === "menus" && (
          <Button variant="primary" icon="plus" onClick={() => setCreateFor("menus")}>
            Tambah Menu
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
        />
      )}
      {tab === "roles" && <RolesTab users={users} />}
      {tab === "menus" && (
        <MenusTab
          menus={filteredMenus}
          loading={menusQ.loading}
          onRefresh={menusQ.refresh}
          openCreate={createFor === "menus"}
          onCreateHandled={() => setCreateFor(null)}
        />
      )}
    </div>
  );
}
