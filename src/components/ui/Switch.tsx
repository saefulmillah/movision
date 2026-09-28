import * as RadixSwitch from "@radix-ui/react-switch";
import styles from "./Switch.module.css";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel?: string;
  title?: string;
  /** Cegah klik menyebar (mis. di dalam baris yang punya onClick sendiri). */
  stopPropagation?: boolean;
}

export function Switch({ checked, onCheckedChange, ariaLabel, title, stopPropagation }: SwitchProps) {
  return (
    <RadixSwitch.Root
      className={styles.switch}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      title={title}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <RadixSwitch.Thumb className={styles.thumb} />
    </RadixSwitch.Root>
  );
}
