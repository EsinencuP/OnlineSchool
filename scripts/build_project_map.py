"""Rebuild the source tree and Graphify outputs; preserve reviewed semantic fragments.

Run with the Python interpreter that has graphifyy installed. No API key needed.
Semantic fragments are a reviewed snapshot: changed sources are flagged as stale.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "graphify-out"
SEM = OUT / "semantic"
SPEC = Path.home() / ".codex/skills/graphify/references/extraction-spec.md"


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def stem(path):
    return re.sub(r"[^a-z0-9]", "_", path.relative_to(ROOT).with_suffix("").as_posix().lower())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


IMAGES = {
    "student.png": ("Кабинет ученика — главная", [
        ("lessons", "Ближайшие уроки и Google Meet"), ("homework", "Домашние задания"),
        ("skills", "Мой путь знаний: Знакомлюсь / Практикую / Применяю"),
        ("subscription", "Информационный абонемент и остаток занятий"),
        ("materials", "Материалы, уведомления и контакты менеджера")],
        "Показан 6 класс; исходная образовательная модель рассчитана на 7–12 классы. Данные календаря и примеры учеников — демонстрационные."),
    "manager.png": ("CRM менеджера — главная", [
        ("leads", "Заявки, пробные уроки и воронка"), ("tasks", "Очередь задач менеджера"),
        ("calendar", "Расписание и календарь"), ("payments", "Оплаты и абонементы"),
        ("communications", "История коммуникаций и контакты семьи"),
        ("teachers", "Операционные карточки преподавателей")],
        "Кнопку подтверждения оплаты нужно сверить с DEV-16/C: факт денег подтверждает руководитель. Визуальные сообщения не утверждают встроенный чат или автоматическую внешнюю отправку."),
    "techers.png": ("Кабинет преподавателя — главная", [
        ("today", "Панель Сегодня и ближайшие занятия"), ("calendar", "Календарь преподавателя"),
        ("homework", "Очередь проверки домашних заданий"), ("students", "Закреплённые ученики"),
        ("notifications", "Рабочие уведомления и материалы")],
        "Раздел Сообщения нужно трактовать через утверждённые организационные обращения, а не межурочный чат с учеником. Проценты прогресса требуют сверки с педагогической моделью."),
    "techers2.png": ("Три экрана преподавателя — обзорный референс", [
        ("earnings", "Начисления, детализация и выплаты"),
        ("progress", "Прогресс ученика, цели и учебная история"),
        ("lessons", "Недельное расписание и история занятий")],
        "В таблице встречаются 350 MDL как начисление за урок; это не подтверждает ставку преподавателя. Проценты, отзывы и самостоятельное планирование не становятся требованиями только из-за изображения."),
    "teacher_lessons_mockup.png": ("Преподаватель — занятия", [
        ("filters", "Сегодня / неделя / месяц / архив"),
        ("lesson", "Карточки уроков, статус и переход в Meet"),
        ("statistics", "Сводка проведённых, отменённых и перенесённых занятий")],
        "Кнопка Запланировать занятие требует маршрута запроса менеджеру: самостоятельное бронирование преподавателем не следует из макета."),
    "teacher_progress_mockup.png": ("Преподаватель — прогресс учеников", [
        ("filters", "Поиск, фильтры предмета и статуса"),
        ("goals", "Цели и карточки прогресса учеников"),
        ("recommendations", "Достижения и рекомендации")],
        "Процентные шкалы и агрегаты Достигли цели — визуальные идеи. Не подменяют карту навыков и проверки 4 / отчёты 8 уроков."),
    "teacher_earnings_mockup.png": ("Преподаватель — начисления", [
        ("rate", "Базовая ставка, бонус и итог месяца"),
        ("ledger", "Детализация начислений и история выплат"),
        ("statistics", "Статистика занятий и начислений")],
        "В макете бонус +30 MDL за высокий рейтинг и выплата 5-го числа. Это не утверждённые правила: сверить со шкалой 200/220/250 MDL, стажем/активными учениками и закрытием финансового периода."),
}


def image_fragment():
    nodes, edges = [], []
    for name, (label, features, caveat) in IMAGES.items():
        path = ROOT / "template" / name
        prefix = stem(path)
        image_id = prefix + "_image"
        nodes.append(dict(id=image_id, label=label, file_type="image", source_file=str(path),
                          source_location="Изображение целиком", status="VISUAL_REFERENCE",
                          summary=caveat, extraction_method="host_agent_vision"))
        for key, text in features:
            nid = prefix + "_" + key
            nodes.append(dict(id=nid, label=text, file_type="concept", source_file=str(path),
                              source_location="Видимый блок интерфейса", status="VISUAL_REFERENCE"))
            edges.append(dict(source=image_id, target=nid, relation="depicts", confidence="EXTRACTED",
                              confidence_score=1.0, source_file=str(path), source_location="Видимый блок интерфейса", weight=1.0))
    return dict(nodes=nodes, edges=edges, hyperedges=[], input_tokens=0, output_tokens=0,
                token_usage_status="unavailable_in_host_session")


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--accept-reviewed-new-sources", action="store_true",
                        help="Add newly reviewed sources to baseline; changed old sources stay stale")
    options = parser.parse_args()
    from graphify.detect import detect, save_manifest
    from graphify.build import build_from_json, build_merge
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.diagnostics import diagnose_extraction
    from graphify.export import to_json
    from graphify.report import generate
    from graphify.cache import save_semantic_cache

    OUT.mkdir(exist_ok=True)
    SEM.mkdir(exist_ok=True)
    # Import reviewed extraction outputs once, then keep them for repeatable builds.
    for path in sorted(OUT.glob(".graphify_chunk_*.json")):
        target = SEM / (path.stem.removeprefix(".graphify_chunk_") + ".json")
        if not target.exists():
            target.write_bytes(path.read_bytes())
    write_json(SEM / "images.json", image_fragment())
    fragments = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(SEM.glob("*.json"))]
    if len(fragments) < 4:
        raise SystemExit("Wait for all three document extraction fragments before building.")

    sources = sorted(p for folder in ("docs", "template", "ref") for p in (ROOT / folder).rglob("*") if p.is_file())
    previous = OUT / "source_snapshot.json"
    hashes = {p.relative_to(ROOT).as_posix(): digest(p) for p in sources}
    stale = []
    if previous.exists():
        old = json.loads(previous.read_text(encoding="utf-8"))["sha256"]
        stale = sorted(k for k in set(old) | set(hashes) if old.get(k) != hashes.get(k))

    nodes, edges, hyperedges = {}, [], []
    for part in fragments:
        for item in part.get("nodes", []) + part.get("edges", []) + part.get("hyperedges", []):
            if item.get("source_file"):
                item["source_file"] = str(Path(item["source_file"]).resolve())
        for node in part["nodes"]:
            if node["id"] in nodes and nodes[node["id"]] != node:
                raise ValueError("Conflicting node ID: " + node["id"])
            nodes[node["id"]] = node
        edges.extend(part["edges"])
        hyperedges.extend(part.get("hyperedges", []))

    if options.accept_reviewed_new_sources and previous.exists():
        reviewed = {Path(n["source_file"]).relative_to(ROOT).as_posix()
                    for n in nodes.values() if n.get("review_status") == "REVIEWED"}
        additions = {k: v for k, v in hashes.items() if k not in old and k in reviewed}
        old.update(additions)
        snapshot = json.loads(previous.read_text(encoding="utf-8"))
        snapshot["sha256"] = old
        snapshot["reviewed_sources_added_at"] = datetime.now(timezone.utc).isoformat()
        write_json(previous, snapshot)
        stale = sorted(k for k in set(old) | set(hashes) if old.get(k) != hashes.get(k))

    def add_edge(source, target, relation, path, location=None, confidence="EXTRACTED", score=1.0):
        edges.append(dict(source=source, target=target, relation=relation, source_file=str(path),
                          source_location=location, confidence=confidence, confidence_score=score, weight=1.0))

    roadmap_path = ROOT / "docs/online_academy_MVP_full_release_architecture_roadmap_v3.8.md"
    for dev, target in (("13", "open_partial_access"), ("14", "open_freeze_access")):
        current = stem(roadmap_path) + "_dev_" + dev
        previous_id = "docs_online_academy_student_architecture_full_decision_log_v2_" + target
        if current in nodes and previous_id in nodes:
            add_edge(current, previous_id, "resolves", roadmap_path, "L714-L715")

    exceptions_path = ROOT / "docs/online_academy_financial_operational_exceptions_part_01_v1.0.md"
    for decision, location in (("fin_01", "L33-L45"), ("fin_02", "L53-L71"),
                               ("ops_01", "L79-L98"), ("ops_02", "L108-L140")):
        current = stem(exceptions_path) + "_" + decision
        earlier = "docs_scheduling_logistics_part_2_modules_06_09_v1_0_" + decision
        if current in nodes and earlier in nodes:
            add_edge(current, earlier, "resolves", exceptions_path, location)
            nodes[earlier].setdefault("source_status", nodes[earlier].get("status"))
            nodes[earlier]["current_status"] = "ФУНКЦИОНАЛЬНО ЗАКРЫТО — " + decision.upper().replace("_", "-") + "/B"
            nodes[earlier]["current_resolution"] = nodes[current].get("summary", "См. поздний реестр финансовых и операционных исключений.")
            nodes[earlier]["resolution_source_file"] = str(exceptions_path)
            nodes[earlier]["resolution_source_location"] = location

    # Every source is represented even if semantic extraction has few concepts.
    file_roots = {}
    for path in sources:
        candidates = [n for n in nodes.values() if Path(n.get("source_file", "")) == path and n["id"].endswith(("_document", "_image"))]
        if candidates:
            root = candidates[0]["id"]
        else:
            is_document = path.suffix.lower() in (".md", ".mp4", ".mov", ".mkv")
            root = stem(path) + ("_document" if is_document else "_image")
            nodes[root] = dict(id=root, label=path.name, file_type="document" if is_document else "image",
                               source_file=str(path), source_location="L1" if path.suffix == ".md" else "Изображение целиком")
        file_roots[path] = root
        for node in list(nodes.values()):
            if node["id"] != root and Path(node.get("source_file", "")) == path:
                add_edge(root, node["id"], "contains", path, node.get("source_location"))

    # A faithful document outline complements the curated semantic concepts.
    for path in sources:
        if path.suffix.lower() != ".md":
            continue
        for lineno, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
            match = re.match(r"^## (.+)", line)
            if match:
                nid = stem(path) + "_heading_" + hashlib.sha1(match[1].encode()).hexdigest()[:10]
                if nid in nodes:
                    continue
                nodes[nid] = dict(id=nid, label=match[1], file_type="document", source_file=str(path),
                                  source_location=f"L{lineno}", status="SOURCE_HEADING")
                add_edge(file_roots[path], nid, "has_section", path, f"L{lineno}")

    # Explicit source filenames provide audited cross-document connections.
    for path in sources:
        if path.suffix.lower() != ".md":
            continue
        for lineno, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
            for cited, rid in file_roots.items():
                if cited != path and cited.name.casefold() in line.casefold():
                    add_edge(file_roots[path], rid, "cites", path, f"L{lineno}")

    # Later explicit approvals supersede snapshots without rewriting closed acts.
    latest = ROOT / "docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md"
    prior = ROOT / "docs/online_academy_MVP_full_release_architecture_roadmap_v7.6.md"
    archived = ROOT / "docs/online_academy_MVP_full_release_architecture_roadmap_v3.8.md"
    handoff = ROOT / "docs/online_academy_block_13_final_architecture_handoff_v1.0.md"
    technical = ROOT / "docs/online_academy_technical_architecture_part_01_v3.2.md"
    detailed = ROOT / "docs/online_academy_detailed_technical_design_part_01_v1.9.md"
    meet = ROOT / "docs/online_academy_REL-01_A_Meet_API_MVP_release_addendum_v1.0.md"
    if latest in file_roots:
        for historical in (prior, archived):
            if historical in file_roots:
                add_edge(file_roots[latest], file_roots[historical], "current_version_of", latest,
                         "L1-L10; §39–41", "INFERRED", 0.95)
        for node in nodes.values():
            source = Path(node.get("source_file", ""))
            if source in (prior, archived):
                node["source_version_status"] = "HISTORICAL_VERSION"
                node["canonical_source_file"] = str(latest)
            elif source in (latest, meet):
                node["source_version_status"] = "CANONICAL_CURRENT"
            elif source in (technical, handoff, detailed):
                node["source_version_status"] = "APPROVED_BASELINE_WITH_LATER_ADDENDA"
                node["current_context_source_file"] = str(latest)
            if "2026-10-22" in node.get("label", "") and "полноты" in node.get("label", "").lower():
                node["current_status"] = "HISTORICAL_ESTIMATE_NOT_CURRENT_READINESS"
        current_tch12 = next((n for n in nodes.values() if Path(n.get("source_file", "")) == latest
                              and n.get("label", "").startswith("TCH-12")), None)
        old_tch12 = stem(archived) + "_tch_12"
        if current_tch12 and old_tch12 in nodes:
            add_edge(current_tch12["id"], old_tch12, "resolves", latest,
                     current_tch12.get("source_location"))
            nodes[old_tch12]["source_status"] = nodes[old_tch12].get("status")
            nodes[old_tch12]["current_status"] = "УТВЕРЖДЕНО — TCH-12/B; функциональный блок преподавателя закрыт TCH-13/B"
            nodes[old_tch12]["resolution_source_file"] = str(latest)

    # Cross-modal links are analyst inference, never proof that a mockup is approved.
    matches = {
        "student.png": ("student_architecture", "MVP_full_release"),
        "manager.png": ("MVP_full_release",),
        "techers.png": ("MVP_full_release", "architecture_decisions"),
        "techers2.png": ("MVP_full_release", "economics_11_3_final", "student_architecture"),
        "teacher_lessons_mockup.png": ("MVP_full_release", "scheduling_logistics_part_2"),
        "teacher_progress_mockup.png": ("MVP_full_release", "student_architecture"),
        "teacher_earnings_mockup.png": ("MVP_full_release", "economics_11_3_final"),
    }
    for name, needles in matches.items():
        image_path = ROOT / "template" / name
        for path, rid in file_roots.items():
            if path.suffix == ".md" and any(x in path.name for x in needles):
                add_edge(file_roots[image_path], rid, "visual_reference_for", image_path,
                         "Сопоставление видимых блоков с назначением документа", "INFERRED", 0.85)

    for image_path, image_id in file_roots.items():
        if "ref" not in image_path.relative_to(ROOT).parts or image_path.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        label = nodes[image_id].get("label", "").casefold()
        needles = {"MVP_full_release"}
        if any(x in label for x in ("урок", "занят", "календар", "расписан")):
            needles.add("scheduling_logistics_part_2")
        if any(x in label for x in ("ученик", "задан", "прогресс", "отчёт", "материал")):
            needles.add("student_architecture")
        if any(x in label for x in ("начисл", "зарплат", "выплат", "ставк")):
            needles.add("economics_11_3_final")
        for path, rid in file_roots.items():
            if path.suffix == ".md" and any(x in path.name for x in needles):
                add_edge(image_id, rid, "visual_reference_for", image_path,
                         "Аналитическое сопоставление изображения с областью требований; не утверждение функции", "INFERRED", 0.75)

    # Keep evidence for repeated relations; Graphify's directed simple graph permits
    # a single edge per pair. Do not silently lose the alternate evidence.
    pairs = {}
    for edge in edges:
        if edge["source"] not in nodes or edge["target"] not in nodes:
            raise ValueError("Dangling edge: " + repr(edge))
        if edge["source"] == edge["target"]:
            raise ValueError("Self loop: " + repr(edge))
        if edge.get("confidence_score") is None:
            raise ValueError("Missing confidence score")
        key = edge["source"], edge["target"]
        if key not in pairs:
            pairs[key] = edge.copy()
        elif edge["relation"] != pairs[key]["relation"]:
            pairs[key].setdefault("alternate_evidence", []).append(edge)
    extraction = dict(nodes=list(nodes.values()), edges=list(pairs.values()), hyperedges=hyperedges,
                      input_tokens=0, output_tokens=0, token_usage_status="unavailable_in_host_session")
    write_json(OUT / ".graphify_extract.json", extraction)
    detection = detect(ROOT)
    write_json(OUT / ".graphify_detect.json", detection)
    # Preserve code symbols from `graphify update .` while replacing reviewed
    # document/image sources. A semantic rebuild must not discard the AST graph.
    graph_path = OUT / "graph.json"
    graph = (build_merge([extraction], graph_path=str(graph_path),
                         prune_sources=[str(p) for p in sources], root=ROOT, directed=True)
             if graph_path.exists() else build_from_json(extraction, root=ROOT, directed=True))
    if not graph:
        raise ValueError("Empty graph")
    communities = cluster(graph)
    cohesion = score_all(graph, communities)
    labels = {}
    for cid, members in communities.items():
        counts = Counter(graph.nodes[n].get("source_file", "") for n in members)
        common_source = counts.most_common(1)[0][0].replace("\\", "/")
        common = Path(common_source).stem
        labels[cid] = ("Внешние визуальные референсы" if common_source.startswith("ref/") else
                       "Макеты кабинетов" if common_source.startswith("template/") else
                       "Инженерное проектирование MVP" if "detailed_technical_design" in common else
                       "Meet API — релизное дополнение" if "REL-01_A" in common else
                       "Техническая архитектура" if "technical_architecture" in common else
                       "Архитектурный handoff" if "block_13" in common else
                       "Финансовые и операционные исключения" if "financial_operational" in common else
                       "Кабинет ученика" if "student" in common else
                       "Расписание и логистика" if "scheduling" in common else
                       "Экономика и расчёты" if "economics" in common else
                       "MVP и рабочие кабинеты" if "MVP" in common else "Образовательная модель") + f" · {cid}"
    gods = god_nodes(graph)
    surprises = surprising_connections(graph, communities)
    questions = suggest_questions(graph, communities, labels)
    if not to_json(graph, communities, str(OUT / "graph.json"), community_labels=labels):
        raise SystemExit("Graphify refused to shrink graph; review the source changes before replacing it.")
    write_json(OUT / ".graphify_labels.json", {str(k): v for k, v in labels.items()})
    write_json(OUT / ".graphify_analysis.json", dict(communities={str(k):v for k,v in communities.items()},
               cohesion={str(k):v for k,v in cohesion.items()}, gods=gods, surprises=surprises, questions=questions))
    report = generate(graph, communities, cohesion, labels, gods, surprises, detection,
                      {"input": 0, "output": 0}, str(ROOT), suggested_questions=questions)
    report = re.sub(r"- Token cost:.*", "- Token cost: недоступен (анализ в сессии Codex; внешних API-вызовов нет).", report)
    report = ("# Ограничения и происхождение карты\n\n"
              "Семантика извлечена текущей сессией Codex, изображения просмотрены визуально. "
              "Точный расход токенов и стоимость недоступны; технические нули в промежуточном формате не означают бесплатность анализа. "
              "Карта помогает найти требования, но не утверждает новые решения.\n\n"
              "Структурные вершины файлов и заголовков могут доминировать в God Nodes. "
              "Surprising Connections — эвристика, а не доказательство бизнес-зависимости.\n\n" + report)
    if stale:
        report = "# Требуется повторный семантический анализ\n\nИзменились источники: " + ", ".join(stale) + "\n\n" + report
    (OUT / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    health = diagnose_extraction(extraction, directed=True, root=ROOT)
    health["scope"] = "reviewed_semantic_extraction"
    health["merged_graph_counts"] = {"nodes": graph.number_of_nodes(), "edges": graph.number_of_edges()}
    write_json(OUT / "graph_health.json", health)
    write_json(OUT / "cost.json", dict(input_tokens=None, output_tokens=None, estimated_usd=None,
               status="unavailable_in_host_session", external_llm_api_calls=0))
    if not previous.exists():
        write_json(previous, dict(captured_at=datetime.now(timezone.utc).isoformat(), sha256=hashes))
    write_json(OUT / "freshness.json", dict(stale_sources=stale, semantic_refresh_required=bool(stale)))
    (OUT / ".graphify_python").write_text(sys.executable, encoding="utf-8")
    (OUT / ".graphify_root").write_text(str(ROOT), encoding="utf-8")
    semantic_files = [str(p) for p in sources]
    in_scope = lambda item: item.get("source_file") and str(Path(item["source_file"]).resolve()) in set(semantic_files)
    save_semantic_cache([n for n in extraction["nodes"] if in_scope(n)],
                        [e for e in extraction["edges"] if in_scope(e)],
                        [h for h in extraction["hyperedges"] if in_scope(h)],
                        root=ROOT, allowed_source_files=semantic_files, prompt_file=str(SPEC))
    save_manifest(detection["files"], root=ROOT, scan_corpus=set(semantic_files))

    tree = ["# Дерево источников проекта", "", "Сгенерировано из docs/, template/, ref/. Исходные имена сохранены.", "", "```text", "OnlineSchool/"]
    for folder in ("docs", "template", "ref"):
        files = [p for p in sources if p.relative_to(ROOT).parts[0] == folder]
        tree.append(f"├── {folder}/" + ("  (пока пусто)" if not files else ""))
        for path in files:
            tree.append("│   ├── " + path.relative_to(ROOT / folder).as_posix())
    tree += ["```", "", f"Всего: {len(sources)} исходных файлов; {graph.number_of_nodes()} узлов; {graph.number_of_edges()} связей.", "", "## Каталог источников", ""]
    for path in sources:
        rel = path.relative_to(ROOT).as_posix()
        tree.append(f"- [{path.name}](../{rel.replace(' ', '%20')}) — {path.stat().st_size:,} байт; SHA-256 `{hashes[rel][:12]}`.")
    (OUT / "SOURCE_TREE.md").write_text("\n".join(tree) + "\n", encoding="utf-8")
    audit = ["# Макеты и требования", "", "Семь изображений просмотрены визуально. Это референсы интерфейса, их наличие не означает утверждение всех подписей, сумм и действий.", ""]
    for name, (label, features, caveat) in IMAGES.items():
        audit += [f"## {label}", "", f"[Открыть изображение](../template/{name})", "", "; ".join(text for _,text in features) + ".", "", caveat, ""]
    (OUT / "UI_REFERENCE_AUDIT.md").write_text("\n".join(audit), encoding="utf-8")
    refs = [p for p in sources if "ref" in p.relative_to(ROOT).parts and p.suffix.lower() in (".jpg", ".jpeg", ".png")]
    videos = [p for p in sources if p.suffix.lower() in (".mp4", ".mov", ".mkv")]
    catalog = ["# Каталог внешних визуальных референсов", "",
               f"В каталоге {len(refs)} изображений из ref/, включая отобранные кадры видео. Макеты template/ разобраны отдельно в [аудите](UI_REFERENCE_AUDIT.md).",
               "", "Наличие функции или цены на чужом интерфейсе не утверждает её для нашего проекта. Снимки экранов не подтверждают текущее состояние показанных сервисов.", ""]
    for path in refs:
        node = nodes[file_roots[path]]
        source_rel = path.relative_to(ROOT).as_posix().replace(" ", "%20")
        catalog += [f"## {node['label']}", "", f"[Открыть {path.name}](../{source_rel})", "",
                    node.get("summary", "Описание в исходном смысловом фрагменте."), ""]
        features = [n["label"] for n in nodes.values() if Path(n.get("source_file", "")) == path and n["id"] != node["id"]]
        if features:
            catalog += ["Наблюдаемые блоки: " + "; ".join(features) + ".", ""]
    catalog += ["## Подробные результаты просмотра", "", "- [Часть A](references_a_findings.md)", "- [Часть B](references_b_findings.md)", "- [Часть C](references_c_findings.md)"]
    if videos:
        catalog += ["- [Видео: кадры, таймкоды и сопоставление с проектом](video/VIDEO_REFERENCES.md)",
                    "- [Галерея кадров с фильтрами](video/gallery.html)"]
    (OUT / "REFERENCE_CATALOG.md").write_text("\n".join(catalog) + "\n", encoding="utf-8")
    print(json.dumps(dict(sources=len(sources), nodes=graph.number_of_nodes(), edges=graph.number_of_edges(),
                          communities=len(communities), stale_sources=stale,
                          health={k:health[k] for k in ("missing_endpoint_edges", "dangling_endpoint_edges",
                                  "self_loop_edges", "directed_same_endpoint_collapsed_edges")}), ensure_ascii=False))


if __name__ == "__main__":
    main()
