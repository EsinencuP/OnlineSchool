"""Promote reviewed video screenshots, write a gallery and a Graphify fragment."""
import hashlib
import html
import json
import re
import shutil
from collections import Counter
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "graphify-out"
VIDEO = OUT / "video"
FRAMES = ROOT / "ref/video_frames/ukraine_crm_review"
MANIFEST = json.loads((VIDEO / "candidate_manifest.json").read_text(encoding="utf-8"))


def node_id(path, suffix):
    return re.sub(r"[^a-z0-9]", "_", path.relative_to(ROOT).with_suffix("").as_posix().lower()) + "_" + suffix


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def url(path):
    return "../../" + quote(path.relative_to(ROOT).as_posix(), safe="/")


def tc(seconds):
    minutes, sec = divmod(seconds, 60)
    return f"{int(minutes):02d}:{sec:06.3f}"


DOMAINS = dict(crm="CRM и заявки", teacher="Кабинет преподавателя", student="Кабинет ученика",
               schedule="Расписание", materials="Материалы", reports="Отчёты", access="Роли и доступ",
               finance="Финансы", public="Публичный сайт")


def main():
    annotations = []
    for suffix in ("a", "b", "c"):
        path = VIDEO / f"annotations_{suffix}.json"
        if not path.exists():
            raise SystemExit(f"Review pending: {path}")
        annotations.extend(json.loads(path.read_text(encoding="utf-8")))
    assert len(annotations) == len(MANIFEST["frames"])
    assert len({x["ordinal"] for x in annotations}) == len(annotations)
    lookup = {x["ordinal"]: x for x in MANIFEST["frames"]}
    for item in annotations:
        original = lookup[item["ordinal"]]
        assert original["filename"] == item["filename"]
        assert original["timestamp_seconds"] == item["timestamp_seconds"]
    chosen = sorted((x for x in annotations if x["use_as_reference"]), key=lambda x:x["timestamp_seconds"])
    FRAMES.mkdir(parents=True, exist_ok=True)
    video_path = Path(MANIFEST["source_file"])
    video_id = node_id(video_path, "document")
    nodes = [dict(id=video_id, label="Видео: обзор украинских школ и CRM — визуальные референсы",
                  file_type="document", media_type="video", source_file=str(video_path), source_location="00:00–13:50.903",
                  status="VISUAL_REFERENCE", review_status="REVIEWED", analysis_scope="selected_visual_frames",
                  summary=f"Запись 13:51; {len(chosen)} просмотренных экранов. Устная часть не расшифровывалась.",
                  user_context="По описанию владельца записи: показ аналогов школ и CRM в Украине.",
                  source_sha256=MANIFEST["source_sha256"])]
    edges = []
    for item in chosen:
        original = lookup[item["ordinal"]]
        target = FRAMES / item["filename"]
        shutil.copy2(original["candidate_file"], target)
        item["source_file"] = target.relative_to(ROOT).as_posix()
        item["source_video"] = video_path.relative_to(ROOT).as_posix()
        item["timestamp"] = tc(item["timestamp_seconds"])
        item["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
        image_id = node_id(target, "image")
        nodes.append(dict(id=image_id, label=f"{item['timestamp']} — {item['title']}", file_type="image",
                          source_file=str(target), source_location=f"Кадр видео {item['timestamp']}",
                          status="VISUAL_REFERENCE", review_status="REVIEWED", summary=item["notes"],
                          timestamp_seconds=item["timestamp_seconds"], source_video=str(video_path),
                          system=item["system"], domains=item["domains"], source_evidence=item["source_evidence"],
                          extraction_method="ffmpeg_seek_and_rotate_then_agent_vision"))
        edges.append(dict(source=video_id, target=image_id, relation="has_frame", confidence="EXTRACTED",
                          confidence_score=1.0, source_file=str(video_path), source_location=item["timestamp"], weight=1.0))
        for index, feature in enumerate(item["features"],1):
            feature_id = node_id(target, "feature_" + str(index))
            nodes.append(dict(id=feature_id, label=feature, file_type="concept", source_file=str(target),
                              source_location=f"Видимый блок кадра {item['timestamp']}", status="VISUAL_REFERENCE",
                              review_status="REVIEWED", timestamp_seconds=item["timestamp_seconds"]))
            edges.append(dict(source=image_id,target=feature_id,relation="depicts",confidence="EXTRACTED",
                              confidence_score=1.0,source_file=str(target),source_location=item["timestamp"],weight=1.0))
    manifest = dict(MANIFEST, reviewed=True, frames=chosen,
                    rejected=[x for x in annotations if not x["use_as_reference"]],
                    analysis_scope="visual screenshots only; audio not transcribed",
                    counts=dict(sampled=166,candidates=len(annotations),selected=len(chosen),rejected=len(annotations)-len(chosen)))
    dump(VIDEO / "manifest.json", manifest)
    dump(OUT / "semantic/video_references.json", dict(nodes=nodes,edges=edges,hyperedges=[],input_tokens=None,
          output_tokens=None,notes="Host session token cost unavailable. Screens viewed; audio not analyzed."))

    cards = []
    for item in chosen:
        image_url = url(ROOT / item["source_file"])
        original_url = url(video_path) + "#t=" + str(item["timestamp_seconds"])
        search = (item["title"] + " " + item["system"] + " " + " ".join(item["features"]) + " " +
                  " ".join(DOMAINS.get(x,x) for x in item["domains"]) + " " + item["timestamp"]).casefold()
        tags = "".join(f'<span>{html.escape(DOMAINS.get(x,x))}</span>' for x in item["domains"])
        bullets = "".join(f"<li>{html.escape(x)}</li>" for x in item["features"])
        system = item["system"] if item["system"] != "unknown" else "Бренд на кадре не указан"
        cards.append(f'''<article data-search="{html.escape(search,quote=True)}" data-domains="{' '.join(item['domains'])}">
<button class="shot" data-src="{image_url}" aria-label="Увеличить: {html.escape(item['title'],quote=True)}"><img src="{image_url}" alt="{html.escape(item['title'],quote=True)}" loading="lazy" width="1920" height="888"></button>
<div class="card-body"><div class="meta"><a href="{original_url}">{item['timestamp']}</a><span>{html.escape(system)}</span></div>
<h2>{html.escape(item['title'])}</h2><div class="tags">{tags}</div><ul>{bullets}</ul>
<p class="note">{html.escape(item['notes'])}</p><a class="file" href="{image_url}" target="_blank">Открыть полный размер ↗</a></div></article>''')
    options = "".join(f'<option value="{k}">{v}</option>' for k,v in DOMAINS.items())
    template = '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Видео-референсы · Онлайн-академия</title><style>
:root{color-scheme:light;--ink:#172a3c;--muted:#526575;--line:#d5dedf;--accent:#006f82}*{box-sizing:border-box}body{margin:0;background:#f4f6f4;color:var(--ink);font:16px/1.55 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:40px 28px}header{border-bottom:1px solid var(--line);padding-bottom:26px}.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);font-weight:700}h1{font-size:clamp(28px,4vw,44px);line-height:1.15;max-width:850px;margin:12px 0}header p{max-width:960px;color:var(--muted)}a{color:#006476;text-underline-offset:3px}nav{display:flex;gap:24px;flex-wrap:wrap}label{font-size:13px;font-weight:650}input,select{font:inherit;border:1px solid #9cadaa;background:white;color:var(--ink);border-radius:5px;padding:10px 12px;min-height:46px;width:100%}.filters{display:grid;grid-template-columns:minmax(200px,1fr) minmax(180px,320px);gap:18px;margin:28px 0 10px}.filters label{display:grid;gap:6px}#count{color:var(--muted);font-size:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,390px),1fr));gap:24px;align-items:start;margin-top:22px}article{background:#fff;border:1px solid var(--line);border-radius:7px;overflow:hidden}article[hidden]{display:none}.shot{display:block;border:0;border-bottom:1px solid var(--line);padding:0;width:100%;cursor:zoom-in;background:#e9eeeb}.shot img{display:block;width:100%;height:auto;aspect-ratio:1920/888;object-fit:contain}.card-body{padding:20px}.meta{display:flex;gap:14px;justify-content:space-between;font-size:12px;color:var(--muted)}.meta a{font-family:ui-monospace,monospace;font-weight:700;font-size:14px}h2{font-size:20px;line-height:1.3;margin:12px 0}.tags{display:flex;flex-wrap:wrap;gap:6px}.tags span{padding:2px 7px;background:#e8f2ef;font-size:12px;border-radius:3px}ul{padding-left:19px;font-size:14px}.note{font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px}.file{font-size:13px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #da8900;outline-offset:3px}dialog{padding:12px;border:0;border-radius:8px;max-width:96vw;max-height:96vh;background:#fff}dialog::backdrop{background:#142432d9}dialog img{display:block;max-width:92vw;max-height:82vh;object-fit:contain}dialog button{font:inherit;border:1px solid #8e9b9c;background:white;border-radius:4px;padding:6px 16px;margin:0 0 10px auto;display:block;cursor:pointer}footer{margin-top:36px;border-top:1px solid var(--line);padding-top:20px;font-size:13px;color:var(--muted)}@media(max-width:640px){main{padding:24px 16px}.filters{grid-template-columns:1fr}nav{gap:14px}.meta{flex-direction:column;gap:3px}}
</style><main><header><div class="eyebrow">Онлайн-академия / Библиотека референсов</div><h1>Экраны школ и CRM из видеодемонстрации</h1><p>__COUNT__ отобранных кадров из записи 13:51. Изображения повёрнуты для чтения, снабжены временем и наблюдаемыми функциями. Это визуальные ориентиры; правила, цены и права доступа определяются документами нашего проекта.</p><nav><a href="../../graphify-out/PROJECT_MAP.md">Карта проекта</a><a href="VIDEO_REFERENCES.md">Разбор и связи с модулями</a><a href="__SOURCE__">Исходное видео</a></nav></header>
<div class="filters"><label>Поиск по экранам и функциям<input id="search" type="search" placeholder="Например: расписание, оплата, роли"></label><label>Область проекта<select id="domain"><option value="">Все области</option>__OPTIONS__</select></label></div><p id="count" aria-live="polite"></p><section class="grid" aria-label="Кадры из видео">__CARDS__</section><footer>Метод: выборка с шагом 5 секунд, сравнение экранов, затем визуальный отбор. Из 38 кандидатов исключены загрузки, повторы и пустые экраны. Описана визуальная часть; аудио не расшифровывалось. Таймкод ссылается на исходный MP4.</footer></main><dialog id="viewer" aria-label="Кадр в полном размере"><button type="button" id="close">Закрыть · Esc</button><img id="large" alt=""></dialog><script>
const cards=[...document.querySelectorAll('article')],search=document.querySelector('#search'),domain=document.querySelector('#domain'),count=document.querySelector('#count'),viewer=document.querySelector('#viewer'),large=document.querySelector('#large');
function filter(){let n=0;for(const card of cards){card.hidden=!(card.dataset.search.includes(search.value.toLocaleLowerCase())&&(!domain.value||card.dataset.domains.split(' ').includes(domain.value)));if(!card.hidden)n++;}count.textContent=`Показано ${n} из ${cards.length} кадров`;}
search.addEventListener('input',filter);domain.addEventListener('change',filter);filter();document.querySelectorAll('.shot').forEach(button=>button.addEventListener('click',()=>{large.src=button.dataset.src;large.alt=button.querySelector('img').alt;viewer.showModal();}));document.querySelector('#close').addEventListener('click',()=>viewer.close());viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
</script></html>'''
    page = template.replace("__COUNT__",str(len(chosen))).replace("__SOURCE__",url(video_path)).replace("__OPTIONS__",options).replace("__CARDS__","\n".join(cards))
    (VIDEO / "gallery.html").write_text(page,encoding="utf-8")
    lines = ["# Видео-референсы: школы и CRM", "", f"Источник: [{video_path.name}]({url(video_path)}). Длительность **13:50.903**. По описанию владельца — демонстрация аналогов школ и CRM в Украине.", "",
             f"Выбрано **{len(chosen)} кадров** из 38 визуально просмотренных кандидатов; предварительная выборка — 166 изображений с шагом 5 секунд. Кадры повёрнуты на 90° против часовой стрелки, без дорисовки интерфейса.", "",
             "[Галерея с фильтрами и увеличением](gallery.html) · [Таймкоды и происхождение](manifest.json)", "",
             "## Связи с разработкой", "",
             "| Наблюдение | Где использовать как референс | Граница применения |", "|---|---|---|",
             "| Сотрудники, профиль, роли и отдельные права | Матрица ролей; CRM преподавателей; TCH-12 | Чужой общий служебный аккаунт и вход за сотрудника не утверждают такую модель у нас |",
             "| День преподавателя, ближайший урок, карточка события | TCH-01/B, TCH-03/B, TCH-08/B; расписание | Частота, длительность, взрослые ученики и самобронирование не переносятся из видео |",
             "| Пробные уроки, очереди и нагрузка методистов | Путь заявки и пробного урока; DEV-04/B; CRM | Действуют наши роли менеджера и правила оплаты, а не процедуры показанной школы |",
             "| Воронка, поиск, сделки и клиентская карточка amoCRM | DEV-02—10: очереди, карточки, контактная история | Наличие интеграций/автоматизаций в чужой CRM не включает их в MVP |",
             "| Сводные таблицы, реестр занятий, фильтр оплаты, feedback | Операционные реестры и сверка; TCH-09/B | Ручная таблица — пример представления данных, не готовая модель транзакций и доступа |", "",
             "Источник утверждённых требований: [roadmap v3.8](../../docs/online_academy_MVP_full_release_architecture_roadmap_v3.8.md). Связи скриншот → модуль помечены INFERRED, содержимое изображения — EXTRACTED.", "",
             "## Отобранные экраны", ""]
    for item in chosen:
        image_url=url(ROOT/item["source_file"])
        lines += [f"### {item['timestamp']} — {item['title']}", "", f"[Открыть кадр]({image_url}) · [Момент в исходном видео]({url(video_path)}#t={item['timestamp_seconds']})", "",
                  "Наблюдается: " + "; ".join(item["features"]) + ".", "", item["notes"], ""]
    lines += ["## Полнота и ограничения", "", "Это отбор ключевых экранов с шагом предварительной выборки 5 секунд, а не покадровая стенограмма. Короткое состояние интерфейса между точками выборки могло не попасть в набор. Нечитаемые поля и устные утверждения не восстанавливались; аудио не транскрибировалось.", "", "Точные таймкоды, SHA-256 исходного видео и кадров, отклонённые кандидаты и причины сохранены в manifest.json. Показанные персональные контакты не перенесены в названия узлов и описания требований."]
    (VIDEO/"VIDEO_REFERENCES.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
    print(json.dumps(dict(selected=len(chosen),rejected=len(annotations)-len(chosen),nodes=len(nodes),edges=len(edges)),ensure_ascii=False))


if __name__ == "__main__":
    main()
