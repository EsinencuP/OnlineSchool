# TASK-003 baseline INDEX

HEAD `171db2142858e035594737e141d422fa5378e844`; dirty `0f9c14c5a304f041af28c22bdb59d3722d0a2d765549c6f5480c18178a5d24d4`; fixed time 2026-11-03T10:30:30Z.

|Case / role / route|Pass / locale / viewport|Status|Screenshot|Assertions / overflow / reason|
|---|---|---|---|---|
|student:/student / STUDENT / /student|1 / ru / 360×900|CAPTURED_WITH_FINDINGS|[PNG](p1-ru-000-360.png)|5/6; overflow=true|
|student:/student / STUDENT / /student|1 / ru / 1280×900|CAPTURED_WITH_FINDINGS|[PNG](p1-ru-000-1280.png)|5/6; overflow=false|
|student:/student/reports / STUDENT / /student/reports|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-001-360.png)|6/6; overflow=true|
|student:/student/reports / STUDENT / /student/reports|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-001-1280.png)|6/6; overflow=false|
|manager:/manager / MANAGER / /manager|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-002-360.png)|6/6; overflow=false|
|manager:/manager / MANAGER / /manager|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-002-1280.png)|6/6; overflow=false|
|manager:/manager/students / MANAGER / /manager/students|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-003-360.png)|6/6; overflow=false|
|manager:/manager/students / MANAGER / /manager/students|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-003-1280.png)|6/6; overflow=false|
|TEACHER:/teacher / TEACHER / /teacher|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-004-360.png)|6/6; overflow=false|
|TEACHER:/teacher / TEACHER / /teacher|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-004-1280.png)|6/6; overflow=false|
|DIRECTOR:/director / DIRECTOR / /director|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-005-360.png)|6/6; overflow=false|
|DIRECTOR:/director / DIRECTOR / /director|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-005-1280.png)|6/6; overflow=false|
|TECH_OPERATOR:/operator / TECH_OPERATOR / /operator|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-006-360.png)|6/6; overflow=false|
|TECH_OPERATOR:/operator / TECH_OPERATOR / /operator|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-006-1280.png)|6/6; overflow=false|
|shared:/account / SHARED / /account|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-007-360.png)|6/6; overflow=false|
|shared:/account / SHARED / /account|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-007-1280.png)|6/6; overflow=false|
|student:reschedule / STUDENT / /student/lessons|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-008-360.png)|6/6; overflow=true|
|student:reschedule / STUDENT / /student/lessons|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-008-1280.png)|6/6; overflow=false|
|manager:new-lead / MANAGER / /manager/leads|1 / ru / 360×900|NOT_RUN|—|locator.click: Timeout 3500ms exceeded.|
|manager:new-lead / MANAGER / /manager/leads|1 / ru / 1280×900|NOT_RUN|—|locator.click: Timeout 3500ms exceeded.|
|manager:compose / MANAGER / /manager/students/11111111-1111-4111-8111-111111111111?tab=notifications|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-010-360.png)|6/6; overflow=false|
|manager:compose / MANAGER / /manager/students/11111111-1111-4111-8111-111111111111?tab=notifications|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-010-1280.png)|6/6; overflow=false|
|common:forbidden / STUDENT / /?state=forbidden|1 / ru / 360×900|CAPTURED|[PNG](p1-ru-011-360.png)|8/8; overflow=false|
|common:forbidden / STUDENT / /?state=forbidden|1 / ru / 1280×900|CAPTURED|[PNG](p1-ru-011-1280.png)|8/8; overflow=false|
|student:/student / STUDENT / /student|1 / ro / 360×900|CAPTURED_WITH_FINDINGS|[PNG](p1-ro-000-360.png)|5/6; overflow=true|
|student:/student / STUDENT / /student|1 / ro / 1280×900|CAPTURED_WITH_FINDINGS|[PNG](p1-ro-000-1280.png)|5/6; overflow=false|
|student:/student/reports / STUDENT / /student/reports|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-001-360.png)|6/6; overflow=true|
|student:/student/reports / STUDENT / /student/reports|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-001-1280.png)|6/6; overflow=false|
|manager:/manager / MANAGER / /manager|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-002-360.png)|6/6; overflow=false|
|manager:/manager / MANAGER / /manager|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-002-1280.png)|6/6; overflow=false|
|manager:/manager/students / MANAGER / /manager/students|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-003-360.png)|6/6; overflow=false|
|manager:/manager/students / MANAGER / /manager/students|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-003-1280.png)|6/6; overflow=false|
|TEACHER:/teacher / TEACHER / /teacher|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-004-360.png)|6/6; overflow=false|
|TEACHER:/teacher / TEACHER / /teacher|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-004-1280.png)|6/6; overflow=false|
|DIRECTOR:/director / DIRECTOR / /director|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-005-360.png)|6/6; overflow=false|
|DIRECTOR:/director / DIRECTOR / /director|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-005-1280.png)|6/6; overflow=false|
|TECH_OPERATOR:/operator / TECH_OPERATOR / /operator|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-006-360.png)|6/6; overflow=false|
|TECH_OPERATOR:/operator / TECH_OPERATOR / /operator|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-006-1280.png)|6/6; overflow=false|
|shared:/account / SHARED / /account|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-007-360.png)|6/6; overflow=false|
|shared:/account / SHARED / /account|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-007-1280.png)|6/6; overflow=false|
|student:reschedule / STUDENT / /student/lessons|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-008-360.png)|6/6; overflow=true|
|student:reschedule / STUDENT / /student/lessons|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-008-1280.png)|6/6; overflow=false|
|manager:new-lead / MANAGER / /manager/leads|1 / ro / 360×900|NOT_RUN|—|locator.click: Timeout 3500ms exceeded.|
|manager:new-lead / MANAGER / /manager/leads|1 / ro / 1280×900|NOT_RUN|—|locator.click: Timeout 3500ms exceeded.|
|manager:compose / MANAGER / /manager/students/11111111-1111-4111-8111-111111111111?tab=notifications|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-010-360.png)|6/6; overflow=false|
|manager:compose / MANAGER / /manager/students/11111111-1111-4111-8111-111111111111?tab=notifications|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-010-1280.png)|6/6; overflow=false|
|common:forbidden / STUDENT / /?state=forbidden|1 / ro / 360×900|CAPTURED|[PNG](p1-ro-011-360.png)|8/8; overflow=false|
|common:forbidden / STUDENT / /?state=forbidden|1 / ro / 1280×900|CAPTURED|[PNG](p1-ro-011-1280.png)|8/8; overflow=false|
