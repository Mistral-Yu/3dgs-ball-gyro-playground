import * as THREE from "./vendor/three/three.module.js";
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "./vendor/three/examples/jsm/controls/TransformControls.js";
import * as Spark from "./vendor/spark/spark.module.js";
import { computeLayoutMode, computePanelWidths, computeShellSize, computeUiScale } from "./viewer-layout.mjs";
import { buildLodChipLabel, buildLodInfoLabel, buildSplatMeshLoadOptions, detectLodAvailability } from "./viewer-lod.mjs";
import {
  applyToneCurveToLinearRgb,
  buildToneCurveSvgPathData,
  buildToneCurveState,
  findNearestRemovableToneCurvePointIndex,
  getSelectedToneCurvePoint,
  insertToneCurvePoint,
  isNeutralToneCurve,
  normalizeToneCurveState,
  removeToneCurvePoint,
  sampleToneCurveChannel,
  setToneCurveActiveChannel,
  setToneCurveSelectedPoint,
  summarizeToneCurve,
  updateToneCurvePoint,
} from "./viewer-tone-curve.mjs";
import {
  createAnimationModifierFromScript,
  DEFAULT_ANIMATION_SCRIPT_NAME,
  buildAnimationDownloadName,
  canPlayAnimation,
  createDefaultAnimationPlaybackState,
  getAnimationPresetScriptText,
  parseAnimationScript,
  serializeAnimationScript,
  shouldRenderAnimationFrame,
} from "./viewer-animation.mjs";
import { DEFAULT_LIGHT_COLOR, DEFAULT_LIGHT_HELPER_SCALE, clampLightColor, createDefaultLightState } from "./viewer-lighting.mjs";
import { DEFAULT_GAME_CONFIG, createDefaultGameState, createDefaultStage, resetGameState, stepGameState } from "./ball-game.mjs";
import { DEFAULT_MOTION_CONFIG, buildGravityVector, calibrateMotionState, createMotionState, updateMotionState } from "./motion-controls.mjs";
import { createGameplayHudModel } from "./game-ui-state.mjs";

function startSparkViewer() {
    const {
      SparkRenderer,
      SplatMesh,
      SplatFileType,
      dyno,
      unpackSplat,
    } = Spark;
    const DEFAULT_LOOK = new THREE.Vector3(0, 0, -1);
    const DEFAULT_FIT = new THREE.Vector3(1.05, 0.68, 1.2).normalize();
    const DEPTH_RANGE_DEFAULT = 10;
    const FOCAL_LENGTH_LIMITS = { min: 5, max: 400 };
    const FOCAL_LENGTH_COMMON_LIMIT = 135;
    const FOCAL_LENGTH_SLIDER_LIMITS = { min: 0, max: 1000 };
    const FOCAL_LENGTH_COMMON_WEIGHT = 0.8;
    const MOVE_SPEED_LIMITS = { min: 0.01, max: 100 };
    const OPACITY_LIMITS = { min: 0, max: 8 };
    const TONE_CURVE_POINT_LIMITS = { min: 0, max: 1 };
    const FALLOFF_LIMITS = { min: 0, max: 8 };
    const EXPOSURE_LIMITS = { min: -6, max: 6 };
    const POSITION_RANGE_LIMITS = { min: 0.05, max: 8 };
    const RENDER_FPS_LIMITS = { min: 1, max: 240 };
    const INTERACTION_PREVIEW_FPS = 12;
    const INTERACTION_PREVIEW_MS = 180;
    const INTERACTION_SETTLE_MS = 140;
    const SCALE_LIMITS = { min: 0.001, max: 1000 };
    const LIGHT_INTENSITY_LIMITS = { min: 0, max: 100000 };
    const LIGHT_HELPER_SCALE_LIMITS = { min: 0.1, max: 8 };
    const LIGHT_POSITION_LIMITS = { min: -100000, max: 100000 };
    const LIGHT_HELPER_COLOR = "#fff1b5";
    const LIGHT_COLOR_COMPONENT_LIMITS = { min: 0, max: 1 };
    const LIGHT_OCCLUDER_LIMIT = 96;
    const TRANSLATE_LIMITS = { min: -100000, max: 100000 };
    const FPS_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ShiftLeft", "ShiftRight"]);
    const BACKGROUNDS = {
      dawn: "#efe6d7",
      graphite: "#061019",
      museum: "#17110f",
      studio: "#d7dde8",
    };
    const QUALITY = {
      balanced: { label: "Balanced", maxPixelRatio: 1.4, maxStdDev: Math.sqrt(8) },
      fast: { label: "Fast", maxPixelRatio: 1.0, maxStdDev: Math.sqrt(6) },
      sharp: { label: "Sharp", maxPixelRatio: 1.85, maxStdDev: Math.sqrt(9) },
    };
    const CAMERA_MODE_TEXT = {
      orbit: "Orbit mode: left drag rotates, right drag or Shift + left drag pans, wheel zooms, and WASD/QE moves the camera.",
      fps: "First-person: left drag looks, right drag pans in screen space, wheel moves forward or backward, WASD moves, Q/E moves vertically, Shift boosts speed.",
    };
    const RENDER_MODE_LABELS = {
      beauty: "Beauty",
      depth: "Depth",
      position: "Position",
      worldNormal: "World Normal",
    };
    const COMPRESSION_LABELS = {
      ksplat: "K-SPLAT compressed",
      ply: "Uncompressed PLY",
      splat: "Packed SPLAT",
      spz: "SPZ compressed",
    };
    const ANIMATION_PRESET_LABELS = {
      explosion: "Splat Explosion",
      reveal: "Splat Reveal",
    };
    const ANIMATION_PARAM_LIMITS = {
      distanceScale: { min: 0, max: 6 },
      opacityPower: { min: 0.1, max: 4 },
      scaleInfluence: { min: 0, max: 4 },
      speed: { min: 0.05, max: 8 },
      strength: { min: 0, max: 12 },
      swirl: { min: 0, max: 6 },
    };
    const dom = {
      backgroundSelect: document.getElementById("background-select"),
      cameraChip: document.getElementById("camera-chip"),
      clearPickedColorsButton: document.getElementById("clear-picked-colors-button"),
      clearSceneButton: document.getElementById("clear-scene-button"),
      colorspaceChip: document.getElementById("colorspace-chip"),
      lodAutoCheckbox: document.getElementById("lod-auto-checkbox"),
      lodChip: document.getElementById("lod-chip"),
      depthRangeField: document.getElementById("depth-range-field"),
      depthRangeInput: document.getElementById("depth-range-input"),
      depthRangeLabel: document.getElementById("normalize-range-label"),
      depthRangeRange: document.getElementById("depth-range-range"),
      dropOverlay: document.getElementById("drop-overlay"),
      emptyState: document.getElementById("empty-state"),
      exposureInput: document.getElementById("exposure-input"),
      exposureRange: document.getElementById("exposure-range"),
      toneCurveAddPointButton: document.getElementById("tone-curve-add-point-button"),
      toneCurveChannelSelect: document.getElementById("tone-curve-channel-select"),
      toneCurveGraph: document.getElementById("tone-curve-graph"),
      toneCurvePointList: document.getElementById("tone-curve-point-list"),
      toneCurvePointXInput: document.getElementById("tone-curve-point-x-input"),
      toneCurvePointYInput: document.getElementById("tone-curve-point-y-input"),
      toneCurveRemovePointButton: document.getElementById("tone-curve-remove-point-button"),
      exportDisableAllButton: document.getElementById("export-disable-all-button"),
      exportEmpty: document.getElementById("export-empty"),
      exportEnableAllButton: document.getElementById("export-enable-all-button"),
      exportFalloffCheckbox: document.getElementById("export-falloff-checkbox"),
      exportList: document.getElementById("export-list"),
      exportOpacityCheckbox: document.getElementById("export-opacity-checkbox"),
      exportShCheckbox: document.getElementById("export-sh-checkbox"),
      falloffInput: document.getElementById("falloff-input"),
      falloffRange: document.getElementById("falloff-range"),
      fileInput: document.getElementById("file-input"),
      fitViewButton: document.getElementById("fit-view-button"),
      fpsChip: document.getElementById("fps-chip"),
      focalLengthInput: document.getElementById("focal-length-input"),
      focalLengthRange: document.getElementById("focal-length-range"),
      gridChip: document.getElementById("grid-chip"),
      gridScaleInput: document.getElementById("grid-scale-input"),
      gridScaleSelect: document.getElementById("grid-scale-select"),
      hoverChip: document.getElementById("hover-chip"),
      hoverChipColor: document.getElementById("hover-chip-color"),
      hoverChipItem: document.getElementById("hover-chip-item"),
      gizmoRotateButton: document.getElementById("gizmo-rotate-button"),
      gizmoScaleButton: document.getElementById("gizmo-scale-button"),
      gizmoTranslateButton: document.getElementById("gizmo-translate-button"),
      infoBounds: document.getElementById("info-bounds"),
      infoAutoLod: document.getElementById("info-auto-lod"),
      infoCenter: document.getElementById("info-center"),
      infoCompression: document.getElementById("info-compression"),
      infoCompressionRatio: document.getElementById("info-compression-ratio"),
      infoEncoding: document.getElementById("info-encoding"),
      infoFormat: document.getElementById("info-format"),
      infoItemName: document.getElementById("info-item-name"),
      infoLoadTime: document.getElementById("info-load-time"),
      infoLoadMode: document.getElementById("info-load-mode"),
      infoName: document.getElementById("info-name"),
      infoPackedCapacity: document.getElementById("info-packed-capacity"),
      infoScaleRange: document.getElementById("info-scale-range"),
      infoShActive: document.getElementById("info-sh-active"),
      infoShDegree: document.getElementById("info-sh-degree"),
      infoSize: document.getElementById("info-size"),
      infoSource: document.getElementById("info-source"),
      infoSplats: document.getElementById("info-splats"),
      lightControlsSection: document.getElementById("light-controls-section"),
      lightEmpty: document.getElementById("light-empty"),
      lightGizmoButton: document.getElementById("light-gizmo-button"),
      lightHelperScaleInput: document.getElementById("light-helper-scale-input"),
      lightHelperScaleRange: document.getElementById("light-helper-scale-range"),
      lightIntensityInput: document.getElementById("light-intensity-input"),
      lightIntensityRange: document.getElementById("light-intensity-range"),
      lightList: document.getElementById("light-list"),
      lightName: document.getElementById("light-name"),
      lightRInput: document.getElementById("light-r-input"),
      lightGInput: document.getElementById("light-g-input"),
      lightBInput: document.getElementById("light-b-input"),
      lightXInput: document.getElementById("light-x-input"),
      lightYInput: document.getElementById("light-y-input"),
      lightZInput: document.getElementById("light-z-input"),
      lensChip: document.getElementById("lens-chip"),
      addPointLightButton: document.getElementById("add-point-light-button"),
      addPrimitiveButton: document.getElementById("add-primitive-button"),
      animationApplyButton: document.getElementById("animation-apply-button"),
      animationCopyDefaultButton: document.getElementById("animation-copy-default-button"),
      animationFileInput: document.getElementById("animation-file-input"),
      animationLoadPresetButton: document.getElementById("animation-load-preset-button"),
      animationLoopCheckbox: document.getElementById("animation-loop-checkbox"),
      animationOpenButton: document.getElementById("animation-open-button"),
      animationOriginModeSelect: document.getElementById("animation-origin-mode-select"),
      animationOriginXInput: document.getElementById("animation-origin-x-input"),
      animationOriginYInput: document.getElementById("animation-origin-y-input"),
      animationOriginZInput: document.getElementById("animation-origin-z-input"),
      animationPauseButton: document.getElementById("animation-pause-button"),
      animationPlayButton: document.getElementById("animation-play-button"),
      animationPresetSelect: document.getElementById("animation-preset-select"),
      animationResetButton: document.getElementById("animation-reset-button"),
      animationSaveButton: document.getElementById("animation-save-button"),
      animationScriptEditor: document.getElementById("animation-script-editor"),
      animationScriptStatus: document.getElementById("animation-script-status"),
      animationTimeLabel: document.getElementById("animation-time-label"),
      animationTimeRange: document.getElementById("animation-time-range"),
      primitiveSelect: document.getElementById("primitive-select"),
      modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
      modeDescription: document.getElementById("mode-description"),
      moveSpeedInput: document.getElementById("move-speed-input"),
      moveSpeedRange: document.getElementById("move-speed-range"),
      openFileButton: document.getElementById("open-file-button"),
      opacityInput: document.getElementById("opacity-input"),
      opacityRange: document.getElementById("opacity-range"),
      pickColorButton: document.getElementById("pick-color-button"),
      pickedColorsEmpty: document.getElementById("picked-colors-empty"),
      pickedColorsList: document.getElementById("picked-colors-list"),
      progressFill: document.getElementById("progress-fill"),
      progressLabel: document.getElementById("progress-label"),
      progressTrack: document.getElementById("progress-track"),
      qualitySelect: document.getElementById("quality-select"),
      renderModeSelect: document.getElementById("render-mode-select"),
      renderFpsInput: document.getElementById("render-fps-input"),
      resetRotationButton: document.getElementById("reset-rotation-button"),
      resetViewButton: document.getElementById("reset-view-button"),
      saveSceneSplatsButton: document.getElementById("save-scene-splats-button"),
      selectedExposureInput: document.getElementById("selected-exposure-input"),
      selectedExposureRange: document.getElementById("selected-exposure-range"),
      sceneEmpty: document.getElementById("scene-empty"),
      sceneLimitInput: document.getElementById("scene-limit-input"),
      sceneLimitRange: document.getElementById("scene-limit-range"),
      sceneList: document.getElementById("scene-list"),
      sceneRenderSection: document.getElementById("scene-render-section"),
      sceneSelectInput: document.getElementById("scene-select-input"),
      sceneSelectRange: document.getElementById("scene-select-range"),
      sceneTransformSection: document.getElementById("scene-transform-section"),
      inspectorPanels: Array.from(document.querySelectorAll("[data-inspector-panel]")),
      inspectorTabButtons: Array.from(document.querySelectorAll("[data-inspector-tab]")),
      rotationXInput: document.getElementById("rotation-x-input"),
      rotationYInput: document.getElementById("rotation-y-input"),
      rotationZInput: document.getElementById("rotation-z-input"),
      scaleInput: document.getElementById("scale-input"),
      translateXInput: document.getElementById("translate-x-input"),
      translateYInput: document.getElementById("translate-y-input"),
      translateZInput: document.getElementById("translate-z-input"),
      shSelect: document.getElementById("sh-select"),
      speedChip: document.getElementById("speed-chip"),
      stage: document.getElementById("viewer-stage"),
      gameUi: document.getElementById("game-ui"),
      gameStatusText: document.getElementById("game-status-text"),
      gameTimerChip: document.getElementById("game-timer-chip"),
      gameModeChip: document.getElementById("game-mode-chip"),
      gameGoalChip: document.getElementById("game-goal-chip"),
      gameQualityChip: document.getElementById("game-quality-chip"),
      gamePrimaryButton: document.getElementById("game-primary-button"),
      gameEnableMotionButton: document.getElementById("game-enable-motion-button"),
      gameCalibrateButton: document.getElementById("game-calibrate-button"),
      gameResetButton: document.getElementById("game-reset-button"),
      statusLine: document.getElementById("status-line"),
      toggleAutorotateButton: document.getElementById("toggle-autorotate-button"),
      toggleAxesButton: document.getElementById("toggle-axes-button"),
      toggleBoundsButton: document.getElementById("toggle-bounds-button"),
      toggleGizmoButton: document.getElementById("toggle-gizmo-button"),
      toggleGridButton: document.getElementById("toggle-grid-button"),
    };

    const {
      Gsplat,
      abs,
      add,
      clamp,
      combineGsplat,
      cos,
      cross,
      div,
      dot = dyno.Dot,
      dynoBlock,
      dynoConst,
      dynoFloat,
      dynoVec3,
      floor,
      fract,
      gsplatNormal,
      length,
      max = dyno.Max,
      min = dyno.Min,
      mix,
      mul,
      normalize,
      pow,
      sign,
      sin,
      split,
      splitGsplat,
      step,
      sub,
    } = dyno;

    const formatBytes = (bytes) => {
      if (!Number.isFinite(bytes) || bytes <= 0) {
        return "-";
      }
      const units = ["B", "KB", "MB", "GB"];
      let value = bytes;
      let unitIndex = 0;
      while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
      }
      return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    };

    const formatVector = (vector) =>
      `${vector.x.toFixed(2)} / ${vector.y.toFixed(2)} / ${vector.z.toFixed(2)}`;

    const formatRatio = (ratio) => {
      if (!Number.isFinite(ratio) || ratio <= 0) {
        return "-";
      }
      const decimals = ratio >= 10 ? 1 : 2;
      return `~${ratio.toFixed(decimals)}x`;
    };

    const formatNumber = (value, digits = 2) => {
      if (!Number.isFinite(value)) {
        return "-";
      }
      return value.toFixed(digits);
    };

    const linearRgbToSrgb8 = (linearRgb) => {
      const color = new THREE.Color(
        Math.max(linearRgb[0] ?? 0, 0),
        Math.max(linearRgb[1] ?? 0, 0),
        Math.max(linearRgb[2] ?? 0, 0),
      ).convertLinearToSRGB();
      return [
        Math.round(THREE.MathUtils.clamp(color.r, 0, 1) * 255),
        Math.round(THREE.MathUtils.clamp(color.g, 0, 1) * 255),
        Math.round(THREE.MathUtils.clamp(color.b, 0, 1) * 255),
      ];
    };

    const formatHoverColor = (linearRgb) => {
      const [r, g, b] = linearRgbToSrgb8(linearRgb);
      return `${String(r).padStart(3, "0")}/${String(g).padStart(3, "0")}/${String(b).padStart(3, "0")}`;
    };

    const formatLinearColor = (linearRgb) =>
      linearRgb
        .map((value) => (Number.isFinite(value) ? value.toFixed(Math.abs(value) >= 10 ? 2 : 4) : "-"))
        .join(" / ");

    const formatSrgbColor = (linearRgb) => {
      const [r, g, b] = linearRgbToSrgb8(linearRgb);
      return `${String(r).padStart(3, "0")} / ${String(g).padStart(3, "0")} / ${String(b).padStart(3, "0")}`;
    };

    const toLinearRgbArray = (color) => {
      if (!color) {
        return [0, 0, 0];
      }
      if (Array.isArray(color)) {
        return [
          Number(color[0]) || 0,
          Number(color[1]) || 0,
          Number(color[2]) || 0,
        ];
      }
      return [
        Number(color.r ?? color.x ?? 0) || 0,
        Number(color.g ?? color.y ?? 0) || 0,
        Number(color.b ?? color.z ?? 0) || 0,
      ];
    };

    const clipPadText = (value, width) => {
      const text = String(value ?? "");
      if (text.length === width) {
        return text;
      }
      if (text.length > width) {
        return `${text.slice(0, Math.max(width - 1, 0))}\u2026`;
      }
      return text.padEnd(width, " ");
    };

    const formatSpeedLabel = (value) =>
      `${Number(value).toFixed(value < 10 ? 2 : 1)} u/s`;

    const formatDepthLabel = (value) =>
      `${Number(value).toFixed(value < 10 ? 1 : 0)} u`;

    const formatPositionRangeLabel = (value) =>
      `${Number(value).toFixed(value < 10 ? 2 : 1)}x`;

    const formatExposureLabel = (value) =>
      `${Number(value).toFixed(Math.abs(value) < 1 ? 1 : 2)} EV`;

    const formatScaleRange = (minValue, maxValue) =>
      Number.isFinite(minValue) && Number.isFinite(maxValue)
        ? `${formatNumber(minValue, 4)} - ${formatNumber(maxValue, 4)}`
        : "-";

    const formatShLabel = (degree) =>
      Number.isFinite(degree) && degree >= 0 ? `SH${degree}` : "-";

    const sanitizeDownloadName = (value) =>
      (String(value ?? "scene-splat")
        .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        || "scene-splat");

    const buildUniqueFileName = (baseName, extension, usedNames) => {
      const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
      const stem = sanitizeDownloadName(baseName).replace(/\.[^.]+$/, "") || "scene-splat";
      let candidate = `${stem}${normalizedExtension}`;
      if (!usedNames.has(candidate.toLowerCase())) {
        usedNames.add(candidate.toLowerCase());
        return candidate;
      }
      let serial = 2;
      while (true) {
        candidate = `${stem}_${String(serial).padStart(2, "0")}${normalizedExtension}`;
        if (!usedNames.has(candidate.toLowerCase())) {
          usedNames.add(candidate.toLowerCase());
          return candidate;
        }
        serial += 1;
      }
    };

    const createDefaultModelMeta = (name = "No file loaded", source = "Waiting for input") => ({
      activeSh: "-",
      bytes: 0,
      compression: "-",
      compressionRatio: "-",
      elapsedMs: 0,
      encoding: "-",
      format: "-",
      name,
      packedCapacity: "-",
      scaleRange: "-",
      shDegree: "-",
      source,
      splats: 0,
    });

    const isIntermediateNumericInput = (value) =>
      value === "" || value === "-" || value === "." || value === "-." || value === "+";

    const createWorldNormalModifier = () =>
      dynoBlock({ gsplat: Gsplat }, { gsplat: Gsplat }, ({ gsplat }) => {
        if (!gsplat) {
          throw new Error("No gsplat input");
        }
        const rawNormal = gsplatNormal(gsplat);
        const normal = div(rawNormal, length(rawNormal));
        const rgb = add(
          mul(normal, dynoConst("float", 0.5)),
          dynoConst("float", 0.5),
        );
        return { gsplat: combineGsplat({ gsplat, rgb }) };
      });

    const createDepthColorModifier = ({ maxDepth }, splatToView) =>
      dynoBlock({ gsplat: Gsplat }, { gsplat: Gsplat }, ({ gsplat }) => {
        if (!gsplat) {
          throw new Error("No gsplat input");
        }
        const center = splatToView.apply(splitGsplat(gsplat).outputs.center);
        const depth = clamp(
          div(length(center), maxDepth),
          dynoConst("float", 0),
          dynoConst("float", 1),
        );
        return { gsplat: combineGsplat({ gsplat, r: depth, g: depth, b: depth }) };
      });

    const createPositionColorModifier = ({ minCorner, span, scaleFactor }) =>
      dynoBlock({ gsplat: Gsplat }, { gsplat: Gsplat }, ({ gsplat }) => {
        if (!gsplat) {
          throw new Error("No gsplat input");
        }
        const center = splitGsplat(gsplat).outputs.center;
        const scaledSpan = mul(span, scaleFactor);
        const normalized = clamp(
          div(sub(center, minCorner), scaledSpan),
          dynoConst("float", 0),
          dynoConst("float", 1),
        );
        const { x: r, y: g, z: b } = split(normalized).outputs;
        return { gsplat: combineGsplat({ gsplat, r, g, b }) };
      });

    const createPointLightColorModifier = ({
      lightColorB,
      lightColorG,
      lightColorR,
      lightIntensities,
      lightPositions,
      lightCount,
    }) =>
      dynoBlock({ gsplat: Gsplat }, { gsplat: Gsplat }, ({ gsplat }) => {
        if (!gsplat) {
          throw new Error("No gsplat input");
        }
        const outputs = splitGsplat(gsplat).outputs;
        const center = outputs.center;
        const { x: rgbR, y: rgbG, z: rgbB } = split(outputs.rgb).outputs;
        const floatZero = dynoConst("float", 0);
        const floatOne = dynoConst("float", 1);
        const floatEps = dynoConst("float", 0.0001);
        let lightBoostR = floatZero;
        let lightBoostG = floatZero;
        let lightBoostB = floatZero;
        for (let lightIndex = 0; lightIndex < lightCount; lightIndex += 1) {
          const lightPosition = lightPositions[lightIndex];
          const lightIntensity = max(lightIntensities[lightIndex], floatZero);
          const lightVector = sub(center, lightPosition);
          const lightDistanceSq = max(dot(lightVector, lightVector), floatEps);
          const lightStrength = div(lightIntensity, lightDistanceSq);
          lightBoostR = add(lightBoostR, mul(lightColorR[lightIndex], lightStrength));
          lightBoostG = add(lightBoostG, mul(lightColorG[lightIndex], lightStrength));
          lightBoostB = add(lightBoostB, mul(lightColorB[lightIndex], lightStrength));
        }
        return {
          gsplat: combineGsplat({
            gsplat,
            r: mul(rgbR, add(floatOne, lightBoostR)),
            g: mul(rgbG, add(floatOne, lightBoostG)),
            b: mul(rgbB, add(floatOne, lightBoostB)),
          }),
        };
      });

    const evaluateToneCurveExpression = (value, points) => {
      const curvePoints = normalizeToneCurveState({ curves: { master: points } }).curves.master;
      const floatZero = dynoConst("float", 0);
      const floatOne = dynoConst("float", 1);
      let result = dynoConst("float", curvePoints[0]?.y ?? 0);
      curvePoints.slice(0, -1).forEach((point, index) => {
        const nextPoint = curvePoints[index + 1];
        const span = Math.max(nextPoint.x - point.x, 0.001);
        const segment = clamp(
          sub(value, dynoConst("float", point.x)),
          floatZero,
          dynoConst("float", span),
        );
        result = add(result, mul(segment, dynoConst("float", (nextPoint.y - point.y) / span)));
      });
      return clamp(result, floatZero, floatOne);
    };

    const createToneCurveColorModifier = (toneCurveState) => {
      const toneCurve = normalizeToneCurveState(toneCurveState);
      return dynoBlock({ gsplat: Gsplat }, { gsplat: Gsplat }, ({ gsplat }) => {
        if (!gsplat) {
          throw new Error("No gsplat input");
        }
        const outputs = splitGsplat(gsplat).outputs;
        const { x: rgbR, y: rgbG, z: rgbB } = split(outputs.rgb).outputs;
        const masterR = evaluateToneCurveExpression(rgbR, toneCurve.curves.master);
        const masterG = evaluateToneCurveExpression(rgbG, toneCurve.curves.master);
        const masterB = evaluateToneCurveExpression(rgbB, toneCurve.curves.master);
        return {
          gsplat: combineGsplat({
            gsplat,
            r: evaluateToneCurveExpression(masterR, toneCurve.curves.red),
            g: evaluateToneCurveExpression(masterG, toneCurve.curves.green),
            b: evaluateToneCurveExpression(masterB, toneCurve.curves.blue),
          }),
        };
      });
    };

    const getFileExtension = (name) => (name.split(".").pop() || "").toLowerCase();

    const detectSplatFileType = (name) => {
      const extension = getFileExtension(name);
      if (extension === "splat") {
        return SplatFileType?.SPLAT ?? "splat";
      }
      if (extension === "ksplat") {
        return SplatFileType?.KSPLAT ?? "ksplat";
      }
      if (extension === "spz") {
        return SplatFileType?.SPZ ?? "spz";
      }
      if (extension === "ply") {
        return SplatFileType?.PLY ?? "ply";
      }
      return undefined;
    };

    const isSupportedFile = (file) =>
      ["ksplat", "ply", "splat", "spz"].includes(getFileExtension(file.name));

    const parseRotationValue = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const clampNumber = (value, { min, max }) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return min;
      }
      return THREE.MathUtils.clamp(parsed, min, max);
    };

    const sliderToFocalLength = (sliderValue) => {
      const normalized = THREE.MathUtils.clamp(
        Number(sliderValue) / FOCAL_LENGTH_SLIDER_LIMITS.max,
        0,
        1,
      );
      if (normalized <= FOCAL_LENGTH_COMMON_WEIGHT) {
        const local = normalized / FOCAL_LENGTH_COMMON_WEIGHT;
        return THREE.MathUtils.lerp(
          FOCAL_LENGTH_LIMITS.min,
          FOCAL_LENGTH_COMMON_LIMIT,
          local,
        );
      }
      const local = (normalized - FOCAL_LENGTH_COMMON_WEIGHT) / (1 - FOCAL_LENGTH_COMMON_WEIGHT);
      return THREE.MathUtils.lerp(
        FOCAL_LENGTH_COMMON_LIMIT,
        FOCAL_LENGTH_LIMITS.max,
        local,
      );
    };

    const focalLengthToSlider = (focalLength) => {
      const clamped = THREE.MathUtils.clamp(
        Number(focalLength),
        FOCAL_LENGTH_LIMITS.min,
        FOCAL_LENGTH_LIMITS.max,
      );
      let normalized;
      if (clamped <= FOCAL_LENGTH_COMMON_LIMIT) {
        normalized = THREE.MathUtils.mapLinear(
          clamped,
          FOCAL_LENGTH_LIMITS.min,
          FOCAL_LENGTH_COMMON_LIMIT,
          0,
          FOCAL_LENGTH_COMMON_WEIGHT,
        );
      } else {
        normalized = THREE.MathUtils.mapLinear(
          clamped,
          FOCAL_LENGTH_COMMON_LIMIT,
          FOCAL_LENGTH_LIMITS.max,
          FOCAL_LENGTH_COMMON_WEIGHT,
          1,
        );
      }
      return Math.round(normalized * FOCAL_LENGTH_SLIDER_LIMITS.max);
    };

    const firstFinite = (...values) =>
      values.find((value) => Number.isFinite(value) && value >= 0);

    const inferShDegree = (mesh) =>
      THREE.MathUtils.clamp(
        firstFinite(
          mesh?.maxShDegree,
          mesh?.packedSplats?.maxShDegree,
          mesh?.packedSplats?.meta?.maxShDegree,
          mesh?.gsplatArray?.maxShDegree,
          mesh?.csplatArray?.maxShDegree,
          mesh?.packedSplats?.shDegree,
          mesh?.packedSplats?.meta?.shDegree,
          3,
        ),
        0,
        3,
      );

    const estimateRawGaussianBytes = (splats, shDegree) => {
      if (!Number.isFinite(splats) || splats <= 0) {
        return 0;
      }
      const shCoefficients = Math.max(((shDegree + 1) ** 2) - 1, 0) * 3;
      const baseBytesPerSplat = 64;
      return splats * (baseBytesPerSplat + shCoefficients * 4);
    };

    const readPlyHeaderText = (fileBytes) => {
      if (!(fileBytes instanceof ArrayBuffer) || fileBytes.byteLength === 0) {
        return "";
      }
      const prefix = new Uint8Array(fileBytes, 0, Math.min(fileBytes.byteLength, 65536));
      const text = new TextDecoder("latin1").decode(prefix);
      const headerEndMatch = text.match(/end_header\r?\n/i);
      return headerEndMatch ? text.slice(0, headerEndMatch.index + headerEndMatch[0].length) : "";
    };

    const detectPlyCompressionLabel = (fileBytes) => {
      const header = readPlyHeaderText(fileBytes).toLowerCase();
      if (!header.startsWith("ply")) {
        return COMPRESSION_LABELS.ply;
      }
      const hasChunkTable = header.includes("element chunk");
      const hasPackedFields = [
        "property uint packed_position",
        "property uint packed_rotation",
        "property uint packed_scale",
        "property uint packed_color",
      ].every((marker) => header.includes(marker));
      if (hasChunkTable && hasPackedFields) {
        return "Packed PLY (chunked)";
      }
      if (hasPackedFields) {
        return "Packed PLY";
      }
      return COMPRESSION_LABELS.ply;
    };

    const formatEncodingMeta = (encoding) => {
      if (!encoding) {
        return "RGB 0..1 / lnScale -12..9 / lodAlpha off";
      }
      const rgbMin = Number.isFinite(encoding.rgbMin) ? encoding.rgbMin : 0;
      const rgbMax = Number.isFinite(encoding.rgbMax) ? encoding.rgbMax : 1;
      const lnScaleMin = Number.isFinite(encoding.lnScaleMin) ? encoding.lnScaleMin : -12;
      const lnScaleMax = Number.isFinite(encoding.lnScaleMax) ? encoding.lnScaleMax : 9;
      const lodText = encoding.lodOpacity ? "lodAlpha on" : "lodAlpha off";
      return `RGB ${formatNumber(rgbMin, 2)}..${formatNumber(rgbMax, 2)} / lnScale ${formatNumber(lnScaleMin, 1)}..${formatNumber(lnScaleMax, 1)} / ${lodText}`;
    };

    const SH_C0 = 0.28209479177387814;

    const alphaToOpacity = (alpha) => {
      const clamped = THREE.MathUtils.clamp(alpha, 0.001, 0.999);
      return Math.log(clamped / (1 - clamped));
    };

    const colorToDc = (color) => ((THREE.MathUtils.clamp(color, 0, 1) - 0.5) / SH_C0);

    const createQuaternionFromNormal = (normal) => {
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
      return quaternion;
    };

    const sanitizePlyComment = (value) =>
      String(value ?? "")
        .replace(/[\r\n]+/g, " ")
        .replace(/[^\x20-\x7e]/g, "?")
        .trim()
        .slice(0, 240);

    const packGaussianPly = (splats, comments = []) => {
      const commentLines = comments
        .map(sanitizePlyComment)
        .filter(Boolean)
        .map((comment) => `comment ${comment}`);
      const header = [
        "ply",
        "format binary_little_endian 1.0",
        ...commentLines,
        `element vertex ${splats.length}`,
        "property float x",
        "property float y",
        "property float z",
        "property float nx",
        "property float ny",
        "property float nz",
        "property float f_dc_0",
        "property float f_dc_1",
        "property float f_dc_2",
        "property float opacity",
        "property float scale_0",
        "property float scale_1",
        "property float scale_2",
        "property float rot_0",
        "property float rot_1",
        "property float rot_2",
        "property float rot_3",
        "end_header\n",
      ].join("\n");
      const headerBytes = new TextEncoder().encode(header);
      const buffer = new ArrayBuffer(headerBytes.byteLength + (splats.length * 17 * 4));
      const bytes = new Uint8Array(buffer);
      bytes.set(headerBytes, 0);
      const view = new DataView(buffer, headerBytes.byteLength);
      splats.forEach((splat, index) => {
        const offset = index * 17 * 4;
        const values = [
          splat.position.x,
          splat.position.y,
          splat.position.z,
          splat.normal.x,
          splat.normal.y,
          splat.normal.z,
          colorToDc(splat.color.r),
          colorToDc(splat.color.g),
          colorToDc(splat.color.b),
          alphaToOpacity(splat.alpha),
          Math.log(splat.scale.x),
          Math.log(splat.scale.y),
          Math.log(splat.scale.z),
          splat.quaternion.w,
          splat.quaternion.x,
          splat.quaternion.y,
          splat.quaternion.z,
        ];
        values.forEach((value, valueIndex) => {
          view.setFloat32(offset + (valueIndex * 4), value, true);
        });
      });
      return buffer;
    };

    const createPrimitiveSpec = async (kind) => {
      if (!window.PrimitiveLibrary?.createPrimitiveDefinition) {
        throw new Error("Primitive library failed to load");
      }
      const definition = await window.PrimitiveLibrary.createPrimitiveDefinition({
        kind,
        THREE,
        helpers: {
          createQuaternionFromNormal,
          formatScaleRange,
        },
      });
      const hoverEntries = definition.hoverEntries?.map((entry) => ({
        alpha: entry.alpha,
        color: entry.color.slice(),
        label: entry.label || "",
        position: new THREE.Vector3(...entry.position),
        scale: new THREE.Vector3(...entry.scale),
      })) ?? definition.splats.map((splat, index) => ({
        alpha: splat.alpha,
        color: [splat.color.r, splat.color.g, splat.color.b],
        label: `${definition.name} ${index + 1}`,
        position: splat.position.clone(),
        scale: splat.scale.clone(),
      }));
      return {
        ...definition,
        bytes: definition.splats.length * 17 * 4,
        buffer: packGaussianPly(definition.splats),
        hoverEntries,
        splatDefinitions: definition.splats,
        splats: definition.splats.length,
      };
    };

    const createGameplayPrimitiveSpec = async ({
      alpha = null,
      colorHex = null,
      kind = "sphere",
      radius = 1,
    } = {}) => {
      const definition = await createPrimitiveSpec(kind);
      const scaledRadius = Math.max(Number(radius) || 1, 0.01);
      const overrideAlpha = Number.isFinite(alpha) ? alpha : null;
      const overrideColor = colorHex == null ? null : new THREE.Color(colorHex);
      const scaleVector = new THREE.Vector3(scaledRadius, scaledRadius, scaledRadius);
      const splats = definition.splatDefinitions.map((splat) => ({
        ...splat,
        alpha: overrideAlpha ?? splat.alpha,
        color: overrideColor ? overrideColor.clone() : splat.color.clone(),
        position: splat.position.clone().multiply(scaleVector),
        scale: splat.scale.clone().multiplyScalar(scaledRadius),
      }));
      const localBounds = definition.localBounds.clone();
      localBounds.min.multiply(scaleVector);
      localBounds.max.multiply(scaleVector);
      return {
        ...definition,
        localBounds,
        name: `Gameplay ${definition.name}`,
        scaleRange: formatScaleRange(
          Math.max(scaledRadius * 0.045, 0.001),
          Math.max(scaledRadius * 0.12, 0.001),
        ),
        splats,
        bytes: splats.length * 17 * 4,
        buffer: packGaussianPly(splats),
        hoverEntries: definition.hoverEntries?.map((entry) => ({
          ...entry,
          color: overrideColor ? [overrideColor.r, overrideColor.g, overrideColor.b] : entry.color.slice(),
          position: entry.position.clone().multiply(scaleVector),
          scale: entry.scale.clone().multiplyScalar(scaledRadius),
        })) ?? null,
      };
    };

    const getBoxCorners = (box) => {
      if (!box) {
        return [];
      }
      const { min, max } = box;
      return [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z),
      ];
    };

    const computeCenterBounds = (mesh, fallbackBounds) => {
      const packedSplats = mesh?.packedSplats;
      if (packedSplats?.forEachSplat) {
        try {
          const bounds = new THREE.Box3();
          let hasPoint = false;
          packedSplats.forEachSplat((splat) => {
            const center = splat?.center ?? splat?.position;
            if (!center) {
              return;
            }
            const point = new THREE.Vector3(center.x, center.y, center.z);
            if (!hasPoint) {
              bounds.min.copy(point);
              bounds.max.copy(point);
              hasPoint = true;
              return;
            }
            bounds.expandByPoint(point);
          });
          if (hasPoint) {
            return bounds;
          }
        } catch {
          return fallbackBounds.clone();
        }
      }
      return fallbackBounds.clone();
    };

    const createAxisLabelSprite = (label, color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 96;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(4, 8, 14, 0.82)";
      context.beginPath();
      context.arc(48, 48, 30, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = color;
      context.font = "700 36px 'Space Grotesk', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, 48, 49);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      material.toneMapped = false;
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.24);
      sprite.renderOrder = 20;
      return sprite;
    };

    class FirstPersonController {
      constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.onChange = null;
        this.pointerEnabled = false;
        this.movementEnabled = true;
        this.dragMode = null;
        this.keys = new Set();
        this.lookSpeed = 0.0023;
        this.moveSpeed = 1.4;
        this.boostMultiplier = 2.8;
        this.pitchLimit = Math.PI / 2 - 0.03;
        this.pitch = 0;
        this.yaw = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.euler = new THREE.Euler(0, 0, 0, "YXZ");
        this.forward = new THREE.Vector3();
        this.right = new THREE.Vector3();
        this.up = new THREE.Vector3(0, 1, 0);
        this.screenUp = new THREE.Vector3();
        this.move = new THREE.Vector3();
        this.lastMovementDelta = new THREE.Vector3();
        this.handleKeyDown = (event) => {
          if (FPS_KEYS.has(event.code)) {
            const sizeBefore = this.keys.size;
            this.keys.add(event.code);
            if (this.keys.size !== sizeBefore) {
              this.notifyChange();
            }
          }
        };
        this.handleKeyUp = (event) => {
          if (FPS_KEYS.has(event.code)) {
            const removed = this.keys.delete(event.code);
            if (removed) {
              this.notifyChange();
            }
          }
        };
        this.handlePointerDown = (event) => {
          if (!this.pointerEnabled || (event.button !== 0 && event.button !== 2)) {
            return;
          }
          this.dragMode = (event.button === 2 || event.buttons === 2 || event.which === 3) ? "pan" : "look";
          this.lastX = event.clientX;
          this.lastY = event.clientY;
          this.domElement.classList.toggle("is-looking", this.dragMode === "look");
          this.domElement.classList.toggle("is-panning", this.dragMode === "pan");
          this.notifyChange();
          event.preventDefault();
        };
        this.handlePointerMove = (event) => {
          if (!this.pointerEnabled || !this.dragMode) {
            return;
          }
          if (event.buttons === 0) {
            this.handlePointerUp();
            return;
          }
          if ((event.buttons === 2 || event.which === 3) && this.dragMode !== "pan") {
            this.dragMode = "pan";
            this.domElement.classList.remove("is-looking");
            this.domElement.classList.add("is-panning");
          }
          const deltaX = event.clientX - this.lastX;
          const deltaY = event.clientY - this.lastY;
          this.lastX = event.clientX;
          this.lastY = event.clientY;
          if (this.dragMode === "look") {
            this.yaw -= deltaX * this.lookSpeed;
            this.pitch = THREE.MathUtils.clamp(
              this.pitch - deltaY * this.lookSpeed,
              -this.pitchLimit,
              this.pitchLimit,
            );
            this.euler.set(this.pitch, this.yaw, 0, "YXZ");
            this.camera.quaternion.setFromEuler(this.euler);
            this.notifyChange();
            return;
          }
          this.camera.updateMatrixWorld(true);
          this.right.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
          this.screenUp.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
          const panScale = this.moveSpeed * 0.012;
          this.camera.position.addScaledVector(this.right, -deltaX * panScale);
          this.camera.position.addScaledVector(this.screenUp, deltaY * panScale);
          this.notifyChange();
        };
        this.handlePointerUp = () => {
          const wasDragging = Boolean(this.dragMode);
          this.dragMode = null;
          this.domElement.classList.remove("is-looking");
          this.domElement.classList.remove("is-panning");
          if (wasDragging) {
            this.notifyChange();
          }
        };
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
        window.addEventListener("mouseup", this.handlePointerUp);
        window.addEventListener("mousemove", this.handlePointerMove);
        window.addEventListener("blur", () => {
          this.keys.clear();
          this.handlePointerUp();
        });
        domElement.addEventListener("mousedown", this.handlePointerDown);
      }

      notifyChange() {
        if (typeof this.onChange === "function") {
          this.onChange();
        }
      }

      setPointerEnabled(enabled) {
        this.pointerEnabled = Boolean(enabled);
        if (!this.pointerEnabled) {
          this.dragMode = null;
          this.domElement.classList.remove("is-looking");
          this.domElement.classList.remove("is-panning");
          return;
        }
        this.syncFromCamera();
      }

      setMovementEnabled(enabled) {
        this.movementEnabled = Boolean(enabled);
        if (!this.movementEnabled) {
          this.keys.clear();
          this.lastMovementDelta.set(0, 0, 0);
        }
      }

      setSpeed(speed) {
        this.moveSpeed = Math.max(speed, 0.001);
      }

      dolly(amount) {
        if (!this.pointerEnabled || !Number.isFinite(amount) || amount === 0) {
          return;
        }
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        if (direction.lengthSq() < 1e-6) {
          direction.copy(DEFAULT_LOOK);
        }
        this.camera.position.addScaledVector(direction.normalize(), amount);
        this.notifyChange();
      }

      syncFromCamera() {
        this.euler.setFromQuaternion(this.camera.quaternion, "YXZ");
        this.pitch = THREE.MathUtils.clamp(this.euler.x, -this.pitchLimit, this.pitchLimit);
        this.yaw = this.euler.y;
      }

      update(delta) {
        if (!this.movementEnabled) {
          this.lastMovementDelta.set(0, 0, 0);
          return false;
        }
        let moved = false;
        this.move.set(0, 0, 0);
        this.camera.getWorldDirection(this.forward);
        this.forward.y = 0;
        if (this.forward.lengthSq() < 1e-6) {
          this.forward.copy(DEFAULT_LOOK);
        }
        this.forward.normalize();
        this.right.crossVectors(this.forward, this.up).normalize();
        if (this.keys.has("KeyW")) {
          this.move.add(this.forward);
        }
        if (this.keys.has("KeyS")) {
          this.move.sub(this.forward);
        }
        if (this.keys.has("KeyD")) {
          this.move.add(this.right);
        }
        if (this.keys.has("KeyA")) {
          this.move.sub(this.right);
        }
        if (this.keys.has("KeyE")) {
          this.move.add(this.up);
        }
        if (this.keys.has("KeyQ")) {
          this.move.sub(this.up);
        }
        if (this.move.lengthSq() === 0) {
          this.lastMovementDelta.set(0, 0, 0);
          return moved;
        }
        const boost = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")
          ? this.boostMultiplier
          : 1;
        this.move.normalize();
        this.lastMovementDelta.copy(this.move).multiplyScalar(delta * this.moveSpeed * boost);
        this.camera.position.add(this.lastMovementDelta);
        moved = true;
        return moved;
      }
    }

    class GaussianViewerApp {
      constructor(elements) {
        this.dom = elements;
        this.isFileProtocol = window.location.protocol === "file:";
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.0005, 5000);
        this.camera.position.set(0, 0, 0);
        this.camera.lookAt(DEFAULT_LOOK);
        this.scene.add(this.camera);

        this.splatSceneRoot = new THREE.Group();
        this.scene.add(this.splatSceneRoot);
        this.lightSceneRoot = new THREE.Group();
        this.scene.add(this.lightSceneRoot);
        this.gameSceneRoot = new THREE.Group();
        this.gameSceneRoot.name = "game-scene-root";
        this.scene.add(this.gameSceneRoot);
        this.modelRoot = null;
        this.rotationPivot = null;

        this.renderer = new THREE.WebGLRenderer({
          alpha: false,
          antialias: false,
          powerPreference: "high-performance",
        });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(320, 240, false);
        this.renderer.setClearColor(BACKGROUNDS.graphite);

        this.spark = new SparkRenderer({
          falloff: 1,
          focalAdjustment: 1,
          maxStdDev: QUALITY.balanced.maxStdDev,
          renderer: this.renderer,
        });
        this.scene.add(this.spark);

        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.08;
        this.orbitControls.enablePan = true;
        this.orbitControls.screenSpacePanning = true;
        this.orbitControls.zoomSpeed = 1.18;
        this.orbitControls.target.copy(DEFAULT_LOOK);
        this.orbitControls.update();
        this.orbitControls.enabled = true;

        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControlsHelper = this.transformControls.getHelper();
        this.transformControls.enabled = false;
        this.transformControls.visible = false;
        this.transformControls.size = 0.9;
        this.transformControls.space = "local";
        this.transformControlsHelper.visible = false;
        this.scene.add(this.transformControlsHelper);

        this.firstPerson = new FirstPersonController(this.camera, this.renderer.domElement);
        this.firstPerson.setPointerEnabled(false);
        this.firstPerson.setMovementEnabled(true);
        this.firstPerson.onChange = () => this.invalidateRender();

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.currentMesh = null;
        this.sceneItems = [];
        this.sceneItemSerial = 0;
        this.sceneLights = [];
        this.sceneLightSerial = 0;
        this.selectedSceneItemId = null;
        this.selectedLightId = null;
        this.baseLocalBounds = null;
        this.baseCenterBounds = null;
        this.bounds = null;
        this.boundsSphere = null;
        this.centerBounds = null;
        this.centerBoundsSphere = null;
        this.sceneBounds = null;
        this.sceneBoundsSphere = null;
        this.hoverPointer = null;
        this.lastHoverPointer = null;
        this.lastHoverHit = null;
        this.isColorPickMode = false;
        this.hoverProbePending = false;
        this.hoverReadout = "Hover -";
        this.pickedColors = [];
        this.pickedColorSerial = 0;
        this.lightOccluderSamples = [];
        this.runtimeLightOccluders = [];
        this.activeLightCount = 0;
        this.activeOccluderCount = 0;
        this.lightHandles = {
          colorB: [],
          colorG: [],
          colorR: [],
          intensities: [],
          occluderOpacities: [],
          occluderPositions: [],
          occluderRadii: [],
          positions: [],
        };
        this.gridHelper = null;
        this.axesHelper = null;
        this.axisLabelGroup = null;
        this.boundsHelper = null;
        this.currentGridScale = null;
        this.currentGridStep = null;
        this.baseMoveSpeed = 1;
        this.defaultPose = null;
        this.hasCapturedInitialPose = false;
        this.activeMode = "orbit";
        this.loadToken = 0;
        this.frameCounter = 0;
        this.lastFpsUpdate = performance.now();
        this.renderInvalidated = true;
        this.pendingForcedFrames = 0;
        this.animationLoopHandle = 0;
        this.scheduledRenderAt = 0;
        this.lastRenderFrameAt = 0;
        this.activeRenderUntil = 0;
        this.deferredPreviewHandle = 0;
        this.interactionFinalizeHandle = 0;
        this.animationPlaybackHandle = 0;
        this.lastAnimationTickAt = 0;
        this.sparkSceneDirty = false;
        this.sparkSceneUpdateQueued = false;
        this.sparkSceneUpdatePromise = null;
        this.pendingPreviewSparkUpdate = false;
        this.postLoadRefreshHandle = 0;
        this.stageResizeObserver = null;
        this.viewportResizeFrame = 0;
        this.lastStageSize = { width: 0, height: 0 };
        this.handleViewportResize = () => {
          if (this.viewportResizeFrame) {
            window.cancelAnimationFrame(this.viewportResizeFrame);
          }
          this.viewportResizeFrame = window.requestAnimationFrame(() => {
            this.viewportResizeFrame = 0;
            this.syncUiScale();
            this.onResize();
          });
        };
        this.idleRenderDelayMs = 160;
        this.depthRangeLimits = { min: 0.1, max: 100 };
        this.depthRangeIsAuto = true;
        this.pendingTransformRefresh = null;
        this.gameStage = createDefaultStage();
        this.gameState = createDefaultGameState(this.gameStage);
        this.motionState = createMotionState({
          hasSensorSupport: typeof window.DeviceOrientationEvent !== "undefined",
          mode: "sensor",
        });
        this.gameInputMode = "sensor";
        this.gameplaySensorListenersInstalled = false;
        this.gameplayHasLoadedDemo = false;
        this.gameplayQualityLevel = "Medium";
        this.handleDeviceOrientation = (event) => {
          this.motionState = updateMotionState(this.motionState, {
            beta: event?.beta,
            gamma: event?.gamma,
            now: performance.now(),
          }, DEFAULT_MOTION_CONFIG);
          this.motionState.mode = "sensor";
          if (this.gameInputMode !== "touch") {
            this.gameInputMode = "sensor";
          }
          this.syncGameplayUi();
          this.invalidateRender();
        };
        this.depthModifierHandles = {
          maxDepth: dynoFloat(DEPTH_RANGE_DEFAULT, "viewerNormalizeMax"),
        };
        this.positionModifierHandles = {
          minCorner: dynoVec3(new THREE.Vector3(), "viewerPositionMin"),
          scaleFactor: dynoFloat(1, "viewerPositionScale"),
          span: dynoVec3(new THREE.Vector3(1, 1, 1), "viewerPositionSpan"),
        };
        this.toneCurvePointerDrag = null;
        this.animationModifierHandles = {
          distanceScale: dynoFloat(1.4, "viewerAnimationDistanceScale"),
          epsilon: dynoFloat(0.0001, "viewerAnimationEpsilon"),
          epsilonVector: dynoVec3(new THREE.Vector3(0.0001, 0.0001, 0.0001), "viewerAnimationEpsilonVector"),
          opacityPower: dynoFloat(1.35, "viewerAnimationOpacityPower"),
          origin: dynoVec3(new THREE.Vector3(), "viewerAnimationOrigin"),
          scaleInfluence: dynoFloat(1.2, "viewerAnimationScaleInfluence"),
          speed: dynoFloat(1, "viewerAnimationSpeed"),
          strength: dynoFloat(1.8, "viewerAnimationStrength"),
          swirl: dynoFloat(0.18, "viewerAnimationSwirl"),
          time: dynoFloat(0, "viewerAnimationTime"),
          up: dynoVec3(new THREE.Vector3(0, 1, 0.35).normalize(), "viewerAnimationUp"),
        };
        this.activeAnimationModifier = null;
        this.activeAnimationScript = null;
        const defaultAnimationState = createDefaultAnimationPlaybackState(null);
        this.baseObjectModifier = undefined;
        this.baseWorldModifier = undefined;
        this.loadedShDegree = 3;
        this.modelMeta = createDefaultModelMeta();
        this.state = {
          autoRotate: false,
          autoLodEnabled: false,
          background: "graphite",
          depthRange: DEPTH_RANGE_DEFAULT,
          exportFalloff: true,
          exportOpacity: true,
          exportSh: true,
          exposure: -5,
          toneCurve: buildToneCurveState(),
          falloff: 1,
          focalLength: 14,
          gridScaleMode: "auto",
          gridScaleValue: 1,
          inspectorTab: "scene",
          ...defaultAnimationState,
          lightHelperScale: DEFAULT_LIGHT_HELPER_SCALE,
          lightIntensity: 20,
          lightR: DEFAULT_LIGHT_COLOR.r,
          lightG: DEFAULT_LIGHT_COLOR.g,
          lightB: DEFAULT_LIGHT_COLOR.b,
          lightX: 0,
          lightY: 0,
          lightZ: 0,
          moveSpeedFactor: 1,
          opacity: 1,
          positionRangeScale: 1,
          quality: "balanced",
          renderFps: 60,
          renderMode: "beauty",
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scale: 1,
          translateX: 0,
          translateY: 0,
          translateZ: 0,
          selectedExposure: 0,
          shLevel: 3,
          sceneListLimit: 6,
          showAxes: true,
          showBounds: false,
          showGizmo: false,
          showGrid: true,
          transformGizmoMode: "translate",
          viewMode: "play",
        };
      }

      async init() {
        this.dom.stage.append(this.renderer.domElement);
        this.syncUiScale();
        this.bindUi();
        this.syncViewModeUi();
        if (this.dom.sceneRenderSection && this.dom.sceneTransformSection) {
          this.dom.sceneRenderSection.parentElement?.insertBefore(
            this.dom.sceneTransformSection,
            this.dom.sceneRenderSection,
          );
        }
        this.applyBackground();
        this.applyQualityPreset(this.state.quality);
        this.applyOpacity(false);
        this.applyFalloff(false);
        this.applyExposure(false);
        this.applyToneCurve(false);
        this.applyFocalLength(false, false);
        this.applyMoveSpeed(false);
        this.applyRenderFps(false);
        this.applyDepthRange(false);
        this.applyPositionRange(false);
        this.syncTransformInputs();
        this.syncToggleButtons();
        this.syncLodUi();
        this.applyRenderMode(false);
        this.updateModeUi();
        this.syncInspectorTabs();
        this.syncExportList();
        this.syncGridControls();
        this.syncSelectedLightControls(true);
        this.syncLightList();
        this.syncAnimationEditor();
        this.syncAnimationControls(true);
        if (this.dom.colorspaceChip) {
          this.dom.colorspaceChip.textContent = "Display sRGB";
        }
        this.clearHoverReadout();
        this.renderPickedColors();
        this.syncColorPickButton();
        this.updateTransformGizmoButtons();
        this.updateMetaUi();
        await this.setupGameplayScene();
        this.syncGameplayUi();
        this.onResize();
        this.startAnimationLoop();
        this.setProgress("Idle", 0);
        this.updateRenderChip("Idle");
        this.updateStatus("Viewer ready");
        this.orbitControls.addEventListener("change", () => this.invalidateRender());
        window.addEventListener("resize", this.handleViewportResize);
        window.visualViewport?.addEventListener("resize", this.handleViewportResize);
        window.addEventListener("pointermove", (event) => this.updateToneCurvePointFromPointer(event));
        window.addEventListener("pointerup", () => this.stopToneCurvePointDrag());
        window.addEventListener("pointercancel", () => this.stopToneCurvePointDrag());
        if (typeof ResizeObserver === "function") {
          this.stageResizeObserver = new ResizeObserver(() => this.onResize());
          this.stageResizeObserver.observe(this.dom.stage);
        }
        this.renderer.domElement.addEventListener("dblclick", (event) => this.focusPick(event));
        this.renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
        this.renderer.domElement.addEventListener("pointerdown", (event) => {
          if (this.isColorPickMode && event.button === 0) {
            event.preventDefault();
            event.stopPropagation();
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.hoverPointer = {
              x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
              y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
            };
            this.lastHoverPointer = { ...this.hoverPointer };
            this.pickHoveredColor({ fromPointerClick: true });
            return;
          }
          this.commitActiveField();
        }, true);
        this.renderer.domElement.addEventListener("pointermove", (event) => this.queueHoverProbe(event));
        this.renderer.domElement.addEventListener("pointerleave", () => this.clearHoverReadout());
        this.renderer.domElement.addEventListener("wheel", (event) => this.handleStageWheel(event), { passive: false });
        this.installRenderActivityListeners();
        this.invalidateRender();

        if (this.isFileProtocol) {
          this.prepareFileProtocolMode();
          return;
        }

        this.dom.progressLabel.textContent = "Open a local file or drag one into the viewer.";
        this.updateRenderChip("Ready");
        this.updateStatus("Viewer is ready. Open a local file.");
        await this.ensureGameplayDemoLoaded();
      }

      bindUi() {
        this.dom.backgroundSelect.addEventListener("change", (event) => {
          this.state.background = event.target.value;
          this.applyBackground();
        });
        this.dom.lodAutoCheckbox?.addEventListener("change", () => {
          this.state.autoLodEnabled = Boolean(this.dom.lodAutoCheckbox.checked);
          this.syncLodUi();
          this.updateStatus(this.state.autoLodEnabled
            ? "Auto LoD enabled for the next splat load"
            : "Auto LoD disabled; next splat loads will use the legacy path");
        });

        this.bindNumberPair({
          input: this.dom.opacityInput,
          range: this.dom.opacityRange,
          limits: OPACITY_LIMITS,
          onChange: (value, options) => this.setOpacity(value, options),
        });
        this.bindNumberPair({
          input: this.dom.falloffInput,
          range: this.dom.falloffRange,
          limits: FALLOFF_LIMITS,
          onChange: (value, options) => this.setFalloff(value, options),
        });
        this.dom.focalLengthRange.addEventListener("input", (event) => {
          this.setFocalLength(
            sliderToFocalLength(event.target.value),
            true,
            { commit: true, syncInput: true },
          );
        });
        this.bindNumberPair({
          input: this.dom.focalLengthInput,
          range: null,
          limits: FOCAL_LENGTH_LIMITS,
          onChange: (value, options) => this.setFocalLength(value, true, options),
        });
        this.bindNumberPair({
          input: this.dom.moveSpeedInput,
          range: this.dom.moveSpeedRange,
          limits: MOVE_SPEED_LIMITS,
          onChange: (value, options) => this.setMoveSpeedFactor(value, options),
        });
        this.bindNumberPair({
          input: this.dom.renderFpsInput,
          range: null,
          limits: RENDER_FPS_LIMITS,
          onChange: (value, options) => this.setRenderFps(value, options),
        });
        this.bindNumberPair({
          input: this.dom.exposureInput,
          range: this.dom.exposureRange,
          limits: EXPOSURE_LIMITS,
          onChange: (value, options) => this.setExposure(value, options),
        });
        this.dom.toneCurveChannelSelect?.addEventListener("change", (event) => {
          this.state.toneCurve = setToneCurveActiveChannel(this.state.toneCurve, event.target.value);
          this.syncToneCurveUi();
        });
        this.dom.toneCurveGraph?.addEventListener("pointerdown", (event) => this.handleToneCurveGraphPointerDown(event));
        this.dom.toneCurveGraph?.addEventListener("contextmenu", (event) => this.handleToneCurveGraphContextMenu(event));
        this.dom.toneCurveAddPointButton?.addEventListener("click", () => {
          this.state.toneCurve = insertToneCurvePoint(this.state.toneCurve);
          this.applyToneCurve(true, true);
        });
        this.dom.toneCurveRemovePointButton?.addEventListener("click", () => {
          this.state.toneCurve = removeToneCurvePoint(this.state.toneCurve);
          this.applyToneCurve(true, true);
        });
        this.bindNumberPair({
          input: this.dom.toneCurvePointXInput,
          range: null,
          limits: TONE_CURVE_POINT_LIMITS,
          onChange: (value, options) => this.setSelectedToneCurvePointValue("x", value, options),
        });
        this.bindNumberPair({
          input: this.dom.toneCurvePointYInput,
          range: null,
          limits: TONE_CURVE_POINT_LIMITS,
          onChange: (value, options) => this.setSelectedToneCurvePointValue("y", value, options),
        });
        this.bindNumberPair({
          input: this.dom.selectedExposureInput,
          range: this.dom.selectedExposureRange,
          limits: EXPOSURE_LIMITS,
          onChange: (value, options) => this.setSelectedExposure(value, options),
        });
        this.dom.pickColorButton?.addEventListener("click", () => {
          if (this.isColorPickMode) {
            this.stopColorPickMode();
            this.updateStatus("Color picker canceled");
            return;
          }
          this.startColorPickMode();
        });
        this.dom.clearPickedColorsButton?.addEventListener("click", () => {
          this.clearPickedColors();
        });
        this.dom.addPointLightButton?.addEventListener("click", () => {
          this.addPointLight();
        });
        this.bindNumberPair({
          input: this.dom.depthRangeInput,
          range: this.dom.depthRangeRange,
          limits: () => this.getActiveNormalizeLimits(),
          onChange: (value, options) => this.setNormalizeValue(value, options),
        });

        this.dom.fileInput.addEventListener("change", async (event) => {
          const [file] = Array.from(event.target.files || []);
          if (!file) {
            return;
          }
          await this.loadFromFile(file);
          event.target.value = "";
        });

        this.dom.fitViewButton.addEventListener("click", () => this.fitView({ preserveDirection: true }));
        this.dom.addPrimitiveButton.addEventListener("click", async () => {
          await this.loadPrimitive(this.dom.primitiveSelect.value || "cube");
        });
        this.dom.clearSceneButton.addEventListener("click", () => this.clearLoadedSplat());
        this.dom.gamePrimaryButton?.addEventListener("click", () => this.handleGameplayPrimaryAction());
        this.dom.gameEnableMotionButton?.addEventListener("click", () => this.requestMotionPermission());
        this.dom.gameCalibrateButton?.addEventListener("click", () => this.calibrateGameplayMotion());
        this.dom.gameResetButton?.addEventListener("click", () => this.resetGameplayRun(true));
        this.dom.saveSceneSplatsButton?.addEventListener("click", async () => {
          try {
            await this.saveVisibleSceneSplats();
          } catch (error) {
            this.updateStatus(error instanceof Error ? error.message : "Save failed");
          }
        });
        this.dom.exportEnableAllButton?.addEventListener("click", () => this.setAllExportEnabled(true));
        this.dom.exportDisableAllButton?.addEventListener("click", () => this.setAllExportEnabled(false));
        [
          [this.dom.exportOpacityCheckbox, "exportOpacity"],
          [this.dom.exportFalloffCheckbox, "exportFalloff"],
          [this.dom.exportShCheckbox, "exportSh"],
        ].forEach(([checkbox, stateKey]) => {
          checkbox?.addEventListener("change", () => {
            this.state[stateKey] = Boolean(checkbox.checked);
          });
        });

        this.dom.modeButtons.forEach((button) => {
          button.addEventListener("click", () => this.setMode(button.dataset.mode || "orbit"));
        });
        this.dom.inspectorTabButtons.forEach((button) => {
          button.addEventListener("click", () => this.setInspectorTab(button.dataset.inspectorTab || "scene"));
        });
        this.dom.animationLoopCheckbox?.addEventListener("change", () => {
          this.state.animationLoop = Boolean(this.dom.animationLoopCheckbox.checked);
          if (this.activeAnimationScript) {
            this.activeAnimationScript.loop = this.state.animationLoop;
            this.syncAnimationEditor();
          }
        });
        this.dom.animationOriginModeSelect?.addEventListener("change", () => this.setAnimationOriginMode(this.dom.animationOriginModeSelect.value));
        this.bindNumberPair({
          input: this.dom.animationOriginXInput,
          range: null,
          limits: TRANSLATE_LIMITS,
          onChange: (value) => this.setAnimationOriginAxis("x", value),
        });
        this.bindNumberPair({
          input: this.dom.animationOriginYInput,
          range: null,
          limits: TRANSLATE_LIMITS,
          onChange: (value) => this.setAnimationOriginAxis("y", value),
        });
        this.bindNumberPair({
          input: this.dom.animationOriginZInput,
          range: null,
          limits: TRANSLATE_LIMITS,
          onChange: (value) => this.setAnimationOriginAxis("z", value),
        });
        this.dom.animationLoadPresetButton?.addEventListener("click", () => this.loadAnimationPreset(this.dom.animationPresetSelect?.value || "explosion"));
        this.dom.animationCopyDefaultButton?.addEventListener("click", () => this.clearAnimationScript(true));
        this.dom.animationApplyButton?.addEventListener("click", () => this.applyAnimationScript(true));
        this.dom.animationPlayButton?.addEventListener("click", () => this.playAnimation());
        this.dom.animationPauseButton?.addEventListener("click", () => this.pauseAnimation());
        this.dom.animationResetButton?.addEventListener("click", () => this.resetAnimation());
        this.dom.animationOpenButton?.addEventListener("click", () => this.dom.animationFileInput?.click());
        this.dom.animationSaveButton?.addEventListener("click", () => this.saveAnimationScript());
        this.dom.animationFileInput?.addEventListener("change", async (event) => {
          const [file] = Array.from(event.target.files || []);
          if (!file) {
            return;
          }
          await this.loadAnimationScriptFile(file);
          event.target.value = "";
        });
        this.dom.animationTimeRange?.addEventListener("input", () => this.setAnimationTimeFromUi(false));
        this.dom.animationTimeRange?.addEventListener("change", () => this.setAnimationTimeFromUi(true));
        this.bindNumberPair({
          input: this.dom.sceneLimitInput,
          range: this.dom.sceneLimitRange,
          limits: { min: 3, max: 14 },
          onChange: (value, options) => this.setSceneListLimit(value, options),
        });
        this.bindNumberPair({
          input: this.dom.sceneSelectInput,
          range: this.dom.sceneSelectRange,
          limits: () => ({ min: 1, max: Math.max(this.sceneItems.length, 1) }),
          onChange: (value, options) => this.setSceneSelectionIndex(value, options),
        });
        this.bindNumberPair({
          input: this.dom.lightHelperScaleInput,
          range: this.dom.lightHelperScaleRange,
          limits: LIGHT_HELPER_SCALE_LIMITS,
          onChange: (value, options) => this.setSelectedLightHelperScale(value, options),
        });
        this.bindNumberPair({
          input: this.dom.lightIntensityInput,
          range: this.dom.lightIntensityRange,
          limits: LIGHT_INTENSITY_LIMITS,
          onChange: (value, options) => this.setSelectedLightIntensity(value, options),
        });
        this.dom.gridScaleSelect?.addEventListener("change", (event) => {
          this.setGridScaleMode(event.target.value);
        });
        this.bindNumberPair({
          input: this.dom.gridScaleInput,
          range: null,
          limits: { min: 0.01, max: 100000 },
          onChange: (value, options) => this.setGridScaleValue(value, options),
        });

        this.dom.openFileButton.addEventListener("click", () => this.dom.fileInput.click());
        this.dom.renderModeSelect.addEventListener("change", (event) => {
          this.setRenderMode(event.target.value);
          this.dom.renderModeSelect.blur();
        });
        this.dom.renderModeSelect.addEventListener("keydown", (event) => {
          const blockedKeys = new Set([
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
            "PageUp",
            "PageDown",
          ]);
          const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
          if (blockedKeys.has(event.key) || isPrintable) {
            event.preventDefault();
          }
        });
        this.dom.renderModeSelect.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });

        this.dom.qualitySelect.addEventListener("change", (event) => {
          this.applyQualityPreset(event.target.value);
        });

        this.dom.resetViewButton.addEventListener("click", () => this.resetView());
        this.dom.toggleGizmoButton.addEventListener("click", () => this.toggleTransformGizmo());
        this.dom.lightGizmoButton?.addEventListener("click", () => this.toggleTransformGizmo());
        this.dom.gizmoTranslateButton.addEventListener("click", () => this.setTransformGizmoMode("translate"));
        this.dom.gizmoRotateButton.addEventListener("click", () => this.setTransformGizmoMode("rotate"));
        this.dom.gizmoScaleButton.addEventListener("click", () => this.setTransformGizmoMode("scale"));
        this.dom.shSelect.addEventListener("change", (event) => {
          this.state.shLevel = Number(event.target.value);
          this.applyShLevel();
          this.updateRenderChip("SH level updated");
        });

        this.dom.toggleAutorotateButton.addEventListener("click", () => {
          this.state.autoRotate = !this.state.autoRotate;
          this.orbitControls.autoRotate = this.state.autoRotate;
          this.syncToggleButtons();
        });
        this.dom.toggleAxesButton.addEventListener("click", () => this.toggleHelper("showAxes"));
        this.dom.toggleBoundsButton.addEventListener("click", () => this.toggleHelper("showBounds"));
        this.dom.toggleGridButton.addEventListener("click", () => this.toggleHelper("showGrid"));

        this.dom.resetRotationButton.addEventListener("click", () => this.resetTransform());
        [
          this.dom.lightRInput,
          this.dom.lightGInput,
          this.dom.lightBInput,
          this.dom.lightXInput,
          this.dom.lightYInput,
          this.dom.lightZInput,
          this.dom.rotationXInput,
          this.dom.rotationYInput,
          this.dom.rotationZInput,
          this.dom.scaleInput,
          this.dom.translateXInput,
          this.dom.translateYInput,
          this.dom.translateZInput,
        ].forEach((input) => {
          if (!input) {
            return;
          }
          if (
            input === this.dom.lightXInput
            || input === this.dom.lightYInput
            || input === this.dom.lightZInput
          ) {
            input.addEventListener("input", () => this.applySelectedLightPosition(false));
            input.addEventListener("blur", () => this.applySelectedLightPosition(true));
            input.addEventListener("keydown", (event) => {
              if (event.key === "Enter") {
                this.applySelectedLightPosition(true);
              }
            });
            return;
          }
          if (
            input === this.dom.lightRInput
            || input === this.dom.lightGInput
            || input === this.dom.lightBInput
          ) {
            input.addEventListener("input", () => this.applySelectedLightColor(false));
            input.addEventListener("blur", () => this.applySelectedLightColor(true));
            input.addEventListener("keydown", (event) => {
              if (event.key === "Enter") {
                this.applySelectedLightColor(true);
              }
            });
            return;
          }
          input.addEventListener("input", () => this.applyTransformFromInputs(false, false));
          input.addEventListener("blur", () => this.applyTransformFromInputs(true, true));
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              this.applyTransformFromInputs(true, true);
            }
          });
        });

        this.dom.stage.addEventListener("dragenter", (event) => this.onDrag(event));
        this.dom.stage.addEventListener("dragover", (event) => this.onDrag(event));
        this.dom.stage.addEventListener("dragleave", (event) => this.onDragLeave(event));
        this.dom.stage.addEventListener("drop", async (event) => this.onDrop(event));

        this.transformControls.addEventListener("dragging-changed", (event) => {
          this.orbitControls.enabled = this.activeMode === "orbit" && !event.value;
          this.firstPerson.setPointerEnabled(this.activeMode === "fps" && !event.value);
          this.firstPerson.setMovementEnabled(!event.value);
          if (event.value) {
            this.startDeferredInteraction();
          } else {
            this.finishDeferredInteraction();
          }
        });
        this.transformControls.addEventListener("change", () => {
          if (!this.state.showGizmo) {
            return;
          }
          this.startDeferredInteraction();
        });
        this.transformControls.addEventListener("objectChange", () => {
          if (!this.state.showGizmo) {
            return;
          }
          this.applyTransformFromGizmo();
          this.startDeferredInteraction();
        });
      }

      syncUiScale() {
        const viewport = window.visualViewport;
        const viewportWidth = viewport?.width ?? window.innerWidth;
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const layoutMode = computeLayoutMode({ viewportWidth });
        const shellSize = computeShellSize({ viewportHeight, viewportWidth });
        const panelWidths = computePanelWidths({ layoutMode, viewportWidth });
        const compensation = computeUiScale({
          viewportHeight,
          viewportWidth,
        });
        document.documentElement.style.setProperty("--ui-scale", compensation.toFixed(4));
        document.documentElement.style.setProperty("--shell-width", `${shellSize.width}px`);
        document.documentElement.style.setProperty("--shell-height", `${shellSize.height}px`);
        document.documentElement.style.setProperty("--panel-left-width", `${panelWidths.left}px`);
        document.documentElement.style.setProperty("--panel-right-width", `${panelWidths.right}px`);
        document.body.dataset.layout = layoutMode;
      }

      installRenderActivityListeners() {
        const mark = () => this.markRenderActivity();
        ["pointerdown", "pointermove", "keydown", "keyup", "wheel"].forEach((eventName) => {
          window.addEventListener(eventName, mark, { passive: true });
        });
      }

      startAnimationLoop() {
        if (this.animationLoopHandle) {
          return;
        }
        const tick = () => {
          this.animationLoopHandle = window.requestAnimationFrame(tick);
          this.renderLoop();
        };
        this.animationLoopHandle = window.requestAnimationFrame(tick);
      }

      markRenderActivity(durationMs = 1400) {
        this.activeRenderUntil = Math.max(
          this.activeRenderUntil,
          performance.now() + Math.max(0, durationMs),
        );
        this.scheduleRender(this.getRenderFrameDelay());
      }

      queueSparkSceneUpdate() {
        if (!this.spark || !this.scene || !this.camera) {
          return Promise.resolve();
        }
        this.sparkSceneDirty = true;
        if (this.sparkSceneUpdatePromise) {
          this.sparkSceneUpdateQueued = true;
          return this.sparkSceneUpdatePromise;
        }
        const runUpdate = async () => {
          while (this.sparkSceneDirty || this.sparkSceneUpdateQueued) {
            this.sparkSceneDirty = false;
            this.sparkSceneUpdateQueued = false;
            this.syncLightingRuntimeState();
            await this.spark.update({
              scene: this.scene,
              camera: this.camera,
            });
            this.pendingForcedFrames = Math.max(this.pendingForcedFrames, 1);
            this.renderInvalidated = true;
            this.scheduleRender(0);
          }
        };
        this.sparkSceneUpdatePromise = runUpdate()
          .catch((error) => {
            console.error("Spark scene update failed", error);
          })
          .finally(() => {
            this.sparkSceneUpdatePromise = null;
            if (this.sparkSceneDirty || this.sparkSceneUpdateQueued) {
              this.queueSparkSceneUpdate();
            }
          });
        return this.sparkSceneUpdatePromise;
      }

      isTimedRenderActive(now = performance.now()) {
        return now < this.activeRenderUntil;
      }

      getRenderFrameIntervalMs() {
        const fps = THREE.MathUtils.clamp(
          Number(this.state.renderFps) || 60,
          RENDER_FPS_LIMITS.min,
          RENDER_FPS_LIMITS.max,
        );
        return 1000 / fps;
      }

      getRenderFrameDelay(now = performance.now()) {
        const elapsed = this.lastRenderFrameAt > 0
          ? now - this.lastRenderFrameAt
          : Number.POSITIVE_INFINITY;
        return Math.max(0, this.getRenderFrameIntervalMs(now) - elapsed);
      }

      startDeferredInteraction(durationMs = INTERACTION_PREVIEW_MS) {
        const safeDuration = Math.max(0, durationMs);
        this.renderInvalidated = true;
        if (!this.deferredPreviewHandle) {
          const previewIntervalMs = Math.max(
            16,
            Math.round(1000 / Math.min(Number(this.state.renderFps) || 60, INTERACTION_PREVIEW_FPS)),
          );
          this.deferredPreviewHandle = window.setInterval(() => {
            if (this.pendingPreviewSparkUpdate) {
              this.pendingPreviewSparkUpdate = false;
              this.queueSparkSceneUpdate();
            }
            this.flushRenderNow();
          }, previewIntervalMs);
        }
        if (this.interactionFinalizeHandle) {
          window.clearTimeout(this.interactionFinalizeHandle);
        }
        this.interactionFinalizeHandle = window.setTimeout(() => {
          this.interactionFinalizeHandle = 0;
          this.finishDeferredInteraction();
        }, safeDuration + INTERACTION_SETTLE_MS);
        this.scheduleRender(0);
      }

      finishDeferredInteraction() {
        if (this.interactionFinalizeHandle) {
          window.clearTimeout(this.interactionFinalizeHandle);
          this.interactionFinalizeHandle = 0;
        }
        if (this.deferredPreviewHandle) {
          window.clearInterval(this.deferredPreviewHandle);
          this.deferredPreviewHandle = 0;
        }
        if (this.pendingPreviewSparkUpdate) {
          this.pendingPreviewSparkUpdate = false;
          this.queueSparkSceneUpdate();
        }
        this.scheduledRenderAt = 0;
        this.lastRenderFrameAt = 0;
        this.renderInvalidated = true;
        this.pendingForcedFrames = Math.max(this.pendingForcedFrames, 1);
        this.flushRenderNow();
      }

      flushRenderNow() {
        this.syncVisibleSceneItemTransforms();
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
        this.updateFps();
        this.updateCameraUi();
        this.lastRenderFrameAt = performance.now();
        this.scheduledRenderAt = 0;
        this.renderInvalidated = false;
        if (this.pendingForcedFrames > 0) {
          this.pendingForcedFrames -= 1;
        }
      }

      ensureDynoHandleArray(target, count, factory) {
        while (target.length < count) {
          target.push(factory(target.length));
        }
        return target;
      }

      createSceneItemRecord(name, source) {
        const modelRoot = new THREE.Group();
        const rotationPivot = new THREE.Group();
        rotationPivot.rotation.order = "XYZ";
        modelRoot.add(rotationPivot);
        this.splatSceneRoot.add(modelRoot);
        return {
          id: `scene-item-${++this.sceneItemSerial}`,
          modelRoot,
          rotationPivot,
          mesh: null,
          visible: true,
          loadedShDegree: 3,
          baseObjectModifier: undefined,
          baseWorldModifier: undefined,
          baseLocalBounds: null,
          baseCenterBounds: null,
          bounds: null,
          boundsSphere: null,
          centerBounds: null,
          centerBoundsSphere: null,
          hoverEntries: null,
          modelMeta: createDefaultModelMeta(name, source),
          exportEnabled: true,
          settings: {
            exposure: 0,
            falloff: 1,
            opacity: 1,
            renderMode: "beauty",
            shLevel: 3,
            toneCurve: buildToneCurveState(),
          },
          lightExposureHandle: dynoFloat(1, `itemLightExposure-${this.sceneItemSerial}`),
          transform: {
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scale: 1,
            translateX: 0,
            translateY: 0,
            translateZ: 0,
          },
        };
      }

      createLightRecord() {
        const root = new THREE.Group();
        const defaultLight = createDefaultLightState({
          radius: this.sceneBoundsSphere?.radius ?? 1,
          sceneLightSerial: this.sceneLightSerial + 1,
        });
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 18, 18),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(defaultLight.color.r, defaultLight.color.g, defaultLight.color.b) }),
        );
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.18, 0.28, 28),
          new THREE.MeshBasicMaterial({
            color: LIGHT_HELPER_COLOR,
            opacity: 0.82,
            side: THREE.DoubleSide,
            transparent: true,
          }),
        );
        halo.rotation.x = -Math.PI / 2;
        root.add(halo, bulb);
        this.lightSceneRoot.add(root);
        return {
          id: `scene-light-${++this.sceneLightSerial}`,
          color: { ...defaultLight.color },
          helperScale: defaultLight.helperScale,
          intensity: defaultLight.intensity,
          name: defaultLight.name,
          root,
          visible: true,
          position: new THREE.Vector3(),
        };
      }

      getSelectedItem() {
        return this.sceneItems.find((item) => item.id === this.selectedSceneItemId) || null;
      }

      getSelectedLight() {
        return this.sceneLights.find((light) => light.id === this.selectedLightId) || null;
      }

      syncSelectionRefs(item) {
        this.currentMesh = item?.mesh ?? null;
        this.modelRoot = item?.modelRoot ?? null;
        this.rotationPivot = item?.rotationPivot ?? null;
        this.baseLocalBounds = item?.baseLocalBounds ?? null;
        this.baseCenterBounds = item?.baseCenterBounds ?? null;
        this.bounds = item?.bounds ?? null;
        this.boundsSphere = item?.boundsSphere ?? null;
        this.centerBounds = item?.centerBounds ?? null;
        this.centerBoundsSphere = item?.centerBoundsSphere ?? null;
        this.baseObjectModifier = item?.baseObjectModifier;
        this.baseWorldModifier = item?.baseWorldModifier;
        this.loadedShDegree = item?.loadedShDegree ?? 3;
        this.modelMeta = item?.modelMeta ?? createDefaultModelMeta();
      }

      applySelectedTransformState(syncInputs = true) {
        const item = this.getSelectedItem();
        if (!item) {
          this.state.rotationX = 0;
          this.state.rotationY = 0;
          this.state.rotationZ = 0;
          this.state.scale = 1;
          this.state.translateX = 0;
          this.state.translateY = 0;
          this.state.translateZ = 0;
          if (syncInputs) {
            this.syncTransformInputs();
          }
          return;
        }
        this.state.rotationX = item.transform.rotationX;
        this.state.rotationY = item.transform.rotationY;
        this.state.rotationZ = item.transform.rotationZ;
        this.state.scale = item.transform.scale;
        this.state.translateX = item.transform.translateX;
        this.state.translateY = item.transform.translateY;
        this.state.translateZ = item.transform.translateZ;
        if (syncInputs) {
          this.syncTransformInputs();
        }
        this.syncTransformGizmo();
      }

      syncSelectedSplatControls(syncInputs = true) {
        const item = this.getSelectedItem();
        this.state.selectedExposure = item?.settings?.exposure ?? 0;
        this.state.toneCurve = normalizeToneCurveState(item?.settings?.toneCurve ?? buildToneCurveState());
        this.state.falloff = Number.isFinite(this.spark?.falloff)
          ? this.spark.falloff
          : item?.settings?.falloff ?? 1;
        this.state.opacity = item?.settings?.opacity ?? 1;
        this.state.renderMode = item?.settings?.renderMode ?? "beauty";
        this.state.shLevel = item?.settings?.shLevel ?? 3;
        if (item) {
          this.spark.falloff = this.state.falloff;
        }
        if (this.dom.selectedExposureRange) {
          this.dom.selectedExposureRange.value = String(
            clampNumber(this.state.selectedExposure, EXPOSURE_LIMITS),
          );
        }
        if (this.dom.selectedExposureInput && syncInputs) {
          this.dom.selectedExposureInput.value = this.state.selectedExposure
            .toFixed(Math.abs(this.state.selectedExposure) < 1 ? 1 : 2);
        }
        if (this.dom.falloffRange) {
          this.dom.falloffRange.value = String(
            clampNumber(this.state.falloff, FALLOFF_LIMITS),
          );
        }
        if (this.dom.falloffInput && syncInputs) {
          this.dom.falloffInput.value = this.state.falloff.toFixed(2);
        }
        if (this.dom.opacityRange) {
          this.dom.opacityRange.value = String(Math.min(this.state.opacity, 2));
        }
        if (this.dom.opacityInput && syncInputs) {
          this.dom.opacityInput.value = this.state.opacity.toFixed(2);
        }
        if (this.dom.renderModeSelect) {
          this.dom.renderModeSelect.value = this.state.renderMode;
        }
        if (this.dom.shSelect) {
          this.dom.shSelect.value = String(this.state.shLevel);
        }
        this.syncToneCurveUi(syncInputs);
        this.setSectionDisabled(this.dom.sceneRenderSection, !item);
        this.setSectionDisabled(this.dom.sceneTransformSection, !item);
      }

      syncSelectedLightControls(syncInputs = true) {
        const light = this.getSelectedLight();
        const lightColor = clampLightColor(light?.color ?? DEFAULT_LIGHT_COLOR);
        this.state.lightHelperScale = light?.helperScale ?? DEFAULT_LIGHT_HELPER_SCALE;
        this.state.lightIntensity = light?.intensity ?? 20;
        this.state.lightR = lightColor.r;
        this.state.lightG = lightColor.g;
        this.state.lightB = lightColor.b;
        this.state.lightX = light?.position?.x ?? 0;
        this.state.lightY = light?.position?.y ?? 0;
        this.state.lightZ = light?.position?.z ?? 0;
        if (this.dom.lightName) {
          this.dom.lightName.textContent = light?.name ?? "No light selected";
        }
        if (this.dom.lightHelperScaleRange) {
          this.dom.lightHelperScaleRange.value = String(clampNumber(this.state.lightHelperScale, LIGHT_HELPER_SCALE_LIMITS));
          this.dom.lightHelperScaleRange.disabled = !light;
        }
        if (syncInputs && this.dom.lightHelperScaleInput) {
          this.dom.lightHelperScaleInput.value = formatNumber(this.state.lightHelperScale, 2);
        }
        if (this.dom.lightIntensityRange) {
          this.dom.lightIntensityRange.value = String(Math.min(clampNumber(this.state.lightIntensity, LIGHT_INTENSITY_LIMITS), 100));
          this.dom.lightIntensityRange.disabled = !light;
        }
        if (syncInputs && this.dom.lightIntensityInput) {
          this.dom.lightIntensityInput.value = this.state.lightIntensity.toFixed(this.state.lightIntensity < 10 ? 2 : 1);
        }
        [
          this.dom.lightHelperScaleInput,
          this.dom.lightIntensityInput,
          this.dom.lightRInput,
          this.dom.lightGInput,
          this.dom.lightBInput,
          this.dom.lightXInput,
          this.dom.lightYInput,
          this.dom.lightZInput,
        ].forEach((input) => {
          if (input) {
            input.disabled = !light;
          }
        });
        if (syncInputs) {
          if (this.dom.lightRInput) {
            this.dom.lightRInput.value = formatNumber(this.state.lightR, 3);
          }
          if (this.dom.lightGInput) {
            this.dom.lightGInput.value = formatNumber(this.state.lightG, 3);
          }
          if (this.dom.lightBInput) {
            this.dom.lightBInput.value = formatNumber(this.state.lightB, 3);
          }
          if (this.dom.lightXInput) {
            this.dom.lightXInput.value = formatNumber(this.state.lightX, Math.abs(this.state.lightX) < 10 ? 2 : 1);
          }
          if (this.dom.lightYInput) {
            this.dom.lightYInput.value = formatNumber(this.state.lightY, Math.abs(this.state.lightY) < 10 ? 2 : 1);
          }
          if (this.dom.lightZInput) {
            this.dom.lightZInput.value = formatNumber(this.state.lightZ, Math.abs(this.state.lightZ) < 10 ? 2 : 1);
          }
        }
        this.setSectionDisabled(this.dom.lightControlsSection, !light);
      }

      setSectionDisabled(section, disabled, allowedButtons = []) {
        if (!section) {
          return;
        }
        section.classList.toggle("is-disabled", Boolean(disabled));
        const allowSet = new Set(allowedButtons.filter(Boolean));
        section.querySelectorAll("input, select, textarea, button").forEach((element) => {
          if (allowSet.has(element)) {
            return;
          }
          element.disabled = Boolean(disabled);
        });
      }

      updateLightVisual(light) {
        if (!light?.root) {
          return;
        }
        light.root.position.copy(light.position);
        light.root.visible = light.visible;
        const bulb = light.root.children[1];
        const halo = light.root.children[0];
        const helperScale = clampNumber(light.helperScale ?? DEFAULT_LIGHT_HELPER_SCALE, LIGHT_HELPER_SCALE_LIMITS);
        const lightColor = clampLightColor(light.color ?? DEFAULT_LIGHT_COLOR);
        if (bulb?.material?.color) {
          bulb.material.color.setRGB(lightColor.r, lightColor.g, lightColor.b);
        }
        if (bulb) {
          bulb.scale.setScalar(helperScale);
        }
        if (halo) {
          halo.material?.color?.setRGB(lightColor.r, lightColor.g, lightColor.b);
          const haloScale = THREE.MathUtils.clamp(0.8 + Math.log10(Math.max(light.intensity, 1) + 1) * 0.32, 0.8, 2.5);
          halo.scale.setScalar(haloScale * helperScale);
        }
      }

      getRenderModeForItem(item) {
        if (!item) {
          return "beauty";
        }
        return item.id === this.selectedSceneItemId
          ? (item.settings.renderMode || "beauty")
          : "beauty";
      }

      getGlobalExposureScale() {
        return 2 ** clampNumber(this.state.exposure, EXPOSURE_LIMITS);
      }

      getBeautyExposureScaleForItem(item) {
        return this.getGlobalExposureScale()
          * (2 ** clampNumber(item?.settings?.exposure ?? 0, EXPOSURE_LIMITS));
      }

      selectLight(lightId, announce = true) {
        const light = this.sceneLights.find((entry) => entry.id === lightId) || null;
        this.selectedLightId = light?.id ?? null;
        this.selectedSceneItemId = null;
        this.syncSelectionRefs(null);
        this.applySelectedTransformState(true);
        this.syncSelectedSplatControls(true);
        this.syncSelectedLightControls(true);
        this.applyRenderMode(false);
        this.updateNormalizeFieldState();
        this.updateMetaUi();
        this.syncSceneList();
        this.syncLightList();
        this.syncTransformGizmo();
        this.updateTransformGizmoButtons();
        this.clearHoverReadout();
        this.renderPickedColors();
        if (announce && light) {
          this.updateStatus(`Selected ${light.name}`);
        }
        this.invalidateRender();
      }

      selectSceneItem(itemId, announce = true) {
        const item = this.sceneItems.find((entry) => entry.id === itemId) || null;
        this.selectedSceneItemId = item?.id ?? null;
        this.selectedLightId = null;
        this.syncSelectionRefs(item);
        this.applySelectedTransformState(true);
        this.syncSelectedSplatControls(true);
        this.syncSelectedLightControls(true);
        this.updatePositionModifierBounds();
        this.applyRenderMode(false);
        this.updateNormalizeFieldState();
        this.updateMetaUi();
        this.syncSceneList();
        this.syncLightList();
        this.updateTransformGizmoButtons();
        if (this.hoverPointer) {
          this.updateHoverReadout();
        } else {
          this.clearHoverReadout();
        }
        this.renderPickedColors();
        requestAnimationFrame(() => {
          this.dom.sceneList?.querySelector(".scene-item.is-active")?.scrollIntoView?.({
            block: "nearest",
          });
        });
        if (announce && item) {
          this.updateStatus(`Selected ${item.modelMeta.name}`);
        }
        this.invalidateRender();
      }

      toggleTransformGizmo() {
        this.state.showGizmo = !this.state.showGizmo;
        this.syncTransformGizmo();
        this.updateTransformGizmoButtons();
      }

      setTransformGizmoMode(mode) {
        this.state.transformGizmoMode = ["translate", "rotate", "scale"].includes(mode) ? mode : "translate";
        this.syncTransformGizmo();
        this.updateTransformGizmoButtons();
      }

      updateTransformGizmoButtons() {
        const lightSelected = Boolean(this.getSelectedLight());
        const effectiveMode = lightSelected ? "translate" : this.state.transformGizmoMode;
        this.dom.toggleGizmoButton.classList.toggle("is-active", this.state.showGizmo);
        this.dom.toggleGizmoButton.textContent = this.state.showGizmo ? "Gizmo On" : "Gizmo Off";
        if (this.dom.lightGizmoButton) {
          this.dom.lightGizmoButton.classList.toggle("is-active", this.state.showGizmo && lightSelected);
          this.dom.lightGizmoButton.textContent = this.state.showGizmo && lightSelected
            ? "Move Gizmo On"
            : "Move Gizmo Off";
        }
        this.dom.gizmoTranslateButton.classList.toggle("is-active", effectiveMode === "translate");
        this.dom.gizmoRotateButton.classList.toggle("is-active", effectiveMode === "rotate");
        this.dom.gizmoScaleButton.classList.toggle("is-active", effectiveMode === "scale");
        this.dom.gizmoRotateButton.disabled = lightSelected;
        this.dom.gizmoScaleButton.disabled = lightSelected;
      }

      syncTransformGizmo() {
        const light = this.getSelectedLight();
        const item = this.getSelectedItem();
        if (
          !this.state.showGizmo
          || (light && !light.visible)
          || (!light && (!item || !item.visible))
        ) {
          this.transformControls.detach();
          this.transformControls.visible = false;
          this.transformControls.enabled = false;
          this.transformControlsHelper.visible = false;
          this.invalidateRender();
          return;
        }
        const mode = light ? "translate" : this.state.transformGizmoMode;
        const target = light
          ? light.root
          : (mode === "translate" ? item.modelRoot : item.rotationPivot);
        if (!target) {
          this.transformControls.detach();
          this.transformControls.visible = false;
          this.transformControls.enabled = false;
          this.transformControlsHelper.visible = false;
          return;
        }
        this.transformControls.enabled = true;
        this.transformControls.visible = true;
        this.transformControlsHelper.visible = true;
        this.transformControls.setMode(mode);
        this.transformControls.space = mode === "translate" ? "world" : "local";
        this.transformControls.attach(target);
        this.invalidateRender();
      }

      applyTransformFromGizmo() {
        const light = this.getSelectedLight();
        if (light?.root) {
          light.root.updateMatrixWorld(true);
          light.root.getWorldPosition(light.position);
          this.state.lightX = light.position.x;
          this.state.lightY = light.position.y;
          this.state.lightZ = light.position.z;
          this.syncSelectedLightControls(true);
          this.refreshLightingModel();
          this.lastRenderFrameAt = 0;
          this.forceVisualRefresh(4);
          return;
        }
        const item = this.getSelectedItem();
        if (!item || !item.modelRoot || !item.rotationPivot) {
          return;
        }
        this.state.translateX = item.modelRoot.position.x;
        this.state.translateY = item.modelRoot.position.y;
        this.state.translateZ = item.modelRoot.position.z;
        this.state.rotationX = THREE.MathUtils.radToDeg(item.rotationPivot.rotation.x);
        this.state.rotationY = THREE.MathUtils.radToDeg(item.rotationPivot.rotation.y);
        this.state.rotationZ = THREE.MathUtils.radToDeg(item.rotationPivot.rotation.z);
        this.state.scale = item.rotationPivot.scale.x;
        item.transform.rotationX = this.state.rotationX;
        item.transform.rotationY = this.state.rotationY;
        item.transform.rotationZ = this.state.rotationZ;
        item.transform.scale = this.state.scale;
        item.transform.translateX = this.state.translateX;
        item.transform.translateY = this.state.translateY;
        item.transform.translateZ = this.state.translateZ;
        this.syncTransformInputs();
        this.scheduleSelectedTransformRefresh(false, false);
        this.forceVisualRefresh(3);
      }

      scheduleSelectedTransformRefresh(announce = false, commit = false) {
        if (this.pendingTransformRefresh != null) {
          this.pendingTransformRefresh.announce = this.pendingTransformRefresh.announce || announce;
          this.pendingTransformRefresh.commit = this.pendingTransformRefresh.commit || commit;
          return;
        }
        this.pendingTransformRefresh = { announce, commit };
        requestAnimationFrame(() => {
          const refresh = this.pendingTransformRefresh;
          this.pendingTransformRefresh = null;
          if (!this.currentMesh) {
            if (refresh?.commit) {
              this.finishDeferredInteraction();
            } else {
              this.startDeferredInteraction();
            }
            return;
          }
          this.recomputeBounds();
          this.configureDepthRangeFromBounds();
          this.updatePositionModifierBounds();
          this.refreshHelpers();
          this.updateMetaUi();
          this.updateCameraClipping();
          this.syncLightingRuntimeState();
          if (this.hoverPointer) {
            this.updateHoverReadout();
          }
          this.renderPickedColors();
          if (refresh?.announce) {
            this.updateStatus(
              `Applied splat transform: rot ${this.state.rotationX.toFixed(1)} / ${this.state.rotationY.toFixed(1)} / ${this.state.rotationZ.toFixed(1)} deg, move ${this.state.translateX.toFixed(2)} / ${this.state.translateY.toFixed(2)} / ${this.state.translateZ.toFixed(2)}, scale ${this.state.scale.toFixed(2)}`,
            );
            this.updateRenderChip("Transform updated");
          }
          this.queueSparkSceneUpdate();
          if (refresh?.commit) {
            this.finishDeferredInteraction();
          } else {
            this.invalidateRender(true);
          }
        });
      }

      setSceneListLimit(value, { commit = true, syncInput = true } = {}) {
        const nextLimit = commit
          ? Math.round(clampNumber(value, { min: 3, max: 14 }))
          : Math.max(3, Math.round(Number(value) || this.state.sceneListLimit));
        this.state.sceneListLimit = nextLimit;
        if (this.dom.sceneLimitRange) {
          this.dom.sceneLimitRange.value = String(nextLimit);
        }
        if (syncInput && this.dom.sceneLimitInput) {
          this.dom.sceneLimitInput.value = String(nextLimit);
        }
        this.syncSceneList();
      }

      setSceneSelectionIndex(value, { commit = true, syncInput = true } = {}) {
        const total = this.sceneItems.length;
        const nextIndex = commit
          ? Math.round(clampNumber(value, { min: 1, max: Math.max(total, 1) }))
          : Math.max(1, Math.round(Number(value) || 1));
        if (this.dom.sceneSelectRange) {
          this.dom.sceneSelectRange.min = total ? "1" : "0";
          this.dom.sceneSelectRange.max = String(Math.max(total, 1));
          this.dom.sceneSelectRange.value = String(total ? Math.min(nextIndex, total) : 0);
          this.dom.sceneSelectRange.disabled = total <= 1;
        }
        if (syncInput && this.dom.sceneSelectInput) {
          this.dom.sceneSelectInput.value = String(total ? Math.min(nextIndex, total) : 0);
        }
        if (!total) {
          return;
        }
        const item = this.sceneItems[Math.min(Math.max(nextIndex - 1, 0), total - 1)];
        if (item) {
          this.selectSceneItem(item.id);
        }
      }

      toggleExportItem(itemId) {
        const item = this.getSceneItemById(itemId);
        if (!item) {
          return;
        }
        item.exportEnabled = !item.exportEnabled;
        this.syncExportList();
        this.updateStatus(`${item.modelMeta.name} export ${item.exportEnabled ? "enabled" : "disabled"}`);
      }

      setAllExportEnabled(enabled) {
        this.sceneItems.forEach((item) => {
          item.exportEnabled = enabled;
        });
        this.syncExportList();
        this.updateStatus(enabled ? "Enabled export for all splats" : "Disabled export for all splats");
      }

      syncExportList() {
        if (!this.dom.exportList || !this.dom.exportEmpty) {
          return;
        }
        this.dom.exportList.replaceChildren();
        this.dom.exportEmpty.hidden = this.sceneItems.length > 0;
        this.sceneItems.forEach((item) => {
          const row = document.createElement("div");
          row.className = `scene-item${item.exportEnabled ? " is-active" : ""}`;

          const body = document.createElement("div");
          body.className = "scene-item-main";

          const title = document.createElement("span");
          title.className = "scene-item-title";
          title.textContent = item.modelMeta.name;

          const meta = document.createElement("span");
          meta.className = "scene-item-meta";
          meta.textContent = `${item.modelMeta.splats || 0} splats`;

          body.append(title, meta);

          const toggleButton = document.createElement("button");
          toggleButton.type = "button";
          toggleButton.className = `scene-item-button${item.exportEnabled ? " is-active" : ""}`;
          toggleButton.textContent = item.exportEnabled ? "On" : "Off";
          toggleButton.title = "Toggle whether this splat will be included in export.";
          toggleButton.addEventListener("click", () => this.toggleExportItem(item.id));

          row.append(body, toggleButton);
          this.dom.exportList.append(row);
        });
      }

      setGridScaleMode(mode) {
        const nextMode = ["auto", "1", "10", "100", "custom"].includes(mode) ? mode : "auto";
        this.state.gridScaleMode = nextMode;
        if (nextMode !== "auto" && nextMode !== "custom") {
          this.state.gridScaleValue = Number(nextMode);
        }
        this.syncGridControls();
        this.refreshHelpers();
      }

      setGridScaleValue(value, { commit = true, syncInput = true } = {}) {
        const parsed = commit
          ? clampNumber(value, { min: 0.01, max: 100000 })
          : Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return;
        }
        this.state.gridScaleValue = parsed;
        this.state.gridScaleMode = ["1", "10", "100"].includes(String(parsed)) ? String(parsed) : "custom";
        this.syncGridControls(syncInput);
        this.refreshHelpers();
      }

      syncGridControls(syncInput = true) {
        if (this.dom.gridScaleSelect) {
          this.dom.gridScaleSelect.value = this.state.gridScaleMode;
        }
        if (syncInput && this.dom.gridScaleInput) {
          this.dom.gridScaleInput.value = formatNumber(this.state.gridScaleValue, this.state.gridScaleValue < 10 ? 2 : 0);
        }
      }

      getAutoGridStep(gridSize) {
        if (!Number.isFinite(gridSize) || gridSize <= 4) {
          return 1;
        }
        if (gridSize <= 40) {
          return 1;
        }
        if (gridSize <= 400) {
          return 10;
        }
        return 100;
      }

      syncSceneList() {
        if (!this.dom.sceneList || !this.dom.sceneEmpty) {
          return;
        }
        this.dom.sceneList.replaceChildren();
        this.dom.sceneEmpty.hidden = this.sceneItems.length > 0;
        const total = this.sceneItems.length;
        const limit = Math.max(3, Math.round(this.state.sceneListLimit || 6));
        const rowHeight = 78;
        this.dom.sceneList.style.maxHeight = `${rowHeight * limit}px`;
        const selectedIndex = Math.max(this.sceneItems.findIndex((item) => item.id === this.selectedSceneItemId), 0);
        if (this.dom.sceneLimitRange) {
          this.dom.sceneLimitRange.value = String(limit);
        }
        if (this.dom.sceneLimitInput) {
          this.dom.sceneLimitInput.value = String(limit);
        }
        if (this.dom.sceneSelectRange) {
          this.dom.sceneSelectRange.min = total ? "1" : "0";
          this.dom.sceneSelectRange.max = String(Math.max(total, 1));
          this.dom.sceneSelectRange.value = String(total ? selectedIndex + 1 : 0);
          this.dom.sceneSelectRange.disabled = total <= 1;
        }
        if (this.dom.sceneSelectInput) {
          this.dom.sceneSelectInput.value = String(total ? selectedIndex + 1 : 0);
        }
        this.sceneItems.forEach((item) => {
          const row = document.createElement("div");
          row.className = "scene-item";
          if (item.id === this.selectedSceneItemId) {
            row.classList.add("is-active");
          }

          const mainButton = document.createElement("button");
          mainButton.type = "button";
          mainButton.className = "scene-item-main";
          mainButton.title = "Select this splat item.";
          mainButton.addEventListener("click", () => this.selectSceneItem(item.id));

          const name = document.createElement("p");
          name.className = "scene-item-name";
          name.textContent = item.modelMeta.name;
          const meta = document.createElement("p");
          meta.className = "scene-item-meta";
          const splatText = item.modelMeta.splats
            ? `${item.modelMeta.splats.toLocaleString()} splats`
            : "No splats";
          meta.textContent = `${item.visible ? "Visible" : "Hidden"} / ${splatText}`;
          mainButton.append(name, meta);

          const toggleButton = document.createElement("button");
          toggleButton.type = "button";
          toggleButton.className = "scene-item-button";
          if (!item.visible) {
            toggleButton.classList.add("is-hidden");
          }
          toggleButton.textContent = item.visible ? "On" : "Off";
          toggleButton.title = "Toggle item visibility.";
          toggleButton.addEventListener("click", () => this.toggleSceneItemVisibility(item.id));

          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "scene-item-button";
          deleteButton.textContent = "Delete";
          deleteButton.title = "Delete this splat item from the scene.";
          deleteButton.addEventListener("click", () => this.removeSceneItem(item.id));

          row.append(mainButton, toggleButton, deleteButton);
          this.dom.sceneList.append(row);
        });
        this.syncExportList();
      }

      syncLightList() {
        if (!this.dom.lightList || !this.dom.lightEmpty) {
          return;
        }
        this.dom.lightList.replaceChildren();
        this.dom.lightEmpty.hidden = this.sceneLights.length > 0;
        this.sceneLights.forEach((light) => {
          const row = document.createElement("div");
          row.className = "scene-item";
          if (light.id === this.selectedLightId) {
            row.classList.add("is-active");
          }

          const mainButton = document.createElement("button");
          mainButton.type = "button";
          mainButton.className = "scene-item-main";
          mainButton.title = "Select this point light.";
          mainButton.addEventListener("click", () => this.selectLight(light.id));

          const name = document.createElement("p");
          name.className = "scene-item-name";
          name.textContent = light.name;

          const meta = document.createElement("p");
          meta.className = "scene-item-meta";
          meta.textContent =
            `${light.visible ? "On" : "Off"} / I ${formatNumber(light.intensity, light.intensity < 10 ? 2 : 1)}`;
          mainButton.append(name, meta);

          const toggleButton = document.createElement("button");
          toggleButton.type = "button";
          toggleButton.className = "scene-item-button";
          if (!light.visible) {
            toggleButton.classList.add("is-hidden");
          }
          toggleButton.textContent = light.visible ? "On" : "Off";
          toggleButton.title = "Toggle this point light.";
          toggleButton.addEventListener("click", () => this.toggleLightVisibility(light.id));

          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "scene-item-button";
          deleteButton.textContent = "Delete";
          deleteButton.title = "Delete this point light.";
          deleteButton.addEventListener("click", () => this.removeLight(light.id));

          row.append(mainButton, toggleButton, deleteButton);
          this.dom.lightList.append(row);
        });
      }

      addPointLight() {
        const light = this.createLightRecord();
        light.position.copy(this.camera.position);
        this.updateLightVisual(light);
        this.sceneLights.push(light);
        this.selectLight(light.id, false);
        this.syncLightList();
        this.refreshLightingModel({ forceModifierRebuild: true });
        this.updateStatus(`Added ${light.name}`);
      }

      toggleLightVisibility(lightId) {
        const light = this.sceneLights.find((entry) => entry.id === lightId);
        if (!light) {
          return;
        }
        light.visible = !light.visible;
        this.updateLightVisual(light);
        this.syncLightList();
        this.syncTransformGizmo();
        this.refreshLightingModel();
        this.updateStatus(`${light.name} ${light.visible ? "shown" : "hidden"}`);
      }

      removeLight(lightId) {
        const index = this.sceneLights.findIndex((entry) => entry.id === lightId);
        if (index < 0) {
          return;
        }
        const [light] = this.sceneLights.splice(index, 1);
        this.lightSceneRoot.remove(light.root);
        light.root.traverse?.((child) => {
          child.geometry?.dispose?.();
          child.material?.dispose?.();
        });
        const wasSelected = light.id === this.selectedLightId;
        if (wasSelected) {
          const nextLight = this.sceneLights[index] || this.sceneLights[index - 1] || null;
          this.selectedLightId = nextLight?.id ?? null;
        }
        this.syncSelectedLightControls(true);
        this.syncLightList();
        this.syncTransformGizmo();
        this.updateTransformGizmoButtons();
        this.refreshLightingModel({ forceModifierRebuild: true });
        this.updateStatus(`Removed ${light.name}`);
      }

      applySelectedLightIntensity(updateStatus = true, syncInput = true) {
        const light = this.getSelectedLight();
        const intensity = clampNumber(this.state.lightIntensity, LIGHT_INTENSITY_LIMITS);
        this.state.lightIntensity = intensity;
        if (this.dom.lightIntensityRange) {
          this.dom.lightIntensityRange.value = String(Math.min(intensity, 100));
        }
        if (syncInput && this.dom.lightIntensityInput) {
          this.dom.lightIntensityInput.value = intensity.toFixed(intensity < 10 ? 2 : 1);
        }
        if (!light) {
          return;
        }
        light.intensity = intensity;
        this.updateLightVisual(light);
        this.syncLightList();
        this.refreshLightingModel();
        if (updateStatus) {
          this.updateStatus(`${light.name} intensity updated`);
        }
      }

      applySelectedLightHelperScale(updateStatus = true, syncInput = true) {
        const light = this.getSelectedLight();
        const helperScale = clampNumber(this.state.lightHelperScale, LIGHT_HELPER_SCALE_LIMITS);
        this.state.lightHelperScale = helperScale;
        if (this.dom.lightHelperScaleRange) {
          this.dom.lightHelperScaleRange.value = String(helperScale);
        }
        if (syncInput && this.dom.lightHelperScaleInput) {
          this.dom.lightHelperScaleInput.value = formatNumber(helperScale, 2);
        }
        if (!light) {
          return;
        }
        light.helperScale = helperScale;
        this.updateLightVisual(light);
        this.invalidateRender();
        if (updateStatus) {
          this.updateStatus(`${light.name} helper size updated`);
        }
      }

      setSelectedLightHelperScale(value, { commit = true, syncInput = true } = {}) {
        this.state.lightHelperScale = commit ? clampNumber(value, LIGHT_HELPER_SCALE_LIMITS) : Number(value);
        if (!Number.isFinite(this.state.lightHelperScale)) {
          return;
        }
        this.applySelectedLightHelperScale(true, syncInput);
        if (commit) {
          this.finishDeferredInteraction();
        } else {
          this.startDeferredInteraction();
        }
      }

      setSelectedLightIntensity(value, { commit = true, syncInput = true } = {}) {
        this.state.lightIntensity = commit ? clampNumber(value, LIGHT_INTENSITY_LIMITS) : Number(value);
        this.applySelectedLightIntensity(true, syncInput);
        if (commit) {
          this.finishDeferredInteraction();
        } else {
          this.startDeferredInteraction();
        }
      }

      applySelectedLightColor(commit = false) {
        const light = this.getSelectedLight();
        const color = clampLightColor({
          r: commit ? clampNumber(this.dom.lightRInput?.value ?? this.state.lightR, LIGHT_COLOR_COMPONENT_LIMITS) : this.dom.lightRInput?.value,
          g: commit ? clampNumber(this.dom.lightGInput?.value ?? this.state.lightG, LIGHT_COLOR_COMPONENT_LIMITS) : this.dom.lightGInput?.value,
          b: commit ? clampNumber(this.dom.lightBInput?.value ?? this.state.lightB, LIGHT_COLOR_COMPONENT_LIMITS) : this.dom.lightBInput?.value,
        });
        this.state.lightR = color.r;
        this.state.lightG = color.g;
        this.state.lightB = color.b;
        if (light) {
          light.color = { ...color };
          this.updateLightVisual(light);
          this.syncLightList();
          this.refreshLightingModel();
        }
        if (commit) {
          this.syncSelectedLightControls(true);
          this.finishDeferredInteraction();
        } else {
          this.startDeferredInteraction();
        }
      }

      applySelectedLightPosition(commit = false) {
        const light = this.getSelectedLight();
        const xRaw = this.dom.lightXInput?.value?.trim() ?? "0";
        const yRaw = this.dom.lightYInput?.value?.trim() ?? "0";
        const zRaw = this.dom.lightZInput?.value?.trim() ?? "0";
        this.state.lightX = commit
          ? clampNumber(xRaw, LIGHT_POSITION_LIMITS)
          : (Number.isFinite(Number(xRaw)) ? Number(xRaw) : this.state.lightX);
        this.state.lightY = commit
          ? clampNumber(yRaw, LIGHT_POSITION_LIMITS)
          : (Number.isFinite(Number(yRaw)) ? Number(yRaw) : this.state.lightY);
        this.state.lightZ = commit
          ? clampNumber(zRaw, LIGHT_POSITION_LIMITS)
          : (Number.isFinite(Number(zRaw)) ? Number(zRaw) : this.state.lightZ);
        if (light) {
          light.position.set(this.state.lightX, this.state.lightY, this.state.lightZ);
          this.updateLightVisual(light);
          if (this.transformControls.object === light.root) {
            this.transformControls.attach(light.root);
          }
          this.syncLightList();
          this.refreshLightingModel();
          if (commit) {
            this.finishDeferredInteraction();
          } else {
            this.startDeferredInteraction();
          }
        }
        if (commit) {
          this.syncSelectedLightControls(true);
        }
      }

      collectLightOccluderSamples() {
        const visibleItems = this.sceneItems.filter((item) => item.visible && item.mesh);
        if (!visibleItems.length) {
          return [];
        }
        const perItemBudget = Math.max(4, Math.floor(LIGHT_OCCLUDER_LIMIT / Math.max(visibleItems.length, 1)));
        const samples = [];
        visibleItems.forEach((item) => {
          const sourceEntries = item.hoverEntries?.length
            ? item.hoverEntries
            : (this.createMeshHoverEntries(item, perItemBudget * 12) || []);
          if (!sourceEntries.length) {
            return;
          }
          const step = Math.max(1, Math.ceil(sourceEntries.length / perItemBudget));
          for (let index = 0; index < sourceEntries.length && samples.length < LIGHT_OCCLUDER_LIMIT; index += step) {
            const entry = sourceEntries[index];
            const radius = Math.max(
              Number(entry.scale?.x ?? 0.05) || 0.05,
              Number(entry.scale?.y ?? 0.05) || 0.05,
              Number(entry.scale?.z ?? 0.05) || 0.05,
            );
            samples.push({
              itemId: item.id,
              localPosition: entry.position.clone(),
              opacity: THREE.MathUtils.clamp(Number(entry.alpha ?? 1) || 0, 0, 1),
              radius,
            });
            if (samples.length >= LIGHT_OCCLUDER_LIMIT) {
              break;
            }
          }
        });
        return samples;
      }

      syncLightingRuntimeState() {
        this.syncVisibleSceneItemTransforms();
        this.lightSceneRoot.updateMatrixWorld(true);
        const activeLights = this.sceneLights.filter((light) => light.visible);
        this.activeLightCount = activeLights.length;
        this.ensureDynoHandleArray(
          this.lightHandles.positions,
          this.activeLightCount,
          (index) => dynoVec3(new THREE.Vector3(), `viewerLightPosition${index}`),
        );
        this.ensureDynoHandleArray(
          this.lightHandles.intensities,
          this.activeLightCount,
          (index) => dynoFloat(0, `viewerLightIntensity${index}`),
        );
        this.ensureDynoHandleArray(
          this.lightHandles.colorR,
          this.activeLightCount,
          (index) => dynoFloat(DEFAULT_LIGHT_COLOR.r, `viewerLightColorR${index}`),
        );
        this.ensureDynoHandleArray(
          this.lightHandles.colorG,
          this.activeLightCount,
          (index) => dynoFloat(DEFAULT_LIGHT_COLOR.g, `viewerLightColorG${index}`),
        );
        this.ensureDynoHandleArray(
          this.lightHandles.colorB,
          this.activeLightCount,
          (index) => dynoFloat(DEFAULT_LIGHT_COLOR.b, `viewerLightColorB${index}`),
        );
        const lightWorldPosition = new THREE.Vector3();
        activeLights.forEach((light, index) => {
          light.root.updateMatrixWorld(true);
          light.root.getWorldPosition(lightWorldPosition);
          light.position.copy(lightWorldPosition);
          const lightColor = clampLightColor(light.color ?? DEFAULT_LIGHT_COLOR);
          this.lightHandles.positions[index].value.copy(lightWorldPosition);
          this.lightHandles.intensities[index].value = light.intensity;
          this.lightHandles.colorR[index].value = lightColor.r;
          this.lightHandles.colorG[index].value = lightColor.g;
          this.lightHandles.colorB[index].value = lightColor.b;
        });
        this.activeOccluderCount = 0;
        this.runtimeLightOccluders = [];
      }

      refreshLightingModel({ forceModifierRebuild = false } = {}) {
        const previousLightCount = this.activeLightCount;
        this.syncLightingRuntimeState();
        const needsRebuild = forceModifierRebuild
          || previousLightCount !== this.activeLightCount;
        if (needsRebuild) {
          this.applyRenderMode(false);
          this.queueSparkSceneUpdate();
          return;
        }
        if (this.hoverPointer) {
          this.updateHoverReadout();
        }
        this.renderPickedColors();
        this.invalidateRender();
        this.forceVisualRefresh(2);
        this.queueSparkSceneUpdate();
      }

      getSceneExposureScale() {
        return this.getGlobalExposureScale();
      }

      getItemExposureScale(item) {
        return this.getRenderModeForItem(item) === "beauty"
          ? this.getBeautyExposureScaleForItem(item)
          : 1;
      }

      getSceneItemById(itemId) {
        return this.sceneItems.find((item) => item.id === itemId) || null;
      }

      setHoverChip(itemText, colorText) {
        if (this.dom.hoverChipItem && this.dom.hoverChipColor) {
          this.dom.hoverChipItem.textContent = `Item ${itemText}`;
          this.dom.hoverChipColor.textContent = `Color ${colorText}`;
          return;
        }
        this.hoverReadout = `Item ${itemText} | Color ${colorText}`;
        if (this.dom.hoverChip) {
          this.dom.hoverChip.textContent = this.hoverReadout;
        }
      }

      syncColorPickButton() {
        if (!this.dom.pickColorButton) {
          return;
        }
        this.dom.pickColorButton.classList.toggle("is-active", this.isColorPickMode);
        this.dom.pickColorButton.textContent = this.isColorPickMode ? "Click In View" : "Pick Hovered";
        this.dom.stage?.classList.toggle("is-picking", this.isColorPickMode);
      }

      startColorPickMode() {
        this.isColorPickMode = true;
        this.syncColorPickButton();
        this.updateStatus("Color picker active. Left-click the 3D view to confirm.");
      }

      stopColorPickMode() {
        this.isColorPickMode = false;
        this.syncColorPickButton();
      }

      createMeshHoverEntries(item, maxEntries = 4096) {
        const packedSplats = item?.mesh?.packedSplats;
        const count = Number(item?.mesh?.numSplats ?? packedSplats?.numSplats ?? 0);
        if (!packedSplats || !count) {
          return null;
        }
        const entries = [];
        const step = Math.max(1, Math.floor(count / Math.max(maxEntries, 1)));
        for (let index = 0; index < count; index += step) {
          const splat = packedSplats.getSplat
            ? packedSplats.getSplat(index)
            : unpackSplat(packedSplats.packedArray, index, item.mesh.packedSplats?.splatEncoding);
          const center = splat?.center ?? splat?.position;
          const scales = splat?.scales ?? splat?.scale;
          if (!center) {
            continue;
          }
          entries.push({
            alpha: Number(splat.opacity ?? splat.alpha ?? splat.rgba?.w ?? splat.rgba?.a ?? 1) || 0,
            color: toLinearRgbArray(splat.color ?? splat.rgb ?? splat.rgba),
            label: `Splat ${index + 1}`,
            position: new THREE.Vector3(center.x, center.y, center.z),
            scale: new THREE.Vector3(
              Number(scales?.x ?? 0.05) || 0.05,
              Number(scales?.y ?? 0.05) || 0.05,
              Number(scales?.z ?? 0.05) || 0.05,
            ),
            splatIndex: index,
          });
        }
        return entries;
      }

      getVisibleMeshHitsFromPointer(pointer = this.hoverPointer) {
        if (!pointer) {
          return [];
        }
        this.pointer.set(pointer.x, pointer.y);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        return this.raycaster.intersectObjects(
          this.sceneItems.filter((item) => item.visible && item.mesh).map((item) => item.mesh),
          true,
        );
      }

      getTopHoverHit(pointer = this.hoverPointer) {
        const hits = this.getVisibleMeshHitsFromPointer(pointer);
        if (!hits.length) {
          return null;
        }
        hits.sort((left, right) => left.distance - right.distance);
        const hit = hits[0];
        const sceneItemId = hit.object?.userData?.sceneItemId ?? hit.object?.parent?.userData?.sceneItemId;
        if (!sceneItemId) {
          return null;
        }
        const sceneItem = this.getSceneItemById(sceneItemId);
        if (!sceneItem) {
          return null;
        }
        return { hit, sceneItem };
      }

      resolvePrimitiveHoverSample(item, worldPoint) {
        if (!item?.hoverEntries?.length || !item.mesh) {
          return null;
        }
        const localPoint = worldPoint
          .clone()
          .applyMatrix4(item.mesh.matrixWorld.clone().invert());
        let bestEntry = null;
        let bestDistance = Infinity;
        item.hoverEntries.forEach((entry, index) => {
          const distanceSq = localPoint.distanceToSquared(entry.position);
          if (distanceSq < bestDistance) {
            bestDistance = distanceSq;
            bestEntry = { entry, index };
          }
        });
        if (!bestEntry) {
          return null;
        }
        return {
          alpha: Number(bestEntry.entry.alpha ?? 1) || 0,
          baseLinearRgb: toLinearRgbArray(bestEntry.entry.color),
          itemId: item.id,
          label: bestEntry.entry.label || `Splat ${bestEntry.index + 1}`,
          localPosition: bestEntry.entry.position.clone(),
          splatIndex: bestEntry.index,
        };
      }

      resolvePrimitivePointerSample(item, pointer) {
        if (!item?.hoverEntries?.length || !item.mesh || !pointer) {
          return null;
        }
        const worldPosition = new THREE.Vector3();
        const viewPosition = new THREE.Vector3();
        const ndcPosition = new THREE.Vector3();
        let bestEntry = null;
        let bestDistance = Infinity;
        let bestDepth = Infinity;
        item.hoverEntries.forEach((entry, index) => {
          worldPosition.copy(entry.position).applyMatrix4(item.mesh.matrixWorld);
          viewPosition.copy(worldPosition).applyMatrix4(this.camera.matrixWorldInverse);
          if (viewPosition.z >= 0) {
            return;
          }
          ndcPosition.copy(worldPosition).project(this.camera);
          const distanceSq = ((ndcPosition.x - pointer.x) ** 2) + ((ndcPosition.y - pointer.y) ** 2);
          const depth = -viewPosition.z;
          if (distanceSq < bestDistance - 1e-8 || (Math.abs(distanceSq - bestDistance) <= 1e-8 && depth < bestDepth)) {
            bestDistance = distanceSq;
            bestDepth = depth;
            bestEntry = { entry, index };
          }
        });
        if (!bestEntry) {
          return null;
        }
        return {
          alpha: Number(bestEntry.entry.alpha ?? 1) || 0,
          baseLinearRgb: toLinearRgbArray(bestEntry.entry.color),
          itemId: item.id,
          label: bestEntry.entry.label || `Splat ${bestEntry.index + 1}`,
          localPosition: bestEntry.entry.position.clone(),
          screenDistanceSq: bestDistance,
          splatIndex: bestEntry.index,
          viewDepth: bestDepth,
        };
      }

      resolvePackedHoverSample(item, worldPoint) {
        const packedSplats = item?.mesh?.packedSplats;
        const count = Number(item?.mesh?.numSplats ?? packedSplats?.numSplats ?? 0);
        if (!packedSplats || !count) {
          return null;
        }
        const inverseMatrix = item.mesh.matrixWorld.clone().invert();
        const localPoint = worldPoint.clone().applyMatrix4(inverseMatrix);
        let bestIndex = -1;
        let bestSplat = null;
        let bestDistance = Infinity;
        for (let index = 0; index < count; index += 1) {
          const splat = packedSplats.getSplat
            ? packedSplats.getSplat(index)
            : unpackSplat(packedSplats.packedArray, index, item.mesh.packedSplats?.splatEncoding);
          const center = splat?.center ?? splat?.position;
          if (!center) {
            continue;
          }
          const distanceSq = localPoint.distanceToSquared(
            new THREE.Vector3(center.x, center.y, center.z),
          );
          if (distanceSq < bestDistance) {
            bestDistance = distanceSq;
            bestIndex = index;
            bestSplat = splat;
          }
        }
        if (!bestSplat || bestIndex < 0) {
          return null;
        }
        return {
          alpha: Number(bestSplat.opacity ?? bestSplat.alpha ?? bestSplat.rgba?.w ?? bestSplat.rgba?.a ?? 1) || 0,
          baseLinearRgb: toLinearRgbArray(bestSplat.color ?? bestSplat.rgb ?? bestSplat.rgba),
          itemId: item.id,
          label: `Splat ${bestIndex + 1}`,
          localPosition: new THREE.Vector3(
            bestSplat.center?.x ?? bestSplat.position?.x ?? 0,
            bestSplat.center?.y ?? bestSplat.position?.y ?? 0,
            bestSplat.center?.z ?? bestSplat.position?.z ?? 0,
          ),
          splatIndex: bestIndex,
        };
      }

      resolvePackedPointerSample(item, pointer) {
        const packedSplats = item?.mesh?.packedSplats;
        const count = Number(item?.mesh?.numSplats ?? packedSplats?.numSplats ?? 0);
        if (!packedSplats || !count || !pointer) {
          return null;
        }
        const worldPosition = new THREE.Vector3();
        const viewPosition = new THREE.Vector3();
        const ndcPosition = new THREE.Vector3();
        let bestIndex = -1;
        let bestSplat = null;
        let bestDistance = Infinity;
        let bestDepth = Infinity;
        for (let index = 0; index < count; index += 1) {
          const splat = packedSplats.getSplat
            ? packedSplats.getSplat(index)
            : unpackSplat(packedSplats.packedArray, index, item.mesh.packedSplats?.splatEncoding);
          const center = splat?.center ?? splat?.position;
          if (!center) {
            continue;
          }
          worldPosition.set(center.x, center.y, center.z).applyMatrix4(item.mesh.matrixWorld);
          viewPosition.copy(worldPosition).applyMatrix4(this.camera.matrixWorldInverse);
          if (viewPosition.z >= 0) {
            continue;
          }
          ndcPosition.copy(worldPosition).project(this.camera);
          const distanceSq = ((ndcPosition.x - pointer.x) ** 2) + ((ndcPosition.y - pointer.y) ** 2);
          const depth = -viewPosition.z;
          if (distanceSq < bestDistance - 1e-8 || (Math.abs(distanceSq - bestDistance) <= 1e-8 && depth < bestDepth)) {
            bestDistance = distanceSq;
            bestDepth = depth;
            bestIndex = index;
            bestSplat = splat;
          }
        }
        if (!bestSplat || bestIndex < 0) {
          return null;
        }
        return {
          alpha: Number(bestSplat.opacity ?? bestSplat.alpha ?? bestSplat.rgba?.w ?? bestSplat.rgba?.a ?? 1) || 0,
          baseLinearRgb: toLinearRgbArray(bestSplat.color ?? bestSplat.rgb ?? bestSplat.rgba),
          itemId: item.id,
          label: `Splat ${bestIndex + 1}`,
          localPosition: new THREE.Vector3(
            bestSplat.center?.x ?? bestSplat.position?.x ?? 0,
            bestSplat.center?.y ?? bestSplat.position?.y ?? 0,
            bestSplat.center?.z ?? bestSplat.position?.z ?? 0,
          ),
          screenDistanceSq: bestDistance,
          splatIndex: bestIndex,
          viewDepth: bestDepth,
        };
      }

      resolveColorSampleFromHit(item, worldPoint) {
        if (!item?.mesh || !worldPoint) {
          return null;
        }
        return this.resolvePrimitiveHoverSample(item, worldPoint)
          ?? this.resolvePackedHoverSample(item, worldPoint);
      }

      resolveColorSampleFromPointer(pointer) {
        if (!pointer) {
          return null;
        }
        let bestSample = null;
        this.sceneItems.forEach((item) => {
          if (!item.visible || !item.mesh) {
            return;
          }
          const sample = item.hoverEntries?.length
            ? this.resolvePrimitivePointerSample(item, pointer)
            : this.resolvePackedPointerSample(item, pointer);
          if (!sample) {
            return;
          }
          if (
            !bestSample
            || sample.screenDistanceSq < bestSample.screenDistanceSq - 1e-8
            || (
              Math.abs(sample.screenDistanceSq - bestSample.screenDistanceSq) <= 1e-8
              && sample.viewDepth < bestSample.viewDepth
            )
          ) {
            bestSample = sample;
          }
        });
        return bestSample;
      }

      resolveCurrentPickSample() {
        const liveHit = this.getTopHoverHit();
        if (liveHit) {
          this.lastHoverHit = {
            itemId: liveHit.sceneItem.id,
            point: liveHit.hit.point.clone(),
          };
          return this.resolveColorSampleFromHit(liveHit.sceneItem, liveHit.hit.point);
        }
        if (!this.lastHoverHit) {
          return null;
        }
        const item = this.getSceneItemById(this.lastHoverHit.itemId);
        if (!item?.mesh) {
          return null;
        }
        return this.resolveColorSampleFromHit(item, this.lastHoverHit.point);
      }

      getSampleWorldPosition(item, sample) {
        if (!item?.mesh || !sample?.localPosition) {
          return null;
        }
        return sample.localPosition.clone().applyMatrix4(item.mesh.matrixWorld);
      }

      evaluateLightTransmission(lightPosition, targetPosition, sourceItemId = null) {
        void lightPosition;
        void targetPosition;
        void sourceItemId;
        return 1;
      }

      getDisplayLinearColorForSample(item, sample) {
        if (!item || !sample) {
          return [0, 0, 0];
        }
        const itemMode = this.getRenderModeForItem(item);
        const splatExposureScale = itemMode === "beauty" ? this.getBeautyExposureScaleForItem(item) : 1;
        const toneCurve = item.settings?.toneCurve ?? buildToneCurveState();
        const linear = sample.baseLinearRgb.map((value) => Math.max(value * splatExposureScale, 0));
        if (itemMode !== "beauty" || !this.sceneLights.length) {
          return applyToneCurveToLinearRgb(linear, toneCurve);
        }
        const worldPosition = this.getSampleWorldPosition(item, sample);
        if (!worldPosition) {
          return applyToneCurveToLinearRgb(linear, toneCurve);
        }
        let lightSum = 0;
        this.sceneLights.forEach((light) => {
          if (!light.visible) {
            return;
          }
          const distanceSq = Math.max(light.position.distanceToSquared(worldPosition), 0.0001);
          lightSum += (light.intensity / distanceSq) * this.evaluateLightTransmission(light.position, worldPosition, item.id);
        });
        const lightMultiplier = 1 + lightSum;
        return applyToneCurveToLinearRgb([
          Math.max(linear[0] * lightMultiplier, 0),
          Math.max(linear[1] * lightMultiplier, 0),
          Math.max(linear[2] * lightMultiplier, 0),
        ], toneCurve);
      }

      getPickedColorDisplay(entry) {
        const item = this.getSceneItemById(entry.itemId);
        if (!item) {
          return null;
        }
        const displayLinear = this.getDisplayLinearColorForSample(item, entry);
        const displayAlpha = Math.max(entry.alpha * (item.settings.opacity ?? 1), 0);
        return {
          alpha: displayAlpha,
          item,
          linear: displayLinear,
          srgb: linearRgbToSrgb8(displayLinear),
        };
      }

      renderPickedColors() {
        if (!this.dom.pickedColorsList || !this.dom.pickedColorsEmpty) {
          return;
        }
        this.dom.pickedColorsList.replaceChildren();
        const validEntries = this.pickedColors
          .map((entry) => ({ entry, display: this.getPickedColorDisplay(entry) }))
          .filter(({ display }) => display);
        this.dom.pickedColorsEmpty.hidden = validEntries.length > 0;
        validEntries.forEach(({ entry, display }) => {
          const row = document.createElement("div");
          row.className = "picked-color-row";

          const swatch = document.createElement("div");
          swatch.className = "picked-color-swatch";
          swatch.style.background = `rgb(${display.srgb[0]}, ${display.srgb[1]}, ${display.srgb[2]})`;

          const body = document.createElement("div");
          body.className = "picked-color-body";

          const title = document.createElement("p");
          title.className = "picked-color-title";
          title.textContent = `${display.item.modelMeta.name} / ${entry.label}`;

          const meta = document.createElement("p");
          meta.className = "picked-color-meta";
          meta.textContent =
            `sRGB ${formatSrgbColor(display.linear)}\n` +
            `linear ${formatLinearColor(display.linear)}\n` +
            `alpha ${display.alpha.toFixed(display.alpha < 10 ? 2 : 1)}`;

          body.append(title, meta);

          const removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.className = "scene-item-button";
          removeButton.textContent = "Remove";
          removeButton.title = "Remove this picked color.";
          removeButton.addEventListener("click", () => this.removePickedColor(entry.id));

          row.append(swatch, body, removeButton);
          this.dom.pickedColorsList.append(row);
        });
      }

      removePickedColor(entryId) {
        this.pickedColors = this.pickedColors.filter((entry) => entry.id !== entryId);
        this.renderPickedColors();
      }

      removePickedColorsForItem(itemId) {
        const previousLength = this.pickedColors.length;
        this.pickedColors = this.pickedColors.filter((entry) => entry.itemId !== itemId);
        if (this.pickedColors.length !== previousLength) {
          this.renderPickedColors();
        }
      }

      clearPickedColors() {
        this.pickedColors = [];
        this.renderPickedColors();
        this.updateStatus("Cleared picked splat colors");
      }

      pickHoveredColor({ fromPointerClick = false } = {}) {
        const sample = this.resolveCurrentPickSample()
          ?? this.resolveColorSampleFromPointer(this.hoverPointer ?? this.lastHoverPointer);
        if (!sample) {
          if (fromPointerClick) {
            this.stopColorPickMode();
          }
          this.updateStatus("No hovered splat is available to pick");
          return;
        }
        const existing = this.pickedColors.find((entry) =>
          entry.itemId === sample.itemId
            && entry.splatIndex === sample.splatIndex
            && entry.label === sample.label);
        if (existing) {
          this.pickedColors = [existing, ...this.pickedColors.filter((entry) => entry.id !== existing.id)];
          this.renderPickedColors();
          if (fromPointerClick) {
            this.stopColorPickMode();
          }
          this.updateStatus(`Updated picked color from ${existing.label}`);
          return;
        }
        this.pickedColors.unshift({
          alpha: sample.alpha,
          baseLinearRgb: sample.baseLinearRgb.slice(),
          id: `picked-color-${++this.pickedColorSerial}`,
          itemId: sample.itemId,
          label: sample.label,
          localPosition: sample.localPosition?.clone?.() ?? null,
          splatIndex: sample.splatIndex,
        });
        this.renderPickedColors();
        if (fromPointerClick) {
          this.stopColorPickMode();
        }
        this.updateStatus(`Picked ${sample.label}`);
      }

      bindNumberPair({ input, range, limits, onChange }) {
        const getLimits = () => (typeof limits === "function" ? limits() : limits);
        range?.addEventListener("input", (event) => onChange(event.target.value, {
          commit: false,
          limits: getLimits(),
          syncInput: true,
        }));
        range?.addEventListener("change", (event) => onChange(event.target.value, {
          commit: true,
          limits: getLimits(),
          syncInput: true,
        }));
        input?.addEventListener("input", (event) => {
          const rawValue = event.target.value.trim();
          if (isIntermediateNumericInput(rawValue)) {
            return;
          }
          const parsed = Number(rawValue);
          if (!Number.isFinite(parsed)) {
            return;
          }
          onChange(parsed, {
            commit: false,
            limits: getLimits(),
            syncInput: false,
          });
        });
        input?.addEventListener("blur", (event) => onChange(event.target.value, {
          commit: true,
          limits: getLimits(),
          syncInput: true,
        }));
        input?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            onChange(event.target.value, {
              commit: true,
              limits: getLimits(),
              syncInput: true,
            });
            event.target.blur();
          }
        });
      }

      commitActiveField() {
        const active = document.activeElement;
        if (!active || active === document.body) {
          return;
        }
        if (active === this.dom.fileInput) {
          return;
        }
        if (active instanceof HTMLElement && active.matches("input, select, textarea")) {
          active.blur();
        }
      }

      applyBackground() {
        this.renderer.setClearColor(BACKGROUNDS[this.state.background] || BACKGROUNDS.graphite);
        this.invalidateRender();
      }

      applyOpacity(updateChip = true, syncInput = true) {
        const opacity = clampNumber(this.state.opacity, OPACITY_LIMITS);
        this.state.opacity = opacity;
        if (this.dom.opacityRange) {
          this.dom.opacityRange.value = String(Math.min(opacity, 2));
        }
        if (syncInput) {
          this.dom.opacityInput.value = opacity.toFixed(2);
        }
        const item = this.getSelectedItem();
        if (item) {
          item.settings.opacity = opacity;
          if (item.mesh) {
            item.mesh.opacity = opacity;
          }
          this.modelMeta = item.modelMeta;
        }
        if (updateChip) {
          this.updateRenderChip("Opacity updated");
        }
        this.syncLightingRuntimeState();
        this.renderPickedColors();
        this.invalidateRender();
      }

      setOpacity(value, { commit = true, syncInput = true } = {}) {
        this.state.opacity = commit ? clampNumber(value, OPACITY_LIMITS) : Number(value);
        this.applyOpacity(true, syncInput);
        if (commit) {
          this.finishDeferredInteraction();
        } else {
          this.startDeferredInteraction();
        }
      }

      applyFalloff(updateChip = true, syncInput = true) {
        const falloff = clampNumber(this.state.falloff, FALLOFF_LIMITS);
        this.state.falloff = falloff;
        if (this.dom.falloffRange) {
          this.dom.falloffRange.value = String(falloff);
        }
        if (syncInput) {
          this.dom.falloffInput.value = falloff.toFixed(2);
        }
        this.spark.falloff = falloff;
        const item = this.getSelectedItem();
        this.sceneItems.forEach((sceneItem) => {
          sceneItem.settings.falloff = falloff;
        });
        if (item) {
          this.modelMeta = item.modelMeta;
        }
        if (updateChip) {
          this.updateRenderChip("Falloff updated");
        }
        this.renderPickedColors();
        this.invalidateRender();
      }

      setFalloff(value, { commit = true, syncInput = true } = {}) {
        this.state.falloff = commit ? clampNumber(value, FALLOFF_LIMITS) : Number(value);
        this.applyFalloff(true, syncInput);
        if (commit) {
          this.finishDeferredInteraction();
        } else {
          this.startDeferredInteraction();
        }
      }

      triggerBrowserDownload(fileName, buffer) {
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = "none";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      async writeFileToDirectory(directoryHandle, fileName, buffer) {
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(new Uint8Array(buffer));
        await writable.close();
      }

      getPackedSplatCount(item) {
        return Number(item?.mesh?.numSplats ?? item?.mesh?.packedSplats?.numSplats ?? 0);
      }

      getPackedSplatAt(item, index) {
        const packedSplats = item?.mesh?.packedSplats;
        if (!packedSplats) {
          return null;
        }
        return packedSplats.getSplat
          ? packedSplats.getSplat(index)
          : unpackSplat(packedSplats.packedArray, index, item.mesh.packedSplats?.splatEncoding);
      }

      getSplatQuaternion(splat) {
        const source = splat?.quaternion ?? splat?.rotation ?? splat?.rot;
        if (source) {
          return new THREE.Quaternion(
            Number(source.x ?? source[1] ?? 0) || 0,
            Number(source.y ?? source[2] ?? 0) || 0,
            Number(source.z ?? source[3] ?? 0) || 0,
            Number(source.w ?? source[0] ?? 1) || 1,
          ).normalize();
        }
        const sourceNormal = splat?.normal ?? splat?.norm ?? splat?.n;
        if (sourceNormal) {
          return createQuaternionFromNormal(
            new THREE.Vector3(
              Number(sourceNormal.x ?? sourceNormal[0] ?? 0) || 0,
              Number(sourceNormal.y ?? sourceNormal[1] ?? 0) || 0,
              Number(sourceNormal.z ?? sourceNormal[2] ?? 1) || 1,
            ),
          );
        }
        return new THREE.Quaternion();
      }

      getSplatNormal(splat) {
        const source = splat?.normal ?? splat?.norm ?? splat?.n;
        const vector = source
          ? new THREE.Vector3(
            Number(source.x ?? source[0] ?? 0) || 0,
            Number(source.y ?? source[1] ?? 0) || 0,
            Number(source.z ?? source[2] ?? 1) || 1,
          )
          : new THREE.Vector3(0, 0, 1).applyQuaternion(this.getSplatQuaternion(splat));
        if (vector.lengthSq() < 1e-12) {
          return new THREE.Vector3(0, 0, 1);
        }
        return vector.normalize();
      }

      getExportOptions() {
        this.state.exportOpacity = this.dom.exportOpacityCheckbox?.checked ?? this.state.exportOpacity;
        this.state.exportFalloff = this.dom.exportFalloffCheckbox?.checked ?? this.state.exportFalloff;
        this.state.exportSh = this.dom.exportShCheckbox?.checked ?? this.state.exportSh;
        return {
          falloff: Boolean(this.state.exportFalloff),
          opacity: Boolean(this.state.exportOpacity),
          sh: Boolean(this.state.exportSh),
        };
      }

      getExportCommentsForItem(item, options) {
        const comments = [
          `gs360_export_item ${item.modelMeta?.name ?? item.id}`,
          "gs360_export_color_space linear_srgb_values_srgb_display",
        ];
        if (options.opacity) {
          comments.push(`gs360_export_opacity ${formatNumber(item.settings?.opacity ?? 1, 6)}`);
        }
        if (options.falloff) {
          comments.push(`gs360_export_falloff ${formatNumber(item.settings?.falloff ?? this.spark?.falloff ?? 1, 6)}`);
        }
        if (options.sh) {
          comments.push(`gs360_export_active_sh ${Math.round(item.settings?.shLevel ?? 0)}`);
          comments.push(`gs360_export_loaded_sh ${Math.round(item.loadedShDegree ?? 0)}`);
        }
        return comments;
      }

      buildExportSplatsForItem(item, options = this.getExportOptions()) {
        if (!item?.mesh) {
          return [];
        }
        const count = this.getPackedSplatCount(item);
        if (!count) {
          return [];
        }
        item.modelRoot.updateMatrixWorld(true);
        item.rotationPivot.updateMatrixWorld(true);
        item.mesh.updateMatrixWorld(true);
        const worldMatrix = item.mesh.matrixWorld.clone();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        worldMatrix.decompose(new THREE.Vector3(), worldQuaternion, worldScale);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);
        const exposureScale = 2 ** clampNumber(this.state.exposure, EXPOSURE_LIMITS)
          * 2 ** clampNumber(item.settings?.exposure ?? 0, EXPOSURE_LIMITS);
        const opacityScale = options.opacity
          ? clampNumber(item.settings?.opacity ?? 1, OPACITY_LIMITS)
          : 1;
        const exportSplats = [];
        for (let index = 0; index < count; index += 1) {
          const splat = this.getPackedSplatAt(item, index);
          if (!splat) {
            continue;
          }
          const center = splat.center ?? splat.position;
          const scales = splat.scales ?? splat.scale;
          if (!center || !scales) {
            continue;
          }
          const localPosition = new THREE.Vector3(
            Number(center.x ?? center[0] ?? 0) || 0,
            Number(center.y ?? center[1] ?? 0) || 0,
            Number(center.z ?? center[2] ?? 0) || 0,
          );
          const localQuaternion = this.getSplatQuaternion(splat);
          const localNormal = this.getSplatNormal(splat);
          const localScale = new THREE.Vector3(
            Math.max(Number(scales.x ?? scales[0] ?? 0.0001) || 0.0001, 0.0001),
            Math.max(Number(scales.y ?? scales[1] ?? 0.0001) || 0.0001, 0.0001),
            Math.max(Number(scales.z ?? scales[2] ?? 0.0001) || 0.0001, 0.0001),
          );
          const color = toLinearRgbArray(splat.color ?? splat.rgb ?? splat.rgba);
          const alpha = Number(splat.opacity ?? splat.alpha ?? splat.rgba?.w ?? splat.rgba?.a ?? 1) || 0;
          exportSplats.push({
            position: localPosition.applyMatrix4(worldMatrix),
            normal: localNormal.applyMatrix3(normalMatrix).normalize(),
            color: new THREE.Color(
              THREE.MathUtils.clamp(color[0] * exposureScale, 0, 1),
              THREE.MathUtils.clamp(color[1] * exposureScale, 0, 1),
              THREE.MathUtils.clamp(color[2] * exposureScale, 0, 1),
            ),
            alpha: THREE.MathUtils.clamp(alpha * opacityScale, 0.001, 0.999),
            scale: localScale.clone().multiply(worldScale).clampScalar(0.0001, 1e6),
            quaternion: worldQuaternion.clone().multiply(localQuaternion).normalize(),
          });
        }
        return exportSplats;
      }

      async saveVisibleSceneSplats() {
        const exportItems = this.sceneItems.filter((item) => item.exportEnabled && item.mesh);
        if (!exportItems.length) {
          this.updateStatus("No export-enabled splats to save");
          return;
        }
        const usedNames = new Set();
        const exportPayloads = [];
        const exportOptions = this.getExportOptions();
        for (const [index, item] of exportItems.entries()) {
          const exportSplats = this.buildExportSplatsForItem(item, exportOptions);
          if (!exportSplats.length) {
            continue;
          }
          const baseName = sanitizeDownloadName(item.modelMeta?.name ?? `scene-splat-${index + 1}`);
          exportPayloads.push({
            buffer: packGaussianPly(exportSplats, this.getExportCommentsForItem(item, exportOptions)),
            fileName: buildUniqueFileName(baseName, ".ply", usedNames),
          });
        }
        if (!exportPayloads.length) {
          this.updateStatus("No exportable splats were found");
          return;
        }
        let savedCount = 0;
        if (window.showDirectoryPicker) {
          try {
            const directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
            for (const payload of exportPayloads) {
              await this.writeFileToDirectory(directoryHandle, payload.fileName, payload.buffer);
              savedCount += 1;
            }
          } catch (error) {
            if (error?.name === "AbortError") {
              this.updateStatus("Save canceled");
              return;
            }
            throw error;
          }
        } else {
          exportPayloads.forEach((payload) => {
            this.triggerBrowserDownload(payload.fileName, payload.buffer);
            savedCount += 1;
          });
        }
        this.updateStatus(
          savedCount > 0
            ? `Saved ${savedCount} scene splat${savedCount === 1 ? "" : "s"}`
            : "No exportable splats were found",
        );
        this.forceVisualRefresh(2);
      }

      applyExposure(updateChip = true, syncInput = true) {
        const exposure = clampNumber(this.state.exposure, EXPOSURE_LIMITS);
        this.state.exposure = exposure;
        this.renderer.toneMappingExposure = 1;
        this.syncMeshExposure();
        if (this.dom.exposureRange) {
          this.dom.exposureRange.value = String(exposure);
        }
        if (syncInput) {
          this.dom.exposureInput.value = exposure.toFixed(Math.abs(exposure) < 1 ? 1 : 2);
        }
        if (updateChip) {
          this.updateRenderChip(`Exposure ${formatExposureLabel(exposure)}`);
        }
        this.syncLightingRuntimeState();
        this.renderPickedColors();
        this.invalidateRender();
      }

      setExposure(value, { commit = true, syncInput = true } = {}) {
        this.state.exposure = commit ? clampNumber(value, EXPOSURE_LIMITS) : Number(value);
        this.applyExposure(true, syncInput);
        if (commit) {
          this.finishDeferredInteraction();
        } else {
          this.startDeferredInteraction();
        }
      }

      applyToneCurve(updateChip = true, syncInput = true, { commit = true } = {}) {
        this.state.toneCurve = normalizeToneCurveState(this.state.toneCurve);
        const item = this.getSelectedItem();
        if (item) {
          item.settings.toneCurve = normalizeToneCurveState(this.state.toneCurve);
        }
        this.syncToneCurveUi(syncInput);
        if (updateChip) {
          this.updateRenderChip(`Tone curve ${summarizeToneCurve(this.state.toneCurve)}`);
        }
        if (this.hoverPointer) {
          this.updateHoverReadout();
        }
        this.renderPickedColors();
        this.applyRenderMode(false);
        this.invalidateRender();
        this.forceVisualRefresh(commit ? 2 : 1);
        if (commit) {
          this.queueSparkSceneUpdate();
          this.finishDeferredInteraction();
        } else {
          this.pendingPreviewSparkUpdate = true;
          this.startDeferredInteraction();
        }
      }

      setSelectedToneCurvePointValue(axis, value, { commit = true } = {}) {
        const toneCurve = normalizeToneCurveState(this.state.toneCurve);
        const channel = toneCurve.activeChannel;
        const index = toneCurve.selectedPointIndices[channel];
        this.state.toneCurve = updateToneCurvePoint(toneCurve, channel, index, { [axis]: value });
        this.applyToneCurve(true, true, { commit });
      }

      syncToneCurveUi(syncInput = true) {
        this.state.toneCurve = normalizeToneCurveState(this.state.toneCurve);
        const toneCurve = this.state.toneCurve;
        const channel = toneCurve.activeChannel;
        const selectedIndex = toneCurve.selectedPointIndices[channel];
        const selectedPoint = getSelectedToneCurvePoint(toneCurve, channel);
        const isEndpoint = selectedIndex <= 0 || selectedIndex >= toneCurve.curves[channel].length - 1;
        if (this.dom.toneCurveChannelSelect) {
          this.dom.toneCurveChannelSelect.value = channel;
        }
        if (syncInput && this.dom.toneCurvePointXInput) {
          this.dom.toneCurvePointXInput.value = Number(selectedPoint?.x ?? 1).toFixed(3);
        }
        if (syncInput && this.dom.toneCurvePointYInput) {
          this.dom.toneCurvePointYInput.value = Number(selectedPoint?.y ?? 1).toFixed(3);
        }
        if (this.dom.toneCurveRemovePointButton) {
          this.dom.toneCurveRemovePointButton.disabled = isEndpoint;
        }
        this.renderToneCurvePointList();
        this.renderToneCurveGraph();
      }

      renderToneCurvePointList() {
        if (!this.dom.toneCurvePointList) {
          return;
        }
        const toneCurve = normalizeToneCurveState(this.state.toneCurve);
        const channel = toneCurve.activeChannel;
        const selectedIndex = toneCurve.selectedPointIndices[channel];
        this.dom.toneCurvePointList.innerHTML = "";
        toneCurve.curves[channel].forEach((point, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "tone-curve-point-button";
          button.textContent = `${index}: ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`;
          button.classList.toggle("is-active", index === selectedIndex);
          button.addEventListener("click", () => {
            this.state.toneCurve = setToneCurveSelectedPoint(this.state.toneCurve, channel, index);
            this.syncToneCurveUi();
          });
          this.dom.toneCurvePointList.append(button);
        });
      }

      renderToneCurveGraph() {
        if (!this.dom.toneCurveGraph) {
          return;
        }
        const toneCurve = normalizeToneCurveState(this.state.toneCurve);
        const channel = toneCurve.activeChannel;
        const selectedIndex = toneCurve.selectedPointIndices[channel];
        const curve = toneCurve.curves[channel];
        const pathData = buildToneCurveSvgPathData(curve);
        this.dom.toneCurveGraph.innerHTML = `
          <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.24)" stroke-dasharray="4 4" />
          <path d="${pathData}" fill="none" stroke="rgba(127,240,215,0.95)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          ${curve.map((point, index) => {
            const cx = (point.x * 100).toFixed(3);
            const cy = (100 - point.y * 100).toFixed(3);
            const selected = index === selectedIndex;
            return `<circle class="tone-curve-point-handle" data-tone-curve-point-index="${index}" cx="${cx}" cy="${cy}" r="${selected ? 3.5 : 2.8}" fill="${selected ? '#7ff0d7' : '#f6fbff'}" stroke="rgba(6,16,25,0.88)" stroke-width="1.2" />`;
          }).join("")}
        `;
        this.dom.toneCurveGraph.querySelectorAll("[data-tone-curve-point-index]").forEach((element) => {
          const index = Number(element.getAttribute("data-tone-curve-point-index"));
          element.addEventListener("click", (event) => {
            event.preventDefault();
            this.state.toneCurve = setToneCurveSelectedPoint(this.state.toneCurve, channel, index);
            this.syncToneCurveUi();
          });
          element.addEventListener("pointerdown", (event) => this.startToneCurvePointDrag(index, event));
        });
      }

      getToneCurveGraphPointFromEvent(event) {
        if (!this.dom.toneCurveGraph) {
          return null;
        }
        const rect = this.dom.toneCurveGraph.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return null;
        }
        return {
          x: THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1),
          y: THREE.MathUtils.clamp(1 - ((event.clientY - rect.top) / rect.height), 0, 1),
        };
      }

      handleToneCurveGraphPointerDown(event) {
        if (event.button !== 0) {
          return;
        }
        if (event.target?.closest?.("[data-tone-curve-point-index]")) {
          return;
        }
        const graphPoint = this.getToneCurveGraphPointFromEvent(event);
        if (!graphPoint) {
          return;
        }
        event.preventDefault();
        const toneCurve = normalizeToneCurveState(this.state.toneCurve);
        const channel = toneCurve.activeChannel;
        const { x, y } = graphPoint;
        this.state.toneCurve = insertToneCurvePoint(this.state.toneCurve, channel, { x, y });
        this.applyToneCurve(true, true);
      }

      handleToneCurveGraphContextMenu(event) {
        event.preventDefault();
        const graphPoint = this.getToneCurveGraphPointFromEvent(event);
        if (!graphPoint) {
          return;
        }
        const toneCurve = normalizeToneCurveState(this.state.toneCurve);
        const channel = toneCurve.activeChannel;
        const index = findNearestRemovableToneCurvePointIndex(toneCurve.curves[channel], graphPoint);
        if (index == null) {
          return;
        }
        this.state.toneCurve = removeToneCurvePoint(this.state.toneCurve, channel, index);
        this.applyToneCurve(true, true);
      }

      startToneCurvePointDrag(index, event) {
        if (!this.dom.toneCurveGraph) {
          return;
        }
        const toneCurve = normalizeToneCurveState(this.state.toneCurve);
        const channel = toneCurve.activeChannel;
        if (index < 0 || index >= toneCurve.curves[channel].length) {
          return;
        }
        event.preventDefault();
        this.state.toneCurve = setToneCurveSelectedPoint(this.state.toneCurve, channel, index);
        this.toneCurvePointerDrag = { channel, index };
        this.updateToneCurvePointFromPointer(event);
      }

      updateToneCurvePointFromPointer(event) {
        if (!this.toneCurvePointerDrag || !this.dom.toneCurveGraph) {
          return;
        }
        const graphPoint = this.getToneCurveGraphPointFromEvent(event);
        if (!graphPoint) {
          return;
        }
        const { x, y } = graphPoint;
        this.state.toneCurve = updateToneCurvePoint(
          this.state.toneCurve,
          this.toneCurvePointerDrag.channel,
          this.toneCurvePointerDrag.index,
          { x, y },
        );
        this.applyToneCurve(false, true, { commit: false });
      }

      stopToneCurvePointDrag() {
        if (!this.toneCurvePointerDrag) {
          return;
        }
        this.toneCurvePointerDrag = null;
        this.applyToneCurve(true, true, { commit: true });
      }

      applySelectedExposure(updateChip = true, syncInput = true) {
        const exposure = clampNumber(this.state.selectedExposure, EXPOSURE_LIMITS);
        this.state.selectedExposure = exposure;
        if (this.dom.selectedExposureRange) {
          this.dom.selectedExposureRange.value = String(exposure);
        }
        if (syncInput && this.dom.selectedExposureInput) {
          this.dom.selectedExposureInput.value = exposure.toFixed(Math.abs(exposure) < 1 ? 1 : 2);
        }
        const item = this.getSelectedItem();
        if (item) {
          item.settings.exposure = exposure;
          this.modelMeta = item.modelMeta;
        }
        this.syncMeshExposure();
        if (updateChip) {
          this.updateRenderChip(`Selected exposure ${formatExposureLabel(exposure)}`);
        }
        this.syncLightingRuntimeState();
        this.renderPickedColors();
        this.invalidateRender();
      }

      setSelectedExposure(value, { commit = true, syncInput = true } = {}) {
        this.state.selectedExposure = commit ? clampNumber(value, EXPOSURE_LIMITS) : Number(value);
        this.applySelectedExposure(true, syncInput);
        if (commit) {
          this.finishDeferredInteraction();
        } else {
          this.startDeferredInteraction();
        }
      }

      syncMeshExposure() {
        this.sceneItems.forEach((item) => {
          if (item.mesh?.recolor) {
            const exposureScale = this.getItemExposureScale(item);
            item.mesh.recolor.setRGB(exposureScale, exposureScale, exposureScale);
          }
        });
      }

      handleStageWheel(event) {
        this.commitActiveField();
        if (this.activeMode !== "fps") {
          return;
        }
        event.preventDefault();
        const delta = THREE.MathUtils.clamp(event.deltaY, -240, 240);
        if (Math.abs(delta) < 1e-3) {
          return;
        }
        const direction = delta < 0 ? 1 : -1;
        const distance = this.firstPerson.moveSpeed * (Math.abs(delta) / 120) * 0.9 * direction;
        this.firstPerson.dolly(distance);
        this.updateCameraClipping();
      }

      applyFocalLength(refreshClipping, updateChip = true, syncInput = true) {
        const focalLength = clampNumber(this.state.focalLength, FOCAL_LENGTH_LIMITS);
        this.state.focalLength = focalLength;
        this.camera.setFocalLength(focalLength);
        this.camera.updateProjectionMatrix();
        this.dom.focalLengthRange.value = String(focalLengthToSlider(focalLength));
        if (syncInput) {
          this.dom.focalLengthInput.value = formatNumber(focalLength, focalLength < 10 ? 1 : 0);
        }
        this.dom.lensChip.textContent = `${formatNumber(focalLength, focalLength < 10 ? 1 : 0)} mm`;
        if (refreshClipping) {
          this.updateCameraClipping();
        }
        if (updateChip) {
          this.updateRenderChip("Lens updated");
        }
        this.invalidateRender();
      }

      applyMoveSpeed(updateChip = true, syncInput = true) {
        const multiplier = Math.max(this.state.moveSpeedFactor, MOVE_SPEED_LIMITS.min);
        if (this.dom.moveSpeedRange) {
          this.dom.moveSpeedRange.value = String(multiplier);
        }
        if (syncInput) {
          this.dom.moveSpeedInput.value = multiplier.toFixed(2);
        }
        const speedText = formatSpeedLabel(multiplier);
        this.dom.speedChip.textContent = speedText;
        this.firstPerson.setSpeed(multiplier);
        if (updateChip) {
          this.updateRenderChip("Move speed updated");
        }
        this.invalidateRender(false);
      }

      applyRenderFps(updateChip = true, syncInput = true) {
        const fps = clampNumber(this.state.renderFps, RENDER_FPS_LIMITS);
        this.state.renderFps = fps;
        if (syncInput && this.dom.renderFpsInput) {
          this.dom.renderFpsInput.value = String(Math.round(fps));
        }
        if (updateChip) {
          this.updateRenderChip(`Render ${Math.round(fps)} fps`);
        }
        this.markRenderActivity();
        this.invalidateRender(false);
      }

      setRenderFps(value, { commit = true, syncInput = true } = {}) {
        this.state.renderFps = commit ? clampNumber(value, RENDER_FPS_LIMITS) : Number(value);
        if (!Number.isFinite(this.state.renderFps)) {
          return;
        }
        this.applyRenderFps(true, syncInput);
      }

      setFocalLength(value, refreshClipping, { commit = true, syncInput = true } = {}) {
        this.state.focalLength = commit ? clampNumber(value, FOCAL_LENGTH_LIMITS) : Number(value);
        this.applyFocalLength(refreshClipping, true, syncInput);
      }

      setMoveSpeedFactor(value, { commit = true, syncInput = true } = {}) {
        this.state.moveSpeedFactor = commit ? clampNumber(value, MOVE_SPEED_LIMITS) : Number(value);
        this.applyMoveSpeed(true, syncInput);
      }

      configureDepthRangeFromBounds() {
        const referenceSphere = this.centerBoundsSphere ?? this.boundsSphere;
        let suggested = Math.max(referenceSphere?.radius || 0.05, 0.05);
        if (this.centerBounds) {
          this.camera.updateMatrixWorld(true);
          let furthestDepth = 0;
          getBoxCorners(this.centerBounds).forEach((corner) => {
            furthestDepth = Math.max(furthestDepth, corner.distanceTo(this.camera.position));
          });
          if (furthestDepth > 0) {
            suggested = furthestDepth;
          }
        }
        suggested = Math.max(suggested * 1.05, 0.05);
        this.depthRangeLimits = {
          min: 0.01,
          max: Math.max(suggested * 8, suggested + 1, 5),
        };
        if (this.depthRangeIsAuto || !Number.isFinite(this.state.depthRange)) {
          this.state.depthRange = suggested;
        }
        this.applyDepthRange(false);
      }

      getActiveNormalizeLimits() {
        return this.state.renderMode === "position"
          ? POSITION_RANGE_LIMITS
          : this.depthRangeLimits;
      }

      applyDepthRange(updateChip = true, syncInput = true) {
        const clamped = clampNumber(this.state.depthRange, this.depthRangeLimits);
        this.state.depthRange = clamped;
        this.depthModifierHandles.maxDepth.value = clamped;
        this.updateNormalizeFieldState(syncInput);
        if (updateChip) {
          this.updateRenderChip("Depth max updated");
        }
        this.forceVisualRefresh(3);
      }

      setDepthRange(value, { commit = true, syncInput = true } = {}) {
        if (commit) {
          this.depthRangeIsAuto = false;
        }
        this.state.depthRange = commit ? clampNumber(value, this.depthRangeLimits) : Number(value);
        this.applyDepthRange(true, syncInput);
      }

      applyPositionRange(updateChip = true, syncInput = true) {
        const clamped = clampNumber(this.state.positionRangeScale, POSITION_RANGE_LIMITS);
        this.state.positionRangeScale = clamped;
        this.positionModifierHandles.scaleFactor.value = clamped;
        this.updateNormalizeFieldState(syncInput);
        if (updateChip) {
          this.updateRenderChip("Position range updated");
        }
        this.forceVisualRefresh(3);
      }

      setPositionRange(value, { commit = true, syncInput = true } = {}) {
        this.state.positionRangeScale = commit
          ? clampNumber(value, POSITION_RANGE_LIMITS)
          : Number(value);
        this.applyPositionRange(true, syncInput);
      }

      setNormalizeValue(value, options = {}) {
        if (this.state.renderMode === "position") {
          this.setPositionRange(value, options);
          return;
        }
        this.setDepthRange(value, options);
      }

      updateNormalizeFieldState(syncInput = true) {
        const isDepth = this.state.renderMode === "depth";
        const isPosition = this.state.renderMode === "position";
        const isActive = isDepth || isPosition;
        this.dom.depthRangeField.classList.toggle("is-disabled", !isActive);
        this.dom.depthRangeLabel.textContent = isPosition ? "Position Range" : "Depth Max";
        this.dom.depthRangeField.title = isPosition
          ? "Adjust the rotated splat-center normalization span used by the Position render mode."
          : "Adjust the normalization distance used by the Depth render mode.";
        const limits = this.getActiveNormalizeLimits();
        const currentValue = isPosition ? this.state.positionRangeScale : this.state.depthRange;
        this.dom.depthRangeRange.min = String(limits.min);
        this.dom.depthRangeRange.max = String(limits.max);
        this.dom.depthRangeRange.value = String(currentValue);
        if (syncInput) {
          this.dom.depthRangeInput.value = isPosition
            ? currentValue.toFixed(currentValue < 10 ? 2 : 1)
            : currentValue.toFixed(currentValue < 10 ? 1 : 2);
        }
      }

      applyQualityPreset(presetKey) {
        const preset = QUALITY[presetKey] || QUALITY.balanced;
        this.state.quality = presetKey in QUALITY ? presetKey : "balanced";
        this.spark.maxStdDev = preset.maxStdDev;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.maxPixelRatio));
        this.dom.qualitySelect.value = this.state.quality;
        this.onResize();
      }

      getAvailableShDegree() {
        if (!this.currentMesh) {
          return 0;
        }
        return THREE.MathUtils.clamp(
          Number.isFinite(this.loadedShDegree) ? this.loadedShDegree : inferShDegree(this.currentMesh),
          0,
          3,
        );
      }

      getEffectiveShLevel() {
        const maxSh = this.getAvailableShDegree();
        const forced = this.state.renderMode === "worldNormal";
        return {
          activeSh: forced ? 0 : THREE.MathUtils.clamp(this.state.shLevel, 0, maxSh),
          forced,
          maxSh,
        };
      }

      applyShLevel(updateGenerator = true) {
        const selectedItem = this.getSelectedItem();
        if (selectedItem) {
          selectedItem.settings.shLevel = this.state.shLevel;
        }
        this.sceneItems.forEach((item) => {
          if (!item.mesh) {
            return;
          }
          const maxSh = THREE.MathUtils.clamp(
            Number.isFinite(item.loadedShDegree) ? item.loadedShDegree : inferShDegree(item.mesh),
            0,
            3,
          );
          const itemRenderMode = item.id === this.selectedSceneItemId
            ? this.state.renderMode
            : "beauty";
          const forced = itemRenderMode === "worldNormal";
          const targetSh = item.settings?.shLevel ?? 3;
          const activeSh = forced ? 0 : THREE.MathUtils.clamp(targetSh, 0, maxSh);
          item.mesh.maxSh = activeSh;
          item.mesh.splats?.setMaxSh?.(activeSh);
          if (item.mesh.packedSplats) {
            item.mesh.packedSplats.maxSh = activeSh;
          }
          if (item.mesh.extSplats) {
            item.mesh.extSplats.maxSh = activeSh;
          }
          if (updateGenerator) {
            item.mesh.updateGenerator();
          }
          item.modelMeta.shDegree = formatShLabel(maxSh);
          item.modelMeta.activeSh = forced
            ? `${formatShLabel(activeSh)} forced`
            : formatShLabel(activeSh);
        });
        this.updateMetaUi();
        this.invalidateRender();
      }

      applyTransformFromInputs(announce, commit = false) {
        const selectedItem = this.getSelectedItem();
        const rotationXRaw = this.dom.rotationXInput.value.trim();
        const rotationYRaw = this.dom.rotationYInput.value.trim();
        const rotationZRaw = this.dom.rotationZInput.value.trim();
        const scaleRaw = this.dom.scaleInput.value.trim();
        const translateXRaw = this.dom.translateXInput.value.trim();
        const translateYRaw = this.dom.translateYInput.value.trim();
        const translateZRaw = this.dom.translateZInput.value.trim();
        const parsedScale = Number(scaleRaw);
        const parsedTranslateX = Number(translateXRaw);
        const parsedTranslateY = Number(translateYRaw);
        const parsedTranslateZ = Number(translateZRaw);
        this.state.rotationX = !commit && isIntermediateNumericInput(rotationXRaw)
          ? this.state.rotationX
          : parseRotationValue(rotationXRaw);
        this.state.rotationY = !commit && isIntermediateNumericInput(rotationYRaw)
          ? this.state.rotationY
          : parseRotationValue(rotationYRaw);
        this.state.rotationZ = !commit && isIntermediateNumericInput(rotationZRaw)
          ? this.state.rotationZ
          : parseRotationValue(rotationZRaw);
        this.state.scale = commit
          ? clampNumber(scaleRaw, SCALE_LIMITS)
          : Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : this.state.scale;
        this.state.translateX = commit
          ? clampNumber(translateXRaw, TRANSLATE_LIMITS)
          : Number.isFinite(parsedTranslateX) ? parsedTranslateX : this.state.translateX;
        this.state.translateY = commit
          ? clampNumber(translateYRaw, TRANSLATE_LIMITS)
          : Number.isFinite(parsedTranslateY) ? parsedTranslateY : this.state.translateY;
        this.state.translateZ = commit
          ? clampNumber(translateZRaw, TRANSLATE_LIMITS)
          : Number.isFinite(parsedTranslateZ) ? parsedTranslateZ : this.state.translateZ;
        if (selectedItem) {
          selectedItem.transform.rotationX = this.state.rotationX;
          selectedItem.transform.rotationY = this.state.rotationY;
          selectedItem.transform.rotationZ = this.state.rotationZ;
          selectedItem.transform.scale = this.state.scale;
          selectedItem.transform.translateX = this.state.translateX;
          selectedItem.transform.translateY = this.state.translateY;
          selectedItem.transform.translateZ = this.state.translateZ;
        }
        if (!this.modelRoot || !this.rotationPivot) {
          if (commit) {
            this.syncTransformInputs();
          }
          return;
        }
        this.modelRoot.position.set(
          this.state.translateX,
          this.state.translateY,
          this.state.translateZ,
        );
        this.rotationPivot.rotation.set(
          THREE.MathUtils.degToRad(this.state.rotationX),
          THREE.MathUtils.degToRad(this.state.rotationY),
          THREE.MathUtils.degToRad(this.state.rotationZ),
        );
        this.rotationPivot.scale.setScalar(this.state.scale);
        this.rotationPivot.updateMatrixWorld(true);
        if (commit) {
          this.syncTransformInputs();
        }
        this.syncTransformGizmo();
        if (!this.currentMesh) {
          if (commit) {
            this.finishDeferredInteraction();
          } else {
            this.startDeferredInteraction();
          }
          return;
        }
        this.syncVisibleSceneItemTransforms();
        if (commit) {
          this.finishDeferredInteraction();
        } else {
          this.startDeferredInteraction();
        }
        this.scheduleSelectedTransformRefresh(announce, commit);
      }

      syncTransformInputs() {
        this.dom.rotationXInput.value = String(this.state.rotationX);
        this.dom.rotationYInput.value = String(this.state.rotationY);
        this.dom.rotationZInput.value = String(this.state.rotationZ);
        this.dom.scaleInput.value = String(this.state.scale);
        this.dom.translateXInput.value = String(this.state.translateX);
        this.dom.translateYInput.value = String(this.state.translateY);
        this.dom.translateZInput.value = String(this.state.translateZ);
      }

      clearDiagnostics() {
        const item = this.getSelectedItem();
        if (!item?.mesh) {
          return;
        }
        item.mesh.enableWorldToView = false;
        item.mesh.objectModifiers = item.baseObjectModifier ? [item.baseObjectModifier] : undefined;
        item.mesh.worldModifiers = item.baseWorldModifier ? [item.baseWorldModifier] : undefined;
        this.syncMeshExposure();
      }

      disposeSceneItem(item) {
        if (!item) {
          return;
        }
        if (item.mesh) {
          item.rotationPivot.remove(item.mesh);
          item.mesh.dispose();
          item.mesh = null;
        }
        this.splatSceneRoot.remove(item.modelRoot);
      }

      resetModelMeta() {
        this.modelMeta = createDefaultModelMeta();
      }

      recomputeSceneBounds() {
        const visibleItems = this.sceneItems.filter((item) => item.visible && item.bounds);
        if (!visibleItems.length) {
          this.sceneBounds = null;
          this.sceneBoundsSphere = null;
          return;
        }
        const aggregate = visibleItems[0].bounds.clone();
        visibleItems.slice(1).forEach((item) => aggregate.union(item.bounds));
        this.sceneBounds = aggregate;
        this.sceneBoundsSphere = aggregate.getBoundingSphere(new THREE.Sphere());
      }

      toggleSceneItemVisibility(itemId) {
        const item = this.sceneItems.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }
        item.visible = !item.visible;
        item.rotationPivot.visible = item.visible;
        item.modelRoot.visible = item.visible;
        if (item.mesh) {
          item.mesh.visible = item.visible;
          item.mesh.updateGenerator?.();
        }
        this.recomputeSceneBounds();
        this.refreshHelpers();
        this.updateCameraClipping();
        this.syncTransformGizmo();
        this.syncSceneList();
        this.refreshLightingModel();
        this.updateStatus(`${item.modelMeta.name} ${item.visible ? "shown" : "hidden"}`);
        this.forceVisualRefresh(4);
      }

      removeSceneItem(itemId) {
        const index = this.sceneItems.findIndex((entry) => entry.id === itemId);
        if (index < 0) {
          return;
        }
        const [item] = this.sceneItems.splice(index, 1);
        this.removePickedColorsForItem(item.id);
        const wasSelected = item.id === this.selectedSceneItemId;
        this.disposeSceneItem(item);
        this.recomputeSceneBounds();
        if (wasSelected) {
          const nextItem = this.sceneItems[index] || this.sceneItems[index - 1] || null;
          this.selectSceneItem(nextItem?.id ?? null, false);
        } else {
          this.syncSceneList();
        }
        this.refreshHelpers();
        this.updateCameraClipping();
        this.syncTransformGizmo();
        this.refreshLightingModel({ forceModifierRebuild: true });
        this.updateMetaUi();
        this.updateStatus(`Removed ${item.modelMeta.name}`);
        if (!this.sceneItems.length) {
          this.resetModelMeta();
          this.syncSelectionRefs(null);
          this.applySelectedTransformState(true);
          this.showEmptyState();
          this.setProgress("Idle", 0);
          this.updateRenderChip("Cleared");
        }
        this.invalidateRender();
      }

      clearScene() {
        this.sceneItems.forEach((item) => this.disposeSceneItem(item));
        this.sceneItems = [];
        this.sceneLights.forEach((light) => {
          this.lightSceneRoot.remove(light.root);
          light.root.traverse?.((child) => {
            child.geometry?.dispose?.();
            child.material?.dispose?.();
          });
        });
        this.sceneLights = [];
        this.pickedColors = [];
        this.selectedSceneItemId = null;
        this.selectedLightId = null;
        this.syncSelectionRefs(null);
        this.resetModelMeta();
        this.depthRangeIsAuto = true;
        this.sceneBounds = null;
        this.sceneBoundsSphere = null;
        this.applySelectedTransformState(true);
        this.syncSelectedSplatControls(true);
        this.syncSelectedLightControls(true);
        this.syncTransformGizmo();
        this.refreshHelpers();
        this.syncLightList();
        this.refreshLightingModel({ forceModifierRebuild: true });
        this.renderPickedColors();
        this.forceVisualRefresh(3);
      }

      clearLoadedSplat() {
        this.clearScene();
        this.state.renderMode = "beauty";
        this.state.depthRange = DEPTH_RANGE_DEFAULT;
        this.state.positionRangeScale = 1;
        this.state.translateX = 0;
        this.state.translateY = 0;
        this.state.translateZ = 0;
        this.applyDepthRange(false);
        this.applyPositionRange(false);
        this.syncTransformInputs();
        this.updateMetaUi();
        this.updateModeUi();
        this.syncSceneList();
        this.showEmptyState();
        this.clearHoverReadout();
        this.setProgress("Idle", 0);
        if (this.isFileProtocol) {
          this.prepareFileProtocolMode();
        } else {
          this.dom.progressLabel.textContent = "Open a local file or drag one into the viewer.";
          this.updateRenderChip("Cleared");
          this.updateStatus("Cleared the loaded splat.");
        }
        this.forceVisualRefresh(3);
      }

      async fetchArrayBufferWithProgress(url, label) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`${label} failed to download: ${response.status}`);
        }
        if (!response.body) {
          const buffer = await response.arrayBuffer();
          return { buffer, bytes: buffer.byteLength };
        }
        const totalBytes = Number(response.headers.get("content-length") || 0);
        const reader = response.body.getReader();
        const chunks = [];
        let loadedBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          chunks.push(value);
          loadedBytes += value.byteLength;
          this.setProgress(`Downloading ${label}`, totalBytes > 0 ? loadedBytes / totalBytes : null);
        }
        const merged = new Uint8Array(loadedBytes);
        let offset = 0;
        chunks.forEach((chunk) => {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        });
        return { buffer: merged.buffer, bytes: loadedBytes };
      }

      async loadFromFile(file) {
        if (!isSupportedFile(file)) {
          this.updateStatus(`Unsupported file type: ${file.name}`);
          return;
        }
        this.setProgress(`Reading ${file.name}`, null);
        const arrayBuffer = await file.arrayBuffer();
        await this.loadMesh({
          bytes: arrayBuffer.byteLength,
          fileBytes: arrayBuffer,
          fileName: file.name,
          fileType: detectSplatFileType(file.name),
          source: "Local file",
        });
      }

      async loadFromUrl(url, fileName, source) {
        const { buffer, bytes } = await this.fetchArrayBufferWithProgress(url, fileName);
        await this.loadMesh({
          bytes,
          fileBytes: buffer,
          fileName,
          fileType: detectSplatFileType(fileName),
          source,
        });
      }

      async loadPrimitive(kind) {
        const requestToken = ++this.loadToken;
        try {
          const spec = await createPrimitiveSpec(kind);
          if (requestToken !== this.loadToken) {
            return;
          }
          await this.loadMesh({
            bytes: spec.bytes,
            fileBytes: spec.buffer,
            fileName: spec.name,
            fileType: SplatFileType.PLY,
            loadToken: requestToken,
            localBounds: spec.localBounds,
            primitiveMeta: spec,
            source: spec.source,
          });
        } catch (error) {
          if (requestToken !== this.loadToken) {
            return;
          }
          this.updateStatus(error instanceof Error ? error.message : "Primitive load failed");
          this.updateRenderChip("Error");
          this.setProgress("Load failed", 0);
        }
      }

      async loadMesh({
        bytes,
        fileBytes,
        fileName,
        fileType,
        loadToken,
        localBounds,
        primitiveMeta,
        source,
      }) {
        const token = loadToken ?? ++this.loadToken;
        const hadSceneItems = this.sceneItems.length > 0;
        const startedAt = performance.now();
        this.updateStatus(`Loading ${fileName}...`);
        this.updateRenderChip("Initializing");
        this.hideEmptyState();

        let mesh = null;
        try {
          mesh = new SplatMesh({
            ...buildSplatMeshLoadOptions(this.state.autoLodEnabled),
            fileBytes,
            fileType,
          });
          mesh.name = fileName;
          if (primitiveMeta) {
            mesh.maxShDegree = primitiveMeta.shDegree;
          }
          await mesh.initialized;

          if (token !== this.loadToken) {
            mesh.dispose();
            return;
          }

          const sceneItem = this.createSceneItemRecord(fileName, source);
          sceneItem.mesh = mesh;
          sceneItem.loadedShDegree = primitiveMeta?.shDegree ?? inferShDegree(mesh);
          sceneItem.settings.shLevel = THREE.MathUtils.clamp(sceneItem.loadedShDegree, 0, 3);
          if (primitiveMeta?.defaultSettings) {
            sceneItem.settings.exposure = primitiveMeta.defaultSettings.exposure ?? sceneItem.settings.exposure;
            sceneItem.settings.opacity = primitiveMeta.defaultSettings.opacity ?? sceneItem.settings.opacity;
            sceneItem.settings.falloff = primitiveMeta.defaultSettings.falloff ?? sceneItem.settings.falloff;
          }
          sceneItem.hoverEntries = primitiveMeta?.hoverEntries ?? null;
          sceneItem.baseObjectModifier = mesh.objectModifier;
          sceneItem.baseWorldModifier = mesh.worldModifier;
          mesh.userData.sceneItemId = sceneItem.id;
          this.sceneItems.push(sceneItem);
          this.selectedSceneItemId = sceneItem.id;
          this.selectedLightId = null;
          this.syncSelectionRefs(sceneItem);

          this.depthRangeIsAuto = true;
          let meshLocalBounds;
          if (localBounds) {
            meshLocalBounds = localBounds.clone();
          } else {
            try {
              meshLocalBounds = mesh.getBoundingBox(false);
            } catch {
              meshLocalBounds = mesh.getBoundingBox(true);
            }
          }
          const centerBounds = primitiveMeta?.localBounds?.clone() ?? computeCenterBounds(mesh, meshLocalBounds);
          this.attachMesh(sceneItem, mesh, meshLocalBounds, centerBounds);
          if (!sceneItem.hoverEntries) {
            sceneItem.hoverEntries = this.createMeshHoverEntries(sceneItem);
          }
          this.applySelectedTransformState(true);
          this.syncSelectedSplatControls(true);
          this.applyOpacity(false);
          this.applyFalloff(false);
          this.applyExposure(false);
          if (primitiveMeta) {
            this.updatePrimitiveMeta(primitiveMeta);
          } else {
            this.updateCompressionMeta(fileName, bytes, mesh, fileBytes);
          }
          this.modelMeta.bytes = bytes;
          this.modelMeta.elapsedMs = performance.now() - startedAt;
          this.modelMeta.format = primitiveMeta?.format ?? (getFileExtension(fileName).toUpperCase() || "AUTO");
          this.modelMeta.name = fileName;
          this.modelMeta.source = source;
          this.modelMeta.splats = primitiveMeta?.splats ?? Number(mesh.numSplats ?? mesh.packedSplats?.numSplats ?? 0);

          this.recomputeBounds();
          if (!hadSceneItems && !this.hasCapturedInitialPose) {
            this.fitView({ preserveDirection: false, captureDefaultPose: true, announce: false });
          } else {
            this.updateCameraClipping();
          }
          this.configureDepthRangeFromBounds();
          this.refreshHelpers();
          this.syncSelectedLightControls(true);
          this.refreshLightingModel({ forceModifierRebuild: true });
          this.updateMetaUi();
          this.syncSceneList();
          this.syncLightList();
          this.setProgress("Ready", 1);
          this.updateRenderChip("Ready");
          this.updateStatus(`Loaded ${fileName}`);
          this.schedulePostLoadRefresh();
        } catch (error) {
          this.updateStatus(error instanceof Error ? error.message : "Load failed");
          this.updateRenderChip("Error");
          this.setProgress("Load failed", 0);
          if (mesh) {
            mesh.dispose();
          }
          this.forceVisualRefresh(3);
        }
      }

      attachMesh(item, mesh, localBoundsOverride = null, centerBoundsOverride = null) {
        let localBounds;
        if (localBoundsOverride) {
          localBounds = localBoundsOverride.clone();
        } else {
          try {
            localBounds = mesh.getBoundingBox(false);
          } catch {
            localBounds = mesh.getBoundingBox(true);
          }
        }
        const centerBounds = centerBoundsOverride
          ? centerBoundsOverride.clone()
          : computeCenterBounds(mesh, localBounds);
        item.baseLocalBounds = localBounds.clone();
        item.baseCenterBounds = centerBounds.clone();
        const center = centerBounds.getCenter(new THREE.Vector3());
        item.rotationPivot.position.set(0, 0, 0);
        mesh.position.copy(center.clone().multiplyScalar(-1));
        mesh.opacity = item.settings.opacity;
        item.rotationPivot.add(mesh);
        item.modelRoot.visible = item.visible;
        this.syncSelectionRefs(item);
        this.applySelectedTransformState(true);
        this.applyTransformFromInputs(false, true);
      }

      updatePrimitiveMeta(spec) {
        this.modelMeta.compression = spec.compression;
        this.modelMeta.compressionRatio = spec.compressionRatio;
        this.modelMeta.encoding = spec.encoding;
        this.modelMeta.packedCapacity = spec.packedCapacity;
        this.modelMeta.scaleRange = spec.scaleRange;
        this.modelMeta.shDegree = formatShLabel(spec.shDegree);
        this.modelMeta.activeSh = formatShLabel(spec.shDegree);
      }

      updateCompressionMeta(fileName, bytes, mesh, fileBytes) {
        const extension = getFileExtension(fileName);
        const splats = Number(mesh.numSplats ?? mesh.packedSplats?.numSplats ?? 0);
        const shDegree = this.loadedShDegree;
        const rawEstimate = estimateRawGaussianBytes(splats, shDegree);
        const compressionLabel = extension === "ply"
          ? detectPlyCompressionLabel(fileBytes)
          : (COMPRESSION_LABELS[extension] || "Unknown");
        const estimatedRatio = rawEstimate / Math.max(bytes, 1);
        const isCompressedPayload = extension !== "ply" || compressionLabel !== COMPRESSION_LABELS.ply;
        this.modelMeta.compression = compressionLabel;
        this.modelMeta.compressionRatio = isCompressedPayload
          ? formatRatio(estimatedRatio)
          : "1.00x baseline";
        this.modelMeta.shDegree = formatShLabel(shDegree);
        this.modelMeta.activeSh = formatShLabel(Math.min(this.state.shLevel, shDegree));
        this.modelMeta.encoding = formatEncodingMeta(mesh?.packedSplats?.splatEncoding);
        this.modelMeta.packedCapacity = Number.isFinite(mesh?.packedSplats?.maxSplats)
          ? `${mesh.packedSplats.maxSplats.toLocaleString()}`
          : "-";
        const packedArray = mesh?.packedSplats?.packedArray;
        if (packedArray && splats > 0) {
          let minScale = Infinity;
          let maxScale = 0;
          const sampleStep = Math.max(1, Math.ceil(splats / 200000));
          for (let index = 0; index < splats; index += sampleStep) {
            const splat = unpackSplat(packedArray, index, mesh.packedSplats?.splatEncoding);
            minScale = Math.min(minScale, splat.scales.x, splat.scales.y, splat.scales.z);
            maxScale = Math.max(maxScale, splat.scales.x, splat.scales.y, splat.scales.z);
          }
          this.modelMeta.scaleRange = formatScaleRange(minScale, maxScale);
        } else {
          this.modelMeta.scaleRange = "-";
        }
      }

      updatePositionModifierBounds() {
        if (!this.centerBounds) {
          this.positionModifierHandles.minCorner.value.set(0, 0, 0);
          this.positionModifierHandles.span.value.set(1, 1, 1);
          return;
        }
        const size = this.centerBounds.getSize(new THREE.Vector3());
        this.positionModifierHandles.minCorner.value.copy(this.centerBounds.min);
        this.positionModifierHandles.span.value.set(
          Math.max(size.x, 0.0001),
          Math.max(size.y, 0.0001),
          Math.max(size.z, 0.0001),
        );
      }

      setDefaultPoseFromCentroid() {
        const centerSphere = this.centerBoundsSphere ?? this.boundsSphere ?? this.sceneBoundsSphere;
        if (!centerSphere) {
          return;
        }
        const center = centerSphere.center.clone();
        const radius = Math.max(centerSphere.radius, 0.05);
        const framingRadius = Math.max(this.sceneBoundsSphere?.radius || this.boundsSphere?.radius || radius, radius);
        const lookTarget = center.clone().add(DEFAULT_LOOK.clone().multiplyScalar(Math.max(radius * 0.35, 1)));
        this.camera.position.copy(center);
        this.camera.lookAt(lookTarget);
        this.orbitControls.target.copy(lookTarget);
        this.updateOrbitDistances(framingRadius);
        this.orbitControls.update();
        this.updateCameraClipping(framingRadius * 1.5);
        this.firstPerson.syncFromCamera();
        this.captureCurrentPoseAsDefault();
        this.updateRenderChip("Centered at centroid");
        this.forceVisualRefresh(3);
      }

      fitView({ preserveDirection = false, captureDefaultPose = false, announce = true } = {}) {
        const targetSphere = this.sceneBoundsSphere ?? this.boundsSphere;
        if (!targetSphere) {
          return;
        }
        const center = targetSphere.center.clone();
        const radius = Math.max(targetSphere.radius, 0.05);
        const verticalHalfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
        const horizontalHalfFov = Math.atan(
          Math.tan(verticalHalfFov) * Math.max(this.camera.aspect, 0.1),
        );
        const limitAngle = Math.max(
          Math.min(verticalHalfFov, horizontalHalfFov),
          THREE.MathUtils.degToRad(8),
        );
        const distance = (radius / Math.sin(limitAngle)) * 1.08;
        const direction = preserveDirection
          ? this.getCurrentFitDirection(center)
          : DEFAULT_FIT.clone();
        this.camera.position.copy(center.clone().addScaledVector(direction, distance));
        this.camera.lookAt(center);
        this.orbitControls.target.copy(center);
        this.updateOrbitDistances(radius);
        this.orbitControls.update();
        this.firstPerson.syncFromCamera();
        this.updateCameraClipping(distance);
        if (captureDefaultPose) {
          this.captureCurrentPoseAsDefault();
        }
        this.updateRenderChip("Fit view");
        if (announce) {
          this.updateStatus("Framed the loaded splat");
        }
        this.forceVisualRefresh(3);
      }

      getCurrentFitDirection(center) {
        const direction = this.camera.position.clone().sub(center);
        if (direction.lengthSq() < 1e-6) {
          const forward = new THREE.Vector3();
          this.camera.getWorldDirection(forward);
          return forward.multiplyScalar(-1).normalize();
        }
        return direction.normalize();
      }

      updateOrbitDistances(radius) {
        this.orbitControls.minDistance = Math.max(radius * 0.001, 0.0005);
        this.orbitControls.maxDistance = Math.max(radius * 260, 1500);
      }

      syncDiagnosticTransform() {
        if (!this.currentMesh?.context?.transform) {
          return;
        }
        this.currentMesh.updateMatrixWorld(true);
        this.currentMesh.context.transform.updateFromMatrix(this.currentMesh.matrixWorld);
      }

      recomputeBounds() {
        const item = this.getSelectedItem();
        if (!item?.mesh || !item.baseLocalBounds) {
          this.bounds = null;
          this.boundsSphere = null;
          this.centerBounds = null;
          this.centerBoundsSphere = null;
          this.recomputeSceneBounds();
          return;
        }
        item.modelRoot.updateMatrixWorld(true);
        item.rotationPivot.updateMatrixWorld(true);
        item.mesh.updateMatrixWorld(true);
        this.syncDiagnosticTransform();
        item.bounds = item.baseLocalBounds.clone().applyMatrix4(item.mesh.matrixWorld);
        item.boundsSphere = item.bounds.getBoundingSphere(new THREE.Sphere());
        item.centerBounds = (item.baseCenterBounds ?? item.baseLocalBounds)
          .clone()
          .applyMatrix4(item.mesh.matrixWorld);
        item.centerBoundsSphere = item.centerBounds.getBoundingSphere(new THREE.Sphere());
        this.syncSelectionRefs(item);
        this.recomputeSceneBounds();
      }

      prepareFileProtocolMode() {
        this.dom.progressLabel.textContent =
          "Direct-open mode detected. Use Open File or drag a file into the viewer.";
        this.dom.infoSource.textContent = "Direct-open mode";
        this.updateStatus("Direct-open mode is active. Open a local file.");
        this.updateRenderChip("Open local file");
      }

      hideEmptyState() {
        this.dom.emptyState.hidden = true;
        this.dom.dropOverlay.hidden = true;
      }

      showEmptyState() {
        this.dom.emptyState.hidden = false;
        this.dom.dropOverlay.hidden = true;
      }

      focusPick(event) {
        if (!this.sceneItems.length) {
          return;
        }
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(
          this.sceneItems.filter((item) => item.visible && item.mesh).map((item) => item.mesh),
          true,
        );
        if (!hits.length) {
          return;
        }
        const sceneItemId = hits[0].object?.userData?.sceneItemId ?? hits[0].object?.parent?.userData?.sceneItemId;
        if (sceneItemId) {
          this.selectSceneItem(sceneItemId, false);
        }
        const focusPoint = hits[0].point;
        const offset = this.camera.position.clone().sub(this.orbitControls.target);
        this.orbitControls.target.copy(focusPoint);
        this.camera.position.copy(focusPoint.clone().add(offset));
        this.orbitControls.update();
        this.firstPerson.syncFromCamera();
        this.updateStatus(`Focus point updated: ${formatVector(focusPoint)}`);
        this.forceVisualRefresh(3);
      }

      queueHoverProbe(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return;
        }
        this.hoverPointer = {
          x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
          y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        };
        this.lastHoverPointer = { ...this.hoverPointer };
        if (this.hoverProbePending) {
          return;
        }
        this.hoverProbePending = true;
        requestAnimationFrame(() => {
          this.hoverProbePending = false;
          this.updateHoverReadout();
        });
      }

      legacyClearHoverReadout() {
        this.hoverPointer = null;
        const selectedItem = this.getSelectedItem();
        const itemText = clipPadText(selectedItem?.modelMeta?.name ?? "選択していない", 18);
        const colorText = clipPadText("色未知", 11);
        this.hoverReadout = `Item ${itemText} | Color ${colorText}`;
        if (this.dom.hoverChip) {
          this.dom.hoverChip.textContent = this.hoverReadout;
        }
      }

      legacyUpdateHoverReadout() {
        const selectedItem = this.getSelectedItem();
        if (!selectedItem) {
          this.clearHoverReadout();
          return;
        }
        const itemText = clipPadText(selectedItem.modelMeta.name, 18);
        let colorText = clipPadText("色未知", 11);
        if (!this.hoverPointer || !selectedItem.hoverEntries?.length || !selectedItem.mesh) {
          this.hoverReadout = `Item ${itemText} | Color ${colorText}`;
          if (this.dom.hoverChip) {
            this.dom.hoverChip.textContent = this.hoverReadout;
          }
          return;
        }
        this.pointer.set(this.hoverPointer.x, this.hoverPointer.y);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(
          this.sceneItems.filter((item) => item.visible && item.mesh).map((item) => item.mesh),
          true,
        );
        if (hits.length) {
          hits.sort((left, right) => left.distance - right.distance);
          const hit = hits[0];
          const sceneItemId = hit.object?.userData?.sceneItemId ?? hit.object?.parent?.userData?.sceneItemId;
          if (sceneItemId === selectedItem.id) {
            let bestEntry = null;
            let bestDistance = Infinity;
            const worldPosition = new THREE.Vector3();
            selectedItem.hoverEntries.forEach((entry) => {
              worldPosition.copy(entry.position).applyMatrix4(selectedItem.mesh.matrixWorld);
              const distanceSq = worldPosition.distanceToSquared(hit.point);
              if (distanceSq < bestDistance) {
                bestDistance = distanceSq;
                bestEntry = entry;
              }
            });
            if (bestEntry) {
              colorText = clipPadText(formatHoverColor(bestEntry.color), 11);
            }
          }
        }
        this.hoverReadout = `Item ${itemText} | Color ${colorText}`;
        if (this.dom.hoverChip) {
          this.dom.hoverChip.textContent = this.hoverReadout;
        }
      }

      clearHoverReadout() {
        this.hoverPointer = null;
        const selectedItem = this.getSelectedItem();
        const itemText = clipPadText(selectedItem?.modelMeta?.name ?? "Not selected", 18);
        const colorText = clipPadText("Unknown", 11);
        this.hoverReadout = `Item ${itemText} | Color ${colorText}`;
        this.setHoverChip(itemText, colorText);
      }

      updateHoverReadout() {
        const selectedItem = this.getSelectedItem();
        if (!selectedItem) {
          this.clearHoverReadout();
          return;
        }
        const itemText = clipPadText(selectedItem.modelMeta.name, 18);
        let colorText = clipPadText("Unknown", 11);
        const pointer = this.hoverPointer ?? this.lastHoverPointer;
        if (!pointer) {
          this.hoverReadout = `Item ${itemText} | Color ${colorText}`;
          this.setHoverChip(itemText, colorText);
          return;
        }
        const sample = selectedItem.hoverEntries?.length
          ? this.resolvePrimitivePointerSample(selectedItem, pointer)
          : this.resolvePackedPointerSample(selectedItem, pointer);
        if (sample) {
          colorText = clipPadText(
            formatHoverColor(this.getDisplayLinearColorForSample(selectedItem, sample)),
            11,
          );
        }
        this.hoverReadout = `Item ${itemText} | Color ${colorText}`;
        this.setHoverChip(itemText, colorText);
      }

      onDrag(event) {
        event.preventDefault();
        this.dom.dropOverlay.hidden = false;
      }

      onDragLeave(event) {
        event.preventDefault();
        if (event.relatedTarget && this.dom.stage.contains(event.relatedTarget)) {
          return;
        }
        this.dom.dropOverlay.hidden = true;
      }

      async onDrop(event) {
        event.preventDefault();
        this.dom.dropOverlay.hidden = true;
        const file = Array.from(event.dataTransfer?.files || []).find((entry) => isSupportedFile(entry));
        if (!file) {
          this.updateStatus("No supported splat file was found in the drop payload.");
          return;
        }
        await this.loadFromFile(file);
      }

      onResize() {
        const width = Math.round(this.dom.stage.clientWidth);
        const height = Math.round(this.dom.stage.clientHeight);
        if (!width || !height) {
          return;
        }
        if (this.lastStageSize.width === width && this.lastStageSize.height === height) {
          return;
        }
        this.lastStageSize = { width, height };
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
        this.invalidateRender();
      }

      refreshHelpers() {
        [this.axesHelper, this.axisLabelGroup, this.boundsHelper, this.gridHelper].forEach((helper) => {
          if (!helper) {
            return;
          }
          this.scene.remove(helper);
          helper.traverse?.((child) => {
            child.geometry?.dispose?.();
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => {
                material.map?.dispose?.();
                material.dispose?.();
              });
            } else {
              child.material?.map?.dispose?.();
              child.material?.dispose?.();
            }
          });
          helper.geometry?.dispose?.();
          if (Array.isArray(helper.material)) {
            helper.material.forEach((material) => material.dispose?.());
          } else {
            helper.material?.dispose?.();
          }
        });
        this.axesHelper = null;
        this.axisLabelGroup = null;
        this.boundsHelper = null;
        this.gridHelper = null;
        this.currentGridScale = null;
        this.currentGridStep = null;

        const helperBounds = this.sceneBounds ?? this.bounds;
        if (!helperBounds) {
          return;
        }

        const autoGridBounds = this.sceneItems[0]?.baseLocalBounds ?? helperBounds;
        const autoGridSizeVector = autoGridBounds.getSize(new THREE.Vector3());
        const autoGridSize = Math.max(autoGridSizeVector.x, autoGridSizeVector.z, 1) * 1.8;
        const gridSize = this.state.gridScaleMode === "auto"
          ? autoGridSize
          : Math.max(this.state.gridScaleValue, 0.01);
        const gridStep = this.getAutoGridStep(gridSize);
        const divisions = Math.max(1, Math.round(gridSize / gridStep));

        if (this.state.showGrid) {
          this.gridHelper = new THREE.GridHelper(
            gridSize,
            divisions,
            new THREE.Color("#5ce2c3"),
            new THREE.Color("#20384d"),
          );
          this.gridHelper.position.set(0, 0, 0);
          this.scene.add(this.gridHelper);
        }
        this.currentGridScale = gridSize;
        this.currentGridStep = gridStep;

        if (this.state.showAxes) {
          const axesLength = Math.max(gridSize * 0.5, 0.5);
          this.axesHelper = new THREE.AxesHelper(axesLength);
          this.axesHelper.position.set(0, 0, 0);
          this.scene.add(this.axesHelper);
          this.axisLabelGroup = new THREE.Group();
          const labelOffset = Math.max(axesLength * 1.12, 0.75);
          const xLabel = createAxisLabelSprite("X", "#ff6d6d");
          xLabel.position.set(labelOffset, 0, 0);
          const yLabel = createAxisLabelSprite("Y", "#63ff92");
          yLabel.position.set(0, labelOffset, 0);
          const zLabel = createAxisLabelSprite("Z", "#5da7ff");
          zLabel.position.set(0, 0, labelOffset);
          this.axisLabelGroup.add(xLabel, yLabel, zLabel);
          this.scene.add(this.axisLabelGroup);
        }

        if (this.state.showBounds) {
          this.boundsHelper = new THREE.Box3Helper(helperBounds.clone(), new THREE.Color("#b7e7ff"));
          this.scene.add(this.boundsHelper);
        }
        this.invalidateRender();
      }

      renderLoop() {
        const frameStartedAt = performance.now();
        this.syncLodUi();
        const delta = Math.min(this.clock.getDelta(), 0.05);
        let keepAnimating = false;
        const animationActive = this.stepAnimation(delta);
        const animationShouldRender = shouldRenderAnimationFrame(this.state);
        const gameplayActive = this.updateGameplay(delta, frameStartedAt);
        const movedByKeys = Boolean(this.firstPerson.update(delta));
        if (movedByKeys && this.activeMode === "orbit") {
          this.orbitControls.target.add(this.firstPerson.lastMovementDelta);
        }
        if (movedByKeys) {
          this.updateCameraClipping();
        }
        if (this.activeMode === "orbit") {
          this.orbitControls.autoRotate = this.state.autoRotate;
          keepAnimating = Boolean(this.orbitControls.enabled && this.orbitControls.update());
        } else {
          keepAnimating = movedByKeys;
        }
        keepAnimating = keepAnimating || movedByKeys || animationActive || animationShouldRender || gameplayActive;
        const timedRenderActive = this.isTimedRenderActive(frameStartedAt);
        const scheduledReady = !this.scheduledRenderAt || frameStartedAt >= this.scheduledRenderAt;
        const shouldDraw = (this.renderInvalidated && scheduledReady)
          || keepAnimating
          || this.pendingForcedFrames > 0
          || timedRenderActive;
        if (!shouldDraw) {
          return;
        }
        this.syncVisibleSceneItemTransforms();
        const frameDelay = this.getRenderFrameDelay(frameStartedAt);
        const canDrawNow = frameDelay <= 1
          || (this.renderInvalidated && scheduledReady)
          || keepAnimating
          || this.pendingForcedFrames > 0;
        if (shouldDraw && canDrawNow) {
          this.flushRenderNow();
        }
      }

      async createGameplaySplatAsset({
        alpha = null,
        colorHex = null,
        kind = "sphere",
        position = new THREE.Vector3(),
        radius = 1,
      } = {}) {
        const spec = await createGameplayPrimitiveSpec({ alpha, colorHex, kind, radius });
        const mesh = new SplatMesh({
          ...buildSplatMeshLoadOptions(false),
          fileBytes: spec.buffer,
          fileType: SplatFileType.PLY,
        });
        mesh.name = spec.name;
        mesh.maxShDegree = spec.shDegree;
        await mesh.initialized;
        const root = new THREE.Group();
        root.name = `${spec.name}-root`;
        root.position.copy(position);
        root.add(mesh);
        root.updateMatrixWorld(true);
        return { mesh, root, spec };
      }

      collectGameplaySceneCollisionObstacles() {
        return this.sceneItems
          .filter((item) => item.visible && item.mesh && (item.baseCenterBounds || item.baseLocalBounds))
          .map((item) => {
            item.modelRoot.updateMatrixWorld(true);
            item.rotationPivot.updateMatrixWorld(true);
            item.mesh.updateMatrixWorld(true);
            const sourceBounds = item.baseCenterBounds ?? item.baseLocalBounds;
            const localCenter = sourceBounds.getCenter(new THREE.Vector3());
            const localSize = sourceBounds.getSize(new THREE.Vector3());
            const worldCenter = localCenter.clone().applyMatrix4(item.mesh.matrixWorld);
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            item.mesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
            const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQuaternion);
            const rotation = Math.atan2(axisX.z, axisX.x);
            const halfSizeX = Math.max((Math.abs(localSize.x * worldScale.x) * 0.5), 0.001);
            const halfSizeZ = Math.max((Math.abs(localSize.z * worldScale.z) * 0.5), 0.001);
            return {
              kind: "scene-item",
              halfSizeX,
              halfSizeZ,
              rotation,
              shape: "box",
              sourceId: item.id,
              x: worldCenter.x,
              z: worldCenter.z,
            };
          })
          .filter(Boolean);
      }

      async setupGameplayScene() {
        const planeGeometry = new THREE.CircleGeometry(4.4, 64);
        const planeMaterial = new THREE.MeshStandardMaterial({
          color: 0x10202b,
          metalness: 0.08,
          roughness: 0.9,
        });
        this.gameFloor = new THREE.Mesh(planeGeometry, planeMaterial);
        this.gameFloor.rotation.x = -Math.PI / 2;
        this.gameFloor.position.y = 0.01;
        this.gameSceneRoot.add(this.gameFloor);

        const rimGeometry = new THREE.RingGeometry(4.1, 4.35, 64);
        const rimMaterial = new THREE.MeshBasicMaterial({
          color: 0x61d8bc,
          opacity: 0.25,
          side: THREE.DoubleSide,
          transparent: true,
        });
        this.gameRim = new THREE.Mesh(rimGeometry, rimMaterial);
        this.gameRim.rotation.x = -Math.PI / 2;
        this.gameRim.position.y = 0.015;
        this.gameSceneRoot.add(this.gameRim);

        this.gameShadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.24, 32),
          new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.22, transparent: true }),
        );
        this.gameShadow.rotation.x = -Math.PI / 2;
        this.gameShadow.position.y = 0.02;
        this.gameSceneRoot.add(this.gameShadow);

        const ballAsset = await this.createGameplaySplatAsset({ kind: "sphere", radius: this.gameState.ball.radius });
        this.gameBall = ballAsset.mesh;
        this.gameBallSplatRoot = ballAsset.root;
        this.gameSceneRoot.add(this.gameBallSplatRoot);
        this.gameBallLight = new THREE.PointLight(0xffffff, 20, 2.8, 2);
        this.gameBallLight.position.set(0, 1.2, 0);
        this.gameSceneRoot.add(this.gameBallLight);

        this.gameGoal = new THREE.Mesh(
          new THREE.TorusGeometry(0.42, 0.04, 16, 48),
          new THREE.MeshBasicMaterial({ color: 0x50f5b2, opacity: 0.9, transparent: true }),
        );
        this.gameGoal.rotation.x = Math.PI / 2;
        this.gameGoal.position.y = 0.04;
        this.gameSceneRoot.add(this.gameGoal);

        this.gameSplatObstacleAssets = await Promise.all(
          this.gameStage.splatObstacles.map(async (obstacle) => {
            const asset = await this.createGameplaySplatAsset({
              kind: "sphere",
              radius: obstacle.radius,
              colorHex: 0x4da6ff,
              alpha: 0.88,
              position: new THREE.Vector3(obstacle.x, obstacle.radius, obstacle.z),
            });
            this.gameSceneRoot.add(asset.root);
            return asset;
          }),
        );
        this.gameMeshObstacleMeshes = this.gameStage.meshObstacles.map((obstacle) => {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(obstacle.radius * 1.4, 0.52, obstacle.radius * 1.4),
            new THREE.MeshStandardMaterial({ color: 0x7df0ff, emissive: 0x0b2430, roughness: 0.24, metalness: 0.22 }),
          );
          mesh.position.set(obstacle.x, 0.26, obstacle.z);
          mesh.rotation.y = Math.PI / 5;
          this.gameSceneRoot.add(mesh);
          return mesh;
        });

        const ambient = new THREE.AmbientLight(0xffffff, 0.04);
        const key = new THREE.DirectionalLight(0xffffff, 0.18);
        key.position.set(4, 7, 5);
        this.gameSceneRoot.add(ambient);
        this.gameSceneRoot.add(key);
        this.gameGoal.position.set(this.gameStage.goal.x, 0.04, this.gameStage.goal.z);
        this.gameSceneRoot.visible = true;
        this.updateGameplayVisuals();
      }

      async ensureGameplayDemoLoaded() {
        if (this.gameplayHasLoadedDemo || this.sceneItems.length > 0) {
          return;
        }
        this.gameplayHasLoadedDemo = true;
        this.dom.primitiveSelect.value = "cube";
        await this.loadPrimitive("cube");
        this.applyDemoSceneLayout();
        this.gameStage.additionalCollisionObstacles = this.collectGameplaySceneCollisionObstacles();
        this.gameState = { ...this.gameState, stage: this.gameStage };
        this.camera.position.set(0, 5.4, 5.8);
        this.camera.lookAt(0, 0.25, 0);
        this.orbitControls.target.set(0, 0.25, 0);
        this.orbitControls.update();
        this.firstPerson.syncFromCamera();
        this.updateStatus("Gameplay sample loaded. Open another splat any time.");
        this.forceVisualRefresh(3);
      }

      installMotionSensors() {
        if (this.gameplaySensorListenersInstalled || typeof window.DeviceOrientationEvent === "undefined") {
          return;
        }
        window.addEventListener("deviceorientation", this.handleDeviceOrientation, true);
        this.gameplaySensorListenersInstalled = true;
      }

      async requestMotionPermission() {
        if (typeof window.DeviceOrientationEvent === "undefined") {
          this.motionState = { ...this.motionState, hasSensorSupport: false, permission: "denied", mode: "sensor" };
          this.syncGameplayUi();
          this.updateStatus("Motion sensor unavailable");
          this.invalidateRender();
          return false;
        }
        this.installMotionSensors();
        if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
          const permission = await window.DeviceOrientationEvent.requestPermission();
          this.motionState = { ...this.motionState, permission: permission === "granted" ? "granted" : "denied" };
          if (permission !== "granted") {
            this.syncGameplayUi();
            this.updateStatus("Motion permission denied");
            this.invalidateRender();
            return false;
          }
        } else {
          this.motionState = { ...this.motionState, permission: "granted" };
        }
        this.gameInputMode = "sensor";
        this.motionState = { ...this.motionState, mode: "sensor" };
        this.syncGameplayUi();
        this.invalidateRender();
        return true;
      }

      applyDemoSceneLayout() {
        const selectedItem = this.getSelectedItem();
        if (!selectedItem) {
          return;
        }
        selectedItem.transform.rotationX = 0;
        selectedItem.transform.rotationY = 18;
        selectedItem.transform.rotationZ = 0;
        selectedItem.transform.scale = 0.82;
        selectedItem.transform.translateX = 2.45;
        selectedItem.transform.translateY = 0.58;
        selectedItem.transform.translateZ = -2.05;
        this.applySelectedTransformState(true);
        this.applyTransformFromInputs(false, true);
      }

      calibrateGameplayMotion() {
        this.motionState = calibrateMotionState(this.motionState, {
          beta: this.motionState.rawBeta,
          gamma: this.motionState.rawGamma,
        });
        this.syncGameplayUi();
        this.updateStatus("Gameplay motion calibrated");
      }

      handleGameplayPrimaryAction() {
        const hud = createGameplayHudModel({ motion: this.motionState, game: this.gameState });
        if (hud.primaryAction.id === "enable-motion") {
          void this.requestMotionPermission();
          return;
        }
        if (hud.primaryAction.id === "retry") {
          this.resetGameplayRun(true);
          return;
        }
        if (hud.primaryAction.id === "sensor-unavailable") {
          this.updateStatus("Motion sensor unavailable");
          return;
        }
        this.gameState = { ...this.gameState, status: "playing" };
        this.syncGameplayUi();
        this.invalidateRender();
      }

      resetGameplayRun(announce = false) {
        this.gameStage.additionalCollisionObstacles = this.collectGameplaySceneCollisionObstacles();
        this.gameState = resetGameState({ ...this.gameState, stage: this.gameStage });
        this.gameState = { ...this.gameState, stage: this.gameStage };
        this.updateGameplayVisuals();
        this.syncGameplayUi();
        if (announce) {
          this.updateStatus("Gameplay reset");
        }
        this.invalidateRender();
      }

      updateGameplay(delta, now = performance.now()) {
        this.gameStage.additionalCollisionObstacles = this.collectGameplaySceneCollisionObstacles();
        this.gameState = { ...this.gameState, stage: this.gameStage };
        let inputVector = { x: 0, z: 0 };
        if (this.gameInputMode === "sensor" && this.motionState.permission === "granted") {
          const gravity = buildGravityVector(this.motionState, DEFAULT_MOTION_CONFIG);
          inputVector = {
            x: THREE.MathUtils.clamp(gravity.x / DEFAULT_MOTION_CONFIG.sensitivity, -1, 1),
            z: THREE.MathUtils.clamp(gravity.z / DEFAULT_MOTION_CONFIG.sensitivity, -1, 1),
          };
        }
        const shouldStep = this.gameState.status === "playing"
          || Math.abs(inputVector.x) > 0.001
          || Math.abs(inputVector.z) > 0.001;
        if (!shouldStep && this.gameState.status !== "won") {
          this.syncGameplayUi();
          return false;
        }
        this.gameState = stepGameState(this.gameState, inputVector, delta, DEFAULT_GAME_CONFIG);
        this.updateGameplayVisuals();
        this.syncGameplayUi();
        if (this.gameState.goalReached) {
          this.updateRenderChip("Goal");
        }
        return true;
      }

      updateGameplayVisuals() {
        if (!this.gameBallSplatRoot || !this.gameShadow) {
          return;
        }
        const { position } = this.gameState.ball;
        this.gameBallSplatRoot.position.set(position.x, position.y, position.z);
        this.gameShadow.position.set(position.x, 0.03, position.z);
        this.gameBallLight?.position.set(position.x, position.y + 0.85, position.z);
        this.gameGoal.position.set(this.gameStage.goal.x, 0.04, this.gameStage.goal.z);
        const hue = this.gameState.goalReached ? 0x65ff9f : 0x50f5b2;
        this.gameGoal.material.color.setHex(hue);
      }

      syncGameplayUi() {
        const hud = createGameplayHudModel({ motion: this.motionState, game: this.gameState });
        if (this.dom.gamePrimaryButton) {
          this.dom.gamePrimaryButton.textContent = hud.primaryAction.label;
          this.dom.gamePrimaryButton.dataset.action = hud.primaryAction.id;
        }
        if (this.dom.gameStatusText) {
          this.dom.gameStatusText.textContent = `${hud.statusText} Sensor control.`;
        }
        if (this.dom.gameTimerChip) {
          this.dom.gameTimerChip.textContent = `Timer ${hud.timerText}`;
        }
        if (this.dom.gameModeChip) {
          this.dom.gameModeChip.textContent = "Mode Sensor";
        }
        if (this.dom.gameGoalChip) {
          this.dom.gameGoalChip.textContent = this.gameState.goalReached ? "Goal Cleared" : "Goal Ahead";
        }
        if (this.dom.gameQualityChip) {
          const mobileWidth = window.innerWidth <= 900;
          this.gameplayQualityLevel = mobileWidth ? "Medium" : "High";
          this.dom.gameQualityChip.textContent = `Quality ${this.gameplayQualityLevel}`;
        }
        this.dom.gameEnableMotionButton?.toggleAttribute(
          "hidden",
          this.motionState.permission === "granted"
            || !this.motionState.hasSensorSupport
            || hud.primaryAction.id === "enable-motion",
        );
        this.dom.gameCalibrateButton?.toggleAttribute("hidden", !hud.showCalibrate);
      }

      resetTransform() {
        const selectedItem = this.getSelectedItem();
        this.state.rotationX = 0;
        this.state.rotationY = 0;
        this.state.rotationZ = 0;
        this.state.scale = 1;
        this.state.translateX = 0;
        this.state.translateY = 0;
        this.state.translateZ = 0;
        if (selectedItem) {
          selectedItem.transform.rotationX = 0;
          selectedItem.transform.rotationY = 0;
          selectedItem.transform.rotationZ = 0;
          selectedItem.transform.scale = 1;
          selectedItem.transform.translateX = 0;
          selectedItem.transform.translateY = 0;
          selectedItem.transform.translateZ = 0;
        }
        if (!this.modelRoot || !this.rotationPivot) {
          this.syncTransformInputs();
          return;
        }
        this.modelRoot.position.set(0, 0, 0);
        this.rotationPivot.rotation.set(0, 0, 0);
        this.rotationPivot.scale.setScalar(1);
        this.rotationPivot.updateMatrixWorld(true);
        this.syncTransformInputs();
        this.syncTransformGizmo();
        if (this.currentMesh) {
          this.recomputeBounds();
          this.configureDepthRangeFromBounds();
          this.updatePositionModifierBounds();
          this.refreshHelpers();
          this.updateMetaUi();
          this.updateCameraClipping();
        }
        this.queueSparkSceneUpdate();
        this.updateStatus("Reset splat transform");
        this.updateRenderChip("Transform reset");
        this.forceVisualRefresh(3);
      }

      resetView() {
        if (!this.defaultPose) {
          return;
        }
        this.state.focalLength = this.defaultPose.focalLength;
        this.applyFocalLength(false);
        this.camera.position.copy(this.defaultPose.position);
        this.camera.quaternion.copy(this.defaultPose.quaternion);
        this.camera.near = this.defaultPose.near;
        this.camera.far = this.defaultPose.far;
        this.camera.updateProjectionMatrix();
        this.orbitControls.target.copy(this.defaultPose.target);
        this.orbitControls.update();
        this.firstPerson.syncFromCamera();
        this.updateRenderChip("Reset view");
        this.updateStatus("Returned to saved default view");
        this.forceVisualRefresh(3);
      }

      setMode(mode) {
        const nextMode = mode === "orbit" ? "orbit" : "fps";
        if (this.activeMode === nextMode) {
          return;
        }
        if (nextMode === "fps") {
          this.orbitControls.enabled = false;
          this.orbitControls.disconnect?.();
          this.firstPerson.setPointerEnabled(true);
          this.firstPerson.setMovementEnabled(true);
        } else {
          this.syncOrbitTargetFromView();
          this.firstPerson.setPointerEnabled(false);
          this.firstPerson.setMovementEnabled(true);
          this.orbitControls.connect?.(this.renderer.domElement);
          this.orbitControls.enabled = true;
          this.orbitControls.update();
        }
        this.activeMode = nextMode;
        this.updateModeUi();
        this.updateStatus(`Camera mode: ${this.activeMode === "fps" ? "First-person" : "Orbit"}`);
        this.invalidateRender();
      }

      setViewMode(mode) {
        const nextMode = mode === "tools" ? "tools" : "play";
        if (this.state.viewMode === nextMode) {
          return;
        }
        this.state.viewMode = nextMode;
        this.syncViewModeUi();
        this.updateStatus(nextMode === "play" ? "Play mode enabled" : "Viewer tools enabled");
        this.invalidateRender();
      }

      setRenderMode(mode) {
        const nextMode = Object.prototype.hasOwnProperty.call(RENDER_MODE_LABELS, mode) ? mode : "beauty";
        const selectedItem = this.getSelectedItem();
        this.state.renderMode = nextMode;
        if (selectedItem) {
          selectedItem.settings.renderMode = nextMode;
        }
        this.applyRenderMode(true);
        this.updateModeUi();
      }

      shouldAttachAnimationModifier() {
        return Boolean(
          this.activeAnimationModifier
          && this.state.animationApplied
          && (this.state.animationPlaying || this.state.animationTime > 0),
        );
      }

      applyRenderMode(updateChip = true) {
        this.syncLightingRuntimeState();
        const animationModifier = this.shouldAttachAnimationModifier() ? this.activeAnimationModifier : null;
        this.sceneItems.forEach((item) => {
          if (!item.mesh) {
            return;
          }
          const itemMode = item.id === this.selectedSceneItemId
            ? (item.settings.renderMode || "beauty")
            : "beauty";
          const objectModifiers = [];
          if (item.baseObjectModifier) {
            objectModifiers.push(item.baseObjectModifier);
          }
          if (animationModifier) {
            objectModifiers.push(animationModifier);
          }
          item.mesh.enableWorldToView = false;
          item.mesh.enableLod = !animationModifier;
          item.mesh.objectModifiers = objectModifiers.length ? objectModifiers : undefined;
          item.mesh.covObjectModifiers = item.mesh.objectModifiers;
          item.mesh.worldModifier = undefined;
          item.mesh.worldModifiers = item.baseWorldModifier ? [item.baseWorldModifier] : undefined;
          item.mesh.covWorldModifiers = item.mesh.worldModifiers;
          item.mesh.updateMatrixWorld(true);
          item.mesh.context?.transform?.updateFromMatrix(item.mesh.matrixWorld);
          if (itemMode === "beauty") {
            const worldModifiers = [];
            if (item.baseWorldModifier) {
              worldModifiers.push(item.baseWorldModifier);
            }
            if (this.activeLightCount > 0) {
              worldModifiers.push(createPointLightColorModifier({
                lightColorB: this.lightHandles.colorB,
                lightColorG: this.lightHandles.colorG,
                lightColorR: this.lightHandles.colorR,
                lightCount: this.activeLightCount,
                lightIntensities: this.lightHandles.intensities,
                lightPositions: this.lightHandles.positions,
              }));
            }
            if (item.id === this.selectedSceneItemId && !isNeutralToneCurve(item.settings.toneCurve)) {
              worldModifiers.push(createToneCurveColorModifier(item.settings.toneCurve));
            }
            item.mesh.worldModifiers = worldModifiers.length ? worldModifiers : undefined;
            item.mesh.covWorldModifiers = item.mesh.worldModifiers;
          } else if (itemMode === "depth") {
            item.mesh.enableWorldToView = true;
            item.mesh.worldModifier = createDepthColorModifier(
              this.depthModifierHandles,
              item.mesh.context.worldToView,
            );
            item.mesh.covWorldModifiers = undefined;
          } else if (itemMode === "position") {
            if (item.id === this.selectedSceneItemId) {
              this.updatePositionModifierBounds();
            }
            item.mesh.worldModifier = createPositionColorModifier(this.positionModifierHandles);
            item.mesh.covWorldModifiers = undefined;
          } else if (itemMode === "worldNormal") {
            item.mesh.worldModifier = createWorldNormalModifier();
            item.mesh.covWorldModifiers = undefined;
          }
        });
        this.syncMeshExposure();
        this.applyShLevel(true);
        this.updateNormalizeFieldState();
        this.renderPickedColors();
        if (updateChip) {
          this.updateRenderChip(`${RENDER_MODE_LABELS[this.state.renderMode] || "Beauty"} mode`);
          this.updateStatus(`Render mode: ${RENDER_MODE_LABELS[this.state.renderMode] || "Beauty"}`);
        }
        this.invalidateRender();
        this.queueSparkSceneUpdate();
      }

      syncOrbitTargetFromView() {
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        const targetSphere = this.sceneBoundsSphere ?? this.boundsSphere;
        const focusDistance = targetSphere ? Math.max(targetSphere.radius * 0.9, 1.2) : 3;
        this.orbitControls.target.copy(
          this.camera.position.clone().addScaledVector(forward, focusDistance),
        );
        this.orbitControls.update();
      }

      scheduleRender(delayMs = 0) {
        const targetTime = performance.now() + Math.max(0, Number(delayMs) || 0);
        if (delayMs <= 0) {
          this.scheduledRenderAt = 0;
        } else if (!this.scheduledRenderAt || targetTime < this.scheduledRenderAt) {
          this.scheduledRenderAt = targetTime;
        }
        this.startAnimationLoop();
      }

      forceVisualRefresh(frameCount = 2) {
        this.pendingForcedFrames = Math.max(
          this.pendingForcedFrames,
          Math.max(1, Math.round(Number(frameCount) || 1)),
        );
        this.invalidateRender();
      }

      schedulePostLoadRefresh() {
        if (this.postLoadRefreshHandle) {
          window.clearTimeout(this.postLoadRefreshHandle);
          this.postLoadRefreshHandle = 0;
        }
        this.forceVisualRefresh(4);
        this.postLoadRefreshHandle = window.setTimeout(() => {
          this.postLoadRefreshHandle = 0;
          this.forceVisualRefresh(4);
          window.setTimeout(() => {
            this.forceVisualRefresh(3);
          }, 120);
        }, 40);
      }

      invalidateRender(immediate = true) {
        this.renderInvalidated = true;
        if (immediate) {
          this.scheduledRenderAt = 0;
        } else {
          this.scheduleRender(this.idleRenderDelayMs);
          return;
        }
        this.markRenderActivity();
        this.scheduleRender(0);
      }

      captureCurrentPoseAsDefault() {
        this.defaultPose = {
          far: this.camera.far,
          focalLength: this.state.focalLength,
          near: this.camera.near,
          position: this.camera.position.clone(),
          quaternion: this.camera.quaternion.clone(),
          target: this.orbitControls.target.clone(),
        };
        this.hasCapturedInitialPose = true;
      }

      setProgress(label, ratio) {
        this.dom.progressLabel.textContent = label;
        this.dom.progressTrack.classList.toggle("is-indeterminate", ratio == null);
        this.dom.progressFill.style.width = ratio == null ? "32%" : `${Math.max(0, Math.min(ratio, 1)) * 100}%`;
      }

      toggleHelper(stateKey) {
        this.state[stateKey] = !this.state[stateKey];
        this.refreshHelpers();
        this.syncToggleButtons();
        this.invalidateRender();
      }

      syncToggleButtons() {
        this.dom.toggleAutorotateButton.classList.toggle("is-active", this.state.autoRotate);
        this.dom.toggleAxesButton.classList.toggle("is-active", this.state.showAxes);
        this.dom.toggleBoundsButton.classList.toggle("is-active", this.state.showBounds);
        this.dom.toggleGridButton.classList.toggle("is-active", this.state.showGrid);
      }

      updateCameraClipping(distanceHint) {
        const targetSphere = this.sceneBoundsSphere ?? this.boundsSphere;
        if (!targetSphere) {
          return;
        }
        const radius = Math.max(targetSphere.radius, 0.05);
        const distance = distanceHint ?? Math.max(this.camera.position.distanceTo(targetSphere.center), radius * 0.25);
        this.camera.near = Math.max(radius / 5000, 0.0005);
        this.camera.far = Math.max(distance + radius * 420, radius * 1500, 2400);
        this.camera.updateProjectionMatrix();
      }

      syncVisibleSceneItemTransforms() {
        this.sceneItems.forEach((item) => {
          if (!item.visible || !item.mesh) {
            return;
          }
          item.modelRoot.updateMatrixWorld(true);
          item.rotationPivot.updateMatrixWorld(true);
          item.mesh.updateMatrixWorld(true);
        });
      }

      updateCameraUi() {
        const gridText = Number.isFinite(this.currentGridScale)
          ? `Grid ${formatNumber(this.currentGridScale, this.currentGridScale < 10 ? 2 : 0)}`
          : "Grid -";
        this.dom.gridChip.textContent = gridText;
        this.dom.cameraChip.textContent = `Cam ${formatVector(this.camera.position)}`;
      }

      updateFps() {
        this.frameCounter += 1;
        const now = performance.now();
        if (now - this.lastFpsUpdate < 500) {
          return;
        }
        const fps = (this.frameCounter * 1000) / (now - this.lastFpsUpdate);
        this.dom.fpsChip.textContent = `${fps.toFixed(1)} fps`;
        this.frameCounter = 0;
        this.lastFpsUpdate = now;
      }

      syncLodUi() {
        if (this.dom.lodAutoCheckbox) {
          this.dom.lodAutoCheckbox.checked = Boolean(this.state.autoLodEnabled);
        }
        if (this.dom.lodChip) {
          const lodActive = detectLodAvailability(this.getSelectedItem()?.mesh);
          this.dom.lodChip.textContent = buildLodChipLabel({
            autoLodEnabled: this.state.autoLodEnabled,
            lodActive,
          });
          this.dom.lodChip.classList.toggle("toolbar-button-primary", lodActive);
        }
      }

      updateMetaUi() {
        const center = this.centerBoundsSphere?.center ?? this.boundsSphere?.center ?? null;
        const selectedItem = this.getSelectedItem();
        const lodActive = detectLodAvailability(selectedItem?.mesh);
        if (this.dom.infoItemName) {
          this.dom.infoItemName.textContent = this.modelMeta.name;
        }
        this.dom.infoName.textContent = this.modelMeta.name;
        this.dom.infoFormat.textContent = this.modelMeta.format;
        this.dom.infoSource.textContent = this.modelMeta.source;
        this.dom.infoSize.textContent = formatBytes(this.modelMeta.bytes);
        this.dom.infoSplats.textContent = this.modelMeta.splats
          ? this.modelMeta.splats.toLocaleString()
          : "-";
        this.dom.infoLoadTime.textContent = this.modelMeta.elapsedMs
          ? `${this.modelMeta.elapsedMs.toFixed(0)} ms`
          : "-";
        this.dom.infoCenter.textContent = center ? formatVector(center) : "-";
        this.dom.infoBounds.textContent = this.bounds
          ? formatVector(this.bounds.getSize(new THREE.Vector3()))
          : "-";
        this.dom.infoAutoLod.textContent = this.state.autoLodEnabled ? "Enabled" : "Disabled";
        this.dom.infoLoadMode.textContent = buildLodInfoLabel({
          autoLodEnabled: this.state.autoLodEnabled,
          lodActive,
        });
        this.dom.infoScaleRange.textContent = this.modelMeta.scaleRange;
        this.dom.infoShDegree.textContent = this.modelMeta.shDegree;
        this.dom.infoShActive.textContent = this.modelMeta.activeSh;
        this.dom.infoCompression.textContent = this.modelMeta.compression;
        this.dom.infoCompressionRatio.textContent = this.modelMeta.compressionRatio;
        this.dom.infoEncoding.textContent = this.modelMeta.encoding;
        this.dom.infoPackedCapacity.textContent = this.modelMeta.packedCapacity;
      }

      updateModeUi() {
        this.dom.modeButtons.forEach((button) => {
          button.classList.toggle("is-active", button.dataset.mode === this.activeMode);
        });
        this.dom.modeDescription.title = CAMERA_MODE_TEXT[this.activeMode];
        this.dom.modeDescription.setAttribute("aria-label", CAMERA_MODE_TEXT[this.activeMode]);
        this.dom.renderModeSelect.value = this.state.renderMode;
        this.updateNormalizeFieldState();
      }

      syncViewModeUi() {
        const isPlayMode = this.state.viewMode === "play";
        document.body.dataset.viewMode = isPlayMode ? "play" : "tools";
      }

      setAnimationOriginMode(mode) {
        if (!this.activeAnimationScript) {
          this.syncAnimationOriginControls();
          return;
        }
        this.activeAnimationScript.originMode = mode === "manual" ? "manual" : "centroid";
        this.syncAnimationEditor();
        this.syncAnimationOriginControls();
        if (this.state.animationApplied) {
          this.applyActiveAnimationUniforms();
          this.forceVisualRefresh(2);
          this.queueSparkSceneUpdate();
        }
      }

      setAnimationOriginAxis(axis, value) {
        if (!this.activeAnimationScript) {
          this.syncAnimationOriginControls();
          return;
        }
        this.activeAnimationScript.originMode = "manual";
        this.activeAnimationScript.origin[axis] = clampNumber(value, TRANSLATE_LIMITS);
        this.syncAnimationEditor();
        this.syncAnimationOriginControls();
        if (this.state.animationApplied) {
          this.applyActiveAnimationUniforms();
          this.forceVisualRefresh(2);
          this.queueSparkSceneUpdate();
        }
      }

      syncAnimationOriginControls() {
        const script = this.activeAnimationScript;
        const originMode = script?.originMode === "manual" ? "manual" : "centroid";
        const disabled = !script;
        if (this.dom.animationOriginModeSelect) {
          this.dom.animationOriginModeSelect.value = originMode;
          this.dom.animationOriginModeSelect.disabled = disabled;
        }
        const x = script?.origin?.x ?? 0;
        const y = script?.origin?.y ?? 0;
        const z = script?.origin?.z ?? 0;
        if (this.dom.animationOriginXInput) {
          this.dom.animationOriginXInput.value = Number(x).toFixed(3);
          this.dom.animationOriginXInput.disabled = disabled || originMode !== "manual";
        }
        if (this.dom.animationOriginYInput) {
          this.dom.animationOriginYInput.value = Number(y).toFixed(3);
          this.dom.animationOriginYInput.disabled = disabled || originMode !== "manual";
        }
        if (this.dom.animationOriginZInput) {
          this.dom.animationOriginZInput.value = Number(z).toFixed(3);
          this.dom.animationOriginZInput.disabled = disabled || originMode !== "manual";
        }
      }

      syncAnimationEditor() {
        if (this.dom.animationScriptEditor) {
          this.dom.animationScriptEditor.value = this.activeAnimationScript
            ? serializeAnimationScript(this.activeAnimationScript)
            : "";
        }
        if (this.dom.animationPresetSelect) {
          this.dom.animationPresetSelect.value = this.activeAnimationScript?.preset || "explosion";
        }
        if (this.dom.animationScriptStatus) {
          this.dom.animationScriptStatus.textContent = this.activeAnimationScript
            ? `${this.activeAnimationScript.name} is loaded. Apply the script to animate the splats.`
            : "No animation script loaded. Use Splat Explosion, load a script, or keep animation off.";
        }
        this.syncAnimationOriginControls();
      }

      syncAnimationControls(syncSlider = true) {
        const duration = Math.max(this.state.animationDuration || this.activeAnimationScript?.duration || 0, 0);
        this.state.animationDuration = duration;
        if (this.dom.animationTimeRange) {
          this.dom.animationTimeRange.max = String(Math.max(duration, 0.01));
          if (syncSlider) {
            this.dom.animationTimeRange.value = String(Math.min(Math.max(this.state.animationTime, 0), Math.max(duration, 0.01)));
          }
        }
        if (this.dom.animationTimeLabel) {
          this.dom.animationTimeLabel.textContent = `${this.state.animationTime.toFixed(2)}s / ${duration.toFixed(2)}s`;
        }
        if (this.dom.animationLoopCheckbox) {
          this.dom.animationLoopCheckbox.checked = Boolean(this.state.animationLoop);
        }
        if (this.dom.animationPlayButton) {
          this.dom.animationPlayButton.classList.toggle("is-active", this.state.animationPlaying);
        }
        if (this.dom.animationPauseButton) {
          this.dom.animationPauseButton.classList.toggle("is-active", !this.state.animationPlaying);
        }
      }

      resolveAnimationOrigin(script) {
        if (!script) {
          return new THREE.Vector3();
        }
        if (script.originMode === "centroid") {
          return (this.centerBoundsSphere?.center ?? this.boundsSphere?.center ?? this.sceneBoundsSphere?.center ?? new THREE.Vector3()).clone();
        }
        return new THREE.Vector3(script.origin.x, script.origin.y, script.origin.z);
      }

      applyActiveAnimationUniforms() {
        if (!this.activeAnimationScript) {
          return;
        }
        const { params } = this.activeAnimationScript;
        const origin = this.resolveAnimationOrigin(this.activeAnimationScript);
        this.animationModifierHandles.origin.value.copy(origin);
        this.animationModifierHandles.distanceScale.value = params.distanceScale;
        this.animationModifierHandles.opacityPower.value = params.opacityPower;
        this.animationModifierHandles.scaleInfluence.value = params.scaleInfluence;
        this.animationModifierHandles.speed.value = params.speed;
        this.animationModifierHandles.strength.value = params.strength;
        this.animationModifierHandles.swirl.value = params.swirl;
        this.animationModifierHandles.time.value = this.state.animationTime;
      }

      clearAnimationScript(announce = false) {
        this.activeAnimationScript = null;
        this.activeAnimationModifier = null;
        Object.assign(this.state, createDefaultAnimationPlaybackState(null));
        this.animationModifierHandles.time.value = 0;
        this.syncAnimationEditor();
        this.syncAnimationControls(true);
        this.applyRenderMode(false);
        this.forceVisualRefresh(2);
        this.queueSparkSceneUpdate();
        if (announce) {
          this.updateStatus("Animation cleared");
          this.updateRenderChip("Animation off");
        }
      }

      loadAnimationPreset(name) {
        try {
          this.activeAnimationScript = parseAnimationScript(getAnimationPresetScriptText(name));
          this.activeAnimationModifier = null;
          this.state.animationApplied = false;
          this.state.animationLoop = this.activeAnimationScript.loop;
          this.state.animationDuration = this.activeAnimationScript.duration;
          this.state.animationPlaying = false;
          this.state.animationTime = 0;
          this.syncAnimationEditor();
          this.syncAnimationControls(true);
          this.applyRenderMode(false);
          this.forceVisualRefresh(2);
          this.queueSparkSceneUpdate();
          this.updateStatus(`Loaded ${this.activeAnimationScript.name}`);
        } catch (error) {
          this.updateStatus(error instanceof Error ? error.message : "Failed to load animation preset");
        }
      }

      applyAnimationScript(announce = true) {
        try {
          const text = this.dom.animationScriptEditor?.value?.trim() || "";
          if (!text) {
            this.clearAnimationScript(announce);
            return;
          }
          this.activeAnimationScript = parseAnimationScript(text);
          this.state.animationLoop = this.activeAnimationScript.loop;
          this.state.animationDuration = this.activeAnimationScript.duration;
          this.state.animationTime = Math.min(this.state.animationTime, this.state.animationDuration);
          this.state.animationApplied = true;
          this.applyActiveAnimationUniforms();
          this.activeAnimationModifier = createAnimationModifierFromScript(this.activeAnimationScript, {
            dyno,
            handles: this.animationModifierHandles,
          });
          this.syncAnimationEditor();
          this.syncAnimationControls(true);
          this.applyRenderMode(false);
          this.forceVisualRefresh(3);
          this.queueSparkSceneUpdate();
          if (announce) {
            this.updateStatus(`Applied ${this.activeAnimationScript.name}`);
            this.updateRenderChip(`${ANIMATION_PRESET_LABELS[this.activeAnimationScript.preset] || "Animation"} ready`);
          }
        } catch (error) {
          this.activeAnimationModifier = null;
          this.state.animationApplied = false;
          this.state.animationPlaying = false;
          this.applyRenderMode(false);
          this.forceVisualRefresh(2);
          this.queueSparkSceneUpdate();
          this.updateStatus(error instanceof Error ? error.message : "Animation script parse failed");
          if (this.dom.animationScriptStatus) {
            this.dom.animationScriptStatus.textContent = error instanceof Error ? error.message : "Animation script parse failed";
          }
        }
      }

      stepAnimation(delta) {
        if (!this.activeAnimationModifier || !this.state.animationApplied) {
          return false;
        }
        if (!this.state.animationPlaying) {
          this.animationModifierHandles.time.value = this.state.animationTime;
          return false;
        }
        const duration = Math.max(this.state.animationDuration || 0.1, 0.1);
        let nextTime = this.state.animationTime + Math.max(delta, 0);
        if (nextTime >= duration) {
          if (this.state.animationLoop) {
            nextTime %= duration;
          } else {
            nextTime = duration;
            this.state.animationPlaying = false;
          }
        }
        this.state.animationTime = nextTime;
        this.animationModifierHandles.time.value = nextTime;
        this.syncAnimationControls(true);
        this.invalidateRender();
        this.forceVisualRefresh(1);
        this.queueSparkSceneUpdate();
        if (!this.state.animationPlaying) {
          this.updateStatus(`Paused ${this.activeAnimationScript.name}`);
        }
        return true;
      }

      playAnimation() {
        if (!canPlayAnimation({
          animationApplied: this.state.animationApplied,
          hasModifier: Boolean(this.activeAnimationModifier),
        })) {
          this.updateStatus("No animation script applied");
          return;
        }
        this.state.animationPlaying = true;
        this.lastAnimationTickAt = performance.now();
        this.markRenderActivity(10_000);
        this.applyRenderMode(false);
        this.forceVisualRefresh(2);
        this.queueSparkSceneUpdate();
        this.syncAnimationControls(true);
        this.updateStatus(`Playing ${this.activeAnimationScript.name}`);
      }

      pauseAnimation() {
        this.state.animationPlaying = false;
        this.applyRenderMode(false);
        this.syncAnimationControls(true);
        this.updateStatus(`Paused ${this.activeAnimationScript?.name || "animation"}`);
      }

      resetAnimation() {
        this.pauseAnimation();
        this.state.animationTime = 0;
        this.animationModifierHandles.time.value = 0;
        this.applyRenderMode(false);
        this.syncAnimationControls(true);
        this.forceVisualRefresh(2);
        this.queueSparkSceneUpdate();
        this.updateStatus(`Reset ${this.activeAnimationScript?.name || "animation"}`);
      }

      setAnimationTimeFromUi(commit = false) {
        if (!this.dom.animationTimeRange) {
          return;
        }
        const duration = Math.max(this.state.animationDuration || 0, 0);
        this.state.animationTime = THREE.MathUtils.clamp(Number(this.dom.animationTimeRange.value) || 0, 0, Math.max(duration, 0));
        this.animationModifierHandles.time.value = this.state.animationTime;
        if (commit) {
          this.state.animationPlaying = false;
        }
        this.applyRenderMode(false);
        this.syncAnimationControls(true);
        this.forceVisualRefresh(commit ? 3 : 1);
        if (this.state.animationApplied) {
          this.queueSparkSceneUpdate();
        }
      }

      async loadAnimationScriptFile(file) {
        try {
          const text = await file.text();
          this.activeAnimationScript = parseAnimationScript(text);
          this.activeAnimationModifier = null;
          this.state.animationApplied = false;
          this.state.animationLoop = this.activeAnimationScript.loop;
          this.state.animationDuration = this.activeAnimationScript.duration;
          this.state.animationPlaying = false;
          this.state.animationTime = 0;
          this.syncAnimationEditor();
          this.syncAnimationControls(true);
          this.applyRenderMode(false);
          this.forceVisualRefresh(2);
          this.queueSparkSceneUpdate();
          this.updateStatus(`Loaded ${this.activeAnimationScript.name}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to read animation script";
          this.updateStatus(message);
          if (this.dom.animationScriptStatus) {
            this.dom.animationScriptStatus.textContent = message;
          }
        }
      }

      saveAnimationScript() {
        const blob = new Blob([this.dom.animationScriptEditor?.value || ""], { type: "text/javascript;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = buildAnimationDownloadName(this.activeAnimationScript?.name || DEFAULT_ANIMATION_SCRIPT_NAME);
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
        this.updateStatus(`Saved ${link.download}`);
      }

      setInspectorTab(tab) {
        const nextTab = ["scene", "color", "light", "animation", "info", "export"].includes(tab) ? tab : "scene";
        this.state.inspectorTab = nextTab;
        this.syncInspectorTabs();
        const label = nextTab === "scene"
          ? "Splats"
          : `${nextTab[0].toUpperCase()}${nextTab.slice(1)}`;
        this.updateRenderChip(`${label} tab`);
      }

      syncInspectorTabs() {
        this.dom.inspectorTabButtons.forEach((button) => {
          const isActive = button.dataset.inspectorTab === this.state.inspectorTab;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-selected", String(isActive));
        });
        this.dom.inspectorPanels.forEach((panel) => {
          const isActive = panel.dataset.inspectorPanel === this.state.inspectorTab;
          panel.classList.toggle("is-active", isActive);
          panel.hidden = !isActive;
        });
      }

      updateRenderChip(message) {
        if (this.dom.renderChip) {
          this.dom.renderChip.textContent = message;
        }
      }

      updateStatus(message) {
        this.dom.statusLine.textContent = message;
      }
    }

    const app = new GaussianViewerApp(dom);
    window.__sparkViewerApp = app;
    app.init().catch((error) => {
      dom.statusLine.textContent = error instanceof Error ? error.message : "Viewer failed to initialize";
      dom.progressLabel.textContent = "Viewer failed to start";
      if (dom.renderChip) {
        dom.renderChip.textContent = "Init error";
      }
    });
}

startSparkViewer();
