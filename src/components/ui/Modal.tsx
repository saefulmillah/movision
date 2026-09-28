import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, onOpenChange, title, footer, children, width }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} style={width ? { width } : undefined}>
          {title && (
            <div className={styles.head}>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              <Dialog.Close className={styles.close} aria-label="Tutup">
                <Icon name="x" size={16} />
              </Dialog.Close>
            </div>
          )}
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
