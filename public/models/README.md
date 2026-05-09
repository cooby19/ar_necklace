# Necklace model assets

Place your GLB file here:

```text
public/models/necklace.glb
```

The MVP loads `/models/necklace.glb` by default.

Model alignment recommendations:

- Put the pivot near the necklace's top center / wearing anchor.
- Face the visible front of the necklace toward the camera.
- Keep the model centered around the origin on X.
- Keep the model width close to one scene unit if possible.
- If the model appears backwards, upside down, or too large, adjust the values in `src/config/necklaces.js`.
- If the GLB includes a modeled neck for occlusion, keep that neck as a separate Blender object/mesh and name it with a keyword from `occluderParts.nameIncludes` in `src/config/necklaces.js`, such as `neck`, `脖子`, or `圓柱體`. The app keeps matched parts invisible while writing them to the depth buffer, so necklace segments behind the neck can be hidden without drawing the neck model.
