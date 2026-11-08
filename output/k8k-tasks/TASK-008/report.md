TASK: TASK-008
Статус: DONE (scoped; следующий TASK не начат)
Дата:04.11.2026
Основа: HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`.
Accepted dirty digest: `3c1036a16e8e2693ec0238c6f97eda4d7320ad97f65ada37bc2cce234018b5ba`.
Source digest475 inputs: `b72b6e077624c707227fe8be3b02543f85075ce84bbe943075bb09debd9ff6d0`.
Run: [verification](runs/2026-11-03T22-51-32.206Z/verification.json), [basis/manifests/routes](runs/2026-11-03T22-51-32.206Z/bundle.json).
Это build-time digest до additive bookkeeping; финальные hashes/delta отдельно в preservation.json.

Что уже существовало:
Native manager/student dialogs с caller guards, Homework autosave/blocker и account-ui SDK/session
switch/logout/BroadcastChannel. Существующие controls/Golos/Lucide/locale/tokens и TASK-007 Profile.
465/465 predecessor source hashes совпали до работы;466 before copies+binary tracked patch
сохранены в before/ и before.json. Существующая dirty/untracked основа не сбрасывалась.

Что изменено:
- packages/ui/src/overlays.tsx + index.ts → controlled Dialog, ConfirmDialog (AlertDialog alias),
  Drawer, Popover, DropdownMenu; required title/description/open/onOpenChange, Content refs,
  focus/event composition, trigger asChild. Native callbacks могут preventDefault; menu roving focus
  по pinned Radix API (без неподдерживаемого onEntryFocus). Public props перечислены в handoff.md.
- onRequestClose(reason) → app решает dirty/pending/unknown. Confirm action предотвращает default
  close, parent закрывает после результата. Pending UI не заменяет inFlight/SDK/idempotency guards.
- overlays.css/tokens.css/style.css/locale.tsx → tokenized responsive surface, same Dialog lifecycle
  desktop-right/mobile-bottom Drawer; generic close RU/RO; no motion/forceMount/exit-kept private DOM.
  Background изолирован aria-hidden/pointer/focus/scroll средствами Radix, не native inert attribute.
- Student ProfileHelp → единственный read-only production пример, существующее пояснение имени.
  Нет API/нового доменного решения. [AST proof](consumer-source-proof.json): save/update и5 прочих
  account functions неизменны. Existing dialogs/account-ui не заменены, см. [inventory](lifecycle-inventory.md).
- CSF stories/local fixtures/SSR tests/scoped evidence helper → controlled refs/accessible names,
  keyboard/nested/async/caller dirty guard/pending/unknown/session revoke, только synthetic data.
- package manifests/lock →4 pinned Radix packages, runtime ReactDOM18.3.1, dev types18.3.7;
  only local safe scripts. [Policy](dependency-policy.json), [lock delta](lock-delta.json):40 new packages,
  all permitted licenses/age≥14(min115),1139 прежних package records и все старые snapshots сохранены.

Контракты/SDK/миграции:
Public UI props в [handoff.md](handoff.md), design intent в [design-note.md](design-note.md).
Нет API DTO/operations/SDK/DB/schema/migration/provider изменений или генерации.
ConfirmDialog не вычисляет права/деньги/capabilities. Caller передаёт eligibility/menu callbacks;
account-ui сохраняет ownership SDK/CSRF/broadcast/navigation. Closing не отменяет принятый write.
Session removal и dropping actor callbacks принадлежат приложению. В fixture это доказано
на noncredential marker; production account/secret acceptance остаётся отдельной задачей.

Источники/решения:
AGENTS.md/PHASE0_CHECKS; текущие K8K plan/status/matrix/design §§2–7 (исторический§8 не применён);
UX register VIS-03…12/UX-AUD-01…13; CON-01…11 сохраняются. Домен/цены/допуски/ledger не менялись.
Pinned registry metadata и installed .d.ts/source сверены с официальными Radix/Context7 docs.
Применён webdev-frontend-craft и React checklist, [review](react-review.json).

Проверки (fresh; [точные команды/exit codes](checks.json)):
| Команда | Exit | Результат / log |
|---|---:|---|
| pnpm --filter @online-school/ui build |0| [ui-build.log](ui-build.log) |
| pnpm --filter @online-school/ui test |0|116/116, [ui-test.log](ui-test.log), closed SSR не emits private subtree/callback |
| pnpm --filter @online-school/ui lint |0|eslint +12 CSS,715 legacy unchanged, [ui-lint.log](ui-lint.log) |
| pnpm --filter @online-school/student-cabinet typecheck:ui-overlays |0| strict stories/consumer props, [fixture-typecheck.log](fixture-typecheck.log) |
| pnpm --filter @online-school/student-cabinet exec tsc -p tsconfig.json --pretty false |0| actual student source, [student-typecheck.log](student-typecheck.log) |
| targeted eslint (full argv in checks.json) |0| [consumer-lint.log](consumer-lint.log) |
| pnpm k8k:overlays:evidence |0|71 browser cases,66 PNG,48 source route builds/budgets; [command log](evidence-command.log) |

Предыдущие failed development runs сохранены и не считаются PASS: исправлены typed pinned API,
ожидания отложенного фокуса/aria-hidden ancestors, локальные harness width/quote typo и явная
классификация exact-URL sentinel errors. Все assertions accepted run выполнены заново.
No unexpected API requests,0 pageerrors/console warnings/network failures.8 намеренно blocked
external sentinel requests/failures/console messages сопоставлены exact URL в [console](runs/2026-11-03T22-51-32.206Z/console.json),
не скрыты общим фильтром ошибок. Server только ephemeral127.0.0.1, envDir/configFile/publicDir=false,
serviceWorkers blocked, неизвестные локальные API501. No .env/DB/providers/real credentials.

Визуальные доказательства:
[Галерея66](runs/2026-11-03T22-51-32.206Z/gallery.html), [cases/screenshots/hashes](runs/2026-11-03T22-51-32.206Z/visual.json).
RU/RO×360/768/1024/1280: Dialog/Drawer/Confirm/Popover/Menu/nonmodal плюс actual Student Profile help.
Synthetic roles student360/768 и manager1024/1280 в generic fixtures; Profile всегда student.
Deep lifecycle RU/RO360: dirty/pending/unknown/revoke/asyncConfirm/nested; touch Drawer360.
Открытие/закрытие controlled roots,16 Tab/ShiftTab шагов/modal, background focus/pointer/scroll,
Escape focus restore, connected refs, initial focus, resolved AX label/description, long RO geometry.
Просмотрены PNG Drawer360, Profile1024, Menu1280, dirty/unknown360; текст/controls доступны,
overflow не скрыт. Снимки содержат только синтетические данные, без одноразовых паролей/OTP.

Размер:
[Сопоставимая таблица](runs/2026-11-03T22-51-32.206Z/bundle.md):48/48≤256000, max243665 (запас12335).
Student204864 (+12214 JS/CSS), platform130854 (+463), manager code delta438…443.
Font delta0: all3 raw WOFF2=63492 per route; code gzip9 + static/lazy closure same v2 as TASK-007.
Optional login/passkey closure184032 PASS. Lockfile change указан явно; не выдан за неизменный.
Это local source assets, не Vercel/CDN throughput или итоговая производительность production.

Acceptance checklist:
| Критерий | Статус | Доказательство |
|---|---|---|
| Prerequisite и сохранение existing dirty/archives |PASS|before466,465 source matches, protected-inputs/preservation |
| Controlled Dialog/AlertDialog/Popover + refs/title/description |PASS|strict props, SSR + browser connected refs/AX IDs/initial focus |
| Responsive Drawer same lifecycle, modal-only trap/inert behavior |PASS|RU/RO4 widths, Tab/ShiftTab, pointer/AT/focus/scroll isolation; nonmodal background focus |
| Escape возвращает trigger; nested popover/dialog |PASS|inner-only Escape, outer surfaces retained; stack focus return |
| Accessible DropdownMenu/caller actions/account-ui ownership |PASS|Home/ArrowDown/Enter/Escape, disabled skipped, callback preventDefault, unchanged account-ui source |
| Dirty app guard/explicit discard preserves unsaved input |PASS|Escape/close/outside→Cancel retains text; explicit discard clears DOM;0 commands |
| Unknown-result без blind retry |PASS|send disabled, close guard, count1; reconciliation event only |
| Pending close без duplicate mutation |PASS|Escape/close/outside/cancel keep operation, count1; async Confirm no auto-close |
| Async settlement и session revoke remove private DOM |PASS|local callback settlement closes; revoke clears subtree/callback; late synthetic result discarded |
| Long RO title помещается |PASS|all4 geometry, no horizontal clip/page overflow, PNG |
| RU/RO/token/font/static Icon/budget/license |PASS|116 tests, strict/lint,48 v2 routes,40 dependency policies |
| One safe production example; native guards unchanged |PASS|ProfileHelp read-only; AST save/update/5 functions + source hashes |
| No DB/migration/production changes; journal/matrix/status/handoff |PASS|scoped commands and preservation, additive documents |

Не проверено/блокеры:
Нет blocker для scoped TASK-008. Storybook runtime до TASK-013 — NOT_RUN.
NVDA/Narrator speech, full WCAG2.2/role/session/privacy/real-secret/backend/DB/provider regressions,
CI/deployment/FND-GATE/LEGAL/FIN-LEGAL/Meet/G4/production GO — NOT_RUN вне scope/не разрешены
этим локальным инкрементом. Mock evidence не закрывает эти gates. Nine UI classes общего
StateBoundary unit-tested; эти overlay primitives не являются новыми read-model/API экранами.

Остатки:
[Handoff](handoff.md): TASK-009 отдельно по команде владельца;013 runtime;030 autosave UI;
034 profile/security full RU/RO;053/054 lead forms;055/056 finance guards;067 account/session;
068/069 privacy/gate. Существующие74 defects и715 legacy CSS не объявлены закрытыми.

Риски и обратимость:
Откат только TASK-008 hunks/new overlay files по before/ и bookkeeping-before.json, без удаления
чужой работы/архивов/истории. Нельзя массово заменить native form Dialog без переноса caller dirty,
unknown/revision/idempotency/secret lifecycle. No reset/clean/stash/commit/merge/push/deploy.
После отчёта остановка; TASK-009 не начат.
