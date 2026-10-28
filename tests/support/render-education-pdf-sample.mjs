import { mkdir, writeFile } from 'node:fs/promises';
import { renderEducationPdf } from '../../apps/worker/dist/education-pdf.js';
import { educationPdfFixture } from './education-pdf-fixture.mjs';
const data = educationPdfFixture();
data.reports.reverse();
for (const report of data.reports) report.content.internalNote = 'SYNTHETIC_INTERNAL_NOTE_EXCLUDED';
await mkdir(new URL('../../output/pdf/', import.meta.url), { recursive: true });
const pdf = await renderEducationPdf(data);
await writeFile(new URL('../../output/pdf/stu09-sample-history.pdf', import.meta.url), pdf);
console.log(
  JSON.stringify({
    bytes: pdf.length,
    pdfHeader: pdf.subarray(0, 5).toString(),
    fixture: 'SYNTHETIC ONLY',
  }),
);
