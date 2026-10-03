export const ShareIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12.5" cy="3" r="2" /><circle cx="3.5" cy="8" r="2" /><circle cx="12.5" cy="13" r="2" />
    <path d="M5.3 7l5.4-3M5.3 9l5.4 3" />
  </svg>
);

export const StarIcon = ({ filled }) => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
  </svg>
);

export const Caret = () => (
  <svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 1l4 4 4-4" /></svg>
);

export const CloseIcon = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
);

export const SearchIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
);

export const Chevron = ({ left }) => (
  <svg viewBox="0 0 6 10" width="6" height="10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={left ? 'M5 1L1 5l4 4' : 'M1 1l4 4-4 4'} /></svg>
);

export const CalendarIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3.5" width="12" height="10.5" rx="1.5" /><path d="M2 7h12M5.5 1.8v3M10.5 1.8v3" /></svg>
);
