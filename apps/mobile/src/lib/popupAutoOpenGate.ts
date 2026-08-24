/** Admin Home Simulator should not receive live GW round-up auto-open. */
let suppressPopupAutoOpen = false;

export function setSuppressPopupAutoOpen(value: boolean): void {
  suppressPopupAutoOpen = value;
}

export function isPopupAutoOpenSuppressed(): boolean {
  return suppressPopupAutoOpen;
}
