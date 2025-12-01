
export type ClubBadgeProps = {
  code: string;          // three-letter code, e.g. "ARS"
  size?: number;         // pixel size (height/width)
  className?: string;    // optional extra classes
  rounded?: boolean;     // if true, use fully rounded shape
};

/**
 * Minimal club badge renderer. Expects a PNG in `/assets/badges/<CODE>.png`.
 * Example: <ClubBadge code="BRE" size={22} />
 */
export default function ClubBadge({ code, size = 22, className = "", rounded = false }: ClubBadgeProps) {
  const src = `/assets/badges/${code}.png`;
  const alt = `${code} badge`;

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`${rounded ? "rounded-full" : "rounded"} object-contain inline-block align-middle select-none pointer-events-none ${className}`}
      loading="lazy"
      onError={(e) => {
        // fall back to a neutral dot if a badge is missing
        (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
      }}
    />
  );
}