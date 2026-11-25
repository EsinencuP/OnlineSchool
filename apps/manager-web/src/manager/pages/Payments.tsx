import { Send } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Badge, Empty, Notice } from '../../shared/ui';
import { useManager } from '../store';
import type { PaymentStatus } from '../types';
import { fmtDateTime, fmtMoney } from '../../shared/format';
import { paymentMethod, paymentStatus } from '../labels';

const ORDER: PaymentStatus[] = ['PENDING', 'AWAITING_APPROVAL', 'CONFIRMED', 'REJECTED'];
const TILE: Record<PaymentStatus, string> = {
  PENDING: 'tile-blue',
  AWAITING_APPROVAL: 'tile-yellow',
  CONFIRMED: 'tile-teal',
  REJECTED: 'tile-coral',
};

const sum = (amounts: string[]) => {
  const cents = amounts.reduce((acc, a) => {
    const [i = '0', f = ''] = a.split('.');
    return acc + BigInt(i) * 100n + BigInt((f + '00').slice(0, 2));
  }, 0n);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
};

export function Payments() {
  const { state, run } = useManager();
  const [filter, setFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const rows = state.payments
    .filter((p) => filter === 'ALL' || p.status === filter)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Платежи</h1>
          <p>Менеджер регистрирует поступление и отправляет его директору. Подтверждает поступление и публикует распределение на абонемент только директор.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {ORDER.map((s) => {
          const items = state.payments.filter((p) => p.status === s);
          return (
            <button
              key={s}
              type="button"
              className={`tile ${TILE[s]}`}
              style={{ minHeight: 120, border: filter === s ? '2px solid var(--ink)' : '2px solid transparent', textAlign: 'left' }}
              aria-pressed={filter === s}
              onClick={() => setFilter((f) => (f === s ? 'ALL' : s))}
            >
              <span style={{ fontWeight: 600 }}>{paymentStatus[s].label}</span>
              <span className="big-num num" style={{ fontSize: 30, marginTop: 'auto' }}>{fmtMoney(sum(items.map((p) => p.amount)), 'MDL')}</span>
              <span className="muted" style={{ fontSize: 12 }}>{items.length} поступл.</span>
            </button>
          );
        })}
      </div>

      <Notice tone="blue">Суммы раздельны по валютам. Неподтверждённые поступления не входят в баланс ученика.</Notice>

      <section className="card" style={{ padding: 14 }}>
        {rows.length === 0 ? (
          <Empty title="Платежей нет" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Плательщик</th>
                  <th>Сумма</th>
                  <th>Способ</th>
                  <th>Назначение</th>
                  <th>Получен</th>
                  <th>Статус</th>
                  <th><span className="sr-only">Действие</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} style={{ cursor: 'default' }}>
                    <td>
                      <div className="cell-person">
                        <Avatar name={p.studentName} />
                        <div>
                          <b>{p.studentName}</b>
                          <span className="num">{p.externalRef ?? 'без внешнего номера'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(p.amount, p.currency)}</td>
                    <td>{p.method ? paymentMethod[p.method] : '—'}</td>
                    <td>{p.purpose === 'FIRST_PAYMENT' ? 'Первая оплата' : p.purpose === 'RENEWAL' ? 'Продление' : 'Другое'}</td>
                    <td className="num">{fmtDateTime(p.receivedAt)}</td>
                    <td>
                      <Badge tone={paymentStatus[p.status].tone}>{paymentStatus[p.status].label}</Badge>
                      {p.rejectionReason && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{p.rejectionReason}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.status === 'PENDING' && (
                        <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'payment.requestApproval', paymentId: p.id })}>
                          <Send size={14} /> Директору
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
