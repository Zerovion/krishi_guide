"""The on-device JS scoring fallback must match the Python backend exactly."""
import itertools
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(shutil.which('node') is None, reason='node not installed')


def test_js_offline_scoring_matches_python_backend():
    from app.main import CROPS, FarmProfile, score_crop

    grid = []
    for season, soil, water, goal, district in itertools.product(
            ['kharif', 'rabi', 'summer'], ['black', 'sandy', 'clayey'], ['low', 'moderate', 'high'],
            ['balanced', 'lowcost', 'water', 'short'], ['', 'Sangli', 'Shimla', 'Indore', 'Assam']):
        grid.append({'district': district or 'x', 'season': season, 'soil': soil, 'water': water,
                     'area': 2.5, 'budget': 30000, 'goal': goal})
    grid += [{'district': 'Alwar, Rajasthan', 'season': 'rabi', 'soil': 'loamy', 'water': 'low', 'area': 0.5, 'budget': 1000, 'goal': 'lowcost'}]

    expected = [[{'id': c['id'], **score_crop(c, FarmProfile(**p))} for c in CROPS] for p in grid]
    script = f"""
      import {{ scoreCrop }} from '{(ROOT / 'frontend' / 'js' / 'offline.js').as_posix()}';
      const crops = {json.dumps(CROPS)}; const grid = {json.dumps(grid)};
      console.log(JSON.stringify(grid.map(p => crops.map(c => ({{ id: c.id, ...scoreCrop(c, p) }})))));
    """
    out = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, text=True, check=True).stdout
    assert json.loads(out) == expected
