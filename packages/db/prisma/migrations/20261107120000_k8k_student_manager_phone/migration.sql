-- Public student contact, provisioned explicitly by authorized staff configuration.
ALTER TABLE staff_accounts
  ADD COLUMN student_phone_e164 text,
  ADD CONSTRAINT ck_staff_student_phone_e164
    CHECK (student_phone_e164 IS NULL OR student_phone_e164 ~ '^[+][1-9][0-9]{6,14}$');
