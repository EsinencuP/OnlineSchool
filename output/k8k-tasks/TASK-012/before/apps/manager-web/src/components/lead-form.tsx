import { useState } from 'react';
import { createManagerLead, updateManagerLead } from '@online-school/api-contracts';
import type { CreateLeadDto, LeadDto } from '@online-school/api-contracts';
import { useCommand } from '../hooks/use-command.js';
import { useOptions } from '../hooks/use-options.js';
import { Check, FormShell, Input, Select, TextArea, enumOptions, text } from './ui.js';
import { ru } from '../i18n/ru.js';
export function LeadForm({
  lead,
  done,
  reload,
}: {
  lead?: LeadDto;
  done: (lead: LeadDto) => void;
  reload?: () => Promise<unknown>;
}) {
  const command = useCommand(),
    options = useOptions();
  const [audience, setAudience] = useState<'CHILD' | 'ADULT'>(lead?.audience ?? 'CHILD');
  const [phone, setPhone] = useState(lead?.phone ?? ''),
    [email, setEmail] = useState(lead?.email ?? ''),
    [force, setForce] = useState(false);
  return (
    <FormShell
      busy={command.busy}
      error={command.error}
      {...(reload ? { reload } : {})}
      button={lead ? ru.save : ru.newLead}
      submit={async (f) => {
        const optional = (name: string) => text(f, name) || undefined;
        const payload: CreateLeadDto = {
          audience,
          contactName: text(f, 'contactName'),
          subjectId: lead?.studentId && lead.subjectId ? lead.subjectId : text(f, 'subjectId'),
          source: text(f, 'source') as CreateLeadDto['source'],
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(optional('guardianName') ? { guardianName: text(f, 'guardianName') } : {}),
          ...(optional('ageYears') ? { ageYears: parseInt(text(f, 'ageYears'), 10) } : {}),
          ...(optional('grade') ? { grade: parseInt(text(f, 'grade'), 10) } : {}),
          ...(optional('level') ? { level: text(f, 'level') } : {}),
          ...(optional('comment') ? { comment: text(f, 'comment') } : {}),
          ...(!lead ? { forceCreate: force } : {}),
        };
        if (lead) {
          const { forceCreate: _, ...update } = payload;
          void _;
          const result = await command.run({ ...update, version: lead.version }, (o) =>
            updateManagerLead(lead.leadId, { ...update, version: lead.version }, o),
          );
          if (result) done(result);
        } else {
          const result = await command.run(payload, (o) => createManagerLead(payload, o));
          if (result) done(result);
        }
      }}
    >
      <Input
        name="contactName"
        label={ru.contactName}
        required
        minLength={2}
        maxLength={120}
        defaultValue={lead?.contactName ?? ''}
      />
      <Select
        name="audience"
        label={ru.audience}
        value={audience}
        placeholder={false}
        options={enumOptions(['CHILD', 'ADULT'])}
        onChange={(e) => setAudience(e.target.value as 'CHILD' | 'ADULT')}
      />
      <Input
        name="guardianName"
        label={ru.guardianNameLead}
        required={audience === 'CHILD'}
        minLength={2}
        maxLength={120}
        defaultValue={lead?.guardianName ?? ''}
      />
      <Input
        name="phone"
        label={ru.phone}
        type="tel"
        required={!email.trim()}
        maxLength={20}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        hint={ru.contactRequired}
      />
      <Input
        name="email"
        label={ru.email}
        type="email"
        required={!phone.trim()}
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Select
        name="subjectId"
        label={ru.studySubject}
        required
        disabled={!!lead?.studentId && !!lead.subjectId}
        defaultValue={lead?.subjectId ?? ''}
        options={options.data?.subjects ?? []}
      />
      <div className="form-grid">
        <Input
          name="ageYears"
          label={ru.ageYears}
          type="number"
          min={3}
          max={99}
          defaultValue={lead?.ageYears ?? ''}
        />
        <Input
          name="grade"
          label={ru.grade}
          type="number"
          min={1}
          max={11}
          defaultValue={lead?.grade ?? ''}
        />
        <Input name="level" label={ru.level} maxLength={10} defaultValue={lead?.level ?? ''} />
      </div>
      <Select
        name="source"
        label={ru.source}
        placeholder={false}
        defaultValue={lead?.source ?? 'PHONE'}
        options={enumOptions(['SITE', 'PHONE', 'MESSENGER', 'REFERRAL', 'OTHER'])}
      />
      <TextArea
        name="comment"
        label={ru.comment}
        maxLength={2000}
        defaultValue={lead?.comment ?? ''}
      />
      {!lead && command.error?.code === 'LEAD_DUPLICATE_SUSPECTED' && (
        <>
          <p>
            {ru.duplicateId}: {command.error.existingId ?? ru.dash}
          </p>
          <Check
            name="forceCreate"
            label={ru.forceLead}
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
        </>
      )}
    </FormShell>
  );
}
