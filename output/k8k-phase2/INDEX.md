# K8K — проверка оболочки фазы 2

Только синтетические fixtures/MSW. Новый вид: 360/768/1024/1280; legacy: 360/1280. Axe — оболочка и компонентные состояния; историческое предметное содержимое целиком не сертифицировано.

| Роль     | Вид      | 360                            | 768                         | 1024                         | 1280                            |
| -------- | -------- | ------------------------------ | --------------------------- | ---------------------------- | ------------------------------- |
| student  | ui.k8k=1 | [PNG](student-k8k-360.png)     | [PNG](student-k8k-768.png)  | [PNG](student-k8k-1024.png)  | [PNG](student-k8k-1280.png)     |
| student  | ui.k8k=0 | [PNG](student-legacy-360.png)  | —                           | —                            | [PNG](student-legacy-1280.png)  |
| manager  | ui.k8k=1 | [PNG](manager-k8k-360.png)     | [PNG](manager-k8k-768.png)  | [PNG](manager-k8k-1024.png)  | [PNG](manager-k8k-1280.png)     |
| manager  | ui.k8k=0 | [PNG](manager-legacy-360.png)  | —                           | —                            | [PNG](manager-legacy-1280.png)  |
| teacher  | ui.k8k=1 | [PNG](teacher-k8k-360.png)     | [PNG](teacher-k8k-768.png)  | [PNG](teacher-k8k-1024.png)  | [PNG](teacher-k8k-1280.png)     |
| teacher  | ui.k8k=0 | [PNG](teacher-legacy-360.png)  | —                           | —                            | [PNG](teacher-legacy-1280.png)  |
| director | ui.k8k=1 | [PNG](director-k8k-360.png)    | [PNG](director-k8k-768.png) | [PNG](director-k8k-1024.png) | [PNG](director-k8k-1280.png)    |
| director | ui.k8k=0 | [PNG](director-legacy-360.png) | —                           | —                            | [PNG](director-legacy-1280.png) |
| operator | ui.k8k=1 | [PNG](operator-k8k-360.png)    | [PNG](operator-k8k-768.png) | [PNG](operator-k8k-1024.png) | [PNG](operator-k8k-1280.png)    |
| operator | ui.k8k=0 | [PNG](operator-legacy-360.png) | —                           | —                            | [PNG](operator-legacy-1280.png) |

Дополнительно: [stale](teacher-stale-1280.png), [forbidden](teacher-forbidden-1280.png).

Девять состояний компонентов:

- [empty](state-empty.png)
- [error](state-error.png)
- [forbidden](state-forbidden.png)
- [loading](state-loading.png)
- [pending](state-pending.png)
- [ready](state-ready.png)
- [session-expired](state-session-expired.png)
- [stale](state-stale.png)
- [subscription-limited](state-subscription-limited.png)

Проверки поведения:

- student: mobile menu Escape returns focus; flag persists through navigation
- teacher: background error retains last-known content/nav/focus; 403 removes private content
- components: stable input DOM/value/focus in stale and unknown-result; no command retry; nine states pass axe
- refresh: editing defers; blur resumes; hidden tab stops polling; return refreshes once

Повтор: после адресных frontend-сборок запустить `node scripts/k8k-phase2-browser.mjs`. Бандл/delta: `node scripts/k8k-phase2-bundle.mjs`, результат — [bundle.json](bundle.json).
