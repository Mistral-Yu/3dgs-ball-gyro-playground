export function buildSplatMeshLoadOptions(autoLodEnabled) {
  return autoLodEnabled ? { lod: true } : {};
}

export function detectLodAvailability(mesh) {
  try {
    if (mesh?.packedSplats?.lodSplats || mesh?.extSplats?.lodSplats) {
      return true;
    }
    if (mesh?.csplatArray?.has_lod?.()) {
      return true;
    }
    if (mesh?.packedSplats?.splatEncoding?.lodOpacity) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function buildLodChipLabel({ autoLodEnabled, lodActive }) {
  const mode = autoLodEnabled ? 'LOD Auto On' : 'LOD Auto Off';
  if (!lodActive) {
    return mode;
  }
  return `${mode} / Active`;
}

export function buildLodInfoLabel({ autoLodEnabled, lodActive }) {
  const mode = autoLodEnabled ? 'Auto-LoD enabled' : 'Auto-LoD disabled';
  return `${mode} / ${lodActive ? 'LoD data active' : 'Full-res only'}`;
}
