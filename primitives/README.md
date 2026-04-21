Primitive source folder for the direct-open 3DGS viewer.

- `primitive-library.js`
  Contains the runtime-authored primitive definitions for:
  - `Sphere`
  - `Cube`
  - `Macbeth`
  - `Human 1.8m`
  - `Bunny`
  - `dragon`
  - `mesh-primitive-data.js`
    Encoded mesh vertex/index data converted from official Stanford repository PLY files.

Notes:
- Macbeth patch values are stored as linear sRGB float triples sampled from:
  `https://raw.githubusercontent.com/colour-science/colour-nuke/master/colour_nuke/resources/images/ColorChecker2014/sRGB_ColorChecker2014.exr`
- Macbeth is authored as layered multi-splat patches so a single chart reads less transparently, and its falloff remains adjustable from the viewer UI.
- `Bunny` and `dragon` are generated from official Stanford repository mesh files and converted to face-aligned Gaussian splats at runtime.
- Original source mesh data is from the Stanford 3D Scanning Repository. The repository asks users to acknowledge Stanford Computer Graphics Laboratory, permits research use and free redistribution, and restricts commercial use without permission:
  `https://graphics.stanford.edu/data/3Dscanrep/`
- Viewer rendering stays in sRGB output, while color math continues in linear sRGB.
