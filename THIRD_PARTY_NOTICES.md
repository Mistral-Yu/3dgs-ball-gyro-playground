# Third-Party Notices

This repository bundles third-party runtime code under `vendor/`.

## Included third-party components

### three.js

- Files:
  - `vendor/three/three.module.js`
  - `vendor/three/three.core.js`
  - `vendor/three/examples/jsm/controls/OrbitControls.js`
  - `vendor/three/examples/jsm/controls/TransformControls.js`
- Upstream:
  - https://github.com/mrdoob/three.js
- License:
  - MIT

The bundled files include MIT license headers.

### Spark

- File:
  - `vendor/spark/spark.module.js`
- Upstream:
  - https://github.com/sparkjsdev/spark
- License:
  - MIT

This repository redistributes the bundled Spark runtime as part of the viewer build.

### Stanford 3D Scanning Repository names

- Referenced names:
  - Bunny
  - dragon
- Upstream:
  - https://graphics.stanford.edu/data/3Dscanrep/
- License / usage note:
  - The viewer's `Bunny` and `dragon` primitives are generated from official Stanford repository mesh files and converted into runtime splats. If you use the original Stanford repository data, acknowledge Stanford Computer Graphics Laboratory, keep free redistribution and research-use terms in mind, and obtain permission for commercial use as described by the repository page.

## Project license

The project's own source files are licensed under the repository `LICENSE` file unless noted otherwise.
