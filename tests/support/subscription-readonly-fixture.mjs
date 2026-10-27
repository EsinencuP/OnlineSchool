const id = (family, n) =>
  `${String(family).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const asOf = '2026-10-27T12:00:00Z',
  owner = id(1, 1),
  other = id(1, 2),
  empty = id(1, 3);
export const subs = [1, 2, 3, 4, 5].map((n) => id(2, n));
const en = [1, 2, 3, 4, 5].map((n) => id(3, n)),
  sale = id(4, 1),
  staff = id(5, 1);
const time = (day) => `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`;
const schemas = {
  sale_conditions: [
    ['id', 'uuid'],
    ['code', 'text'],
  ],
  student_subject_enrollments: [
    ['id', 'uuid'],
    ['student_id', 'uuid'],
  ],
  subscriptions: [
    ['id', 'uuid'],
    ['enrollment_id', 'uuid'],
    ['sale_condition_id', 'uuid'],
    ['lesson_count', 'integer'],
    ['full_price', 'numeric'],
    ['currency', 'text'],
    ['valid_from', 'timestamptz'],
    ['valid_to', 'timestamptz'],
    ['frozen_from', 'timestamptz'],
    ['frozen_until', 'timestamptz'],
  ],
  payment_receipts: [
    ['id', 'uuid'],
    ['amount', 'numeric'],
    ['currency', 'text'],
    ['confirmed_by_director_id', 'uuid'],
    ['confirmed_by_director_at', 'timestamptz'],
  ],
  payment_distributions: [
    ['id', 'uuid'],
    ['payment_id', 'uuid'],
    ['subscription_id', 'uuid'],
    ['amount', 'numeric'],
    ['currency', 'text'],
    ['approved_by_director_id', 'uuid'],
    ['approved_at', 'timestamptz'],
  ],
  entitlement_grants: [
    ['id', 'uuid'],
    ['subscription_id', 'uuid'],
    ['payment_distribution_id', 'uuid'],
    ['quantity', 'integer'],
    ['basis', 'text'],
    ['granted_at', 'timestamptz'],
  ],
  entitlement_consumptions: [
    ['id', 'uuid'],
    ['grant_id', 'uuid'],
    ['subscription_id', 'uuid'],
    ['lesson_occurrence_id', 'uuid'],
    ['quantity', 'integer'],
    ['basis', 'text'],
    ['consumed_at', 'timestamptz'],
    ['cancelled_at', 'timestamptz'],
    ['cancellation_adjustment_id', 'uuid'],
  ],
  entitlement_adjustments: [
    ['id', 'uuid'],
    ['grant_id', 'uuid'],
    ['original_consumption_id', 'uuid'],
    ['kind', 'text'],
    ['delta_quantity', 'integer'],
    ['effective_at', 'timestamptz'],
  ],
  lesson_occurrences: [
    ['id', 'uuid'],
    ['enrollment_id', 'uuid'],
    ['scheduled_at', 'timestamptz'],
    ['status', 'text'],
  ],
  lesson_actual_outcomes: [
    ['lesson_occurrence_id', 'uuid'],
    ['confirmed_at', 'timestamptz'],
  ],
  ledger_documents: [
    ['id', 'uuid'],
    ['payment_id', 'uuid'],
    ['distribution_id', 'uuid'],
    ['consumption_id', 'uuid'],
    ['correction_of_document_id', 'uuid'],
  ],
  ledger_entries: [
    ['id', 'uuid'],
    ['document_id', 'uuid'],
    ['published_at', 'timestamptz'],
    ['reverses_entry_id', 'uuid'],
    ['entitlement_balance_before', 'numeric'],
    ['entitlement_balance_after', 'numeric'],
  ],
  subscription_freeze_history: [
    ['subscription_id', 'uuid'],
    ['frozen_from', 'timestamptz'],
    ['frozen_until', 'timestamptz'],
    ['replaced_at', 'timestamptz'],
  ],
};
const rows = Object.fromEntries(Object.keys(schemas).map((key) => [key, []]));
rows.sale_conditions.push([sale, 'PLAN-LESSONS']);
en.forEach((value, i) => rows.student_subject_enrollments.push([value, i === 4 ? other : owner]));
rows.subscriptions.push(
  [subs[0], en[0], sale, 8, '1500', 'MDL', time(1), '2026-11-01T10:00:00Z', time(20), time(22)],
  [subs[1], en[1], sale, 4, '800', 'USD', time(10), '2026-11-10T10:00:00Z', time(26), time(28)],
  [
    subs[2],
    en[2],
    sale,
    6,
    '600.1234',
    'EUR',
    '2026-09-01T10:00:00Z',
    '2026-09-30T10:00:00Z',
    null,
    null,
  ],
  [subs[3], en[3], sale, 10, '1000', 'UAH', time(5), '2026-11-05T10:00:00Z', null, null],
  [subs[4], en[4], sale, 10, '500', 'MDL', time(25), '2026-11-25T10:00:00Z', null, null],
);
let sequence = 0;
function post(source, at, { reverse = false, replace = false, before = null, after = null } = {}) {
  const n = ++sequence,
    doc = id(10, n),
    entry = id(11, n);
  rows.ledger_documents.push([
    doc,
    source.payment ?? null,
    source.distribution ?? null,
    source.consumption ?? null,
    null,
  ]);
  rows.ledger_entries.push([entry, doc, at, null, before, after]);
  if (reverse) {
    const rd = id(10, ++sequence);
    rows.ledger_documents.push([rd, null, null, null, doc]);
    rows.ledger_entries.push([id(11, sequence), rd, time(15), entry, null, null]);
  }
  if (replace) {
    const rd = id(10, ++sequence);
    rows.ledger_documents.push([rd, null, null, null, doc]);
    rows.ledger_entries.push([id(11, sequence), rd, time(15), null, null, null]);
  }
  return entry;
}
function pay(n, sub, amount, currency, at, options = {}) {
  const receipt = id(6, n),
    distribution = id(7, n);
  rows.payment_receipts.push([
    receipt,
    options.receiptAmount ?? amount,
    currency,
    options.draft ? null : staff,
    options.draft ? null : at,
  ]);
  rows.payment_distributions.push([
    distribution,
    receipt,
    sub,
    amount,
    currency,
    options.unapproved ? null : staff,
    options.unapproved ? null : at,
  ]);
  if (!options.draft) {
    post({ payment: receipt }, at, options);
    if (!options.unapproved) post({ distribution }, at);
  }
  return { receipt, distribution };
}
const paid = pay(1, subs[0], '1500', 'MDL', time(2), { receiptAmount: '2000' }),
  frozen = pay(2, subs[1], '800', 'USD', time(10), { reverse: true, replace: true }),
  expired = pay(3, subs[2], '600.1234', 'EUR', '2026-09-02T10:00:00Z'),
  partial = pay(4, subs[3], '500', 'UAH', time(5));
pay(5, subs[0], '100', 'MDL', time(3), { draft: true });
pay(6, subs[0], '100', 'MDL', time(3), { unapproved: true });
pay(7, subs[0], '99', 'MDL', time(3), { reverse: true });
pay(8, subs[4], '500', 'MDL', time(25));
const grant = id(8, 1);
rows.entitlement_grants.push(
  [grant, subs[0], paid.distribution, 8, 'CONFIRMED_PAYMENT', time(5)],
  [id(8, 2), subs[1], frozen.distribution, 4, 'CONFIRMED_PAYMENT', time(16)],
  [id(8, 3), subs[2], expired.distribution, 6, 'CONFIRMED_PAYMENT', '2026-09-03T10:00:00Z'],
  [id(8, 4), subs[3], partial.distribution, 10, 'CONFIRMED_PAYMENT', time(6)],
  [id(8, 5), subs[0], paid.distribution, 2, 'CONFIRMED_PAYMENT', '2026-11-05T10:00:00Z'],
);
const c1 = id(9, 1),
  c2 = id(9, 2),
  cancel = id(12, 1);
for (let n = 1; n <= 3; n++) {
  const lesson = id(13, n),
    at = n === 1 ? time(6) : n === 2 ? time(7) : time(9);
  rows.lesson_occurrences.push([
    lesson,
    en[0],
    n === 3 ? '2026-11-01T10:00:00Z' : at,
    n === 3 ? 'SCHEDULED' : 'CONDUCTED',
  ]);
  if (n !== 3) rows.lesson_actual_outcomes.push([lesson, at]);
  rows.entitlement_consumptions.push([
    id(9, n),
    grant,
    subs[0],
    lesson,
    1,
    'CONFIRMED_LESSON',
    at,
    n === 2 ? time(8) : null,
    n === 2 ? cancel : null,
  ]);
  post({ consumption: id(9, n) }, at, {
    before: n === 1 ? '8' : n === 2 ? '7' : null,
    after: n === 1 ? '7' : n === 2 ? '6' : null,
  });
}
// Explicit consumption cancellation has an independent published reversal, retaining the original deduction.
const consumedDoc = rows.ledger_documents.find((d) => d[3] === c2),
  consumedEntry = rows.ledger_entries.find((e) => e[1] === consumedDoc[0]),
  reversalDoc = id(10, ++sequence);
rows.ledger_documents.push([reversalDoc, null, null, null, consumedDoc[0]]);
rows.ledger_entries.push([id(11, sequence), reversalDoc, time(8), consumedEntry[0], null, null]);
rows.entitlement_adjustments.push(
  [cancel, grant, c2, 'CONSUMPTION_CANCELLATION', 0, time(8)],
  [id(12, 2), grant, null, 'GRANT_DELTA', -1, time(10)],
  [id(12, 3), grant, c1, 'GRANT_DELTA', 1, time(11)],
);
rows.subscription_freeze_history.push([subs[0], time(12), time(14), time(15)]);
const literal = (x) =>
  x === null ? 'NULL' : typeof x === 'number' ? String(x) : `'${String(x).replaceAll("'", "''")}'`;
export const fixtureCte =
  'WITH ' +
  Object.entries(schemas)
    .map(
      ([name, columns]) =>
        `${name} AS (${rows[name].length ? `SELECT ${columns.map(([column, type]) => `${column}::${type}`).join(',')} FROM(VALUES ${rows[name].map((row) => '(' + row.map(literal).join(',') + ')').join(',')}) v(${columns.map(([column]) => column).join(',')})` : `SELECT ${columns.map(([column, type]) => `NULL::${type} AS ${column}`).join(',')} WHERE false`})`,
    )
    .join(',');
export const cases = [
  {
    name: 'default latest current frozen plan',
    mode: 'details',
    studentId: owner,
    query: {},
    expected: { subscriptionId: subs[1], status: 'FROZEN', lessonsRemaining: 4 },
  },
  {
    name: 'selected plan exact remaining ignores future lesson, restores cancellation and applies adjustments',
    mode: 'details',
    studentId: owner,
    query: { subscriptionId: subs[0] },
    expected: { status: 'ACTIVE', lessonsRemaining: 7 },
  },
  {
    name: 'expired plan retained',
    mode: 'details',
    studentId: owner,
    query: { subscriptionId: subs[2] },
    expected: { status: 'EXPIRED', lessonsRemaining: 6 },
  },
  {
    name: 'partial payment does not create paid rights',
    mode: 'details',
    studentId: owner,
    query: { subscriptionId: subs[3] },
    expected: { lessonsRemaining: 0 },
  },
  { name: 'none', mode: 'details', studentId: empty, query: {}, expected: null },
  {
    name: 'foreign subscription',
    mode: 'details',
    studentId: owner,
    query: { subscriptionId: subs[4] },
    forbidden: true,
  },
  {
    name: 'confirmed owned allocation only, no full shared receipt amount',
    mode: 'payments',
    studentId: owner,
    query: { subscriptionId: subs[0], page: 1, pageSize: 20 },
    expected: { total: 1, amount: '1500', currency: 'MDL', lessonsAdded: 8 },
  },
  {
    name: 'corrected published receipt remains visible',
    mode: 'payments',
    studentId: owner,
    query: { subscriptionId: subs[1], page: 1, pageSize: 20 },
    expected: { total: 1, currency: 'USD', lessonsAdded: 4 },
  },
  {
    name: 'exact four decimal EUR',
    mode: 'payments',
    studentId: owner,
    query: { subscriptionId: subs[2], page: 1, pageSize: 20 },
    expected: { total: 1, amount: '600.1234', currency: 'EUR' },
  },
  {
    name: 'partial payment history without granted lessons',
    mode: 'payments',
    studentId: owner,
    query: { subscriptionId: subs[3], page: 1, pageSize: 20 },
    expected: { total: 1, amount: '500', currency: 'UAH', lessonsAdded: null },
  },
  {
    name: 'all rights operations and retained freeze history',
    mode: 'ledger',
    studentId: owner,
    query: { subscriptionId: subs[0], page: 1, pageSize: 20 },
    expected: { total: 10, latestBalance: '7' },
  },
  {
    name: 'ledger page retains total',
    mode: 'ledger',
    studentId: owner,
    query: { subscriptionId: subs[0], page: 3, pageSize: 4 },
    expected: { total: 10, items: 2 },
  },
  {
    name: 'no future unfreeze event',
    mode: 'ledger',
    studentId: owner,
    query: { subscriptionId: subs[1], page: 1, pageSize: 20 },
    expected: { total: 2, types: ['FREEZE', 'CREDIT'] },
  },
  {
    name: 'foreign payment query forbidden',
    mode: 'payments',
    studentId: owner,
    query: { subscriptionId: subs[4], page: 1, pageSize: 20 },
    forbidden: true,
  },
  {
    name: 'foreign ledger query forbidden',
    mode: 'ledger',
    studentId: owner,
    query: { subscriptionId: subs[4], page: 1, pageSize: 20 },
    forbidden: true,
  },
];
