import * as RadixTabs from "@radix-ui/react-tabs";
import { Icon } from "./Icon";
import styles from "./Tabs.module.css";

export interface TabItem {
  value: string;
  label: string;
  icon?: string;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  className?: string;
}

/** Segmented control beraksesibilitas (Radix Tabs). Konten dirender di luar
 *  berdasarkan `value` — komponen ini hanya menyediakan pemilih tab. */
export function Tabs({ value, onValueChange, items, className }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange}>
      <RadixTabs.List className={className ? `${styles.list} ${className}` : styles.list}>
        {items.map((item) => (
          <RadixTabs.Trigger key={item.value} value={item.value} className={styles.trigger}>
            {item.icon && <Icon name={item.icon} size={15} />}
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}
