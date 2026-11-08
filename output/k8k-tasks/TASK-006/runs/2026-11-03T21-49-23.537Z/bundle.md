# TASK-006 — route budgets v2

v1 static/lazy closure и per-file gzip9 сохранены; font policy v2 включает все три raw WOFF2.

| Role / route | JS/CSS gzip | Fonts | Total | Delta code | Delta fonts | Delta total |
|---|---:|---:|---:|---:|---:|---:|
| STUDENT / `/student/login` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/suspended` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/security/change-password` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/lessons` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/lessons/:id` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/homework` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/homework/:id` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/skills` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/reports` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/materials` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/subscription` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/notifications` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/profile` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `/student/security` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| MANAGER / `/manager/login` | 115116 | 63492 | 178608 | 208 | 3544 | 3752 |
| MANAGER / `/manager` | 174283 | 63492 | 237775 | 208 | 3544 | 3752 |
| MANAGER / `/manager/leads` | 161728 | 63492 | 225220 | 208 | 3544 | 3752 |
| MANAGER / `/manager/leads/:id` | 162260 | 63492 | 225752 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students` | 173388 | 63492 | 236880 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students/:id` | 129125 | 63492 | 192617 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students/:id/account` | 159663 | 63492 | 223155 | 208 | 3544 | 3752 |
| MANAGER / `/manager/schedule` | 176459 | 63492 | 239951 | 208 | 3544 | 3752 |
| MANAGER / `/manager/tasks` | 159071 | 63492 | 222563 | 208 | 3544 | 3752 |
| MANAGER / `/manager/tasks/:id` | 175130 | 63492 | 238622 | 208 | 3544 | 3752 |
| MANAGER / `*` | 113292 | 63492 | 176784 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students/:id?tab=overview` | 129125 | 63492 | 192617 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students/:id?tab=subscriptions` | 176993 | 63492 | 240485 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students/:id?tab=payments` | 177470 | 63492 | 240962 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students/:id?tab=schedule` | 178507 | 63492 | 241999 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students/:id?tab=tasks` | 174904 | 63492 | 238396 | 208 | 3544 | 3752 |
| MANAGER / `/manager/students/:id?tab=notifications` | 175081 | 63492 | 238573 | 208 | 3544 | 3752 |
| TEACHER / `/teacher` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| TEACHER / `/teacher?section=overview` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| TEACHER / `/teacher?section=lessons` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| TEACHER / `/teacher?section=students` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| TEACHER / `/teacher?section=homework` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| DIRECTOR / `/director` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| DIRECTOR / `/director?section=overview` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| DIRECTOR / `/director?section=lessons` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| DIRECTOR / `/director?section=students` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| DIRECTOR / `/director?section=tasks` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| TECH_OPERATOR / `/operator` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| TECH_OPERATOR / `/operator?section=overview` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| SHARED / `/account` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| SHARED / `/` | 65822 | 63492 | 129314 | 202 | 3544 | 3746 |
| SHARED / `(private cabinet account menu)` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |
| STUDENT / `(student route errorElement)` | 127775 | 63492 | 191267 | 197 | 3544 | 3741 |

48/48 rows и optional passkey closures PASS≤256000. JS lockfile/build method прежние; v1→v2 изменение fonts явно отражено в delta.
