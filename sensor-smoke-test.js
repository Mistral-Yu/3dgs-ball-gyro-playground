import {
  DEFAULT_MOTION_CONFIG,
  calibrateMotionState,
  createMotionState,
  updateMotionState,
} from './motion-controls.mjs';

const dom = {
  calibrateButton: document.getElementById('calibrate-button'),
  enableMotionButton: document.getElementById('enable-motion-button'),
  filteredXValue: document.getElementById('filtered-x-value'),
  filteredZValue: document.getElementById('filtered-z-value'),
  modeValue: document.getElementById('mode-value'),
  permissionValue: document.getElementById('permission-value'),
  rawBetaValue: document.getElementById('raw-beta-value'),
  rawGammaValue: document.getElementById('raw-gamma-value'),
  statusValue: document.getElementById('status-value'),
  touchModeButton: document.getElementById('touch-mode-button'),
};

let motionState = createMotionState({
  hasSensorSupport: typeof window.DeviceOrientationEvent !== 'undefined',
});

const render = () => {
  dom.permissionValue.textContent = motionState.permission;
  dom.modeValue.textContent = motionState.mode;
  dom.rawBetaValue.textContent = String(Number(motionState.rawBeta || 0).toFixed(2));
  dom.rawGammaValue.textContent = String(Number(motionState.rawGamma || 0).toFixed(2));
  dom.filteredXValue.textContent = String(Number(motionState.filteredX || 0).toFixed(3));
  dom.filteredZValue.textContent = String(Number(motionState.filteredZ || 0).toFixed(3));
};

const setStatus = (value) => {
  dom.statusValue.textContent = value;
};

const handleOrientation = (event) => {
  motionState = updateMotionState(motionState, {
    beta: event?.beta,
    gamma: event?.gamma,
    now: performance.now(),
  }, DEFAULT_MOTION_CONFIG);
  motionState.mode = 'sensor';
  setStatus('Receiving orientation events');
  render();
};

const installListener = () => {
  if (typeof window.DeviceOrientationEvent === 'undefined') {
    motionState = { ...motionState, hasSensorSupport: false, permission: 'denied', mode: 'touch' };
    setStatus('DeviceOrientationEvent unavailable. Touch fallback only.');
    render();
    return false;
  }
  window.addEventListener('deviceorientation', handleOrientation, true);
  return true;
};

const requestMotion = async () => {
  if (!installListener()) {
    return;
  }
  if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
    const result = await window.DeviceOrientationEvent.requestPermission();
    motionState = { ...motionState, permission: result === 'granted' ? 'granted' : 'denied' };
    setStatus(result === 'granted' ? 'Permission granted. Move the device.' : 'Permission denied.');
  } else {
    motionState = { ...motionState, permission: 'granted' };
    setStatus('Permission flow not required on this browser. Move the device.');
  }
  render();
};

dom.enableMotionButton?.addEventListener('click', () => {
  void requestMotion();
});

dom.calibrateButton?.addEventListener('click', () => {
  motionState = calibrateMotionState(motionState, {
    beta: motionState.rawBeta,
    gamma: motionState.rawGamma,
  });
  setStatus('Calibrated with current beta/gamma values.');
  render();
});

dom.touchModeButton?.addEventListener('click', () => {
  motionState = { ...motionState, mode: 'touch', permission: motionState.permission === 'unknown' ? 'denied' : motionState.permission };
  setStatus('Forced touch fallback for verification.');
  render();
});

setStatus('Tap Enable Motion to begin.');
render();
