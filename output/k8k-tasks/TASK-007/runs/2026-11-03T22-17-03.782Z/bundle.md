# TASK-007 — route budgets v2

Тот же build/runtime/closure/gzip/font метод TASK-006, тот же JS lockfile; все3 raw fonts63492.

| Role / route | JS/CSS gzip | Fonts | Total | Delta code | Delta fonts | Delta total |
|---|---:|---:|---:|---:|---:|---:|
| STUDENT / `/student/login` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/suspended` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/security/change-password` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/lessons` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/lessons/:id` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/homework` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/homework/:id` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/skills` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/reports` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/materials` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/subscription` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/notifications` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/profile` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `/student/security` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| MANAGER / `/manager/login` | 116340 | 63492 | 179832 | 1224 | 0 | 1224 |
| MANAGER / `/manager` | 175506 | 63492 | 238998 | 1223 | 0 | 1223 |
| MANAGER / `/manager/leads` | 162951 | 63492 | 226443 | 1223 | 0 | 1223 |
| MANAGER / `/manager/leads/:id` | 163486 | 63492 | 226978 | 1226 | 0 | 1226 |
| MANAGER / `/manager/students` | 174614 | 63492 | 238106 | 1226 | 0 | 1226 |
| MANAGER / `/manager/students/:id` | 130353 | 63492 | 193845 | 1228 | 0 | 1228 |
| MANAGER / `/manager/students/:id/account` | 160889 | 63492 | 224381 | 1226 | 0 | 1226 |
| MANAGER / `/manager/schedule` | 177689 | 63492 | 241181 | 1230 | 0 | 1230 |
| MANAGER / `/manager/tasks` | 160295 | 63492 | 223787 | 1224 | 0 | 1224 |
| MANAGER / `/manager/tasks/:id` | 176355 | 63492 | 239847 | 1225 | 0 | 1225 |
| MANAGER / `*` | 114518 | 63492 | 178010 | 1226 | 0 | 1226 |
| MANAGER / `/manager/students/:id?tab=overview` | 130353 | 63492 | 193845 | 1228 | 0 | 1228 |
| MANAGER / `/manager/students/:id?tab=subscriptions` | 178214 | 63492 | 241706 | 1221 | 0 | 1221 |
| MANAGER / `/manager/students/:id?tab=payments` | 178692 | 63492 | 242184 | 1222 | 0 | 1222 |
| MANAGER / `/manager/students/:id?tab=schedule` | 179735 | 63492 | 243227 | 1228 | 0 | 1228 |
| MANAGER / `/manager/students/:id?tab=tasks` | 176130 | 63492 | 239622 | 1226 | 0 | 1226 |
| MANAGER / `/manager/students/:id?tab=notifications` | 176307 | 63492 | 239799 | 1226 | 0 | 1226 |
| TEACHER / `/teacher` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| TEACHER / `/teacher?section=overview` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| TEACHER / `/teacher?section=lessons` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| TEACHER / `/teacher?section=students` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| TEACHER / `/teacher?section=homework` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| DIRECTOR / `/director` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| DIRECTOR / `/director?section=overview` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| DIRECTOR / `/director?section=lessons` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| DIRECTOR / `/director?section=students` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| DIRECTOR / `/director?section=tasks` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| TECH_OPERATOR / `/operator` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| TECH_OPERATOR / `/operator?section=overview` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| SHARED / `/account` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| SHARED / `/` | 66899 | 63492 | 130391 | 1077 | 0 | 1077 |
| SHARED / `(private cabinet account menu)` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |
| STUDENT / `(student route errorElement)` | 129158 | 63492 | 192650 | 1383 | 0 | 1383 |

48/48 rows и optional passkey closure PASS≤256000; никаких удалённых функций ради метрики.
