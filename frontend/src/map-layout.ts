export interface Camera {
  cx: number;
  cy: number;
  zoom: number;
}
export interface MapLayout {
  camera: Camera;
  visible: number[];
  labels: "focus" | "all" | "off";
  grid: boolean;
  sectors: boolean;
}
export const DEFAULT_CAMERA: Camera = { cx: 400, cy: 260, zoom: 1 };
const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function normalizeCamera(value: Partial<Camera> = {}): Camera {
  const zoom = clamp(finite(value.zoom, 1), 1, 4),
    halfWidth = 400 / zoom,
    halfHeight = 260 / zoom;
  return {
    zoom,
    cx: clamp(finite(value.cx, 400), halfWidth, 800 - halfWidth),
    cy: clamp(finite(value.cy, 260), halfHeight, 520 - halfHeight),
  };
}
export function zoomCamera(
  camera: Camera,
  zoom: number,
  anchor?: [number, number],
): Camera {
  const next = clamp(zoom, 1, 4),
    ratio = camera.zoom / next;
  return normalizeCamera({
    zoom: next,
    cx: anchor ? anchor[0] + (camera.cx - anchor[0]) * ratio : camera.cx,
    cy: anchor ? anchor[1] + (camera.cy - anchor[1]) * ratio : camera.cy,
  });
}
export function viewBox(camera: Camera): string {
  return `${camera.cx - 400 / camera.zoom} ${camera.cy - 260 / camera.zoom} ${800 / camera.zoom} ${520 / camera.zoom}`;
}
export function normalizeLayout(raw: unknown, drivers: number[]): MapLayout {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const camera =
    value.camera && typeof value.camera === "object"
      ? (value.camera as Camera)
      : {};
  return {
    camera: normalizeCamera(camera),
    visible: Array.isArray(value.visible)
      ? [
          ...new Set(
            value.visible.filter(
              (number): number is number =>
                typeof number === "number" && drivers.includes(number),
            ),
          ),
        ]
      : [...drivers],
    labels:
      value.labels === "all" || value.labels === "off" ? value.labels : "focus",
    grid: typeof value.grid === "boolean" ? value.grid : true,
    sectors: typeof value.sectors === "boolean" ? value.sectors : false,
  };
}
export function layoutKey(raceId: string) {
  return `pitwall.map.v1.${encodeURIComponent(raceId)}`;
}
export function readLayout(raceId: string, drivers: number[]): MapLayout {
  try {
    return normalizeLayout(
      JSON.parse(localStorage.getItem(layoutKey(raceId)) ?? "null"),
      drivers,
    );
  } catch {
    return normalizeLayout(null, drivers);
  }
}
