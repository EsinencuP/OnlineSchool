import {
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  CreditCard,
  Ellipsis,
  FolderOpen,
  House,
  Mail,
  Menu,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
const glyphs = {
  home: House,
  calendar: CalendarDays,
  tasks: ClipboardCheck,
  skills: ChartNoAxesColumnIncreasing,
  materials: FolderOpen,
  wallet: CreditCard,
  profile: UserRound,
  users: UsersRound,
  leads: Mail,
  health: ShieldCheck,
  bell: Bell,
  menu: Menu,
  more: Ellipsis,
  close: X,
  brand: BookOpen,
};
export function Icon({ name }: { name: keyof typeof glyphs }) {
  const Glyph = glyphs[name];
  return <Glyph size={22} strokeWidth={1.7} aria-hidden="true" focusable="false" />;
}
