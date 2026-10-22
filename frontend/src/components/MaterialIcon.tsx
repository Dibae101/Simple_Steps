/**
 * MaterialIcon — a Material Design icon from `@mdi/js`, drawn as inline SVG.
 *
 * Usage:
 *   import { mdiCogOutline } from '@mdi/js';
 *   <MaterialIcon path={mdiCogOutline} />            — default size 16
 *   <MaterialIcon path={mdiLoading} spin size={14} />
 *
 * `@mdi/js` exports each icon as an SVG path string, so only the icons that
 * are imported reach the bundle, and nothing is fetched at runtime — it works
 * offline (the desktop app). The icon takes `currentColor`, like text.
 * Codicons (`Icon`) remain the app chrome's set; this is for the agent UI.
 */
export interface MaterialIconProps {
  /** An icon's path from `@mdi/js`, e.g. `mdiCogOutline`. */
  path: string;
  /** Pixel size. Default 16. */
  size?: number;
  /** Rotate continuously (for a loading icon). */
  spin?: boolean;
  /** Tooltip text; also the accessible name. Without it the icon is decorative. */
  title?: string;
  className?: string;
}

export default function MaterialIcon({ path, size = 16, spin = false, title, className = '' }: MaterialIconProps) {
  return (
    <svg
      className={`material-icon${spin ? ' material-icon--spin' : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={path} />
    </svg>
  );
}
