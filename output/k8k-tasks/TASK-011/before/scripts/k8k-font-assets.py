"""TASK-006 local font asset generation/verification. Never reads environment files."""
import argparse
import hashlib
import io
import importlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("command", choices=["generate", "check"])
parser.add_argument("--tools", type=Path, default=ROOT / "output/k8k-tasks/TASK-006/tooling")
args = parser.parse_args()
sys.path.insert(0, str(args.tools.resolve()))
fontTools = importlib.import_module("fontTools")
brotli = importlib.import_module("brotli")
subset = importlib.import_module("fontTools.subset")
TTFont = importlib.import_module("fontTools.ttLib").TTFont

assert fontTools.__version__ == "4.60.1" and brotli.__version__ == "1.1.0"
package = ROOT / "packages/ui/node_modules/@fontsource-variable/golos-text"
assert json.loads((package / "package.json").read_text())["version"] == "5.2.8"
source = package / "files/golos-text-latin-ext-wght-normal.woff2"
target = ROOT / "packages/ui/src/fonts/golos-text-romanian-wght-normal.woff2"
codepoints = [0x102, 0x103, 0x15E, 0x15F, 0x218, 0x219, 0x21A, 0x21B]
font = TTFont(source, recalcTimestamp=False)
assert all(cp in font.getBestCmap() for cp in codepoints)
options = subset.Options()
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.name_legacy = True
options.name_languages = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=codepoints)
subsetter.subset(font)
font.flavor = "woff2"
stream = io.BytesIO()
font.save(stream, reorderTables=True)
data = stream.getvalue()
metadata = {
    "sourcePackage": "@fontsource-variable/golos-text@5.2.8",
    "sourceAsset": source.name,
    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "sourceBytes": source.stat().st_size,
    "generatedAsset": target.name,
    "sha256": hashlib.sha256(data).hexdigest(),
    "bytes": len(data),
    "unicodeRange": ",".join(f"U+{cp:04X}" for cp in codepoints),
    "fontTools": fontTools.__version__,
    "brotli": brotli.__version__,
    "license": "OFL-1.1; original copyright and license preserved in LICENSE",
    "weightAxis": [{"tag": a.axisTag, "min": int(a.minValue), "max": int(a.maxValue)} for a in font["fvar"].axes],
    "policy": "Only missing Romanian/legacy S-cedilla glyphs added; original Cyrillic/Latin assets unchanged. Fontsource lacks legacy T-cedilla/NFD mark cmap; readable system fallback remains.",
}
if args.command == "generate":
    if target.exists():
        raise SystemExit("Asset already exists: use check; do not overwrite without reviewing source/options")
    target.parent.mkdir(exist_ok=True)
    target.write_bytes(data)
    (target.parent / "LICENSE").write_bytes((package / "LICENSE").read_bytes())
    (target.parent / "provenance.json").write_text(json.dumps(metadata, indent=2) + "\n")
else:
    assert target.read_bytes() == data, "Regenerated font differs"
    assert json.loads((target.parent / "provenance.json").read_text()) == metadata
    assert (target.parent / "LICENSE").read_bytes() == (package / "LICENSE").read_bytes()
    result = TTFont(target)
    assert set(result.getBestCmap()) == set(codepoints)
    assert result["fvar"].axes[0].minValue == 400 and result["fvar"].axes[0].maxValue == 900
print(json.dumps({"command": args.command, "passed": True, **metadata}))
