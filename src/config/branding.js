/**
 * Central branding config — ONE place to change the app/company identity.
 *
 * Everything customer-facing (report header/footer, contact banner, app
 * title) reads from here, so renaming the app or swapping brand vs. LLC is a
 * one-file edit. Phase-3 white-labeling will load a per-agency version of
 * this from the database; keeping the shape stable now makes that a drop-in.
 */
export const BRANDING = {
  appName: 'SolarHealth',            // the product/app name (rename freely)
  brandName: 'Your Energy Best',     // customer-facing brand
  legalName: 'Beacon Energies LLC',  // LLC for the fine print
  phone: '',                         // shown in the report contact banner
  email: '',
  website: '',
  tagline: 'Keep this system earning for the next 20 years'
};
