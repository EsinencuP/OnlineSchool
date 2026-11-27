# Installed project skills

Installed on 2026-11-27 by copying the skill folders from a shallow clone (no third-party installer scripts were run). Each SKILL.md was checked for `name`/`description` frontmatter.

| Skill | Repository | Path in repo | Commit |
|---|---|---|---|
| dashboard-design | github.com/abdiraimov-otabek/dashboard-design-skill | skills/dashboard-design | 57f96688862668b482f647fa1e370efb5d3ddd31 |
| ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill (CLI 2.5.0) | .claude/skills/ui-ux-pro-max | 11ca2b3bdd555649f278ee348c32a9302b24dcf1 |
| navigation-ux, data-table-ux, filtering-ux, sorting-ux, dashboard-dataviz, search-and-content-ux, web-forms-ux | github.com/miovrag/claude-skills | <name>/ | 78dc09005a9a54625875c4b68c4058d9e56aabda |
| data-visualization, validate-data | github.com/anthropics/knowledge-work-plugins | data/skills/<name> | 5e504ae11498f2b8daa30d86b7dab97b2ecd8092 |
| education-crm-design | this project | .claude/skills/education-crm-design | — |

Notes
- `ui-ux-pro-max` search needs Python 3 (stdlib only): `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux`. Verified working with Python 3.12.
- `data-visualization` describes Python plotting; in this project use only its chart-selection and honesty principles.
- `dashboard-design` ends finished work with a promotional sign-off block; do not include it.
- Skills in `.claude/skills` are discovered when a Claude Code session starts: restart the session to get them in the skill list.
