import * as RadixSelect from "@radix-ui/react-select";
import { Icon } from "./Icon";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: string;
  className?: string;
  ariaLabel?: string;
}

export function Select({ value, onValueChange, options, placeholder, icon, className, ariaLabel }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger className={className ? `${styles.trigger} ${className}` : styles.trigger} aria-label={ariaLabel}>
        {icon && (
          <span className={styles.lead}>
            <Icon name={icon} size={15} />
          </span>
        )}
        <span className={styles.value}>
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className={styles.caret}>
          <Icon name="chevron-down" size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content className={styles.content} position="popper" sideOffset={6}>
          <RadixSelect.ScrollUpButton className={styles.scrollBtn}>
            <Icon name="chevron-up" size={14} />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className={styles.viewport}>
            {options.map((opt) => (
              <RadixSelect.Item key={opt.value} value={opt.value} className={styles.item}>
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className={styles.indicator}>
                  <Icon name="check" size={15} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className={styles.scrollBtn}>
            <Icon name="chevron-down" size={14} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
