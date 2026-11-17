-- A director may reject a receipt the manager already submitted for approval.
-- Rejection still excludes confirmation; status projection checks rejected_at first.
ALTER TABLE payment_receipts DROP CONSTRAINT ck_mgr05_rejection;
ALTER TABLE payment_receipts ADD CONSTRAINT ck_mgr05_rejection CHECK (
  (rejected_at IS NULL AND rejection_reason IS NULL AND rejected_by_staff_id IS NULL)
  OR (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL AND length(trim(rejection_reason)) BETWEEN 3 AND 500
      AND rejected_by_staff_id IS NOT NULL AND confirmed_by_director_at IS NULL));
