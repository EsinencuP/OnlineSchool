import PDFDocument from 'pdfkit';
import type { EducationPdfData } from '@online-school/api/education-export';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { Readable } from 'node:stream';

export const MAX_EDUCATION_PDF_BYTES = 20 * 1024 * 1024;
const statuses: Record<string, string> = {
  NOT_STUDIED: 'Ещё не изучали',
  FAMILIARIZING: 'Знакомлюсь',
  PRACTICING: 'Практикую',
  APPLYING: 'Применяю',
  COMPLETED: 'Проведён',
  NO_SHOW: 'Пропуск',
  CANCELLED: 'Отменён',
  RESCHEDULED: 'Перенесён',
  NOT_CONFIRMED: 'Факт не подтверждён',
  DISPUTED: 'Оспаривается',
};
const clean = (value: string) =>
  Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (code >= 32 && code !== 127) || code === 10 || code === 13 || code === 9;
    })
    .join('');
export async function renderEducationPdf(
  data: EducationPdfData,
  signal?: AbortSignal,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 62, left: 54, right: 54, bottom: 58 },
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: 'Образовательная история',
      Author: 'Online Academy',
      Creator: 'Online Academy',
      CreationDate: new Date(data.asOf),
      ModDate: new Date(data.asOf),
    },
  }) as PDFKit.PDFDocument & Readable;
  doc.registerFont(
    'Body',
    fileURLToPath(new URL('../assets/fonts/NotoSans-Regular.ttf', import.meta.url)),
  );
  doc.registerFont(
    'Heading',
    fileURLToPath(new URL('../assets/fonts/NotoSans-Bold.ttf', import.meta.url)),
  );
  const parts: Buffer[] = [];
  let bytes = 0,
    failure: Error | undefined;
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (part: Buffer) => {
      bytes += part.length;
      if (bytes > MAX_EDUCATION_PDF_BYTES) {
        failure = new Error('PDF_EXPORT_SIZE_LIMIT');
        doc.destroy(failure);
      } else parts.push(part);
    });
    doc.once('end', () => resolve(Buffer.concat(parts)));
    doc.once('error', (error: Error) => {
      failure = error;
      reject(error);
    });
  });
  void finished.catch(() => {});
  const aborted = () => {
    failure = new Error('PDF_EXPORT_ABORTED');
    doc.destroy(failure);
  };
  signal?.addEventListener('abort', aborted, { once: true });
  const check = async () => {
    if (signal?.aborted) return Promise.reject(new Error('PDF_EXPORT_ABORTED'));
    if (failure) return Promise.reject(failure);
    if (doc.bufferedPageRange().count > 1000)
      return Promise.reject(new Error('PDF_EXPORT_SIZE_LIMIT'));
  };
  const date = (value: string) =>
    new Intl.DateTimeFormat('ru-RU', { timeZone: data.timeZone, dateStyle: 'medium' }).format(
      new Date(value),
    );
  const newPageHeader = () => {
    const x = doc.x,
      y = doc.y;
    doc
      .font('Heading')
      .fontSize(8)
      .fillColor('#334155')
      .text('ONLINE ACADEMY  /  ОБРАЗОВАТЕЛЬНАЯ ИСТОРИЯ', 54, 27, { lineBreak: false });
    doc
      .moveTo(54, 45)
      .lineTo(doc.page.width - 54, 45)
      .strokeColor('#cbd5e1')
      .lineWidth(0.5)
      .stroke();
    doc.x = x;
    doc.y = y;
    doc.font('Body').fontSize(10).fillColor('#172033');
  };
  const room = (height: number) => {
    if (doc.y + height > doc.page.height - 58) doc.addPage();
  };
  const section = async (number: string, title: string) => {
    await check();
    room(62);
    doc.moveDown(0.7);
    doc.font('Heading').fontSize(9).fillColor('#087f72').text(number);
    doc.fontSize(17).fillColor('#172033').text(title);
    doc.moveDown(0.5);
  };
  const text = (value: string) => {
    doc.font('Body').fontSize(10).fillColor('#172033').text(clean(value), { lineGap: 3 });
    doc.moveDown(0.35);
  };
  const label = (title: string, value: string) => {
    room(32);
    doc.font('Heading').fontSize(9).fillColor('#475569').text(title);
    text(value || 'Не указано');
  };
  try {
    await check();
    doc.addPage();
    doc.font('Heading').fontSize(26).fillColor('#172033').text('Мой путь знаний');
    doc.moveDown(0.3);
    doc.fontSize(17).text(clean(data.studentName));
    doc.moveDown(0.5);
    text(`Период: ${data.periodFrom} - ${data.periodTo}`);
    text(`Дата формирования: ${date(data.asOf)}`);
    await section('01', 'Карта навыков и цели');
    text(`Состояние на ${date(data.asOf)}`);
    if (!data.skills.length) text('Сведения о навыках пока не добавлены.');
    for (const subject of data.skills) {
      room(45);
      doc.font('Heading').fontSize(13).fillColor('#172033').text(clean(subject.subjectName));
      doc.moveDown(0.35);
      if (!subject.skills.length) text('Навыки по предмету пока не добавлены.');
      for (const skill of subject.skills) {
        await check();
        room(28);
        text(`${skill.name} - ${statuses[skill.status] ?? 'Ещё не изучали'}`);
      }
      for (const goal of subject.learningGoals) {
        await check();
        text(
          `${goal.isAchieved ? 'Достигнута цель' : 'Цель'}: ${goal.text}${goal.targetDate ? ` (срок: ${goal.targetDate})` : ''}`,
        );
      }
      await yieldTurn();
    }
    await section('02', 'Образовательные отчёты');
    if (!data.reports.length) text('Опубликованных отчётов пока нет.');
    for (const report of data.reports) {
      await check();
      const reportHeight =
        85 +
        [
          report.content.achievements,
          report.content.growthAreas,
          report.content.recommendations,
          report.content.teacherSignature,
        ].reduce(
          (height, value) =>
            height +
            doc
              .font('Body')
              .fontSize(10)
              .heightOfString(clean(value || 'Не указано'), {
                width: doc.page.width - 108,
                lineGap: 3,
              }) +
            23,
          0,
        );
      room(Math.min(reportHeight, doc.page.height - 120));
      doc.font('Heading').fontSize(13).text(clean(report.subjectName));
      text(`${report.periodFrom} - ${report.periodTo}  |  ${report.lessonCount} уроков`);
      label('Достижения', report.content.achievements);
      label('Зоны роста', report.content.growthAreas);
      label('Рекомендации', report.content.recommendations);
      label('Подпись учителя', report.content.teacherSignature);
      text(`Учитель: ${report.teacherName}`);
      doc.moveDown(0.6);
      await yieldTurn();
    }
    await section('03', 'История посещений');
    if (!data.lessons.length) text('Записей об уроках за выбранный период нет.');
    let row = 0;
    for (const lesson of data.lessons) {
      await check();
      room(38);
      text(
        `${date(lesson.date)}  |  ${lesson.subjectName}  |  ${statuses[lesson.status] ?? 'Факт не подтверждён'}`,
      );
      doc.fontSize(8).fillColor('#64748b').text(clean(lesson.teacherName));
      doc.moveDown(0.45);
      if (++row % 20 === 0) await yieldTurn();
    }
    room(45);
    doc.moveDown();
    text(`Сформировано Online Academy ${date(data.asOf)}`);
    await check();
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      newPageHeader();
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font('Body')
        .fontSize(8)
        .fillColor('#64748b')
        .text(`Online Academy  |  ${i + 1} / ${range.count}`, 54, doc.page.height - 33, {
          width: doc.page.width - 108,
          align: 'right',
          lineBreak: false,
        });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
    return await finished;
  } catch (error) {
    doc.destroy();
    return Promise.reject(error);
  } finally {
    signal?.removeEventListener('abort', aborted);
  }
}
