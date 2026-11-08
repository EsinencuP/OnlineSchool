import { Link } from 'react-router-dom';
import type { StudentCardDto } from '@online-school/api-contracts';
import { formatMoney } from '../../lib/money.js';
import { ru } from '../../i18n/ru.js';
export default function BalanceSummary({ balances }: { balances: StudentCardDto['balances'] }) {
  return (
    <section className="panel">
      <h2>{ru.balance}</h2>
      <p className="hint">{ru.balanceHelp}</p>
      {balances.length ? (
        balances.map((b) => (
          <p className="money-total" key={b.currency}>
            {formatMoney(b.amount, b.currency)}
          </p>
        ))
      ) : (
        <p>{ru.dash}</p>
      )}
      <Link to="?tab=payments">{ru.payments} →</Link>
    </section>
  );
}
