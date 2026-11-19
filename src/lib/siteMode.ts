// Staff and developers normally open straight into their panel. Tapping the
// logo in the panel header turns "site mode" on so they can browse the app's
// own Home / Map like everyone else; the "Panel" button on Home turns it off.
// Kept in memory only: a fresh app start always opens the panel.

let on = false;

export const siteMode = {
  get: (): boolean => on,
  set: (v: boolean): void => {
    on = v;
  },
};
