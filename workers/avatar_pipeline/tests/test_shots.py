import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from types import SimpleNamespace
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shot_pipeline import cache_key, composite, digest, frames
from shot_pipeline import parse_dependencies, plan, require_locked_frame_rate, verify_cache
from render_shot import validate_pass_scenes

SHOT = dict(version=1, strategy='layered', frame_start=1, frame_end=2, fps=24,
            width=1, height=1, revision='fixture-v1', layer_contract='linear-premult-delta-v1')

class ShotTests(unittest.TestCase):
    def test_preflight_rejects_later_pass_before_mutating_first(self):
        class Scene(dict):
            def __init__(self, fps):
                super().__init__(voxtree_pass_contract=SHOT['layer_contract'])
                self.camera = object()
                self.render = SimpleNamespace(fps=fps, fps_base=1, engine='original')
        plate, character = Scene(24), Scene(30)
        bpy = SimpleNamespace(data=SimpleNamespace(scenes={'VT_plate': plate, 'VT_character': character}))
        with self.assertRaisesRegex(ValueError, 'VT_character'):
            validate_pass_scenes(bpy, SHOT, ['plate', 'character'])
        self.assertEqual(plate.render.engine, 'original')
        self.assertEqual(character.render.engine, 'original')
        character.render.fps = 24
        self.assertEqual(validate_pass_scenes(bpy, SHOT, ['plate', 'character']),
                         {'plate': plate, 'character': character})

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
            key = cache_key(SHOT, {'scene': asset})
            self.assertNotEqual(key, cache_key(dict(SHOT, fps=30), {'scene': asset}))
            self.assertFalse(verify_cache(SHOT, root, key))
            for frame in frames(SHOT, root):
                frame.write_bytes(b'test receipt bytes; EXR decoding is separately validated')
            receipt = {'key': key, 'frames': {p.name: digest(p) for p in frames(SHOT, root)}}
            (root / 'receipt.json').write_text(json.dumps(receipt))
            self.assertTrue(verify_cache(SHOT, root, key))
            frames(SHOT, root)[0].write_bytes(b'corrupt')
            self.assertFalse(verify_cache(SHOT, root, key))
            asset.write_bytes(b'changed lighting')
            self.assertNotEqual(key, cache_key(SHOT, {'scene': asset}))

    def test_dependency_swap_invalidates_cache(self):
        # Swapping two dependencies' contents changes the rendered scene, so
        # the key must change even though the multiset of bytes is identical.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wall, floor = root / 'wall.png', root / 'floor.png'
            wall.write_bytes(b'WALL-BYTES')
            floor.write_bytes(b'FLOOR-BYTES')
            before = cache_key(SHOT, {'plates/wall.png': wall, 'plates/floor.png': floor})
            wall.write_bytes(b'FLOOR-BYTES')
            floor.write_bytes(b'WALL-BYTES')
            self.assertNotEqual(before,
                                cache_key(SHOT, {'plates/wall.png': wall, 'plates/floor.png': floor}))
            # Swapping back restores the original scene and its key.
            wall.write_bytes(b'WALL-BYTES')
            floor.write_bytes(b'FLOOR-BYTES')
            self.assertEqual(before,
                             cache_key(SHOT, {'plates/wall.png': wall, 'plates/floor.png': floor}))
            # Identical bytes under different IDs are different scenes.
            self.assertNotEqual(before,
                                cache_key(SHOT, {'plates/wall.png': wall, 'plates/ceiling.png': floor}))
            # Order of declaration never affects the key.
            self.assertEqual(before,
                             cache_key(SHOT, {'plates/floor.png': floor, 'plates/wall.png': wall}))

    def test_dependency_identity_rules(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wall = root / 'wall.png'
            wall.write_bytes(b'WALL-BYTES')
            self.assertEqual(parse_dependencies(['plates/wall.png=' + str(wall)]),
                             {'plates/wall.png': str(wall)})
            for bad in ('wall.png', '=path', 'plates//wall.png', 'plates/../wall.png',
                        '/studio/wall.png', 'C:\\studio\\wall.png', 'plates/wall.png=',
                        'plates\\wall.png=path'):
                with self.subTest(spec=bad):
                    with self.assertRaises(ValueError):
                        parse_dependencies([bad])
            with self.assertRaises(ValueError):
                parse_dependencies(['plates/a.png=' + str(wall),
                                    'plates/a.png=' + str(wall)])
            with self.assertRaises(ValueError):
                parse_dependencies(['scene=' + str(wall)])
            with self.assertRaises(ValueError):
                cache_key(SHOT, {})
            with self.assertRaises(ValueError):
                cache_key(SHOT, {'plates/missing.png': root / 'missing.png'})

    def test_locked_frame_rate(self):
        for fps, base in ((24, 1), (30, 1), (25, 1), (24.0, 1)):
            require_locked_frame_rate(fps, base, int(fps), 'template')
        # The reported 24 -> 30 FPS defect: a motion ending at frame 25 ends at
        # 1.0 s in a 24 fps scene but 0.8 s after silent resampling to 30 fps.
        for template, base, expected in ((24, 1, 30), (30, 1, 24), (30000, 1001, 30),
                                         (24, 1, 24.5), (0, 1, 24), (24, 0, 24),
                                         (-24, 1, 24), (float('nan'), 1, 24),
                                         (24, float('nan'), 24), (True, 1, 1)):
            with self.subTest(template=(template, base, expected)):
                with self.assertRaises(ValueError):
                    require_locked_frame_rate(template, base, expected, 'template')
