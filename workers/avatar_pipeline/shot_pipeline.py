"""Shot planning, verified plate caching and linear-light compositing primitives."""
import hashlib
import json
from pathlib import Path
from contract import fields, require


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def validate_shot(shot):
    fields(shot, {'version', 'strategy', 'frame_start', 'frame_end', 'fps',
                  'width', 'height', 'revision', 'layer_contract'})
    require(type(shot['version']) is int and shot['version'] == 1, 'Unsupported shot version')
    require(shot['strategy'] in ('reuse', 'layered', 'full'), 'Unknown strategy')
    for name, limit in [('frame_start', 28800), ('frame_end', 28800), ('fps', 60),
                        ('width', 8192), ('height', 8192)]:
        require(type(shot[name]) is int and 1 <= shot[name] <= limit, 'Invalid ' + name)
    require(shot['frame_start'] <= shot['frame_end'], 'Reversed frame range')
    require(isinstance(shot['revision'], str) and 1 <= len(shot['revision']) <= 128,
            'Missing studio dependency revision')
    require(shot['layer_contract'] == 'linear-premult-delta-v1', 'Unknown layer contract')
    return shot


def cache_key(shot, dependencies):
    validate_shot(shot)
    require(bool(dependencies), 'Provide all scene/asset/config dependencies')
    # Include content, not machine-specific absolute paths. Revision covers external dependencies.
    payload = {'shot': shot, 'dependencies': sorted(digest(p) for p in dependencies)}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def frames(shot, directory):
    return [Path(directory) / f'frame_{n:06d}.exr'
            for n in range(shot['frame_start'], shot['frame_end'] + 1)]


def verify_cache(shot, directory, key):
    """A cache hit requires an exact receipt and unchanged, complete EXR bytes."""
    try:
        receipt = json.loads((Path(directory) / 'receipt.json').read_text())
        expected = frames(shot, directory)
        return (receipt['key'] == key and
                set(receipt['frames']) == {p.name for p in expected} and
                all(p.stat().st_size > 0 and receipt['frames'][p.name] == digest(p)
                    for p in expected))
    except (OSError, ValueError, KeyError, TypeError):
        return False


def plan(shot, cache_hit):
    validate_shot(shot)
    if shot['strategy'] == 'full':
        return ['full']
    passes = [] if cache_hit else ['plate']
    if shot['strategy'] == 'layered':
        passes += ['character', 'effects']
    return passes


def composite(plate, character, effects):
    """Arrays: opaque RGB plate, premult RGBA character, signed RGB effect delta.

    effects is the difference on the uncovered environment, BEFORE character over.
    It includes shadows/reflections/indirect changes, never the character beauty.
    """
    import numpy as np
    require(plate.ndim == 3 and plate.shape[-1] == 3, 'Plate must be RGB')
    require(character.shape == (*plate.shape[:2], 4) and effects.shape == plate.shape,
            'Pass dimensions differ')
    require(all(np.isfinite(x).all() for x in (plate, character, effects)), 'Nonfinite pixels')
    alpha = character[..., 3:4]
    require(((alpha >= 0) & (alpha <= 1)).all(), 'Invalid alpha')
    return character[..., :3] + (plate + effects) * (1 - alpha)
