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
  Video,
  Clock,
  ArrowRight,
  Check,
  Circle,
  CircleAlert,
  Info,
  Headphones,
  ExternalLink,
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
  video: Video,
  clock: Clock,
  arrow: ArrowRight,
  check: Check,
  circle: Circle,
  warning: CircleAlert,
  info: Info,
  manager: Headphones,
  external: ExternalLink,
};
export type IconName = keyof typeof glyphs;
export type IconProps = { name: IconName; size?: number; className?: string };
// Decorative by contract. Name the enclosing control, never duplicate its announcement.
export function Icon({ name, size = 22, className }: IconProps) {
  const Glyph = glyphs[name];
  return (
    <Glyph
      className={className}
      size={size}
      strokeWidth={1.7}
      aria-hidden="true"
      focusable="false"
    />
  );
}
