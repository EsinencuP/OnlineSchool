BEGIN;
-- AlterTable
ALTER TABLE "households" ADD COLUMN     "created_by_staff_id" UUID;

-- AlterTable
ALTER TABLE "auth_accounts" ADD COLUMN     "recovery_registration_required" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "recovery_only" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "mfa_challenges" ADD COLUMN     "login_binding_hash" CHAR(64);

-- CreateTable
CREATE TABLE "recovery_authorizations" (
    "id" UUID NOT NULL,
    "subject_account_id" UUID NOT NULL,
    "authorized_actor_id" UUID NOT NULL,
    "identity_evidence_ref" TEXT NOT NULL,
    "owner_instruction_ref" TEXT,
    "reason" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_requests" (
    "id" UUID NOT NULL,
    "authorization_id" UUID NOT NULL,
    "command_operation_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_rate_limits" (
    "id" UUID NOT NULL,
    "bucket_key" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "window_started_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recovery_authorizations_subject_account_id_expires_at_idx" ON "recovery_authorizations"("subject_account_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_requests_authorization_id_key" ON "recovery_requests"("authorization_id");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_requests_command_operation_id_key" ON "recovery_requests"("command_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_requests_token_hash_key" ON "recovery_requests"("token_hash");

-- CreateIndex
CREATE INDEX "recovery_requests_expires_at_idx" ON "recovery_requests"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_rate_limits_bucket_key_key" ON "auth_rate_limits"("bucket_key");

-- CreateIndex
CREATE INDEX "auth_rate_limits_expires_at_idx" ON "auth_rate_limits"("expires_at");

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "fk_household_creator" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recovery_authorizations" ADD CONSTRAINT "fk_recovery_subject" FOREIGN KEY ("subject_account_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recovery_authorizations" ADD CONSTRAINT "fk_recovery_authorizer" FOREIGN KEY ("authorized_actor_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recovery_requests" ADD CONSTRAINT "fk_recovery_request_authorization" FOREIGN KEY ("authorization_id") REFERENCES "recovery_authorizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE mfa_challenges ADD CONSTRAINT ck_login_binding_hash CHECK (login_binding_hash IS NULL OR login_binding_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE sessions ADD CONSTRAINT ck_recovery_session_no_mfa CHECK (NOT recovery_only OR mfa_verified_at IS NULL);
ALTER TABLE recovery_authorizations
 ADD CONSTRAINT ck_recovery_evidence CHECK (length(trim(identity_evidence_ref)) BETWEEN 5 AND 200 AND length(trim(reason)) BETWEEN 5 AND 500 AND subject_account_id<>authorized_actor_id),
 ADD CONSTRAINT ck_recovery_authorization_period CHECK (expires_at>verified_at AND expires_at<=verified_at+interval '24 hours');
ALTER TABLE recovery_requests
 ADD CONSTRAINT ck_recovery_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 ADD CONSTRAINT ck_recovery_request_period CHECK (expires_at>created_at AND expires_at<=created_at+interval '15 minutes' AND (completed_at IS NULL OR (completed_at>=created_at AND completed_at<expires_at)) AND (revoked_at IS NULL OR revoked_at>=created_at) AND NOT(completed_at IS NOT NULL AND revoked_at IS NOT NULL));
ALTER TABLE auth_rate_limits ADD CONSTRAINT ck_auth_rate_bucket CHECK (bucket_key ~ '^[0-9a-f]{64}$' AND attempts>0 AND expires_at>window_started_at);

CREATE FUNCTION t07_guard_recovery_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE director_subject boolean; required_role "RoleCode";
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Recovery evidence is append-only' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth_accounts WHERE id=NEW.subject_account_id AND kind<>'STUDENT') OR NEW.verified_at>clock_timestamp() THEN
  RAISE EXCEPTION 'Invalid recovery subject or verification time' USING ERRCODE='23514';
 END IF;
 SELECT EXISTS(SELECT 1 FROM role_assignments a JOIN roles r ON r.id=a.role_id WHERE a.account_id=NEW.subject_account_id AND r.code='DIRECTOR' AND a.valid_from<=NEW.verified_at AND (a.valid_to IS NULL OR a.valid_to>NEW.verified_at)) INTO director_subject;
 required_role=CASE WHEN director_subject THEN 'TECH_OPERATOR'::"RoleCode" ELSE 'DIRECTOR'::"RoleCode" END;
 IF director_subject AND (NEW.owner_instruction_ref IS NULL OR length(trim(NEW.owner_instruction_ref)) NOT BETWEEN 5 AND 200) THEN
  RAISE EXCEPTION 'Director recovery needs confirmed owner instruction' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM role_assignments a JOIN roles r ON r.id=a.role_id JOIN auth_accounts p ON p.id=a.account_id JOIN staff_accounts s ON s.account_id=p.id WHERE a.account_id=NEW.authorized_actor_id AND r.code=required_role AND p.disabled_at IS NULL AND s.deactivated_at IS NULL AND a.valid_from<=NEW.verified_at AND (a.valid_to IS NULL OR a.valid_to>NEW.verified_at)) THEN
  RAISE EXCEPTION 'Recovery authorizer role does not match the subject' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_t07_recovery_evidence BEFORE INSERT OR UPDATE OR DELETE ON recovery_authorizations FOR EACH ROW EXECUTE FUNCTION t07_guard_recovery_authorization();

CREATE FUNCTION t07_guard_recovery_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (OLD.completed_at IS NOT NULL OR OLD.revoked_at IS NOT NULL OR (to_jsonb(NEW)-'completed_at'-'revoked_at'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'completed_at'-'revoked_at'-'updated_at'))) THEN
  RAISE EXCEPTION 'Recovery request history is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_t07_recovery_request BEFORE UPDATE OR DELETE ON recovery_requests FOR EACH ROW EXECUTE FUNCTION t07_guard_recovery_request();

CREATE FUNCTION t07_guard_credential() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Revoke credentials instead of deleting them' USING ERRCODE='23514'; END IF;
 IF OLD.revoked_at IS NOT NULL OR NEW.account_id<>OLD.account_id OR NEW.credential_id<>OLD.credential_id OR NEW.public_key<>OLD.public_key OR NEW.sign_count<OLD.sign_count OR NEW.backup_eligible<>OLD.backup_eligible THEN
  RAISE EXCEPTION 'Credential identity/counter/revocation is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_t07_credential BEFORE UPDATE OR DELETE ON webauthn_credentials FOR EACH ROW EXECUTE FUNCTION t07_guard_credential();

CREATE FUNCTION t07_guard_challenge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.used_at IS NOT NULL OR (to_jsonb(NEW)-'used_at'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'used_at'-'updated_at') THEN
  RAISE EXCEPTION 'Challenge identity and consumed state are immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_t07_challenge BEFORE UPDATE ON mfa_challenges FOR EACH ROW EXECUTE FUNCTION t07_guard_challenge();

GRANT SELECT ON recovery_authorizations TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON recovery_requests TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON auth_rate_limits TO online_school_runtime;
REVOKE INSERT,UPDATE,DELETE ON recovery_authorizations FROM online_school_runtime;
COMMIT;
