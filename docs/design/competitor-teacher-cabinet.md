# Teacher cabinet: competitor functional comparison

Source: 18 screenshots of a competitor's teacher dashboard (Young Smart Academy, 2026-11-27).
Scope: business logic and functions only, not visuals. "We" = `apps/manager-web` teacher cabinet +
`/api/v1/teacher/*` OpenAPI contract.

## What the competitor has

| # | Area | Competitor function (observed) |
|---|---|---|
| C1 | Home | Next lesson card; "После урока (N)": confirm the lesson happened + "Оценить" student |
| C2 | Home KPIs | Lessons this month / week with "finalized N" and %, total done this month, trial lessons ("бесплатные — неоплачиваемые"), salary to date = paid lessons × rate |
| C3 | Home | Weekly calendar strip (lessons per weekday), lesson notifications, upcoming lessons |
| C4 | Home | Ratings received from students |
| C5 | Chat | Threads per student+subject, "Staff" tab, attachments, paste images, "seen" status |
| C6 | Students | Cards with student ID (E0547), status, this week's slots; details: private notes (visible to teacher and school team, not the student), lessons, homework, reports; per-subject stats (scheduled / done / remaining) |
| C7 | Materials | Folders, 25 MB per file, share with students |
| C8 | Lessons | List ↔ calendar toggle; search by ID / student / teacher / subject; filters (status, student, subject, period, only cancelled); quick ranges (upcoming, today, this week, this month, last month); column visibility |
| C9 | Tasks | "Taskuri" section (content not shown) |
| C10 | Reports | Progress reports and trial-lesson reports; pending vs sent |
| C11 | Trial report | Structured form: observed level, can do, can't yet, emotional observation, recommended frequency, recommended package, 4-week plan, message to parent, teacher–student match |
| C12 | Documents | Regulations and contracts: common folder (guides, rules) + personal folder (own contract) |
| C13 | Account | Profile, settings, change password, report a problem, dark mode, notification bell |
| C14 | Extras | Links to a game platform and a mobile app |

## Where we stand

| Competitor | Us today | Gap | Needs backend? |
|---|---|---|---|
| C1 after-lesson confirmation | Journal: result within 24 h, overdue escalation to manager, lesson outcome report + confirmation (API) | Equal or better; show the queue with one-click action on Today | No |
| C2 KPIs | Today tiles: waiting result, review, checkpoints, accrued this month; Payroll page with months, days, goal | Add lessons month/week with "finalized %" and trial-lesson count | No (journal + lessons) |
| C3 weekly strip | Week load columns with daily limit, mini calendar, notifications | Equal | No |
| C4 student ratings | — | Missing | Yes: rating entity + endpoint |
| C5 chat | — (only schedule requests to manager) | Missing; biggest daily-use gap | Yes: conversations, messages, attachments, read receipts |
| C6 students | Students page with skills map (Знакомлюсь → Практикую → Применяю), goals, enrollment overview, history | Missing private teacher notes; add per-subject stats (scheduled / done / remaining) and lessons/homework/reports tabs in one card | Notes: yes. Stats/tabs: no (enrollments, overview, journal, homework) |
| C7 materials | Materials with upload confirm, malware scan, per-student grants | Equal or better (scan, grants); folders missing | Folders: yes |
| C8 lessons list | Schedule (week grid) + journal | Missing searchable lessons list with filters, quick ranges and list/calendar toggle | Mostly no (journal/today data); full history may need a paged endpoint |
| C10 reports | Checkpoints at 4/8 lessons with teacher summary, published report to student | Equal for progress reports | No |
| C11 trial report | Lead trial has outcome + short feedback summary (manager side) | Missing structured trial report from the teacher; this feeds sales | Yes: trial report DTO + endpoint |
| C12 documents | Regulations exist only as docs in the repo | Missing in-product documents (common + personal contract) | Yes: documents store or reuse materials storage |
| C13 account | Passkeys/MFA (stronger auth), profile endpoint | Missing profile/settings UI, report a problem, dark mode | Report a problem: yes; rest no |

## Where we are already ahead (keep and show it)
- Rate transparency: points from seniority and students → rate table, snapshot at lesson start.
- Earnings analytics: months, days, by student, goal projection (competitor: "0 lessons × 150 MDL").
- Pedagogy: skills map with stages, goals, checkpoint reports at 4/8 lessons, homework versions and revisions.
- Discipline: 24-hour result deadline with escalation, availability windows, daily/weekly limits, schedule requests.
- Integrity: Meet link verification, director approvals for disputes, MFA/passkeys.

## How to be better, not just equal
1. **Trial report that sells.** Recommended package is chosen from the director's sale conditions, the report
   creates the manager's follow-up task, the parent message appears in the parent/student cabinet, and
   "teacher–student match = no" opens a reassignment request.
2. **Chat tied to the work.** Threads per enrollment; a message can be turned into a task, a homework
   comment or a schedule request; staff thread goes to the assigned manager with SLA.
3. **Student card as one place.** Notes, skills, lessons, homework, reports and stats in tabs, with
   "remaining lessons" taken from the subscription, not counted by hand.
4. **Lessons list as a real table.** Filters in the URL, quick ranges, column picker, export.
5. **Ratings with care.** Student/parent rating after a lesson, visible to the teacher as a trend, with
   low ratings routed to the manager rather than shown raw.

## Proposed order
| Step | Content | Backend |
|---|---|---|
| 1 ✅ | Lessons list (filters, quick ranges, list/calendar), Today: after-lesson queue + lessons month/week KPIs | No |
| 2 ✅ | Student card with tabs and per-subject stats | No |
| 3 | Structured trial report (+ manager task, package from sale conditions) | Yes |
| 4 | Chat (students/parents + staff) | Yes |
| 5 | Private notes, documents (common + personal), report a problem, ratings | Yes |
