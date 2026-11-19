import { Icon } from '@online-school/ui';
import academyLogo from '../../../../logo/2k-academy-logo.svg';
import mascot from '../../../../logo/2k-academy-mascot.svg';
import historyIcon from '../../../../logo/2k-academy-icon-history.svg';
import itIcon from '../../../../logo/2k-academy-icon-it.svg';
import languagesIcon from '../../../../logo/2k-academy-icon-languages.svg';
import mathIcon from '../../../../logo/2k-academy-icon-math.svg';
import scienceIcon from '../../../../logo/2k-academy-icon-physics-chemistry.svg';
import historySymbol from '../../../../logo/2k-academy-symbol-history.svg';
import itSymbol from '../../../../logo/2k-academy-symbol-it.svg';
import languagesSymbol from '../../../../logo/2k-academy-symbol-languages.svg';
import mathSymbol from '../../../../logo/2k-academy-symbol-math.svg';
import scienceSymbol from '../../../../logo/2k-academy-symbol-physics-chemistry.svg';

export const academyName = '2K Academy';

const subjects = [
  {
    key: 'languages',
    icon: languagesIcon,
    symbol: languagesSymbol,
    names:
      /язык|английск|румынск|французск|немецк|японск|испанск|\b(?:languages?|english|romanian|french|german|japanese|spanish|englez|român|francez|japonez|spaniol|limb)/iu,
  },
  {
    key: 'history',
    icon: historyIcon,
    symbol: historySymbol,
    names: /истори|географ|\b(?:history|historie|istorie|geography|geografi)/iu,
  },
  {
    key: 'it',
    icon: itIcon,
    symbol: itSymbol,
    names: /программ|информатик|\b(?:it|ict|program|coding|informatic|computer)/iu,
  },
  {
    key: 'math',
    icon: mathIcon,
    symbol: mathSymbol,
    names: /математ|алгебр|геометр|\b(?:math|matematic|algebr|geometr)/iu,
  },
  {
    key: 'science',
    icon: scienceIcon,
    symbol: scienceSymbol,
    names: /физик|хими|\b(?:physics|chemistry|fizic|chimi)/iu,
  },
];

export function AcademyMark() {
  return (
    <img
      className="cab-mascot-image"
      src={mascot}
      alt=""
      width={316}
      height={315}
      draggable={false}
    />
  );
}

export function Brand({ full = false }: { full?: boolean }) {
  if (full) {
    return (
      <img
        className="cab-full-logo"
        src={academyLogo}
        alt={academyName}
        width={636}
        height={320}
        draggable={false}
      />
    );
  }
  return (
    <span className="cab-brand">
      <span className="cab-brand-mark">
        <AcademyMark />
      </span>
      <span>
        2K <b>Academy</b>
      </span>
    </span>
  );
}

export function SubjectIcon({ subject, compact = false }: { subject: string; compact?: boolean }) {
  const category = subjects.find(({ names }) => names.test(subject));
  if (compact) {
    return category ? (
      <img
        className="cab-subject-symbol"
        src={category.symbol}
        alt=""
        width={32}
        height={32}
        data-subject-symbol={category.key}
      />
    ) : (
      <Icon name="tasks" size={19} />
    );
  }
  return category ? (
    <span className="cab-subject-icon" data-subject-art={category.key}>
      <img
        className="cab-subject-image"
        src={category.icon}
        alt=""
        width={244}
        height={190}
        draggable={false}
      />
    </span>
  ) : (
    <span className="cab-subject-icon cab-subject-icon-fallback" aria-hidden="true">
      <Icon name="brand" size={23} />
    </span>
  );
}
