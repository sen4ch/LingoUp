import type { SVGProps } from 'react';

const paths = {
  book: 'M12 7c-3-2-6-2-9-1v14c3-1 6-1 9 1m0-14c3-2 6-2 9-1v14c-3-1-6-1-9 1V7Z',
  cards: 'M8 3h12v15H8zM4 7v14h12',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list: 'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
  edit: 'm16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5',
  image: 'M3 3h18v18H3zM3 16l6-6 12 11M15 7h.01',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  close: 'm6 6 12 12M6 18 18 6',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  chevron: 'm9 5 7 7-7 7',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  check: 'm5 12 4 4L19 6',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 6v1a6 6 0 0 0 12 0v-1M12 18v4m-4 0h8',
  phone: 'm5 3 4 1 1 5-3 2a17 17 0 0 0 6 6l2-3 5 1 1 4c-1 3-4 3-7 1A22 22 0 0 1 4 10C2 7 2 4 5 3Z',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 4 12 8-12 8V4Z',
  mail: 'M3 5h18v14H3V5Zm0 0 9 8 9-8',
  headphones:
    'M4 13v-1a8 8 0 0 1 16 0v1M4 12h3v9H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Zm16 0h-3v9h3a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2Z',
  film: 'M3 3h18v18H3V3Zm4 0v18M17 3v18M3 8h4M3 16h4m10-8h4m-4 8h4M7 12h10',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
};

export function VocabularyIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
