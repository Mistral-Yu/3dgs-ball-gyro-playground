(function () {
  let humanBlueprintApi = null;
  const loadHumanBlueprintApi = async () => {
    if (!humanBlueprintApi) {
      humanBlueprintApi = import('./human-blueprint.mjs');
    }
    return humanBlueprintApi;
  };
  const MACBETH_EXR_SOURCE_URL =
    "https://raw.githubusercontent.com/colour-science/colour-nuke/master/colour_nuke/resources/images/ColorChecker2014/sRGB_ColorChecker2014.exr";
  const STANFORD_SCAN_REPOSITORY_URL = "https://graphics.stanford.edu/data/3Dscanrep/";
  const meshPrimitiveCache = new Map();
  const meshPrimitiveDefinitionCache = new Map();

  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  const MACBETH_LINEAR_SRGB = [
    { name: "Dark Skin", linear: [0.173795, 0.078826, 0.053278] },
    { name: "Light Skin", linear: [0.560018, 0.277344, 0.211374] },
    { name: "Blue Sky", linear: [0.105262, 0.189462, 0.327258] },
    { name: "Foliage", linear: [0.105252, 0.150381, 0.052199] },
    { name: "Blue Flower", linear: [0.228946, 0.213441, 0.422734] },
    { name: "Bluish Green", linear: [0.114476, 0.507630, 0.413179] },
    { name: "Orange", linear: [0.744047, 0.201402, 0.032548] },
    { name: "Purplish Blue", linear: [0.060553, 0.102618, 0.383053] },
    { name: "Moderate Red", linear: [0.561840, 0.080835, 0.114428] },
    { name: "Purple", linear: [0.109582, 0.042489, 0.136729] },
    { name: "Yellow Green", linear: [0.329176, 0.494601, 0.048830] },
    { name: "Orange Yellow", linear: [0.767517, 0.355728, 0.025377] },
    { name: "Blue", linear: [0.022476, 0.048798, 0.281168] },
    { name: "Green", linear: [0.044434, 0.290314, 0.064476] },
    { name: "Red", linear: [0.445520, 0.036741, 0.040636] },
    { name: "Yellow", linear: [0.837117, 0.570918, 0.012717] },
    { name: "Magenta", linear: [0.523482, 0.079120, 0.286364] },
    { name: "Cyan", linear: [0.000000, 0.234350, 0.375000] },
    { name: "White 9.5", linear: [0.880061, 0.884344, 0.835094] },
    { name: "Neutral 8", linear: [0.585344, 0.593164, 0.585344] },
    { name: "Neutral 6.5", linear: [0.358357, 0.367172, 0.366175] },
    { name: "Neutral 5", linear: [0.189830, 0.191285, 0.189569] },
    { name: "Neutral 3.5", linear: [0.085938, 0.088851, 0.089840] },
    { name: "Black 2", linear: [0.031296, 0.031433, 0.032268] },
  ];

  const makeBoundsFromSplats = (THREE, splats) => {
    const bounds = new THREE.Box3();
    let padding = 0.01;
    splats.forEach((splat) => {
      bounds.expandByPoint(splat.position);
      padding = Math.max(padding, splat.scale.x, splat.scale.y, splat.scale.z);
    });
    return bounds.expandByScalar(padding);
  };

  const fibonacciDirection = (index, count) => {
    const y = 1 - ((index + 0.5) / count) * 2;
    const radial = Math.sqrt(Math.max(1 - (y * y), 0));
    const phi = index * GOLDEN_ANGLE;
    return { x: Math.cos(phi) * radial, y, z: Math.sin(phi) * radial };
  };

  const decodeBase64 = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  };

  const decodeMeshPrimitive = (key) => {
    if (meshPrimitiveCache.has(key)) {
      return meshPrimitiveCache.get(key);
    }
    const entry = window.MeshPrimitiveData?.[key];
    if (!entry) {
      throw new Error(`Missing mesh primitive data for ${key}`);
    }
    const decoded = {
      ...entry,
      faces: new Uint16Array(decodeBase64(entry.facesBase64)),
      vertices: new Float32Array(decodeBase64(entry.verticesBase64)),
    };
    meshPrimitiveCache.set(key, decoded);
    return decoded;
  };

  const createQuaternionFromFrame = (THREE, tangent, bitangent, normal) => {
    const basis = new THREE.Matrix4().makeBasis(
      tangent.clone().normalize(),
      bitangent.clone().normalize(),
      normal.clone().normalize(),
    );
    return new THREE.Quaternion().setFromRotationMatrix(basis).normalize();
  };

  const createMeshPrimitive = ({ THREE, key, helpers }) => {
    if (meshPrimitiveDefinitionCache.has(key)) {
      return meshPrimitiveDefinitionCache.get(key);
    }
    const meshData = decodeMeshPrimitive(key);
    const vertices = meshData.vertices;
    const faces = meshData.faces;
    const bounds = new THREE.Box3();
    for (let index = 0; index < vertices.length; index += 3) {
      bounds.expandByPoint(new THREE.Vector3(vertices[index], vertices[index + 1], vertices[index + 2]));
    }
    const centerOffset = bounds.getCenter(new THREE.Vector3());
    const splats = [];
    const vertexCount = vertices.length / 3;
    const vertexPositions = Array.from({ length: vertexCount }, (_, index) => new THREE.Vector3(
      vertices[index * 3],
      vertices[(index * 3) + 1],
      vertices[(index * 3) + 2],
    ).sub(centerOffset));
    let minScale = Number.POSITIVE_INFINITY;
    let maxScale = 0;
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const edgeA = new THREE.Vector3();
    const edgeB = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const bitangent = new THREE.Vector3();
    const centroid = new THREE.Vector3();
    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 3) {
      const a = faces[faceIndex];
      const b = faces[faceIndex + 1];
      const c = faces[faceIndex + 2];
      v0.copy(vertexPositions[a]);
      v1.copy(vertexPositions[b]);
      v2.copy(vertexPositions[c]);
      edgeA.subVectors(v1, v0);
      edgeB.subVectors(v2, v0);
      normal.crossVectors(edgeA, edgeB);
      const area2 = normal.length();
      if (area2 < 1e-9) {
        continue;
      }
      normal.normalize();
      tangent.copy(edgeA);
      if (tangent.lengthSq() < 1e-9) {
        tangent.subVectors(v2, v0);
      }
      tangent.projectOnPlane(normal).normalize();
      if (tangent.lengthSq() < 1e-9) {
        tangent.set(Math.abs(normal.y) < 0.95 ? 0 : 1, Math.abs(normal.y) < 0.95 ? 1 : 0, 0);
        tangent.projectOnPlane(normal).normalize();
      }
      if (tangent.lengthSq() < 1e-9) {
        tangent.set(1, 0, 0);
      }
      bitangent.crossVectors(normal, tangent).normalize();
      centroid.copy(v0).add(v1).add(v2).multiplyScalar(1 / 3);

      let tangentMin = Number.POSITIVE_INFINITY;
      let tangentMax = Number.NEGATIVE_INFINITY;
      let bitangentMin = Number.POSITIVE_INFINITY;
      let bitangentMax = Number.NEGATIVE_INFINITY;
      [v0, v1, v2].forEach((vertex) => {
        const delta = vertex.clone().sub(centroid);
        const tangentDot = delta.dot(tangent);
        const bitangentDot = delta.dot(bitangent);
        tangentMin = Math.min(tangentMin, tangentDot);
        tangentMax = Math.max(tangentMax, tangentDot);
        bitangentMin = Math.min(bitangentMin, bitangentDot);
        bitangentMax = Math.max(bitangentMax, bitangentDot);
      });
      const scaleX = Math.max((tangentMax - tangentMin) * 0.78, 0.0008);
      const scaleY = Math.max((bitangentMax - bitangentMin) * 0.78, 0.0008);
      const scaleZ = Math.max(Math.sqrt(area2 * 0.5) * 0.08, 0.0004);
      const normalColor = new THREE.Color(
        (normal.x * 0.5) + 0.5,
        (normal.y * 0.5) + 0.5,
        (normal.z * 0.5) + 0.5,
      );
      minScale = Math.min(minScale, scaleX, scaleY, scaleZ);
      maxScale = Math.max(maxScale, scaleX, scaleY, scaleZ);
      splats.push({
        alpha: 1,
        color: normalColor,
        normal: normal.clone(),
        position: centroid.clone(),
        quaternion: createQuaternionFromFrame(THREE, tangent, bitangent, normal),
        scale: new THREE.Vector3(scaleX, scaleY, scaleZ),
      });
    }
    const definition = {
      compression: "Official mesh converted to runtime splats",
      compressionRatio: "-",
      defaultSettings: {
        falloff: 1,
        opacity: 1,
      },
      encoding: `Runtime-authored SH0 face splats from ${meshData.meshName}`,
      format: "PLY",
      localBounds: makeBoundsFromSplats(THREE, splats),
      name: `Primitive ${meshData.label}`,
      packedCapacity: "-",
      scaleRange: helpers.formatScaleRange(minScale, maxScale),
      shDegree: 0,
      source: `Generated from official Stanford mesh archive: ${meshData.sourceUrl}`,
      splats,
    };
    meshPrimitiveDefinitionCache.set(key, definition);
    return definition;
  };

  const pushEllipsoidSplats = ({
    THREE,
    alpha = 0.94,
    center,
    color,
    count,
    helpers,
    radii,
    rotation = new THREE.Quaternion(),
    scaleMajor,
    scaleMinor,
    splats,
  }) => {
    const centerVector = center.clone ? center.clone() : new THREE.Vector3(...center);
    const radiusVector = radii.clone ? radii.clone() : new THREE.Vector3(...radii);
    const colorObject = color.clone ? color.clone() : new THREE.Color(...color);
    const rotationQuat = rotation.clone ? rotation.clone() : new THREE.Quaternion();
    const major = scaleMajor ?? (Math.max(radiusVector.x, radiusVector.y, radiusVector.z) / Math.sqrt(count) * 2.4);
    const minor = scaleMinor ?? Math.max(major * 0.35, 0.01);
    for (let index = 0; index < count; index += 1) {
      const direction = fibonacciDirection(index, count);
      const unitDirection = new THREE.Vector3(direction.x, direction.y, direction.z);
      const offset = new THREE.Vector3(
        unitDirection.x * radiusVector.x,
        unitDirection.y * radiusVector.y,
        unitDirection.z * radiusVector.z,
      ).applyQuaternion(rotationQuat);
      const normal = new THREE.Vector3(
        unitDirection.x / Math.max(radiusVector.x, 0.0001),
        unitDirection.y / Math.max(radiusVector.y, 0.0001),
        unitDirection.z / Math.max(radiusVector.z, 0.0001),
      ).normalize().applyQuaternion(rotationQuat).normalize();
      splats.push({
        alpha,
        color: colorObject.clone(),
        normal,
        position: centerVector.clone().add(offset),
        quaternion: helpers.createQuaternionFromNormal(normal),
        scale: new THREE.Vector3(major, major, minor),
      });
    }
  };

  const pushTubeSplats = ({
    THREE,
    alpha = 0.93,
    color,
    helpers,
    path,
    radialSteps,
    radiusAt,
    segments,
    splats,
  }) => {
    const colorObject = color.clone ? color.clone() : new THREE.Color(...color);
    for (let segment = 0; segment < segments; segment += 1) {
      const t = (segment + 0.5) / segments;
      const center = path(t);
      const prev = path(Math.max(t - 0.01, 0));
      const next = path(Math.min(t + 0.01, 1));
      const tangent = next.clone().sub(prev).normalize();
      const reference = Math.abs(tangent.y) < 0.92
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, reference).normalize();
      const normalAxis = new THREE.Vector3().crossVectors(binormal, tangent).normalize();
      const radius = radiusAt(t);
      for (let radial = 0; radial < radialSteps; radial += 1) {
        const angle = (radial / radialSteps) * Math.PI * 2;
        const normal = normalAxis.clone()
          .multiplyScalar(Math.cos(angle))
          .add(binormal.clone().multiplyScalar(Math.sin(angle)))
          .normalize();
        splats.push({
          alpha,
          color: colorObject.clone(),
          normal,
          position: center.clone().addScaledVector(normal, radius),
          quaternion: helpers.createQuaternionFromNormal(normal),
          scale: new THREE.Vector3(radius * 0.58, radius * 0.58, Math.max(radius * 0.15, 0.012)),
        });
      }
    }
  };

  const createSpherePrimitive = ({ THREE, helpers }) => {
    const radius = 1;
    const splatCount = 720;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const splats = [];
    for (let index = 0; index < splatCount; index += 1) {
      const y = 1 - ((index + 0.5) / splatCount) * 2;
      const radial = Math.sqrt(Math.max(1 - (y * y), 0));
      const phi = index * goldenAngle;
      const normal = new THREE.Vector3(
        Math.cos(phi) * radial,
        y,
        Math.sin(phi) * radial,
      ).normalize();
      const position = normal.clone().multiplyScalar(radius);
      const color = new THREE.Color(
        normal.x * 0.5 + 0.5,
        normal.y * 0.5 + 0.5,
        normal.z * 0.5 + 0.5,
      );
      splats.push({
        alpha: 0.86,
        color,
        normal,
        position,
        quaternion: helpers.createQuaternionFromNormal(normal),
        scale: new THREE.Vector3(0.12, 0.12, 0.045),
      });
    }
    return {
      compression: "Procedural binary PLY",
      compressionRatio: "-",
      defaultSettings: {
        falloff: 1,
        opacity: 1,
      },
      encoding: "Runtime-authored SH0 surface splats",
      format: "PLY",
      localBounds: new THREE.Box3(
        new THREE.Vector3(-radius, -radius, -radius),
        new THREE.Vector3(radius, radius, radius),
      ),
      name: "Primitive Sphere",
      packedCapacity: "-",
      scaleRange: helpers.formatScaleRange(0.045, 0.12),
      shDegree: 0,
      source: "Generated primitive",
      splats,
    };
  };

  const createCubePrimitive = ({ THREE, helpers }) => {
    const halfExtent = 1;
    const steps = 18;
    const splats = [];
    const faceDefs = [
      { axis: "x", sign: -1, normal: new THREE.Vector3(-1, 0, 0) },
      { axis: "x", sign: 1, normal: new THREE.Vector3(1, 0, 0) },
      { axis: "y", sign: -1, normal: new THREE.Vector3(0, -1, 0) },
      { axis: "y", sign: 1, normal: new THREE.Vector3(0, 1, 0) },
      { axis: "z", sign: -1, normal: new THREE.Vector3(0, 0, -1) },
      { axis: "z", sign: 1, normal: new THREE.Vector3(0, 0, 1) },
    ];
    faceDefs.forEach(({ axis, normal, sign }) => {
      for (let row = 0; row < steps; row += 1) {
        for (let column = 0; column < steps; column += 1) {
          const a = ((column + 0.5) / steps) * 2 - 1;
          const b = ((row + 0.5) / steps) * 2 - 1;
          const position = new THREE.Vector3();
          if (axis === "x") {
            position.set(sign * halfExtent, a * halfExtent, b * halfExtent);
          } else if (axis === "y") {
            position.set(a * halfExtent, sign * halfExtent, b * halfExtent);
          } else {
            position.set(a * halfExtent, b * halfExtent, sign * halfExtent);
          }
          const color = new THREE.Color(
            position.x * 0.25 + 0.5,
            position.y * 0.25 + 0.5,
            position.z * 0.25 + 0.5,
          );
          splats.push({
            alpha: 0.9,
            color,
            normal: normal.clone(),
            position,
            quaternion: helpers.createQuaternionFromNormal(normal),
            scale: new THREE.Vector3(0.11, 0.11, 0.04),
          });
        }
      }
    });
    return {
      compression: "Procedural binary PLY",
      compressionRatio: "-",
      defaultSettings: {
        falloff: 1,
        opacity: 1,
      },
      encoding: "Runtime-authored SH0 surface splats",
      format: "PLY",
      localBounds: new THREE.Box3(
        new THREE.Vector3(-halfExtent, -halfExtent, -halfExtent),
        new THREE.Vector3(halfExtent, halfExtent, halfExtent),
      ),
      name: "Primitive Cube",
      packedCapacity: "-",
      scaleRange: helpers.formatScaleRange(0.04, 0.11),
      shDegree: 0,
      source: "Generated primitive",
      splats,
    };
  };

  const createMacbethPrimitive = ({ THREE, helpers }) => {
    const patchColumns = 6;
    const patchRows = 4;
    const patchStep = 0.22;
    const patchGap = 0.03;
    const patchSubdivisions = 3;
    const patchLayerOffsets = [-0.0025, 0.0025];
    const patchCoverage = 0.82;
    const boardWidth = (patchColumns * patchStep) + ((patchColumns - 1) * patchGap);
    const boardHeight = (patchRows * patchStep) + ((patchRows - 1) * patchGap);
    const boardOrigin = new THREE.Vector3(-boardWidth / 2, boardHeight / 2, 0);
    const boardNormal = new THREE.Vector3(0, 0, 1);
    const boardQuat = helpers.createQuaternionFromNormal(boardNormal);
    const splats = [];
    const hoverEntries = [];
    MACBETH_LINEAR_SRGB.forEach((patch, index) => {
      const column = index % patchColumns;
      const row = Math.floor(index / patchColumns);
      const color = new THREE.Color(...patch.linear);
      const patchX = boardOrigin.x + (column * (patchStep + patchGap));
      const patchY = boardOrigin.y - (row * (patchStep + patchGap));
      const position = new THREE.Vector3(
        patchX + (patchStep * 0.5),
        patchY - (patchStep * 0.5),
        0,
      );
      const scale = new THREE.Vector3(
        (patchStep * patchCoverage) / patchSubdivisions,
        (patchStep * patchCoverage) / patchSubdivisions,
        0.005,
      );
      const alpha = 0.6;
      const localStep = patchStep / patchSubdivisions;
      patchLayerOffsets.forEach((layerOffset) => {
        for (let subRow = 0; subRow < patchSubdivisions; subRow += 1) {
          for (let subColumn = 0; subColumn < patchSubdivisions; subColumn += 1) {
            const subPosition = new THREE.Vector3(
              patchX + ((subColumn + 0.5) * localStep),
              patchY - ((subRow + 0.5) * localStep),
              layerOffset,
            );
            splats.push({
              alpha,
              color: color.clone(),
              normal: boardNormal.clone(),
              position: subPosition,
              quaternion: boardQuat.clone(),
              scale: scale.clone(),
            });
          }
        }
      });
      hoverEntries.push({
        alpha: 1,
        color: patch.linear.slice(),
        label: patch.name,
        position: [position.x, position.y, position.z],
        scale: [patchStep * 0.5, patchStep * 0.5, 0.01],
      });
    });
    return {
      compression: "Procedural binary PLY",
      compressionRatio: "-",
      defaultSettings: {
        falloff: 1.1,
        opacity: 1,
      },
      encoding: "Runtime-authored SH0 Macbeth ColorChecker with layered patch splats (linear sRGB floats from EXR patches)",
      format: "PLY",
      localBounds: new THREE.Box3(
        new THREE.Vector3(-boardWidth / 2, -boardHeight / 2, -0.02),
        new THREE.Vector3(boardWidth / 2, boardHeight / 2, 0.02),
      ),
      name: "Primitive Macbeth",
      packedCapacity: "-",
      scaleRange: helpers.formatScaleRange(0.005, (patchStep * patchCoverage) / patchSubdivisions),
      shDegree: 0,
      source: "Generated primitive",
      hoverEntries,
      splats,
    };
  };

  const createHumanPrimitive = async ({ THREE, helpers }) => {
    const { HUMAN_HEIGHT_METERS, createHumanBlueprint } = await loadHumanBlueprintApi();
    const blueprint = createHumanBlueprint({ heightMeters: HUMAN_HEIGHT_METERS });
    const splats = [];
    const hoverEntries = [];

    blueprint.parts.forEach((part) => {
      if (part.kind === 'ellipsoid') {
        pushEllipsoidSplats({
          THREE,
          alpha: part.alpha,
          center: new THREE.Vector3(...part.center),
          color: new THREE.Color(...part.color),
          count: part.count,
          helpers,
          radii: new THREE.Vector3(...part.radii),
          scaleMajor: part.scaleMajor,
          scaleMinor: part.scaleMinor,
          splats,
        });
      } else if (part.kind === 'tube') {
        const points = part.path.map((coords) => new THREE.Vector3(...coords));
        pushTubeSplats({
          THREE,
          alpha: part.alpha,
          color: new THREE.Color(...part.color),
          helpers,
          path: (t) => {
            const clampedT = Math.min(Math.max(t, 0), 1);
            if (points.length === 1) {
              return points[0].clone();
            }
            const segmentPosition = clampedT * (points.length - 1);
            const segmentIndex = Math.min(Math.floor(segmentPosition), points.length - 2);
            const localT = segmentPosition - segmentIndex;
            return points[segmentIndex].clone().lerp(points[segmentIndex + 1], localT);
          },
          radialSteps: part.radialSteps,
          radiusAt: () => part.radius,
          segments: part.segments,
          splats,
        });
      }
      hoverEntries.push({
        alpha: part.alpha,
        color: part.color.slice(),
        label: part.label,
        position: part.center ? part.center.slice() : part.path[Math.floor(part.path.length / 2)].slice(),
        scale: part.radii ? part.radii.slice() : [part.radius * 1.4, part.radius * 1.4, part.radius * 1.4],
      });
    });

    const bounds = new THREE.Box3(
      new THREE.Vector3(blueprint.bounds.min.x, blueprint.bounds.min.y, blueprint.bounds.min.z),
      new THREE.Vector3(blueprint.bounds.max.x, blueprint.bounds.max.y, blueprint.bounds.max.z),
    );
    return {
      compression: 'Procedural binary PLY',
      compressionRatio: '-',
      defaultSettings: {
        falloff: 1,
        opacity: 1,
      },
      encoding: 'Runtime-authored SH0 human reference primitive',
      format: 'PLY',
      hoverEntries,
      localBounds: bounds,
      name: `Primitive ${blueprint.label}`,
      packedCapacity: '-',
      scaleRange: helpers.formatScaleRange(0.015, 0.06),
      shDegree: 0,
      source: 'Generated primitive',
      splats,
    };
  };

  const createPrimitiveDefinition = async ({ kind, THREE, helpers }) => {
    if (kind === 'cube') {
      return createCubePrimitive({ THREE, helpers });
    }
    if (kind === 'macbeth') {
      return createMacbethPrimitive({ THREE, helpers });
    }
    if (kind === 'bunny') {
      return createMeshPrimitive({ THREE, helpers, key: 'bunny' });
    }
    if (kind === 'dragon') {
      return createMeshPrimitive({ THREE, helpers, key: 'dragon' });
    }
    if (kind === 'human-1p8m') {
      return createHumanPrimitive({ THREE, helpers });
    }
    return createSpherePrimitive({ THREE, helpers });
  };

  window.PrimitiveLibrary = {
    MACBETH_EXR_SOURCE_URL,
    MACBETH_LINEAR_SRGB,
    STANFORD_SCAN_REPOSITORY_URL,
    createPrimitiveDefinition,
  };
})();
