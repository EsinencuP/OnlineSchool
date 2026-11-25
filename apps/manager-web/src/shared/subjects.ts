import type { Tone } from './ui';

/** Brand subject illustrations from /logo and a stable colour per subject. */
export const SUBJECT_ICON: Record<string, string> = {
  Математика: '/2k-academy-icon-math.svg',
  'Английский язык': '/2k-academy-icon-languages.svg',
  Физика: '/2k-academy-icon-physics-chemistry.svg',
  Химия: '/2k-academy-icon-physics-chemistry.svg',
  Информатика: '/2k-academy-icon-it.svg',
  История: '/2k-academy-icon-history.svg',
};

export const SUBJECT_TONE: Record<string, Tone> = {
  Математика: 'yellow',
  'Английский язык': 'coral',
  Физика: 'blue',
  Химия: 'violet',
  Информатика: 'teal',
  История: 'violet',
};
