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

export const LinkIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.1-2.1a3 3 0 0 0-4.2-4.2L7.5 4.3" /><path d="M9.5 6.5a3 3 0 0 0-4.2 0L3.2 8.6a3 3 0 0 0 4.2 4.2l1.1-1.1" />
  </svg>
);

export const TrophyIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2h6v4.5a3 3 0 0 1-6 0V2zM5 3.5H2.5a2.5 2.5 0 0 0 2.5 3M11 3.5h2.5a2.5 2.5 0 0 1-2.5 3M8 9.5v2.5M5.5 14h5" /></svg>
);
export const CalendarIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3.5" width="12" height="10.5" rx="1.5" /><path d="M2 7h12M5.5 1.8v3M10.5 1.8v3" /></svg>
);
export const BlogIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="2" width="11" height="12" rx="1.5" /><path d="M5 5.5h6M5 8h6M5 10.5h3.5" /></svg>
);
export const CoffeeIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5h9v3.5a3.5 3.5 0 0 1-3.5 3.5H6a3.5 3.5 0 0 1-3.5-3.5V6.5zM11.5 7.5h1a1.75 1.75 0 0 1 0 3.5h-1.2M5.5 1.8v2.4M8.5 1.8v2.4" /></svg>
);
