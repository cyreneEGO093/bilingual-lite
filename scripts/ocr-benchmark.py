"""Optional CPU OCR comparison; not an extension runtime dependency.

Install rapidocr==3.9.2 onnxruntime==1.30.0 psutil==7.2.2 in a venv.
Usage: python scripts/ocr-benchmark.py --out evidence/ocr image1.png image2.png
"""
import argparse
import json
import statistics
import threading
import time
from pathlib import Path

import psutil
from PIL import Image, ImageDraw
from rapidocr import RapidOCR

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('images', nargs='+', type=Path)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
proc, peak, done = psutil.Process(), [0], threading.Event()
def monitor():
    while not done.wait(.05):
        peak[0] = max(peak[0], proc.memory_info().rss)
threading.Thread(target=monitor, daemon=True).start()
start = time.perf_counter()
engine = RapidOCR(params={'EngineConfig.onnxruntime.intra_op_num_threads': 4,
                         'EngineConfig.onnxruntime.inter_op_num_threads': 1})
report = {'engine': 'RapidOCR 3.9.2 / PP-OCRv6 small / ONNX Runtime CPU 1.30.0',
          'threads': 4, 'load_seconds': time.perf_counter()-start, 'samples': []}
for index, path in enumerate(args.images, 1):
    timings = []
    for _ in range(3):
        start = time.perf_counter()
        result = engine(path)
        timings.append(time.perf_counter()-start)
    regions = [{'text': text, 'confidence': float(score), 'polygon': box.tolist()}
               for box, text, score in zip(result.boxes, result.txts, result.scores)] if result.boxes is not None else []
    img = Image.open(path).convert('RGB')
    draw = ImageDraw.Draw(img)
    for number, region in enumerate(regions, 1):
        points = [tuple(p) for p in region['polygon']]
        draw.line(points+[points[0]], fill='#0066ff', width=3)
        x, y = points[0]
        draw.rectangle((x,y-14,x+25,y), fill='white')
        draw.text((x,y-14),str(number), fill='#0066ff')
    img.save(args.out/f'sample-{index}.png')
    entry = {'sample': index, 'image_size': list(img.size), 'seconds': timings,
             'median_seconds': statistics.median(timings), 'regions': regions}
    report['samples'].append(entry)
    print(json.dumps({'sample': index, 'seconds': timings, 'regions': len(regions)}), flush=True)
done.set()
report['peak_rss_mb'] = peak[0]/1024**2
report['models_mb'] = sum(p.stat().st_size for p in Path(engine.cfg.Global.model_root_dir).glob('*.onnx'))/1024**2
(args.out/'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='samples'}))
