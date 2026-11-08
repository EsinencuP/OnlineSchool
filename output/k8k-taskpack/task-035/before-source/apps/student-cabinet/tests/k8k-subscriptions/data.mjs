// Synthetic subscription facts for the loopback browser and isolated component fixtures.
export const anchors = {
  math: '71000000-0000-4000-8000-000000000001',
  physics: '71000000-0000-4000-8000-000000000002',
  english: '71000000-0000-4000-8000-000000000003',
  future: '71000000-0000-4000-8000-000000000004',
  wrapper: '72000000-0000-4000-8000-000000000001',
  foreign: '71000000-0000-4000-8000-000000000099',
};
export const subjectIds = {
  math: '60000000-0000-4000-8000-000000000002',
  physics: '60000000-0000-4000-8000-000000000003',
  english: '60000000-0000-4000-8000-000000000001',
};
const data = [
  ['math', 'Математика', 'ACTIVE', 'PAID_RIGHTS', 5],
  ['physics', 'Физика', 'EXPIRED', 'PERIOD_EXPIRED', null],
  ['english', 'Английский язык', 'FROZEN', 'FROZEN', 3],
];
const validity = {
  math: '2026-12-01T02:00:00Z',
  physics: '2026-10-30T02:00:00Z',
  english: '2026-11-30T13:00:00Z',
};
export const frozenUntil = '2026-11-18T13:00:00Z';
const admission = { maxLessons: 3, lessonsRemaining: 2, validUntil: '2026-11-15T02:00:00Z' };

export function subscriptionSubjects(scenario = 'ready') {
  return data.map(([key, subjectName, displayStatus, reasonCode, paidLessonsRemaining], index) => {
    const enrollmentId = '73000000-0000-4000-8000-00000000000' + (index + 1);
    const partial = key === 'math' && scenario === 'partial';
    const noPlan = key === 'physics' && scenario === 'no-plan';
    const plan = {
      subscriptionId: anchors[key],
      managerSubscriptionId: key === 'math' ? anchors.wrapper : null,
      enrollmentId,
      displayStatus: partial ? 'LIMITED' : displayStatus,
      reasonCode: partial ? 'TEMPORARY_ADMISSION' : reasonCode,
      validUntil: validity[key],
      frozenUntil: key === 'english' ? frozenUntil : null,
      paidLessonsRemaining: partial ? 0 : paidLessonsRemaining,
      liveAccess: key === 'math',
      temporaryAdmission: partial ? admission : null,
    };
    return {
      subjectId: subjectIds[key],
      subjectName,
      enrollmentIds: [enrollmentId],
      displayStatus: noPlan ? 'NONE' : plan.displayStatus,
      reasonCode: noPlan ? 'NO_SUBSCRIPTION' : plan.reasonCode,
      liveAccess: plan.liveAccess,
      capabilities: {
        canViewHomework: key === 'english' || key === 'math',
        canViewMaterials: key !== 'physics',
        canOpenSubscription: !noPlan,
        canOpenLessons: key === 'math',
      },
      subscriptions: noPlan ? [] : [plan],
    };
  });
}

export function subscriptionDetails(key, scenario) {
  if (key === 'future' || (key === 'physics' && scenario === 'no-plan'))
    return {
      subscriptionId: null,
      planName: null,
      lessonsTotal: null,
      lessonsRemaining: null,
      validFrom: null,
      validUntil: null,
      isFrozen: false,
      frozenFrom: null,
      frozenUntil: null,
      status: 'NONE',
    };
  const frozen = key === 'english';
  return {
    subscriptionId: key === 'math' ? anchors.wrapper : anchors[key],
    planName: {
      math: 'Синтетический математический план',
      physics: 'Синтетический физический план',
      english: 'Синтетический замороженный план',
    }[key],
    lessonsTotal: 8,
    // The new projection is authoritative, including when it reports null.
    lessonsRemaining: key === 'math' ? (scenario === 'partial' ? 0 : 5) : frozen ? 3 : 0,
    validFrom: '2026-10-01',
    validUntil: key === 'physics' ? '2026-10-29' : '2026-11-30',
    isFrozen: frozen,
    frozenFrom: frozen ? '2026-11-01' : null,
    frozenUntil: frozen ? '2026-11-18' : null,
    status: frozen ? 'FROZEN' : key === 'physics' ? 'EXPIRED' : 'ACTIVE',
  };
}

export function subscriptionPayments(key, scenario) {
  const make = (amount, currency, lessonsAdded, index) => ({
    paymentId: '74000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
    confirmedAt: '2026-11-07T02:30:00Z',
    amount,
    currency,
    description: `Подтверждённая оплата: FIXTURE_${key.toUpperCase()}_${index + 1}`,
    lessonsAdded,
  });
  if (key !== 'math') return [make('25.00', 'EUR', null, 0)];
  if (scenario === 'partial') return [make('600.1234', 'MDL', null, 0)];
  return [
    make('600.1234', 'MDL', null, 0),
    make('1.005', 'EUR', 0, 1),
    make('0.00', 'MDL', 0, 2),
    make('10.00', 'USD', 5, 3),
    ...Array.from({ length: 18 }, (_, index) => make('10.00', 'MDL', null, index + 4)),
  ];
}

export function subscriptionLedger(key, scenario) {
  if (key === 'future' || scenario === 'partial') return [];
  const operations = [
    ['UNFREEZE', '3', '3', 'Разморозка абонемента'],
    ['FREEZE', '3', '3', 'Заморозка абонемента'],
    ['CREDIT', '2', '3', 'Отмена списания занятия'],
    ['DEDUCTION', null, '2', 'Списание занятия'],
    ['CREDIT', '0', '5', 'Корректировка остатка занятий'],
  ];
  if (key === 'math')
    operations.push(
      ...Array.from({ length: 17 }, () => ['CREDIT', '0', '1', 'Начисление оплаченных занятий']),
    );
  return operations.map(([type, balanceBefore, balanceAfter, description], index) => ({
    entryId: '75000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
    entryDate: '2026-11-01',
    type,
    balanceBefore,
    balanceAfter,
    description,
    lessonId: null,
  }));
}
