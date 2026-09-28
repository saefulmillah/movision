import type { CSSProperties } from "react";

/**
 * Ikon Lucide dirender sebagai CSS mask (handoff §7) sehingga warnanya
 * mengikuti `currentColor` dan bisa diwarnai lewat token mana pun.
 *
 * Nama ikon = nama file Lucide, mis. "layout-dashboard", "cctv", "siren".
 */

// Pin versi agar tampilan stabil. Bila kelak dipindah ke paket lokal
// (mis. `lucide-static` di node_modules), cukup ganti builder URL ini.
const LUCIDE_VERSION = "0.469.0";

function iconUrl(name: string): string {
  return `https://unpkg.com/lucide-static@${LUCIDE_VERSION}/icons/${name}.svg`;
}

export type IconName = string;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function Icon({ name, size, className, style, title }: IconProps) {
  const vars = {
    "--icon-url": `url(${iconUrl(name)})`,
    ...(size ? { "--icon-size": `${size}px` } : {})
  } as CSSProperties;

  return (
    <span
      className={className ? `icon ${className}` : "icon"}
      style={{ ...vars, ...style }}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
