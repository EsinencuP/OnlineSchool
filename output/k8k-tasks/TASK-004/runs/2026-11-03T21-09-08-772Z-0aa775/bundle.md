# TASK-004 route budgets

k8k-route-v1: unique cold-entry+explicit-route-lazy-seeds recursive static JS/CSS; gzip(level=9) per file; raw cyrillic+latin WOFF2 once each; limit=256000

Historical delta: unavailable; see provenance/reasons in bundle.json. No zero-size substitution.

|Role / route|App|JS/CSS gzip|Cyrillic raw|Latin raw|Total|Budget|Manifest seeds|
|---|---|---|---|---|---|---|---|
|STUDENT / /student/login|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/suspended|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/security/change-password|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/lessons|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/lessons/:id|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/homework|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/homework/:id|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/skills|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/reports|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/materials|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/subscription|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/notifications|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/profile|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / /student/security|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|MANAGER / /manager/login|manager-web|114750|22032|37916|174698|PASS|index.html, src/pages/Login.tsx|
|MANAGER / /manager|manager-web|173917|22032|37916|233865|PASS|index.html, src/pages/Dashboard.tsx|
|MANAGER / /manager/leads|manager-web|161362|22032|37916|221310|PASS|index.html, src/pages/Leads.tsx|
|MANAGER / /manager/leads/:id|manager-web|161894|22032|37916|221842|PASS|index.html, src/pages/Lead.tsx|
|MANAGER / /manager/students|manager-web|173022|22032|37916|232970|PASS|index.html, src/pages/Students.tsx|
|MANAGER / /manager/students/:id|manager-web|128759|22032|37916|188707|PASS|index.html, src/pages/Student.tsx|
|MANAGER / /manager/students/:id/account|manager-web|159297|22032|37916|219245|PASS|index.html, src/pages/Account.tsx|
|MANAGER / /manager/schedule|manager-web|176093|22032|37916|236041|PASS|index.html, src/pages/Schedule.tsx|
|MANAGER / /manager/tasks|manager-web|158705|22032|37916|218653|PASS|index.html, src/pages/Tasks.tsx|
|MANAGER / /manager/tasks/:id|manager-web|174764|22032|37916|234712|PASS|index.html, src/pages/Task.tsx|
|MANAGER / *|manager-web|112926|22032|37916|172874|PASS|index.html|
|MANAGER / /manager/students/:id?tab=overview|manager-web|128759|22032|37916|188707|PASS|index.html, src/pages/Student.tsx|
|MANAGER / /manager/students/:id?tab=subscriptions|manager-web|176627|22032|37916|236575|PASS|index.html, src/pages/Student.tsx, src/pages/student/Subscriptions.tsx|
|MANAGER / /manager/students/:id?tab=payments|manager-web|177104|22032|37916|237052|PASS|index.html, src/pages/Student.tsx, src/pages/student/Payments.tsx|
|MANAGER / /manager/students/:id?tab=schedule|manager-web|178141|22032|37916|238089|PASS|index.html, src/pages/Student.tsx, src/pages/Schedule.tsx|
|MANAGER / /manager/students/:id?tab=tasks|manager-web|174538|22032|37916|234486|PASS|index.html, src/pages/Student.tsx, src/pages/Tasks.tsx|
|MANAGER / /manager/students/:id?tab=notifications|manager-web|174715|22032|37916|234663|PASS|index.html, src/pages/Student.tsx, src/pages/student/Notifications.tsx|
|TEACHER / /teacher|platform|65460|22032|37916|125408|PASS|index.html|
|TEACHER / /teacher?section=overview|platform|65460|22032|37916|125408|PASS|index.html|
|TEACHER / /teacher?section=lessons|platform|65460|22032|37916|125408|PASS|index.html|
|TEACHER / /teacher?section=students|platform|65460|22032|37916|125408|PASS|index.html|
|TEACHER / /teacher?section=homework|platform|65460|22032|37916|125408|PASS|index.html|
|DIRECTOR / /director|platform|65460|22032|37916|125408|PASS|index.html|
|DIRECTOR / /director?section=overview|platform|65460|22032|37916|125408|PASS|index.html|
|DIRECTOR / /director?section=lessons|platform|65460|22032|37916|125408|PASS|index.html|
|DIRECTOR / /director?section=students|platform|65460|22032|37916|125408|PASS|index.html|
|DIRECTOR / /director?section=tasks|platform|65460|22032|37916|125408|PASS|index.html|
|TECH_OPERATOR / /operator|platform|65460|22032|37916|125408|PASS|index.html|
|TECH_OPERATOR / /operator?section=overview|platform|65460|22032|37916|125408|PASS|index.html|
|SHARED / /account|platform|65460|22032|37916|125408|PASS|index.html|
|SHARED / /|platform|65460|22032|37916|125408|PASS|index.html|
|SHARED / (private cabinet account menu)|student-cabinet|127431|22032|37916|187379|PASS|index.html|
|STUDENT / (student route errorElement)|student-cabinet|127431|22032|37916|187379|PASS|index.html|

Optional lazy actions (passkey browser):
- /manager/login: 178457 bytes, PASS, seed ../../node_modules/.pnpm/@simplewebauthn+browser@14.0.0/node_modules/@simplewebauthn/browser/esm/index.js
