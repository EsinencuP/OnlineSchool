import type {
  StudentSubjectDto,
  StudentSubjectSubscriptionDto,
} from '@online-school/api-contracts';

export function subscriptionHref(subscriptionId: string, subjectId: string) {
  return `/student/subscription?${new URLSearchParams({
    subscriptionId,
    fromSubjectId: subjectId,
  })}`;
}

export function subjectSubscriptionRows(item: StudentSubjectDto) {
  if (!item.subscriptions.length) return [{ plan: null, href: undefined }];
  return item.subscriptions.map((plan) => ({
    plan,
    href: item.capabilities.canOpenSubscription
      ? subscriptionHref(plan.subscriptionId, item.subjectId)
      : undefined,
  }));
}

export function findSubjectPlan(
  items: readonly StudentSubjectDto[],
  subscriptionId: string | null | undefined,
  fromDetails = false,
): { item: StudentSubjectDto; plan: StudentSubjectSubscriptionDto } | undefined {
  if (!subscriptionId) return;
  for (const item of items) {
    const plan = item.subscriptions.find(
      (row) =>
        row.subscriptionId === subscriptionId ||
        (fromDetails && row.managerSubscriptionId === subscriptionId),
    );
    if (plan) return { item, plan };
  }
}
