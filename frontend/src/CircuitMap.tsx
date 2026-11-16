import { useEffect, useRef, useState } from "react";
import {
  Check,
  Focus,
  Move,
  RotateCcw,
  Save,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { markerPosition } from "./locations";
import LocationImport from "./LocationImport";
import type { MarkerPosition, PositionSource } from "./locations";
import type { DriverState, Race } from "./race";
import {
  DEFAULT_CAMERA,
  layoutKey,
  normalizeCamera,
  normalizeLayout,
  readLayout,
  viewBox,
  zoomCamera,
} from "./map-layout";
import type { Camera, MapLayout } from "./map-layout";

export default function CircuitMap({
  race,
  standings,
  focused,
  comparison,
  elapsed,
  onSelect,
  onUpgrade,
}: {
  race: Race;
  standings: DriverState[];
  focused: DriverState;
  comparison: number | null;
  elapsed: number;
  onSelect: (driver: number) => void;
  onUpgrade: (race: Race) => void;
}) {
  const drivers = race.drivers.map((d) => d.number);
  const recordedAvailable = !!race.locations?.traces.some(
    (t) => t.samples.length > 1,
  );
  const [source, setSource] = useState<PositionSource>(
    recordedAvailable ? "recorded" : "lap",
  );
  const positions = new Map(
    standings.map((state) => [
      state.driver.number,
      markerPosition(race, state, elapsed, source),
    ]),
  );
  const [layout, setLayout] = useState<MapLayout>(() =>
    readLayout(race.id, drivers),
  );
  const [settings, setSettings] = useState(false),
    [following, setFollowing] = useState(false),
    [message, setMessage] = useState("");
  const [saved, setSaved] = useState(() =>
    JSON.stringify(readLayout(race.id, drivers)),
  );
  const svg = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    camera: Camera;
    units: number;
  } | null>(null);
  const focusedPosition = positions.get(focused.driver.number)!;
  const lastPoint = useRef<[number, number] | null>(null);
  if (focusedPosition.point) lastPoint.current = focusedPosition.point;
  const point = focusedPosition.point ?? lastPoint.current;
  const effective =
    following && point
      ? normalizeCamera({ ...layout.camera, cx: point[0], cy: point[1] })
      : layout.camera;
  const currentCamera = useRef(effective);
  currentCamera.current = effective;
  const path = race.track.length
    ? `M ${race.track.map((p) => p.join(",")).join(" L ")} Z`
    : "";
  const visible = new Set(layout.visible);
  const dirty = JSON.stringify(layout) !== saved;
  const previousDriver = useRef(focused.driver.number);
  const previousAvailability = useRef(recordedAvailable);
  useEffect(() => {
    if (recordedAvailable && !previousAvailability.current) {
      setLayout(l => ({ ...l, camera: currentCamera.current }));
      setFollowing(false);
      setSource("recorded");
      lastPoint.current = null;
    }
    previousAvailability.current = recordedAvailable;
  }, [recordedAvailable]);
  useEffect(() => {
    if (previousDriver.current !== focused.driver.number) {
      setLayout((l) =>
        l.visible.includes(focused.driver.number)
          ? l
          : { ...l, visible: [...l.visible, focused.driver.number] },
      );
      previousDriver.current = focused.driver.number;
    }
  }, [focused.driver.number]);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const matrix = element.getScreenCTM();
      if (!matrix) return;
      const p = element.createSVGPoint();
      p.x = event.clientX;
      p.y = event.clientY;
      const anchor = p.matrixTransform(matrix.inverse());
      setFollowing(false);
      setLayout((l) => ({
        ...l,
        camera: zoomCamera(
          currentCamera.current,
          currentCamera.current.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15),
          [anchor.x, anchor.y],
        ),
      }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  function camera(next: Camera) {
    setFollowing(false);
    setLayout((l) => ({ ...l, camera: normalizeCamera(next) }));
  }
  function zoom(amount: number) {
    camera(
      zoomCamera(currentCamera.current, currentCamera.current.zoom + amount),
    );
  }
  function follow() {
    if (following) {
      camera(currentCamera.current);
      return;
    }
    setLayout((l) => ({
      ...l,
      camera: zoomCamera(
        currentCamera.current,
        Math.max(2, currentCamera.current.zoom),
      ),
      visible: l.visible.includes(focused.driver.number)
        ? l.visible
        : [...l.visible, focused.driver.number],
    }));
    setFollowing(true);
  }
  function toggle(number: number) {
    setLayout((l) => ({
      ...l,
      visible: l.visible.includes(number)
        ? l.visible.filter((n) => n !== number)
        : [...l.visible, number],
    }));
    if (number === focused.driver.number && following)
      camera(currentCamera.current);
  }
  function preset(numbers: number[]) {
    setLayout((l) => ({ ...l, visible: [...new Set(numbers)] }));
    if (!numbers.includes(focused.driver.number)) setFollowing(false);
  }
  function save() {
    try {
      const next = { ...layout, camera: currentCamera.current };
      localStorage.setItem(layoutKey(race.id), JSON.stringify(next));
      setLayout(next);
      setSaved(JSON.stringify(next));
      setMessage("Layout saved in this browser for this race.");
    } catch {
      setMessage(
        "This browser could not save the layout. Your current view still works.",
      );
    }
  }
  const located = layout.visible.filter(
    (number) => positions.get(number)?.point,
  ).length;
  return (
    <div className="interactive-map">
      <div className="position-source-bar">
        <label>
          Position source
          <select
            aria-label="Position source"
            value={source}
            onChange={(e) => {
              setLayout((l) => ({ ...l, camera: currentCamera.current }));
              setSource(e.target.value as PositionSource);
              setFollowing(false);
              lastPoint.current = null;
            }}
          >
            <option value="recorded" disabled={!recordedAvailable}>
              Recorded positions{recordedAvailable ? "" : " · not loaded"}
            </option>
            <option value="lap">Lap estimate</option>
          </select>
        </label>
        <span
          data-testid="location-status"
          className={
            source === "recorded" && !focusedPosition.point
              ? "location-gap"
              : ""
          }
        >
          {focused.driver.code}:{" "}
          {source === "lap"
            ? "lap estimate"
            : focusedPosition.status === "recorded"
              ? "recorded sample"
              : focusedPosition.status === "smoothed"
                ? "between recorded samples"
                : "location gap"}
        </span>
      </div>
      {!recordedAvailable && <LocationImport raceId={race.id} onLoaded={onUpgrade} />}
      <div className="map-toolbar">
        <div className="camera-tools">
          <button
            className="icon-button"
            aria-label="Zoom out"
            disabled={effective.zoom <= 1}
            onClick={() => zoom(-0.5)}
          >
            <ZoomOut size={16} />
          </button>
          <output aria-label="Map zoom" className="mono">
            {Math.round(effective.zoom * 100)}%
          </output>
          <button
            className="icon-button"
            aria-label="Zoom in"
            disabled={effective.zoom >= 4}
            onClick={() => zoom(0.5)}
          >
            <ZoomIn size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Fit circuit"
            onClick={() => camera(DEFAULT_CAMERA)}
          >
            <RotateCcw size={15} />
          </button>
          <button
            className={`map-follow ${following ? "active" : ""}`}
            aria-label="Follow selected driver"
            disabled={
              !following && source === "recorded" && !focusedPosition.point
            }
            aria-pressed={following}
            onClick={follow}
          >
            <Focus size={14} />
            {following ? "Following" : "Follow"} {focused.driver.code}
          </button>
        </div>
        <button
          className={`map-settings-toggle ${settings ? "active" : ""}`}
          aria-label="Map settings"
          aria-expanded={settings}
          aria-controls="map-settings"
          onClick={() => setSettings((s) => !s)}
        >
          <SlidersHorizontal size={14} /> Drivers & view
        </button>
      </div>
      {settings && (
        <div className="map-settings" id="map-settings">
          <div className="map-settings-top">
            <span>
              {layout.visible.length} / {drivers.length} drivers visible
            </span>
            <div>
              <button onClick={() => preset(drivers)}>Show all</button>
              <button
                onClick={() =>
                  preset([
                    focused.driver.number,
                    ...(comparison === null ? [] : [comparison]),
                  ])
                }
              >
                Focus pair
              </button>
              <button onClick={() => preset([])}>Hide all</button>
            </div>
          </div>
          <fieldset className="map-driver-options">
            <legend className="sr-only">Visible drivers</legend>
            {race.drivers.map((d) => (
              <label key={d.number}>
                <input
                  type="checkbox"
                  aria-label={`Show ${d.code} on map`}
                  checked={visible.has(d.number)}
                  onChange={() => toggle(d.number)}
                />
                <i style={{ background: d.color }} />
                <span>{d.code}</span>
              </label>
            ))}
          </fieldset>
          <div className="map-display-options">
            <label>
              Driver labels
              <select
                aria-label="Driver labels"
                value={layout.labels}
                onChange={(e) =>
                  setLayout((l) => ({
                    ...l,
                    labels: e.target.value as MapLayout["labels"],
                  }))
                }
              >
                <option value="focus">Focus + comparison</option>
                <option value="all">All visible drivers</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="map-grid-option">
              <input
                type="checkbox"
                checked={layout.grid}
                onChange={(e) =>
                  setLayout((l) => ({ ...l, grid: e.target.checked }))
                }
              />{" "}
              Background grid
            </label>
            <button
              className="text-button"
              onClick={() => {
                setLayout(normalizeLayout(null, drivers));
                setFollowing(false);
              }}
            >
              Restore defaults
            </button>
          </div>
        </div>
      )}
      <div className="track-stage camera-stage">
        <svg
          ref={svg}
          viewBox={viewBox(effective)}
          className="track-svg controllable-map"
          role="img"
          tabIndex={0}
          aria-label={`${race.circuit} circuit with ${source === "recorded" ? "approximate recorded positions" : "lap-based driver estimates"}`}
          data-testid="circuit-map"
          onPointerDown={(event) => {
            if (
              event.button !== 0 ||
              (event.target as Element).closest("[data-driver]")
            )
              return;
            const rect = event.currentTarget.getBoundingClientRect(),
              c = currentCamera.current;
            drag.current = {
              pointer: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              camera: c,
              units: Math.max(
                800 / c.zoom / rect.width,
                520 / c.zoom / rect.height,
              ),
            };
            camera(c);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const d = drag.current;
            if (!d || d.pointer !== event.pointerId) return;
            camera({
              ...d.camera,
              cx: d.camera.cx - (event.clientX - d.x) * d.units,
              cy: d.camera.cy - (event.clientY - d.y) * d.units,
            });
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointer === event.pointerId) {
              drag.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            const c = currentCamera.current,
              step = 40 / c.zoom;
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "+",
                "=",
                "-",
              ].includes(event.key)
            ) {
              event.preventDefault();
              event.stopPropagation();
              if (event.key === "Home") camera(DEFAULT_CAMERA);
              else if (event.key === "+" || event.key === "=") zoom(0.5);
              else if (event.key === "-") zoom(-0.5);
              else
                camera({
                  ...c,
                  cx:
                    c.cx +
                    (event.key === "ArrowRight"
                      ? step
                      : event.key === "ArrowLeft"
                        ? -step
                        : 0),
                  cy:
                    c.cy +
                    (event.key === "ArrowDown"
                      ? step
                      : event.key === "ArrowUp"
                        ? -step
                        : 0),
                });
            }
          }}
        >
          <defs>
            <pattern
              id="map-grid"
              width="28"
              height="28"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".7" fill="#252b36" />
            </pattern>
            <filter id="map-glow">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <rect
            width="800"
            height="520"
            fill={layout.grid ? "url(#map-grid)" : "#121923"}
          />
          <path
            d={path}
            fill="none"
            stroke="#000"
            strokeWidth="22"
            strokeLinejoin="round"
            opacity=".28"
            transform="translate(0 6)"
          />
          <path
            d={path}
            fill="none"
            stroke="#343b49"
            strokeWidth="15"
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill="none"
            stroke="#181e28"
            strokeWidth="9"
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill="none"
            stroke="#596477"
            strokeWidth=".7"
            strokeDasharray="2 8"
            opacity=".5"
          />
          {race.track[0] && (
            <g transform={`translate(${race.track[0][0]},${race.track[0][1]})`}>
              <path
                d="M-8 -12 L8 12"
                stroke="#e4e8ef"
                strokeWidth="3"
                strokeDasharray="3 2"
              />
              <text
                x="18"
                y="-13"
                fill="#758092"
                fontSize="11"
                fontFamily="monospace"
              >
                START / FINISH
              </text>
            </g>
          )}
          <text
            x="70"
            y="466"
            fill="#3e4858"
            fontSize="12"
            fontFamily="monospace"
            letterSpacing="3"
          >
            {race.track.length
              ? race.circuit.toUpperCase()
              : "CIRCUIT COORDINATES UNAVAILABLE"}
          </text>
          {standings
            .filter(
              (s) =>
                s.driver.number !== focused.driver.number &&
                visible.has(s.driver.number),
            )
            .reverse()
            .map((s) => (
              <CarMarker
                key={s.driver.number}
                state={s}
                position={positions.get(s.driver.number)!}
                zoom={effective.zoom}
                selected={false}
                compared={s.driver.number === comparison}
                label={
                  layout.labels === "all" ||
                  (layout.labels === "focus" && s.driver.number === comparison)
                }
                onSelect={() => onSelect(s.driver.number)}
              />
            ))}
          {visible.has(focused.driver.number) && (
            <CarMarker
              state={focused}
              position={focusedPosition}
              zoom={effective.zoom}
              selected
              compared={false}
              label={layout.labels !== "off"}
              onSelect={() => onSelect(focused.driver.number)}
            />
          )}
        </svg>
        <div className="map-gesture-hint">
          <Move size={11} /> Drag to pan · Ctrl + scroll to zoom
        </div>
      </div>
      <div className="map-layout-footer">
        <span>
          {source === "recorded"
            ? `Recorded positions · ${located} / ${layout.visible.length} located`
            : `Lap estimate · ${layout.visible.length} visible`}
        </span>
        <button className="save-layout" onClick={save}>
          {dirty ? <Save size={12} /> : <Check size={12} />} Save layout
        </button>
      </div>
      {message && (
        <div className="map-message" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
function CarMarker({
  state,
  position,
  zoom,
  selected,
  compared,
  label,
  onSelect,
}: {
  state: DriverState;
  position: MarkerPosition;
  zoom: number;
  selected: boolean;
  compared: boolean;
  label: boolean;
  onSelect: () => void;
}) {
  if (!position.point) return null;
  const [x, y] = position.point;
  return (
    <g
      data-driver={state.driver.number}
      data-position-source={position.status}
      transform={`translate(${x},${y}) scale(${1 / zoom})`}
      opacity={position.status === "estimated" && state.missing ? 0.35 : 1}
      className="car-marker"
      role="button"
      tabIndex={0}
      aria-label={`Follow ${state.driver.code} on circuit`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }
      }}
    >
      {selected && (
        <circle
          r="16"
          fill={state.driver.color}
          opacity=".3"
          filter="url(#map-glow)"
        />
      )}
      {(selected || compared) && (
        <circle
          r={selected ? 12 : 10}
          fill="none"
          stroke={state.driver.color}
          strokeWidth="1.5"
          strokeDasharray={compared ? "3 3" : undefined}
        />
      )}
      <circle
        r={selected ? 6 : 4}
        fill={state.driver.color}
        stroke="#10151d"
        strokeWidth="2"
      />
      {label && (
        <g transform="translate(16,-24)">
          <rect
            x="-3"
            y="-12"
            width="43"
            height="21"
            rx="4"
            fill="#111824"
            stroke={state.driver.color}
            strokeOpacity=".5"
          />
          <text
            x="18"
            y="2"
            fill="#f4f5f8"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="11"
          >
            {state.driver.code}
          </text>
        </g>
      )}
    </g>
  );
}
