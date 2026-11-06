"""Validate K8K task documents only. No product tests, DB or network access."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import hashlib
import json
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'docs/k8k-redesign-tasks'


def validate():
    errors = []
    manifest_path = PACK / 'manifest.json'
    if not manifest_path.exists():
        return ['manifest.json is missing'], {}
    entries = json.loads(manifest_path.read_text(encoding='utf-8'))
    ids = [e['id'] for e in entries]
    if ids != list(range(1, 77)):
        errors.append('Expected exactly ordered TASK-001..TASK-076')
    if len(list(PACK.glob('TASK-[0-9][0-9][0-9].md'))) != 76:
        errors.append('Expected exactly 76 individual task files')
    sections = (
        '## 1. Команда', '## 2. Контекст', '## 3. Неприкосновенные',
        '## 4. Источники', '## 5. Предметные', '## 6. Контракты',
        '## 7. Пошаговое', '## 8. Обязательные', '## 9. Команды',
        '## 10. Критерии', '## 11. Не входит', '## 12. Артефакты',
    )
    for entry in entries:
        task = PACK / entry['file']
        if not task.is_file():
            errors.append(f'Missing task: {task.name}')
            continue
        content = task.read_text(encoding='utf-8')
        if hashlib.sha256(task.read_bytes()).hexdigest() != entry['sha256']:
            errors.append(f'{task.name}: checksum differs from package edition')
        for section in sections:
            if section not in content:
                errors.append(f'{task.name}: missing {section}')
        if len(content) < 9000:
            errors.append(f'{task.name}: too short for agreed standalone task format')
        if '\ufffd' in content:
            errors.append(f'{task.name}: Unicode replacement character')
        for dep in entry['depends']:
            if dep not in ids or dep >= entry['id']:
                errors.append(f'{task.name}: missing/forward dependency {dep}')
        for path in entry['sources'] + entry['files']:
            if not (ROOT / path).exists():
                errors.append(f'{task.name}: missing source/entrypoint {path}')
        if not re.search(r'\bRU/RO\b', content):
            errors.append(f'{task.name}: missing RU/RO context')
        for field, minimum in [('stepCount', 6), ('testCount', 6), ('acceptanceCount', 5)]:
            if entry.get(field, 0) < minimum:
                errors.append(f'{task.name}: insufficient {field}')
        if 'Не создавать staging/QA/disposable БД' not in content or 'destructive' not in content:
            errors.append(f'{task.name}: missing environment policy')
    checked_links = 0
    for document in PACK.rglob('*.md'):
        content = document.read_text(encoding='utf-8')
        for raw in re.findall(r'\[[^\]\n]+\]\(([^\s)]+)\)', content):
            raw = raw.strip().strip('<>')
            parts = urlsplit(raw)
            if parts.scheme or raw.startswith('#'):
                continue
            target = (document.parent / unquote(parts.path)).resolve()
            checked_links += 1
            if not target.exists():
                errors.append(f'{document.name}: broken local link {raw}')
    log = (PACK / 'EXECUTION_LOG.md').read_text(encoding='utf-8')
    if len(re.findall(r'^\| \[TASK-\d{3}\]', log, re.M)) != 76:
        errors.append('Execution log does not contain 76 task rows')
    modules = list((PACK / 'modules').glob('*.md'))
    expected_blocks = {'0': 4, '1': 13, '2': 6, '3': 12, '4': 12, '5': 11, '6': 11, '7': 7}
    actual_blocks = {key: len([e for e in entries if e['block'] == key]) for key in expected_blocks}
    if actual_blocks != expected_blocks:
        errors.append(f'Unexpected block distribution: {actual_blocks}')
    specifications = json.loads((PACK / 'task-specifications.json').read_text(encoding='utf-8'))
    if [s['id'] for s in specifications] != ids:
        errors.append('Detailed specifications do not match manifest IDs')
    return errors, {
        'tasks': len(entries), 'blocks': len({e['block'] for e in entries}),
        'modules': len(modules), 'localLinks': checked_links,
        'markdownFiles': len(list(PACK.rglob('*.md'))),
        'scope': 'documentation structure, dependencies, local paths and checksums only',
    }


if __name__ == '__main__':
    failures, summary = validate()
    if failures:
        for failure in failures:
            print(failure, file=sys.stderr)
        print(f'FAIL: {len(failures)} documentation issues')
        sys.exit(1)
    print(json.dumps({'status': 'PASS', **summary}, ensure_ascii=True))
