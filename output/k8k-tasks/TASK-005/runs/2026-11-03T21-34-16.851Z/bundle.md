# TASK-005 — route budgets

Метод: `k8k-route-v1: unique cold-entry+explicit-route-lazy-seeds recursive static JS/CSS; gzip(level=9) per file; raw cyrillic+latin WOFF2 once each; limit=256000`

| Role / route | JS/CSS gzip | WOFF2 | Total | Delta total vs TASK-004 | Result |
|---|---:|---:|---:|---:|---|
| STUDENT / `/student/login` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/suspended` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/security/change-password` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/lessons` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/lessons/:id` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/homework` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/homework/:id` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/skills` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/reports` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/materials` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/subscription` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/notifications` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/profile` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `/student/security` | 127578 | 59948 | 187526 | +147 | PASS |
| MANAGER / `/manager/login` | 114908 | 59948 | 174856 | +158 | PASS |
| MANAGER / `/manager` | 174075 | 59948 | 234023 | +158 | PASS |
| MANAGER / `/manager/leads` | 161520 | 59948 | 221468 | +158 | PASS |
| MANAGER / `/manager/leads/:id` | 162052 | 59948 | 222000 | +158 | PASS |
| MANAGER / `/manager/students` | 173180 | 59948 | 233128 | +158 | PASS |
| MANAGER / `/manager/students/:id` | 128917 | 59948 | 188865 | +158 | PASS |
| MANAGER / `/manager/students/:id/account` | 159455 | 59948 | 219403 | +158 | PASS |
| MANAGER / `/manager/schedule` | 176251 | 59948 | 236199 | +158 | PASS |
| MANAGER / `/manager/tasks` | 158863 | 59948 | 218811 | +158 | PASS |
| MANAGER / `/manager/tasks/:id` | 174922 | 59948 | 234870 | +158 | PASS |
| MANAGER / `*` | 113084 | 59948 | 173032 | +158 | PASS |
| MANAGER / `/manager/students/:id?tab=overview` | 128917 | 59948 | 188865 | +158 | PASS |
| MANAGER / `/manager/students/:id?tab=subscriptions` | 176785 | 59948 | 236733 | +158 | PASS |
| MANAGER / `/manager/students/:id?tab=payments` | 177262 | 59948 | 237210 | +158 | PASS |
| MANAGER / `/manager/students/:id?tab=schedule` | 178299 | 59948 | 238247 | +158 | PASS |
| MANAGER / `/manager/students/:id?tab=tasks` | 174696 | 59948 | 234644 | +158 | PASS |
| MANAGER / `/manager/students/:id?tab=notifications` | 174873 | 59948 | 234821 | +158 | PASS |
| TEACHER / `/teacher` | 65620 | 59948 | 125568 | +160 | PASS |
| TEACHER / `/teacher?section=overview` | 65620 | 59948 | 125568 | +160 | PASS |
| TEACHER / `/teacher?section=lessons` | 65620 | 59948 | 125568 | +160 | PASS |
| TEACHER / `/teacher?section=students` | 65620 | 59948 | 125568 | +160 | PASS |
| TEACHER / `/teacher?section=homework` | 65620 | 59948 | 125568 | +160 | PASS |
| DIRECTOR / `/director` | 65620 | 59948 | 125568 | +160 | PASS |
| DIRECTOR / `/director?section=overview` | 65620 | 59948 | 125568 | +160 | PASS |
| DIRECTOR / `/director?section=lessons` | 65620 | 59948 | 125568 | +160 | PASS |
| DIRECTOR / `/director?section=students` | 65620 | 59948 | 125568 | +160 | PASS |
| DIRECTOR / `/director?section=tasks` | 65620 | 59948 | 125568 | +160 | PASS |
| TECH_OPERATOR / `/operator` | 65620 | 59948 | 125568 | +160 | PASS |
| TECH_OPERATOR / `/operator?section=overview` | 65620 | 59948 | 125568 | +160 | PASS |
| SHARED / `/account` | 65620 | 59948 | 125568 | +160 | PASS |
| SHARED / `/` | 65620 | 59948 | 125568 | +160 | PASS |
| SHARED / `(private cabinet account menu)` | 127578 | 59948 | 187526 | +147 | PASS |
| STUDENT / `(student route errorElement)` | 127578 | 59948 | 187526 | +147 | PASS |

Delta сопоставима: тот же runtime/Vite/zlib/alias/gzip/font/static+lazy метод,
план маршрутов сохранён, все прежние lockfile importer/packages/snapshots неизменны.
Добавлены только три root dev dependencies. Клиентский runtime dependency graph не расширен.
Optional passkey closures также проверены; данные — в `bundle.json`.
