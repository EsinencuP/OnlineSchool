# Foundation ERD

Generated from the reviewed Prisma schema. SQL-only guards are verified separately against PostgreSQL catalog metadata.

```mermaid
erDiagram
  access_revocations {
    String id PK
    String account_id
    String session_id
    String revoked_by_account_id
    String reason
    String source
    DateTime revoked_at
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o{ access_revocations : "fk_revocation_account"
  sessions o|--o{ access_revocations : "fk_revocation_session_owner"
  auth_accounts o|--o{ access_revocations : "fk_revocation_actor"
  assigned_managers {
    String id PK
    String manager_id
    String lead_id
    String student_id
    DateTime assigned_at
    DateTime ended_at
    DateTime created_at
    DateTime updated_at
  }
  staff_accounts ||--o{ assigned_managers : "fk_manager_staff"
  leads o|--o{ assigned_managers : "fk_manager_lead"
  students o|--o{ assigned_managers : "fk_manager_student"
  audit_events {
    String id PK
    String actor_id
    AuditActorKind actor_kind
    String system_actor_ref
    String action
    String resource_type
    String resource_id
    AuditResult result
    String request_id
    String source_operation_id
    String event_key
    Json metadata
    DateTime recorded_at
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts o|--o{ audit_events : "fk_t04_audit_event_actor"
  auth_accounts {
    String id PK
    AccountKind kind
    String login_id
    String password_hash
    DateTime disabled_at
    Boolean recovery_registration_required
    DateTime created_at
    DateTime updated_at
  }
  auth_rate_limits {
    String id PK
    String bucket_key
    Int attempts
    DateTime window_started_at
    DateTime expires_at
    DateTime created_at
    DateTime updated_at
  }
  confirmed_payouts {
    String id PK
    String attempt_id
    Decimal amount
    String currency
    DateTime confirmed_at
    String confirmed_by_id
    String provider
    String provider_confirmation_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  payout_attempts ||--o| confirmed_payouts : "fk_t03_confirmed_payout_attempt"
  staff_accounts ||--o{ confirmed_payouts : "fk_t03_confirmed_payout_confirmed_by"
  contact_logs {
    String id PK
    String lead_id
    String student_id
    String representative_id
    String manager_id
    ContactChannel channel
    String outcome
    DateTime occurred_at
    DateTime created_at
    DateTime updated_at
  }
  leads o|--o{ contact_logs : "fk_contact_lead"
  students o|--o{ contact_logs : "fk_contact_student"
  representatives o|--o{ contact_logs : "fk_contact_representative"
  staff_accounts ||--o{ contact_logs : "fk_contact_staff"
  crm_tasks {
    String id PK
    String lead_id
    String student_id
    String assigned_manager_id
    CrmTaskType type
    CrmTaskStatus status
    String title
    DateTime due_at
    DateTime resolved_at
    String resolved_by_staff_id
    String source_event_id
    String idempotency_key
    DateTime created_at
    DateTime updated_at
  }
  leads o|--o{ crm_tasks : "fk_task_lead"
  students o|--o{ crm_tasks : "fk_task_student"
  staff_accounts o|--o{ crm_tasks : "fk_task_assigned_staff"
  staff_accounts o|--o{ crm_tasks : "fk_task_resolved_staff"
  outbox_events o|--o{ crm_tasks : "fk_t04_crm_source_event"
  education_reports {
    String id PK
    String checkpoint_id
    String author_id
    Int version
    DateTime period_start
    DateTime period_end
    Json content
    EducationReportStatus status
    DateTime generated_at
    DateTime published_at
    String published_by
    String supersedes_report_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  progress_checkpoints ||--o{ education_reports : "fk_t04_education_report_checkpoint"
  teacher_accounts ||--o{ education_reports : "fk_t04_education_report_author"
  teacher_accounts o|--o{ education_reports : "fk_t04_education_report_published_by"
  education_reports o|--o| education_reports : "fk_t04_education_report_supersedes_report"
  entitlement_adjustments {
    String id PK
    String grant_id
    String original_consumption_id
    EntitlementAdjustmentKind kind
    Int delta_quantity
    String author_id
    String reason
    DateTime effective_at
    String financial_period_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  entitlement_grants ||--o{ entitlement_adjustments : "fk_t03_entitlement_adjustment_grant"
  entitlement_consumptions o|--o{ entitlement_adjustments : "fk_t03_entitlement_adjustment_original_consumption"
  staff_accounts ||--o{ entitlement_adjustments : "fk_t03_entitlement_adjustment_author"
  financial_periods ||--o{ entitlement_adjustments : "fk_t03_entitlement_adjustment_financial_period"
  entitlement_consumptions {
    String id PK
    String grant_id
    String subscription_id
    String lesson_occurrence_id
    Int quantity
    ConsumptionBasis basis
    String reason
    String authorized_by_id
    DateTime consumed_at
    DateTime cancelled_at
    String cancellation_adjustment_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  entitlement_grants ||--o{ entitlement_consumptions : "fk_t03_entitlement_consumption_grant"
  subscriptions ||--o{ entitlement_consumptions : "fk_t03_entitlement_consumption_subscription"
  lesson_occurrences ||--o{ entitlement_consumptions : "fk_t03_entitlement_consumption_lesson_occurrence"
  staff_accounts ||--o{ entitlement_consumptions : "fk_t03_entitlement_consumption_authorized_by"
  entitlement_adjustments o|--o| entitlement_consumptions : "fk_t03_entitlement_consumption_cancellation_adjustment"
  entitlement_grants {
    String id PK
    String subscription_id
    String payment_distribution_id
    Int quantity
    GrantBasis basis
    DateTime granted_at
    String authorized_by_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  subscriptions ||--o{ entitlement_grants : "fk_t03_entitlement_grant_subscription"
  payment_distributions ||--o{ entitlement_grants : "fk_t03_entitlement_grant_payment_distribution"
  staff_accounts ||--o{ entitlement_grants : "fk_t03_entitlement_grant_authorized_by"
  file_audit_logs {
    String id PK
    String s3_object_id
    String permission_id
    FileAuditAction action
    String actor_id
    DateTime at
    AuditResult result
    String request_id
    String event_key
    DateTime created_at
    DateTime updated_at
  }
  s3_objects ||--o{ file_audit_logs : "fk_t04_file_audit_log_s3_object"
  file_permissions o|--o{ file_audit_logs : "fk_t04_file_audit_log_permission"
  auth_accounts ||--o{ file_audit_logs : "fk_t04_file_audit_log_actor"
  file_permissions {
    String id PK
    String s3_object_id
    String subject_id
    AccountKind subject_type
    String granted_by
    DateTime granted_at
    Boolean can_download
    DateTime expires_at
    DateTime revoked_at
    String revoked_by
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  s3_objects ||--o{ file_permissions : "fk_t04_file_permission_s3_object"
  auth_accounts ||--o{ file_permissions : "fk_t04_file_permission_granted_by"
  auth_accounts o|--o{ file_permissions : "fk_t04_file_permission_revoked_by"
  auth_accounts ||--o{ file_permissions : "fk_t04_permission_subject"
  financial_periods {
    String id PK
    DateTime starts_at
    DateTime ends_at
    DateTime closed_at
    String closed_by_id
    String closure_operation_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  staff_accounts o|--o{ financial_periods : "fk_t03_financial_period_closed_by"
  homework_assignments {
    String id PK
    String subject_id
    String issued_by
    String title
    Json content
    DateTime due_at
    String lesson_occurrence_id
    DateTime archived_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  subjects ||--o{ homework_assignments : "fk_t04_homework_assignment_subject"
  teacher_accounts ||--o{ homework_assignments : "fk_t04_homework_assignment_issued_by"
  lesson_occurrences o|--o{ homework_assignments : "fk_t04_homework_assignment_lesson_occurrence"
  homework_deliveries {
    String id PK
    String assignment_id
    String enrollment_id
    String issued_by
    DateTime issued_at
    DateTime due_at
    DateTime cancelled_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  homework_assignments ||--o{ homework_deliveries : "fk_t04_homework_delivery_assignment"
  student_subject_enrollments ||--o{ homework_deliveries : "fk_t04_homework_delivery_enrollment"
  teacher_accounts ||--o{ homework_deliveries : "fk_t04_homework_delivery_issued_by"
  homework_submissions {
    String id PK
    String delivery_id
    String student_id
    DateTime submitted_at
    Int version
    Json content
    String supersedes_submission_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  homework_deliveries ||--o{ homework_submissions : "fk_t04_homework_submission_delivery"
  students ||--o{ homework_submissions : "fk_t04_homework_submission_student"
  homework_submissions o|--o| homework_submissions : "fk_t04_homework_submission_supersedes_submission"
  household_memberships {
    String id PK
    String household_id
    String student_id
    String representative_id
    MembershipStatus status
    DateTime valid_from
    DateTime valid_to
    String basis
    String recorded_by_staff_id
    DateTime created_at
    DateTime updated_at
  }
  households ||--o{ household_memberships : "fk_membership_household"
  students o|--o{ household_memberships : "fk_membership_student"
  representatives o|--o{ household_memberships : "fk_membership_representative"
  staff_accounts ||--o{ household_memberships : "fk_membership_recorder"
  households {
    String id PK
    String label
    DateTime archived_at
    String created_by_staff_id
    DateTime created_at
    DateTime updated_at
  }
  staff_accounts o|--o{ households : "fk_household_creator"
  idempotency_records {
    String id PK
    String scope
    String key
    String command_type
    String request_hash
    IdempotencyStatus status
    String result_hash
    Json result
    DateTime completed_at
    DateTime expires_at
    DateTime created_at
    DateTime updated_at
  }
  job_attempts {
    String id PK
    String job_id
    Int attempt_no
    DateTime started_at
    DateTime finished_at
    JobAttemptResult result
    String error
    String provider_request_id
    DateTime created_at
    DateTime updated_at
  }
  job_records ||--o{ job_attempts : "fk_t04_job_attempt_job"
  job_records {
    String id PK
    String type
    JobStatus status
    Json payload
    String source_operation_id
    String source_outbox_event_id
    String deduplication_key
    JobRetryPolicy retry_policy
    Int attempts
    Int max_attempts
    DateTime next_run_at
    String locked_by
    DateTime locked_until
    DateTime started_at
    DateTime finished_at
    String last_error_code
    DateTime created_at
    DateTime updated_at
  }
  outbox_events o|--o{ job_records : "fk_t04_job_record_source_outbox_event"
  lead_student_links {
    String id PK
    String lead_id
    String student_id
    String checked_by_staff_id
    String basis
    DateTime linked_at
    DateTime unlinked_at
    DateTime created_at
    DateTime updated_at
  }
  leads ||--o{ lead_student_links : "fk_lead_link_lead"
  students ||--o{ lead_student_links : "fk_lead_link_student"
  staff_accounts ||--o{ lead_student_links : "fk_lead_link_staff"
  leads {
    String id PK
    LeadStage stage
    String full_name
    String phone
    String email
    String source
    DateTime archived_at
    DateTime created_at
    DateTime updated_at
  }
  ledger_documents {
    String distribution_id
    String consumption_id
    String id PK
    String payment_id
    String refund_id
    String accrual_id
    String payout_id
    String correction_of_document_id
    String basis
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  payment_distributions o|--o| ledger_documents : "fk_ledger_document_distribution"
  entitlement_consumptions o|--o| ledger_documents : "fk_ledger_document_consumption"
  payment_receipts o|--o| ledger_documents : "fk_t03_ledger_document_payment"
  refund_records o|--o| ledger_documents : "fk_t03_ledger_document_refund"
  teacher_accruals o|--o| ledger_documents : "fk_t03_ledger_document_accrual"
  confirmed_payouts o|--o| ledger_documents : "fk_t03_ledger_document_payout"
  ledger_documents o|--o{ ledger_documents : "fk_t03_ledger_document_correction_of_document"
  ledger_entries {
    String id PK
    String document_id
    String financial_period_id
    String currency
    DateTime effective_at
    DateTime balanced_at
    DateTime published_at
    String published_by_id
    String publication_operation_id
    Json balance_snapshot
    String reverses_entry_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  ledger_documents ||--o| ledger_entries : "fk_t03_ledger_entry_document"
  financial_periods ||--o{ ledger_entries : "fk_t03_ledger_entry_financial_period"
  staff_accounts o|--o{ ledger_entries : "fk_t03_ledger_entry_published_by"
  ledger_entries o|--o{ ledger_entries : "fk_t03_ledger_entry_reverses_entry"
  ledger_lines {
    String id PK
    String entry_id
    Int position
    LedgerAccountType account_type
    Decimal amount
    LedgerDirection direction
    String currency
    DateTime created_at
    DateTime updated_at
  }
  ledger_entries ||--o{ ledger_lines : "fk_t03_ledger_line_entry"
  lesson_actual_outcomes {
    String report_id
    String currency
    String id PK
    String lesson_occurrence_id
    String actual_teacher_id
    DateTime actual_started_at
    Int duration_min
    DateTime confirmed_at
    String confirmed_by_id
    String temporary_access_permission_id
    Decimal rate_snapshot
    Int points_snapshot
    AccrualRateBasis rate_basis
    String basis
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  lesson_outcome_reports o|--o| lesson_actual_outcomes : "fk_outcome_report"
  lesson_occurrences ||--o| lesson_actual_outcomes : "fk_t03_lesson_actual_outcome_lesson_occurrence"
  teacher_accounts ||--o{ lesson_actual_outcomes : "fk_t03_lesson_actual_outcome_actual_teacher"
  staff_accounts ||--o{ lesson_actual_outcomes : "fk_t03_lesson_actual_outcome_confirmed_by"
  temporary_access_permissions o|--o{ lesson_actual_outcomes : "fk_t03_lesson_actual_outcome_temporary_access_permission"
  lesson_change_events {
    String id PK
    String lesson_occurrence_id
    String author_id
    Json old_values
    Json new_values
    String reason
    DateTime effective_at
    DateTime server_recorded_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  lesson_occurrences ||--o{ lesson_change_events : "fk_t03_lesson_change_event_lesson_occurrence"
  auth_accounts ||--o{ lesson_change_events : "fk_t03_lesson_change_event_author"
  lesson_occurrences {
    String confirmed_report_id
    DateTime occurrence_date
    Json rate_context_snapshot
    DateTime actual_start_at
    String actual_teacher_at_start_id
    Decimal rate_at_start_snapshot
    Int points_at_start_snapshot
    AccrualRateBasis rate_basis_at_start
    String rate_currency_at_start
    String id PK
    String enrollment_id
    String teaching_assignment_id
    String recurring_slot_id
    String scheduled_teacher_id
    DateTime original_scheduled_at
    DateTime scheduled_at
    DateTime scheduled_end_at
    LessonStatus status
    Int version
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  lesson_outcome_reports o|--o| lesson_occurrences : "fk_lesson_confirmed_report"
  teacher_accounts o|--o{ lesson_occurrences : "fk_t03_lesson_start_teacher"
  student_subject_enrollments ||--o{ lesson_occurrences : "fk_t03_lesson_occurrence_enrollment"
  teaching_assignments ||--o{ lesson_occurrences : "fk_t03_lesson_occurrence_teaching_assignment"
  recurring_slots o|--o{ lesson_occurrences : "fk_t03_lesson_occurrence_recurring_slot"
  teacher_accounts ||--o{ lesson_occurrences : "fk_t03_lesson_occurrence_scheduled_teacher"
  lesson_outcome_reports {
    String id PK
    String lesson_occurrence_id
    String reported_by_id
    Int version
    Int lesson_version
    ReportedLessonResult result
    DateTime actual_started_at
    Int duration_min
    String note
    DateTime reported_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  lesson_occurrences ||--o{ lesson_outcome_reports : "fk_report_lesson"
  teacher_accounts ||--o{ lesson_outcome_reports : "fk_report_teacher"
  mfa_challenges {
    String id PK
    String account_id
    String session_id
    MfaChallengePurpose purpose
    String challenge_hash
    String login_binding_hash
    DateTime expires_at
    DateTime used_at
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o{ mfa_challenges : "fk_challenge_account"
  sessions o|--o{ mfa_challenges : "fk_challenge_session_owner"
  outbox_events {
    String id PK
    OutboxStatus status
    String topic
    Int schema_version
    String aggregate_type
    String aggregate_id
    String source_operation_id
    String audit_event_id
    String event_key
    Json payload
    DateTime published_at
    Int attempts
    DateTime last_attempt_at
    DateTime next_attempt_at
    String locked_by
    DateTime locked_until
    String delivery_reference
    String last_error_code
    DateTime created_at
    DateTime updated_at
  }
  audit_events ||--o{ outbox_events : "fk_t04_outbox_event_audit_event"
  payment_distributions {
    String id PK
    String payment_id
    String subscription_id
    Decimal amount
    String currency
    String approved_by_director_id
    DateTime approved_at
    String approval_operation_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  payment_receipts ||--o{ payment_distributions : "fk_t03_payment_distribution_payment"
  subscriptions ||--o{ payment_distributions : "fk_t03_payment_distribution_subscription"
  staff_accounts o|--o{ payment_distributions : "fk_t03_payment_distribution_approved_by_director"
  payment_receipts {
    String student_id
    String id PK
    Decimal amount
    String currency
    String registered_by_manager_id
    DateTime registered_at
    String confirmed_by_director_id
    DateTime confirmed_by_director_at
    String confirmation_operation_id
    String provider
    String external_reference
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  students o|--o{ payment_receipts : "fk_payment_contact_student"
  staff_accounts ||--o{ payment_receipts : "fk_t03_payment_receipt_registered_by_manager"
  staff_accounts o|--o{ payment_receipts : "fk_t03_payment_receipt_confirmed_by_director"
  payout_attempts {
    String id PK
    String obligation_id
    Decimal amount
    String currency
    PayoutAttemptStatus status
    String provider
    String provider_request_id
    String attempted_by_id
    DateTime attempted_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  payroll_obligations ||--o{ payout_attempts : "fk_t03_payout_attempt_obligation"
  staff_accounts ||--o{ payout_attempts : "fk_t03_payout_attempt_attempted_by"
  payroll_obligations {
    String id PK
    String accrual_id
    Decimal amount
    String currency
    DateTime recognized_at
    String recognition_entry_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  teacher_accruals ||--o| payroll_obligations : "fk_t03_payroll_obligation_accrual"
  ledger_entries o|--o| payroll_obligations : "fk_t03_payroll_obligation_recognition_entry"
  progress_checkpoints {
    String id PK
    String enrollment_id
    CheckpointType type
    Int confirmed_lesson_count
    String lesson_actual_outcome_id
    DateTime triggered_at
    DateTime completed_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  student_subject_enrollments ||--o{ progress_checkpoints : "fk_t04_progress_checkpoint_enrollment"
  lesson_actual_outcomes ||--o{ progress_checkpoints : "fk_t04_progress_checkpoint_lesson_actual_outcome"
  recovery_authorizations {
    String id PK
    String subject_account_id
    String authorized_actor_id
    String identity_evidence_ref
    String owner_instruction_ref
    String reason
    DateTime verified_at
    DateTime expires_at
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o{ recovery_authorizations : "fk_recovery_subject"
  auth_accounts ||--o{ recovery_authorizations : "fk_recovery_authorizer"
  recovery_requests {
    String id PK
    String authorization_id
    String command_operation_id
    String token_hash
    DateTime expires_at
    DateTime completed_at
    DateTime revoked_at
    DateTime created_at
    DateTime updated_at
  }
  recovery_authorizations ||--o| recovery_requests : "fk_recovery_request_authorization"
  recovery_states {
    String id PK
    String job_id
    Int attempt_no
    String operation_key
    String provider
    String provider_request_id
    String ext_resource_id
    RecoveryStatus status
    Int check_attempts
    String locked_by
    DateTime locked_until
    DateTime last_checked_at
    DateTime next_check_at
    DateTime reconciled_at
    String evidence_ref
    String reason_code
    DateTime created_at
    DateTime updated_at
  }
  job_records ||--o{ recovery_states : "fk_t04_recovery_state_job"
  recurring_slots {
    Int version
    String id PK
    String enrollment_id
    String teaching_assignment_id
    String rule
    String timezone
    DateTime active_from
    DateTime active_until
    Int duration_min
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  student_subject_enrollments ||--o{ recurring_slots : "fk_t03_recurring_slot_enrollment"
  teaching_assignments ||--o{ recurring_slots : "fk_t03_recurring_slot_teaching_assignment"
  refund_records {
    String id PK
    String subscription_id
    Decimal calculated_amount
    Decimal original_paid_unit_price
    Int paid_unused_quantity
    String calculation_basis
    String currency
    Decimal approved_amount
    String approved_by_director_id
    DateTime approved_by_director_at
    String approval_operation_id
    Decimal executed_amount
    DateTime executed_at
    String execution_reference
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  subscriptions ||--o{ refund_records : "fk_t03_refund_record_subscription"
  staff_accounts o|--o{ refund_records : "fk_t03_refund_record_approved_by_director"
  relationship_verifications {
    String id PK
    String link_id
    VerificationStatus result
    String basis
    String evidence_ref
    String verified_by_staff_id
    DateTime verified_at
    DateTime created_at
    DateTime updated_at
  }
  student_representative_links ||--o{ relationship_verifications : "fk_verification_link"
  staff_accounts ||--o{ relationship_verifications : "fk_verification_staff"
  representatives {
    String id PK
    String full_name
    String phone
    String email
    DateTime archived_at
    DateTime created_at
    DateTime updated_at
  }
  role_assignments {
    String id PK
    String account_id
    String role_id
    String assigned_by_staff_id
    DateTime valid_from
    DateTime valid_to
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o{ role_assignments : "fk_role_assignment_account"
  roles ||--o{ role_assignments : "fk_role_assignment_role"
  staff_accounts o|--o{ role_assignments : "fk_role_assignment_staff"
  roles {
    String id PK
    RoleCode code
    DateTime created_at
    DateTime updated_at
  }
  runtime_heartbeats {
    String instance_id PK
    String component
    DateTime last_seen_at
    DateTime stopped_at
  }
  s3_objects {
    String id PK
    String bucket
    String key
    BigInt size
    String content_type
    S3ObjectStatus status
    DateTime uploaded_at
    DateTime verified_at
    String sha256
    String uploaded_by
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o{ s3_objects : "fk_t04_s3_object_uploaded_by"
  sale_conditions {
    String id PK
    String code
    Int version
    Int lesson_count
    Decimal list_price
    Decimal discount_amount
    Decimal price
    Decimal lesson_unit_price
    String currency
    DateTime valid_from
    DateTime valid_to
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  schedule_change_requests {
    String id PK
    String lesson_occurrence_id
    String recurring_slot_id
    String teacher_id
    DateTime requested_start_at
    DateTime requested_end_at
    String reason
    ScheduleRequestStatus status
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  lesson_occurrences o|--o{ schedule_change_requests : "fk_schedule_request_lesson"
  recurring_slots o|--o{ schedule_change_requests : "fk_schedule_request_slot"
  teacher_accounts ||--o{ schedule_change_requests : "fk_schedule_request_teacher"
  sessions {
    String id PK
    String account_id
    String token_hash
    String csrf_token_hash
    DateTime expires_at
    DateTime revoked_at
    DateTime mfa_verified_at
    Boolean recovery_only
    DateTime last_seen_at
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o{ sessions : "fk_session_account"
  skill_assessments {
    String id PK
    String skill_id
    String enrollment_id
    String assessed_by
    DateTime assessed_at
    String lesson_ref
    SkillLevel level
    Int version
    String basis
    String supersedes_assessment_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  skill_entries ||--o{ skill_assessments : "fk_t04_skill_assessment_skill"
  student_subject_enrollments ||--o{ skill_assessments : "fk_t04_skill_assessment_enrollment"
  teacher_accounts ||--o{ skill_assessments : "fk_t04_skill_assessment_assessed_by"
  lesson_occurrences o|--o{ skill_assessments : "fk_t04_skill_assessment_lesson_ref"
  skill_assessments o|--o| skill_assessments : "fk_t04_skill_assessment_supersedes_assessment"
  skill_entries {
    String id PK
    String subject_id
    String code
    String label
    String description
    DateTime archived_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  subjects ||--o{ skill_entries : "fk_t04_skill_entry_subject"
  slot_change_events {
    String id PK
    String slot_id
    String author_id
    Json old_values
    Json new_values
    String reason
    DateTime effective_at
    DateTime server_recorded_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  recurring_slots ||--o{ slot_change_events : "fk_slot_change_slot"
  auth_accounts ||--o{ slot_change_events : "fk_slot_change_author"
  staff_accounts {
    String id PK
    String account_id
    AccountKind account_kind
    String full_name
    String phone
    String email
    DateTime deactivated_at
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o| staff_accounts : "fk_staff_account_auth"
  student_accounts {
    String id PK
    String student_id
    String account_id
    AccountKind account_kind
    StudentActivationBasis activation_basis
    Boolean must_change_password
    String activation_subscription_id
    String activation_payment_confirmation_id
    String activation_director_admission_id
    String activation_confirmed_by_staff_id
    DateTime activated_at
    DateTime deactivated_at
    DateTime created_at
    DateTime updated_at
  }
  students ||--o{ student_accounts : "fk_student_account_student"
  auth_accounts ||--o| student_accounts : "fk_student_account_auth"
  staff_accounts ||--o{ student_accounts : "fk_student_activation_staff"
  subscriptions ||--o{ student_accounts : "fk_t03_activation_subscription"
  payment_receipts ||--o{ student_accounts : "fk_t03_activation_payment"
  temporary_access_permissions o|--o{ student_accounts : "fk_t03_activation_director"
  student_representative_links {
    String id PK
    String student_id
    String representative_id
    RelationshipRole role
    String basis
    VerificationStatus verification_status
    DateTime verified_at
    String verified_by_staff_id
    DateTime valid_from
    DateTime valid_to
    DateTime created_at
    DateTime updated_at
  }
  students ||--o{ student_representative_links : "fk_relation_student"
  representatives ||--o{ student_representative_links : "fk_relation_representative"
  staff_accounts o|--o{ student_representative_links : "fk_relation_verifier"
  student_subject_enrollments {
    String id PK
    String student_id
    String subject_id
    EnrollmentStatus status
    DateTime valid_from
    DateTime valid_to
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  students ||--o{ student_subject_enrollments : "fk_t03_student_subject_enrollment_student"
  subjects ||--o{ student_subject_enrollments : "fk_t03_student_subject_enrollment_subject"
  students {
    String id PK
    String full_name
    DateTime birth_date
    String phone
    String email
    DateTime archived_at
    DateTime created_at
    DateTime updated_at
  }
  subjects {
    String id PK
    String code
    String name
    DateTime archived_at
    DateTime created_at
    DateTime updated_at
  }
  submission_reviews {
    String id PK
    String submission_id
    String reviewer_id
    Int version
    HomeworkReviewResult result
    String grade
    String comment
    DateTime reviewed_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  homework_submissions ||--o{ submission_reviews : "fk_t04_submission_review_submission"
  teacher_accounts ||--o{ submission_reviews : "fk_t04_submission_review_reviewer"
  subscriptions {
    String id PK
    String enrollment_id
    String sale_condition_id
    Int lesson_count
    Decimal full_price
    Decimal initial_discount_amount
    Decimal original_paid_unit_price
    String currency
    DateTime valid_from
    DateTime valid_to
    DateTime frozen_from
    DateTime frozen_until
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  student_subject_enrollments ||--o{ subscriptions : "fk_t03_subscription_enrollment"
  sale_conditions ||--o{ subscriptions : "fk_t03_subscription_sale_condition"
  teacher_accounts {
    String id PK
    String account_id
    AccountKind account_kind
    String full_name
    String phone
    String email
    DateTime deactivated_at
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o| teacher_accounts : "fk_teacher_account_auth"
  teacher_accruals {
    String exception_authorized_by_id
    String id PK
    String lesson_actual_outcome_id
    String teacher_id
    Decimal rate_snapshot
    Int points_snapshot
    AccrualRateBasis rate_basis
    Decimal amount
    String currency
    String basis
    DateTime recognized_at
    String authorized_by_id
    String financial_period_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  staff_accounts o|--o{ teacher_accruals : "fk_accrual_exception_director"
  lesson_actual_outcomes ||--o| teacher_accruals : "fk_t03_teacher_accrual_lesson_actual_outcome"
  teacher_accounts ||--o{ teacher_accruals : "fk_t03_teacher_accrual_teacher"
  staff_accounts ||--o{ teacher_accruals : "fk_t03_teacher_accrual_authorized_by"
  financial_periods ||--o{ teacher_accruals : "fk_t03_teacher_accrual_financial_period"
  teacher_availabilities {
    String id PK
    String teacher_id
    DateTime starts_at
    DateTime ends_at
    String timezone
    DateTime cancelled_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  teacher_accounts ||--o{ teacher_availabilities : "fk_t03_teacher_availability_teacher"
  teacher_engagements {
    String id PK
    String teacher_id
    DateTime starts_at
    DateTime ends_at
    String basis
    String recorded_by_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  teacher_accounts ||--o{ teacher_engagements : "fk_engagement_teacher"
  staff_accounts ||--o{ teacher_engagements : "fk_engagement_recorder"
  teacher_rate_promises {
    String id PK
    String teacher_id
    DateTime valid_from
    DateTime valid_to
    Decimal minimum_rate
    Decimal additive_rate
    String currency
    String basis
    String recorded_by_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  teacher_accounts ||--o{ teacher_rate_promises : "fk_rate_promise_teacher"
  staff_accounts ||--o{ teacher_rate_promises : "fk_rate_promise_recorder"
  teacher_tenure_credits {
    String id PK
    String engagement_id
    DateTime starts_on
    DateTime ends_on
    String basis
    String recorded_by_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  teacher_engagements ||--o{ teacher_tenure_credits : "fk_tenure_engagement"
  staff_accounts ||--o{ teacher_tenure_credits : "fk_tenure_recorder"
  teaching_assignments {
    String id PK
    String enrollment_id
    String teacher_id
    DateTime valid_from
    DateTime valid_to
    String basis
    String assigned_by_id
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  student_subject_enrollments ||--o{ teaching_assignments : "fk_t03_teaching_assignment_enrollment"
  teacher_accounts ||--o{ teaching_assignments : "fk_t03_teaching_assignment_teacher"
  staff_accounts ||--o{ teaching_assignments : "fk_t03_teaching_assignment_assigned_by"
  temporary_access_permissions {
    String id PK
    String subscription_id
    String approved_by_director_id
    DateTime approved_at
    DateTime valid_from
    DateTime valid_to
    Int max_lessons
    String reason
    DateTime revoked_at
    String source_operation_id
    DateTime created_at
    DateTime updated_at
  }
  subscriptions ||--o{ temporary_access_permissions : "fk_t03_temporary_access_permission_subscription"
  staff_accounts ||--o{ temporary_access_permissions : "fk_t03_temporary_access_permission_approved_by_director"
  webauthn_credentials {
    String id PK
    String account_id
    String aaguid
    Bytes credential_id
    Bytes public_key
    BigInt sign_count
    String_array transports
    Boolean backup_eligible
    Boolean backed_up
    DateTime last_used_at
    DateTime revoked_at
    DateTime created_at
    DateTime updated_at
  }
  auth_accounts ||--o{ webauthn_credentials : "fk_credential_account"
```

Cardinality marks show the referenced-to-dependent direction. Nullable columns and compound FK columns are specified in `schema.contract.json`.
Financial immutability, exclusion constraints, partial unique indexes, RLS and runtime grants are additional SQL invariants, not ORM-only guarantees.
