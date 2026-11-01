// Public, dependency-free source discovery. Only Git files enter the catalogs.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const rawBase = 'https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/';
const raw = (file) => rawBase + file.split('/').map(encodeURIComponent).join('/');
// Copies live below docs/readable; preserve the original link destinations.
const publicLinks = (text, source) =>
  text.replace(/\]\(([^)\n]+)\)/g, (match, target) => {
    if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(target)) return match;
    const [file, fragment] = target.split('#', 2);
    const destination = file
      ? path.posix.normalize(path.posix.join(path.posix.dirname(source), decodeURI(file)))
      : source;
    return `](${raw(destination)}${fragment ? '#' + fragment : ''})`;
  });
const hash = (data) => createHash('sha256').update(data).digest('hex');
async function write(file, text) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), text);
}
const roadmap = 'docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md';
// Canonical repository bytes match anonymous Raw downloads, regardless of local CRLF checkout.
const data = execFileSync('git', ['show', `HEAD:${roadmap}`], { cwd: root });
const parts = [];
for (let start = 0; start < data.length;) {
  let end = Math.min(start + 24 * 1024, data.length);
  if (end < data.length) {
    const newline = data.lastIndexOf(10, end - 1);
    if (newline > start) end = newline + 1;
    else while ((data[end] & 0xc0) === 0x80) end--;
  }
  const part = data.subarray(start, end);
  const file = `docs/readable/roadmap-v9.7/part-${String(parts.length + 1).padStart(2, '0')}.md`;
  await write(file, part);
  parts.push({ file, bytes: part.length, sha256: hash(part), start, end, raw: raw(file) });
  start = end;
}
if (
  hash(Buffer.concat(await Promise.all(parts.map((p) => readFile(path.join(root, p.file)))))) !==
  hash(data)
)
  throw new Error('Roadmap split changed source content');
await write(
  'docs/readable/roadmap-v9.7/manifest.json',
  JSON.stringify(
    {
      source: roadmap,
      sourceBytes: data.length,
      sourceSha256: hash(data),
      exactConcatenation: true,
      parts,
    },
    null,
    2,
  ) + '\n',
);
await write(
  'docs/readable/roadmap-v9.7/README.md',
  '# Roadmap v9.7 целиком по частям\n\n' +
    `Оригинал: [Raw](${raw(roadmap)}). Части до 24 КиБ, без сокращений и правок. ` +
    'Их последовательное побайтное объединение даёт исходный файл; SHA-256 проверен генератором. Статусы и даты исходника сохранены.\n\n' +
    parts
      .map(
        (p, i) =>
          `- Часть ${i + 1}: [GitHub](${path.basename(p.file)}) · [Raw](${p.raw}) (${p.bytes} байт)`,
      )
      .join('\n') +
    '\n',
);

const managerSource = 'docs/AI Coder Tasks — Модуль 2 Кабинет менеджера.md';
const manager = execFileSync('git', ['show', `HEAD:${managerSource}`], {
  cwd: root,
  encoding: 'utf8',
});
const headings = [...manager.matchAll(/^### MGR-\d{2}:[^\r\n]*/gm)];
const shared = manager.slice(0, headings[0].index);
await write('docs/readable/manager-tasks/COMMON.md', publicLinks(shared, managerSource));
const taskLinks = [];
for (let i = 0; i < headings.length; i++) {
  const code = headings[i][0].match(/MGR-\d{2}/)[0];
  const file = `docs/readable/manager-tasks/${code}.md`;
  await write(
    file,
    `> Исходный текст из [пакета Модуль 2](${raw(managerSource)}). ` +
      'Обязательны [общие инварианты и поздние решения владельца](COMMON.md).\n\n' +
      publicLinks(
        manager.slice(headings[i].index, headings[i + 1]?.index ?? manager.length),
        managerSource,
      ),
  );
  taskLinks.push(`- ${code}: [GitHub](${code}.md) · [Raw](${raw(file)})`);
}
await write(
  'docs/readable/manager-tasks/README.md',
  '# Исходные задачи менеджера\n\n' +
    'Здесь разделён существующий исходный пакет задач, а не документы об их реализации. ' +
    'Относительные ссылки исходника заменены прямыми публичными ссылками на те же документы. ' +
    'Применяйте [общие инварианты и уточнения](COMMON.md) ко всем задачам.\n\n' +
    taskLinks.join('\n') +
    `\n- MGR-11: [исходный отдельный документ](${raw('docs/AI Coder Tasks — Модуль 2 — MGR-11.md')})\n`,
);

const images = JSON.parse(
  await readFile(path.join(root, 'docs/reference-images-webp.json'), 'utf8'),
).images;
for (const dir of ['ref', 'template']) {
  const rows = images.filter((i) => i.after.startsWith(dir + '/'));
  await write(
    `${dir}/README.md`,
    `# ${dir === 'ref' ? 'Референсы' : 'Визуальные шаблоны'}\n\n` +
      'Все изображения в этой папке публичны, формат WebP. Это визуальные ориентиры; цифры и действия на них не утверждают бизнес-правила.\n' +
      (dir === 'ref'
        ? '\nИсходное видео удалено владельцем 01.11.2026. Сохранены 17 ранее просмотренных кадров.\n'
        : '') +
      '\n' +
      rows
        .map(
          (i) =>
            `## ${path.basename(i.after)}\n\n![${path.basename(i.after)}](${i.after
              .slice(dir.length + 1)
              .split('/')
              .map(encodeURIComponent)
              .join(
                '/',
              )})\n\n[Прямой файл](${raw(i.after)}) · ${i.webp.width} × ${i.webp.height}\n`,
        )
        .join('\n'),
  );
}

const groups = new Map();
const category = (f) =>
  f.startsWith('apps/api/')
    ? 'api'
    : f.startsWith('apps/worker/')
      ? 'worker'
      : f.startsWith('apps/platform/')
        ? 'platform'
        : f.startsWith('apps/student-cabinet/')
          ? 'student'
          : f.startsWith('apps/manager-web/')
            ? 'manager'
            : f.startsWith('packages/db/')
              ? 'database'
              : f.startsWith('packages/')
                ? 'packages'
                : f.startsWith('docs/')
                  ? 'documents'
                  : /^(ref|template)\//.test(f)
                    ? 'references'
                    : f.startsWith('tests/')
                      ? 'tests'
                      : 'repository';
const files = [
  ...new Set(
    execFileSync('git', ['ls-files', '--cached', '-z'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean),
  ),
]
  .filter((f) => !f.startsWith('docs/public/') && f !== 'PUBLIC_FILES.json')
  .sort();
for (const file of files) {
  const key = category(file);
  const rows = groups.get(key) ?? [];
  rows.push({ path: file, raw: raw(file) });
  groups.set(key, rows);
}
const catalogs = [];
for (const [area, rows] of groups)
  for (let start = 0; start < rows.length; start += 50) {
    const file = `docs/public/${area}-${String(start / 50 + 1).padStart(2, '0')}.json`;
    const entries = rows.slice(start, start + 50);
    await write(file, JSON.stringify({ area, files: entries }, null, 2) + '\n');
    catalogs.push({ area, count: entries.length, file, raw: raw(file) });
  }
await write(
  'PUBLIC_FILES.json',
  JSON.stringify(
    {
      repository: 'EsinencuP/OnlineSchool',
      branch: 'main',
      generatedAt: new Date().toISOString(),
      authenticationRequired: false,
      files: files.length,
      catalogNote:
        'Generated catalog JSON files are listed here rather than recursively listing themselves.',
      catalogs,
    },
    null,
    2,
  ) + '\n',
);
await write(
  'docs/public/README.md',
  '# Публичные каталоги файлов\n\n' +
    'Для автоматического чтения GitHub-деревья не нужны. Каждый JSON содержит пути и прямую Raw-ссылку, без авторизации. Каталоги разбиты по 50 файлов.\n\n' +
    catalogs
      .map(
        (c) =>
          `- ${c.area}, ${c.count} файлов: [GitHub](${path.basename(c.file)}) · [Raw](${c.raw})`,
      )
      .join('\n') +
    '\n\n' +
    '[Общий машинный индекс](../../PUBLIC_FILES.json) · [Обзор источников](../../PUBLIC_INDEX.md)\n',
);
console.log(
  JSON.stringify({
    roadmapParts: parts.length,
    roadmapExact: true,
    originalManagerTasks: headings.length,
    publicCatalogs: catalogs.length,
    listedFiles: files.length,
  }),
);
