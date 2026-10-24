const NAME_PAD = 32;
const AVATAR_SLOT = 26;
const NAME_SLACK = 8;
const NAME_CHAR_PX = 8.5;

/** How many name letters fit beside compact columns on this table width. */
export function leaderboardNameCharacterCap(input: {
  tableWidth: number;
  rankWidth: number;
  compactCount: number;
  compactColumnWidth: number;
  valueColumnWidth: number;
  secondaryWidth?: number;
}): number | null {
  if (input.compactCount <= 0) return null;
  if (input.tableWidth <= 0) return 11;
  const reserved =
    NAME_PAD +
    input.rankWidth +
    AVATAR_SLOT +
    input.compactCount * input.compactColumnWidth +
    (input.secondaryWidth ?? 0) +
    input.valueColumnWidth +
    NAME_SLACK;
  return Math.max(8, Math.min(18, Math.floor((input.tableWidth - reserved) / NAME_CHAR_PX)));
}
