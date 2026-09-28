import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Input.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Ikon Lucide di kiri. */
  icon?: string;
  /** Elemen di kanan (mis. tombol reveal password). */
  trailing?: ReactNode;
  invalid?: boolean;
  wrapClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, trailing, invalid, wrapClassName, className, ...rest },
  ref
) {
  return (
    <div className={wrapClassName ? `${styles.wrap} ${wrapClassName}` : styles.wrap} data-invalid={invalid || undefined}>
      {icon && (
        <span className={styles.lead}>
          <Icon name={icon} size={16} />
        </span>
      )}
      <input ref={ref} className={className ? `${styles.input} ${className}` : styles.input} {...rest} />
      {trailing && <span className={styles.trail}>{trailing}</span>}
    </div>
  );
});
