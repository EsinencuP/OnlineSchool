-- Separate commit: PostgreSQL must commit an enum extension before using its new value.
ALTER TYPE "SkillLevel" ADD VALUE IF NOT EXISTS 'NOT_STUDIED';
