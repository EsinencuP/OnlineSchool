"""Sample the local video, select diverse screens, and retain exact timecodes.

Run using bundled Python (Pillow and NumPy); ffmpeg/ffprobe must be on PATH.
This prepares candidates. Reviewed frames are promoted into ref/ separately.
"""
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ref/ScreenRecording_10-08-2026 15-42-16_1.mp4"
WORK = ROOT / "graphify-out/video-work"
SAMPLES = WORK / "samples"
CANDIDATES = WORK / "candidates"
OUT = ROOT / "graphify-out/video"
for directory in (WORK, SAMPLES, CANDIDATES, OUT):
    directory.mkdir(parents=True, exist_ok=True)

metadata = json.loads(subprocess.check_output([
    "ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_type,width,height,r_frame_rate",
    "-of", "json", str(SOURCE)], text=True))
duration = float(metadata["format"]["duration"])
if not list(SAMPLES.glob("sample_*.jpg")):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(SOURCE),
                    "-vf", "fps=1/5,transpose=2", "-q:v", "2", str(SAMPLES / "sample_%04d.jpg")], check=True)
files = sorted(SAMPLES.glob("sample_*.jpg"))
arrays = [np.asarray(Image.open(p).convert("RGB").resize((192, 89)), dtype=float) for p in files]
mask = np.ones((89, 192), bool)
mask[:25, 145:] = False  # call overlay
mask[73:, :66] = False  # presenter label
mask[:6, :] = False
mask[83:, :] = False
selected = [0]
for index in range(1, len(files)):
    difference = float(np.mean(np.abs(arrays[index] - arrays[selected[-1]])[mask]))
    if difference > 14 or index - selected[-1] >= 8:
        selected.append(index)
if selected[-1] != len(files) - 1:
    selected.append(len(files) - 1)

frames = []
for ordinal, index in enumerate(selected, 1):
    # fps supplies screening candidates only. Re-seek each chosen original time
    # explicitly, so the delivered image has a documented source timecode.
    second = min(index * 5 + 2.5, duration - .1)
    minutes, remainder = divmod(second, 60)
    filename = f"frame_{int(minutes):02d}_{int(remainder):02d}_{int(round((remainder%1)*1000)):03d}.jpg"
    target = CANDIDATES / filename
    if not target.exists():
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{second:.3f}",
                        "-i", str(SOURCE), "-frames:v", "1", "-vf", "transpose=2", "-q:v", "2", str(target)], check=True)
    frames.append(dict(ordinal=ordinal, candidate_file=str(target), filename=filename,
                       timestamp_seconds=second, timestamp=f"{int(minutes):02d}:{remainder:06.3f}",
                       extraction="ffmpeg input seek; transpose=2 (90 degrees counterclockwise)",
                       final_relative_path=f"ref/video_frames/ukraine_crm_review/{filename}"))
result = dict(source_file=str(SOURCE), source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
              duration_seconds=duration, metadata=metadata, sampling_interval_seconds=5,
              selection_pixel_difference_threshold=14, maximum_candidate_gap_seconds=40,
              reviewed=False, audio_transcribed=False, frames=frames)
(OUT / "candidate_manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(dict(duration_seconds=duration, sampled=len(files), candidates=len(frames)), ensure_ascii=False))
