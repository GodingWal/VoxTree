import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shot_pipeline import cache_key, composite, digest, frames, plan, verify_cache

SHOT = dict(version=1, strategy='layered', frame_start=1, frame_end=2, fps=24,
            width=1, height=1, revision='fixture-v1', layer_contract='linear-premult-delta-v1')

class ShotTests(unittest.TestCase):
    def test_plan(self):
        self.assertEqual(plan(SHOT, False), ['plate', 'character', 'effects'])
        self.assertEqual(plan(SHOT, True), ['character', 'effects'])
        self.assertEqual(plan(dict(SHOT, strategy='reuse'), True), [])
        self.assertEqual(plan(dict(SHOT, strategy='full'), True), ['full'])

    def test_shadow_and_premultiplied_edge(self):
        plate = np.ones((1, 1, 3))
        effects = np.full((1, 1, 3), -0.2)
        character = np.array([[[0.2, 0.1, 0.0, 0.5]]])
        np.testing.assert_allclose(composite(plate, character, effects), [[[0.6, 0.5, 0.4]]])
        character[..., 3] = 1
        np.testing.assert_allclose(composite(plate, character, effects), character[..., :3])

    def test_invalid_pixels(self):
        with self.assertRaises(ValueError):
            composite(np.ones((1, 1, 3)), np.full((1, 1, 4), np.nan), np.zeros((1, 1, 3)))

    def test_cache_invalidation_and_corruption(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asset = root / 'scene.blend'
            asset.write_bytes(b'first revision')
            key = cache_key(SHOT, [asset])
            self.assertNotEqual(key, cache_key(dict(SHOT, fps=30), [asset]))
            self.assertFalse(verify_cache(SHOT, root, key))
            for frame in frames(SHOT, root):
                frame.write_bytes(b'test receipt bytes; EXR decoding is separately validated')
            receipt = {'key': key, 'frames': {p.name: digest(p) for p in frames(SHOT, root)}}
            (root / 'receipt.json').write_text(json.dumps(receipt))
            self.assertTrue(verify_cache(SHOT, root, key))
            frames(SHOT, root)[0].write_bytes(b'corrupt')
            self.assertFalse(verify_cache(SHOT, root, key))
            asset.write_bytes(b'changed lighting')
            self.assertNotEqual(key, cache_key(SHOT, [asset]))
