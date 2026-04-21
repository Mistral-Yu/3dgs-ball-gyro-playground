const formatTimer = (elapsedMs) => `${(Math.max(0, Number(elapsedMs) || 0) / 1000).toFixed(2)}s`;

export function createGameplayHudModel({ motion = {}, game = {} } = {}) {
  const permission = motion.permission || 'unknown';
  const hasSensorSupport = motion.hasSensorSupport !== false;
  const usingTouch = game.touchMode || motion.mode === 'touch' || !hasSensorSupport || permission === 'denied';
  const gameStatus = game.status || 'idle';

  let primaryAction = { id: 'start', label: 'Start Run' };
  let statusText = 'Ready to play.';

  if (gameStatus === 'won' || game.goalReached) {
    primaryAction = { id: 'retry', label: 'Retry' };
    statusText = 'Goal reached. Nice run.';
  } else if (usingTouch) {
    primaryAction = { id: 'touch-mode', label: 'Touch Mode' };
    statusText = 'Touch controls active.';
  } else if (hasSensorSupport && permission !== 'granted') {
    primaryAction = { id: 'enable-motion', label: 'Enable Motion' };
    statusText = 'Motion permission is required.';
  }

  return {
    primaryAction,
    secondaryAction: { id: 'reset', label: 'Reset' },
    showCalibrate: permission === 'granted',
    showTouchHint: usingTouch,
    statusText,
    timerText: formatTimer(game.elapsedMs),
  };
}
