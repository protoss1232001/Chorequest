/* ==========================================================================
   ChoreQuest — tab bar icons.
   Stroked SVGs drawn in currentColor so they take the active tint, which
   emoji cannot do.
   ========================================================================== */

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  today: svg('<path d="M9 12.5l2.2 2.2L15.5 10"/><circle cx="12" cy="12" r="9"/>'),
  rewards: svg('<path d="M20 12v8.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5V12"/><rect x="2.5" y="7.5" width="19" height="4.5" rx="1"/><path d="M12 7.5V21"/><path d="M12 7.5H7.75a2.375 2.375 0 1 1 0-4.75C11 2.75 12 7.5 12 7.5z"/><path d="M12 7.5h4.25a2.375 2.375 0 1 0 0-4.75C13 2.75 12 7.5 12 7.5z"/>'),
  progress: svg('<path d="M3 20h18"/><path d="M6.5 20v-6"/><path d="M12 20V7"/><path d="M17.5 20v-9"/>'),
  family: svg('<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V20a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V9.5"/><path d="M9.5 20.5v-6h5v6"/>'),
  review: svg('<path d="M18 8.5a6 6 0 1 0-12 0c0 5.5-2 7-2 7h16s-2-1.5-2-7"/><path d="M13.7 19.5a2 2 0 0 1-3.4 0"/>'),
  manage: svg('<path d="M4 7h10"/><path d="M18 7h2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>'),
  settings: svg('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
};
