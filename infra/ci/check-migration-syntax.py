from pathlib import Path

from pglast import Error, parse_sql
from pglast.parser import get_postgresql_version


def main() -> int:
    version = get_postgresql_version()
    if version[0] != 18:
        print("The migration syntax check requires a PostgreSQL 18 parser.")
        return 1

    root = Path(__file__).resolve().parents[2]
    migrations = sorted((root / "packages/db/prisma/migrations").glob("*/migration.sql"))
    if not migrations:
        print("No active migrations were found.")
        return 1

    failures = 0
    for migration in migrations:
        sql = migration.read_text(encoding="utf-8")
        try:
            parse_sql(sql)
        except Error as error:
            failures += 1
            print(f"{migration.relative_to(root)}: {error}")

    print(f"PostgreSQL {'.'.join(map(str, version))}: {len(migrations)} migration files, {failures} syntax errors.")
    return int(failures > 0)


if __name__ == "__main__":
    raise SystemExit(main())
