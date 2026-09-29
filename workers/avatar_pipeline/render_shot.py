"""Blender entrypoint: render trusted authored pass scenes, then composite EXRs."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contract import load, require
from blender_worker import personalize
from shot_pipeline import cache_key, digest, frames, parse_dependencies, plan
from shot_pipeline import require_locked_frame_rate, validate_shot, verify_cache


def read_image(bpy, path, shot, channels):
    import numpy as np
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        require(tuple(image.size) == (shot['width'], shot['height']), 'Wrong frame dimensions')
        require(image.channels == 4, 'Expected RGBA EXR storage')
        pixels = np.empty(shot['width'] * shot['height'] * 4, dtype=np.float32)
        image.alpha_mode = 'PREMUL'
        image.pixels.foreach_get(pixels)
        require(np.isfinite(pixels).all(), 'Nonfinite rendered pixels')
        return pixels.reshape(shot['height'], shot['width'], 4)[..., :channels].copy()
    finally:
        bpy.data.images.remove(image)


def main():
    import bpy
    from shot_pipeline import composite
    p = argparse.ArgumentParser()
    p.add_argument('--shot', required=True)
    p.add_argument('--avatar', required=True)
    p.add_argument('--dependency', action='append', required=True,
                     help="Repeat as ASSET_ID=path (studio-relative ID, e.g. plates/wall.png=/studio/wall.png)")
    p.add_argument('--cache-root', required=True)
    p.add_argument('--output', required=True)
    args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    shot = validate_shot(json.loads(Path(args.shot).read_text()))
    avatar = load(args.avatar)
    require(all(avatar[k] == shot[k] for k in ('fps', 'frame_start', 'frame_end')),
            'Avatar timing differs from cached shot')
    require(bool(bpy.data.filepath), 'Load a trusted authored blend file')
    # 'scene' is the reserved ID for the loaded template; every other file
    # carries the studio-relative ID supplied with --dependency.
    key = cache_key(shot, {'scene': bpy.data.filepath,
                           **parse_dependencies(args.dependency)})
    cache = Path(args.cache_root).resolve() / key
    hit = verify_cache(shot, cache, key)
    passes = plan(shot, hit)
    # Scenes are authored independently: plate excludes all personalized effects;
    # character retains environment ray participation; effects uses signed collectors.
    scenes = {}
    for name in passes:
        scene = bpy.data.scenes.get('VT_' + name)
        require(scene is not None, 'Missing authored pass scene VT_' + name)
        require(scene.get('voxtree_pass_contract') == shot['layer_contract'],
                'Pass has not been authored for the compositing contract')
        require(scene.camera is not None, 'Missing camera')
        scene.render.engine = 'PRMAN_RENDER'  # Fail without plugin; no fallback.
        scenes[name] = scene
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=False)
    if 'plate' in passes:
        cache.mkdir(parents=True, exist_ok=False)  # No silent overwrite or competing writers.
    for name, scene in scenes.items():
        bpy.context.window.scene = scene
        if name in ('character', 'effects', 'full'):
            personalize(bpy, avatar)
        destination = cache if name == 'plate' else output / name
        destination.mkdir(exist_ok=True)
        scene.frame_start, scene.frame_end = shot['frame_start'], shot['frame_end']
        # Authored pass timing is absolute in frames: adopting a new rate would
        # resample the shot against the plate and the avatar cues. Reject it.
        require_locked_frame_rate(scene.render.fps, scene.render.fps_base,
                                  shot['fps'], 'Pass scene VT_' + name)
        scene.render.fps, scene.render.fps_base = shot['fps'], 1
        scene.render.resolution_x, scene.render.resolution_y = shot['width'], shot['height']
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'OPEN_EXR'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.image_settings.color_depth = '32'
        scene.render.film_transparent = name == 'character'
        for frame, path in zip(range(shot['frame_start'], shot['frame_end'] + 1), frames(shot, destination)):
            scene.frame_set(frame)
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            # Missing/misdirected RenderMan displays must fail before cache publication.
            read_image(bpy, path, shot, 4)
        if name == 'plate':
            receipt = {'key': key, 'frames': {f.name: digest(f) for f in frames(shot, cache)}}
            temp = cache / 'receipt.tmp'
            temp.write_text(json.dumps(receipt, sort_keys=True))
            temp.replace(cache / 'receipt.json')
    if shot['strategy'] == 'layered':
        import numpy as np
        for index, plate in enumerate(frames(shot, cache)):
            rgb = composite(read_image(bpy, plate, shot, 3),
                            read_image(bpy, frames(shot, output / 'character')[index], shot, 4),
                            read_image(bpy, frames(shot, output / 'effects')[index], shot, 3))
            image = bpy.data.images.new('VT_composite', width=shot['width'], height=shot['height'],
                                        alpha=True, float_buffer=True)
            try:
                rgba = np.concatenate((rgb, np.ones((*rgb.shape[:2], 1))), axis=2)
                image.alpha_mode = 'PREMUL'
                image.pixels.foreach_set(rgba.astype(np.float32).ravel())
                image.file_format = 'OPEN_EXR'
                image.filepath_raw = str(output / plate.name)
                image.save()
            finally:
                bpy.data.images.remove(image)
    (output / 'result.json').write_text(json.dumps({
        'status': 'frames_prepared_not_published', 'strategy': shot['strategy'],
        'cache_key': key, 'rendered_passes': passes,
        'frames_directory': str(cache if shot['strategy'] == 'reuse' else
                                output / 'full' if shot['strategy'] == 'full' else output)
    }, indent=2))


if __name__ == '__main__':
    main()
