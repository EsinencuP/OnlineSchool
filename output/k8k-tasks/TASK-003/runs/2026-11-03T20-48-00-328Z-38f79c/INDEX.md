# TASK-003 baseline INDEX

HEAD `171db2142858e035594737e141d422fa5378e844`; dirty `dc2be7ba8c6916104338e1c98019c1050c5d2db11d38ec1801fb5ff0d43dc1a8`; fixed time 2026-11-03T10:30:30Z.

|Case / role / route|Pass / locale / viewport|Status|Screenshot|Assertions / overflow / reason|
|---|---|---|---|---|
|student:email-code-form / STUDENT / /student/security|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-000-360.png)|7/7; overflow=true|
|student:email-code-form / STUDENT / /student/security|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-000-1280.png)|7/7; overflow=false|
|student:draft-error / STUDENT / /student/homework/20000000-0000-4000-8000-000000000001|1 / ru / 360×900|NOT_RUN|—|locator.waitFor: Timeout 3500ms exceeded.|
|student:draft-error / STUDENT / /student/homework/20000000-0000-4000-8000-000000000001|1 / ru / 1280×900|NOT_RUN|—|locator.waitFor: Timeout 3500ms exceeded.|
|student:submit-pending / STUDENT / /student/homework/20000000-0000-4000-8000-000000000001|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-002-360.png)|8/8; overflow=true|
|student:submit-pending / STUDENT / /student/homework/20000000-0000-4000-8000-000000000001|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-002-1280.png)|8/8; overflow=false|
|manager:contact-version-conflict / MANAGER / /manager/students/11111111-1111-4111-8111-111111111111|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-003-360.png)|7/7; overflow=false|
|manager:contact-version-conflict / MANAGER / /manager/students/11111111-1111-4111-8111-111111111111|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-003-1280.png)|7/7; overflow=false|
|manager:login-mfa-prompt / MANAGER / /manager/login|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-004-360.png)|7/7; overflow=false|
|manager:login-mfa-prompt / MANAGER / /manager/login|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-004-1280.png)|7/7; overflow=false|
|MANAGER:read-loading / MANAGER / /manager/students|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-005-360.png)|8/8; overflow=false|
|MANAGER:read-loading / MANAGER / /manager/students|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-005-1280.png)|8/8; overflow=false|
|common:ready / STUDENT / /?state=ready|1 / ru / 360×900|CAPTURED_WITH_FINDINGS|[PNG](p1-ru-006-360.png)|9/10; overflow=false|
|common:ready / STUDENT / /?state=ready|1 / ru / 1280×900|CAPTURED_WITH_FINDINGS|[PNG](p1-ru-006-1280.png)|9/10; overflow=false|
|student:email-code-form / STUDENT / /student/security|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-000-360.png)|7/7; overflow=true|
|student:email-code-form / STUDENT / /student/security|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-000-1280.png)|7/7; overflow=false|
|student:draft-error / STUDENT / /student/homework/20000000-0000-4000-8000-000000000001|1 / ro / 360×900|NOT_RUN|—|locator.waitFor: Timeout 3500ms exceeded.|
|student:draft-error / STUDENT / /student/homework/20000000-0000-4000-8000-000000000001|1 / ro / 1280×900|NOT_RUN|—|locator.waitFor: Timeout 3500ms exceeded.|
|student:submit-pending / STUDENT / /student/homework/20000000-0000-4000-8000-000000000001|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-002-360.png)|8/8; overflow=true|
|student:submit-pending / STUDENT / /student/homework/20000000-0000-4000-8000-000000000001|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-002-1280.png)|8/8; overflow=false|
|manager:contact-version-conflict / MANAGER / /manager/students/11111111-1111-4111-8111-111111111111|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-003-360.png)|7/7; overflow=false|
|manager:contact-version-conflict / MANAGER / /manager/students/11111111-1111-4111-8111-111111111111|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-003-1280.png)|7/7; overflow=false|
|manager:login-mfa-prompt / MANAGER / /manager/login|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-004-360.png)|7/7; overflow=false|
|manager:login-mfa-prompt / MANAGER / /manager/login|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-004-1280.png)|7/7; overflow=false|
|MANAGER:read-loading / MANAGER / /manager/students|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-005-360.png)|8/8; overflow=false|
|MANAGER:read-loading / MANAGER / /manager/students|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-005-1280.png)|8/8; overflow=false|
|common:ready / STUDENT / /?state=ready|1 / ro / 360×900|CAPTURED_WITH_FINDINGS|[PNG](p1-ro-006-360.png)|9/10; overflow=false|
|common:ready / STUDENT / /?state=ready|1 / ro / 1280×900|CAPTURED_WITH_FINDINGS|[PNG](p1-ro-006-1280.png)|9/10; overflow=false|
