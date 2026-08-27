/**
 * The sidebar's nav list.
 *
 * The `existing` items are LMS v7's own — Killsheets, Purchases, Adjustments, Locations, Admin,
 * Logout — rendered exactly as they appear today but inert. They are here so the prototype reads as
 * part of the real application; they deliberately look ordinary rather than disabled, because a
 * greyed-out sidebar would read as a broken app in a demo.
 *
 * The booking module's own entries sit above Logout, which stays last as it does in the live app.
 */
export interface NavItem {
  readonly label: string;
  /** A Material Symbols Outlined ligature. */
  readonly icon: string;
  /** Present only on the booking module's entries; everything else goes nowhere. */
  readonly route?: string;
  /** Renders the disclosure chevron, as Admin has today. */
  readonly expandable?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Killsheets', icon: 'description' },
  { label: 'Purchases', icon: 'credit_card' },
  { label: 'Adjustments', icon: 'radio_button_checked' },
  { label: 'Locations', icon: 'map' },
  { label: 'Admin', icon: 'shield_person', expandable: true },
  { label: 'Matching', icon: 'swap_horiz', route: '/matching' },
  { label: 'Logout', icon: 'logout' },
];
