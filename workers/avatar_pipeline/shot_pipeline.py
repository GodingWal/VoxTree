"""Shot planning, verified plate caching and linear-light compositing primitives."""
import hashlib
import json
import math
from pathlib import Path
from contract import fields, require


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def _require_asset_id(asset_id):
    require(isinstance(asset_id, str) and bool(asset_id), 'Invalid asset ID')
    require(not asset_id.startswith('/') and ':' not in asset_id,
            'Asset IDs must be studio-relative, not machine paths: ' + asset_id)
    require('\\' not in asset_id, 'Asset IDs must use forward slashes: ' + asset_id)
    require(all(part not in ('', '.', '..')
                for part in asset_id.replace('\\', '/').split('/')),
            'Invalid asset ID: ' + asset_id)


def parse_dependency(spec):
    """Split a CLI 'ASSET_ID=path' dependency into an (asset_id, path) pair.

    Asset IDs are studio-relative logical names (e.g. 'plates/wall.png'). They
    bind cached content to its role in the scene, so swapping two files'
    contents invalidates the cache key. Absolute machine paths, parent
    traversal and empty segments are rejected.
    """
    require(isinstance(spec, str) and '=' in spec, 'Dependency must look like ASSET_ID=path')
    asset_id, _, path = spec.partition('=')
    _require_asset_id(asset_id)
    require(bool(path), 'Missing path in dependency ' + repr(spec))
    return asset_id, path


def parse_dependencies(specs):
    """Parse CLI dependency entries into an {asset_id: path} map.

    Rejects duplicates and the reserved 'scene' ID (the loaded template takes
    that slot when the cache key is computed).
    """
    require(bool(specs), 'Provide all scene/asset/config dependencies')
    dependencies = {}
    for spec in specs:
        asset_id, path = parse_dependency(spec)
        require(asset_id not in dependencies, 'Duplicate dependency ID ' + asset_id)
        require(asset_id != 'scene', "Dependency ID 'scene' is reserved for the loaded template")
        dependencies[asset_id] = path
    return dependencies


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
    """Content key with asset identity: sorted (asset_id, sha256) pairs.

    Each digest is bound to its studio-relative asset ID, so swapping two
    files' contents changes the key and a stale receipt cannot validate.
    Absolute machine paths are excluded; the shot revision covers external
    dependencies (renderer/plugin versions, OCIO and the like).
    """
    validate_shot(shot)
    require(type(dependencies) is dict and bool(dependencies),
            'Provide dependencies as {asset_id: path}')
    pairs = []
    for asset_id, path in dependencies.items():
        _require_asset_id(asset_id)
        require(Path(path).is_file(), 'Missing dependency file for asset ' + asset_id)
        pairs.append([asset_id, digest(path)])
    pairs.sort()
    payload = {'shot': shot, 'dependencies': pairs}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def effective_frame_rate(fps, fps_base):
    require(type(fps) in (int, float) and math.isfinite(fps) and fps > 0,
            'Invalid template fps')
    require(type(fps_base) in (int, float) and math.isfinite(fps_base) and fps_base > 0,
            'Invalid template fps_base')
    return fps / fps_base


def require_locked_frame_rate(template_fps, template_base, expected_fps, context):
    """Reject templates whose authored rate differs from the job rate.

    Blender stores animation timing in absolute frames, so silently adopting a
    new FPS resamples authored body/camera motion against speech and the shot.
    Retime the template instead; see RENDERING_RULES.md rule 4.
    """
    actual = effective_frame_rate(template_fps, template_base)
    require(abs(actual - expected_fps) <= 1e-6,
            '%s: template runs at %g fps but the job requires %g fps'
            % (context, actual, expected_fps))


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
