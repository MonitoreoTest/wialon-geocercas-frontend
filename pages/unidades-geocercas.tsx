"use client";

import React, { useState } from "react";

const API = "https://wialon-geocercas-api.monitoristaalarmas.workers.dev";

/* --- minutos máximo para considerar que la unidad tiene señal --- */
const MAX_AGE_MIN = 15;                      // 👈 cámbialo si quieres 30, 120, etc.
const MAX_AGE_SEC = MAX_AGE_MIN * 60;

/* --- Geocercas válidas (las que tú pasaste) --- */
const BASE_GEOFENCES = [
  "ACA01","ACA02","AGP01","AGU01","AGU02","AGU03","AGU05","AGU06","AGU07","AGU08",
  "AGU09","AGU10","AGU11","APZ01","ATO01","BJX01","BJX02","BJX03","BJX04","CAN01",
  "CCA01","CEL01","CEL02","CEN01","CGM01","CGO01","CIV01","CJS01","CJS02","CLQ01",
  "CLQ02","CME01","CMT01","COA01","COA02","CPE01","CPE02","CRB01","CRB02","CSL01",
  "CTA01","CTM01","CUA01","CUL01","CUL02","CUL03","CUL04","CUN01","CUN02","CUT01",
  "CUU01","CUU02","CVJ01","CVM01","CZM01","DEL01","DGO01","ENS01","GDL01","GDL02",
  "GDL03","GDL04","GDL05","GDL06","GDL07","GDL08","GDL09","GDL10","GDL11","GDL12",
  "GML01","GNO01","GVE01","GVE02","GYM02","HMO01","HMO02","HMO03","HMO04","IGW01",
  "IRA01","IRA02","ITP01","JAL01","JRI01","LAP01","LDM01","LDM03","LMM01","LMM03",
  "LMM05","LOV01","LTO01","MAG01","MAM01","MEX01","MEX02","MEX03","MEX04","MEX05",
  "MEX06","MEX07","MEX08","MEX09","MEX10","MEX11","MEX12","MEX13","MEX14","MID01",
  "MID02- PV","MID03","MID04- PV","MLM01","MLM02","MMC01","MRL01","MTY01","MTY02",
  "MTY03","MTY04","MTY05","MTY06","MTY07","MTY08","MTY09","MTY10","MXL01","MXL02",
  "MZT01","MZT02","MZT03","NJA01","NLD01","NLD02","NOG01","OAX01","OAX02","OZB01",
  "PAR01","PAZ01","PBC01","PBC02","PBC03","PBC04","PBC05","PCA01","PCA02","PCM01",
  "PCM02","PDS01","PPE01","PPR01","PVR01","QRO01","QRO02","QRO03","QRO04","QRO05",
  "QRO06","REX01","RIN01","SCX01","SJD01","SLP01","SLP02","SLP03","SLP04","SLW01",
  "SLW02","STT01","SZT01","TAM01","TAM02","TAP01","TAP02","TCN01","TEC01","TGZ01",
  "TIJ01","TIJ02","TIJ03","TIJ04","TLC01","TLC02","TLC03","TLC04","TPQ01","TPT01",
  "TRC01","TUX01","TXA01","TXT01","UAC01","UPN01","VER01","VER02","VER03","VSA01",
  "VSA02","ZCL01","ZLO01","ZMA01","ZMA02","ZMM01","ZMM02","ZPL01","ZPL02"
];

const GEOCERCAS_PERMITIDAS = new Set<string>([
  ...BASE_GEOFENCES,
  ...BASE_GEOFENCES.map((n) => `${n} ext`),
  ...BASE_GEOFENCES.map((n) => `${n} ext.`),
]);

type Unit = {
  id: number;
  name: string;
  lat?: number;
  lon?: number;
  t?: number;
  speed?: number; // km/h
};

type Geofence = { id: number; name: string; categoria?: string | null };

type UnitRow = {
  id: number;
  name: string;
  lat?: number;
  lon?: number;
  t?: number;
  speed?: number;
  zones: Geofence[];
};

const fmtDT = (unix?: number) =>
  !unix ? "—" : new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ");

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-blue-700/90 text-white">
      {label}
    </span>
  );
}

/* ¿Tiene señal (posición reciente)? */
function hasSignal(row: UnitRow): boolean {
  if (!row.t) return false;
  const nowSec = Date.now() / 1000;
  return nowSec - row.t <= MAX_AGE_SEC;
}

/* Letra que se muestra en la columna Sucursal */
function getFlag(row: UnitRow): string {
  if (!hasSignal(row)) return "";       // sin señal → sin S ni I
  if (row.zones.length) return "S";     // en sucursal
  const spd = row.speed ?? 0;
  return spd < 10 ? "I" : "";           // fuera de sucursal y < 10 km/h
}

export default function PageUnidadesGeocercas() {
  const [unitInput, setUnitInput] = useState("");
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function fetchSnapshotAndCross() {
    const snapResp = await fetch(`${API}/wialon/snapshot?resource_id=18891825`);
    const snap = await snapResp.json();

    const crossResp = await fetch(`${API}/wialon/units/in-geofences/local`);
    const crossJson = await crossResp.json();

    return {
      snapshot: snap,
      cross: crossJson.result || {},
    };
  }

  const handleSearch = async () => {
    const unitNames = unitInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!unitNames.length) return;

    setLoading(true);
    try {
      const { snapshot, cross } = await fetchSnapshotAndCross();

      const units: Unit[] = (snapshot.units || []).map((u: any) => {
        const pos = u.pos || {};
        const speed =
          (typeof u.speed === "number" ? u.speed : undefined) ??
          (typeof u.spd === "number" ? u.spd : undefined) ??
          (typeof pos.s === "number" ? pos.s : undefined) ??
          (typeof pos.spd === "number" ? pos.spd : undefined);

        return {
          id: u.id,
          name: u.name || u.nm,
          lat: u.lat ?? u.y ?? pos.y,
          lon: u.lon ?? u.x ?? pos.x,
          t: u.t ?? pos.t,
          speed,
        };
      });

      const unitByName = new Map<string, Unit>();
      units.forEach((u) => {
        unitByName.set(u.name.toLowerCase(), u);
      });

      const geofenceById = new Map<number, Geofence>();
      const geosByRes = snapshot.geofences_by_resource || {};
      for (const resId of Object.keys(geosByRes)) {
        const arr = geosByRes[resId] as any[];
        (arr || []).forEach((g) => {
          const name = String(g.name || g.n || "");
          geofenceById.set(Number(g.id), {
            id: Number(g.id),
            name,
            categoria: g.categoria || null,
          });
        });
      }

      const zonesByUnitId: Record<number, number[]> = {};
      for (const resId of Object.keys(cross)) {
        const byUnit = cross[resId] || {};
        for (const unitId of Object.keys(byUnit)) {
          const val = byUnit[unitId];
          if (!zonesByUnitId[+unitId]) zonesByUnitId[+unitId] = [];
          if (Array.isArray(val)) {
            zonesByUnitId[+unitId].push(...val.map((v: any) => Number(v)));
          } else if (typeof val === "object" && val) {
            for (const zid of Object.keys(val)) {
              zonesByUnitId[+unitId].push(Number(zid));
            }
          }
        }
      }

      const nowSec = Date.now() / 1000;

      const finalRows: UnitRow[] = unitNames.map((name, idx) => {
        const found = unitByName.get(name.toLowerCase());
        if (!found) {
          // unidad no existe en wialon
          return {
            id: 100000 + idx,
            name,
            zones: [],
          };
        }

        // ¿posición vieja? → tratar como sin señal (como si no estuviera)
        const isStale = !found.t || nowSec - found.t > MAX_AGE_SEC;
        if (isStale) {
          return {
            id: found.id,
            name: found.name,
            zones: [],       // así no marca S ni I
          };
        }

        const geofenceIds = zonesByUnitId[found.id] || [];
        const zones = geofenceIds
          .map((id) => geofenceById.get(id))
          .filter(Boolean)
          .filter((g) => {
            const raw = g!.name.trim();
            const clean = raw.replace(/\.$/, "");
            return (
              GEOCERCAS_PERMITIDAS.has(clean) ||
              GEOCERCAS_PERMITIDAS.has(`${clean} ext`) ||
              GEOCERCAS_PERMITIDAS.has(clean.replace(/ ext\.?$/, "")) ||
              GEOCERCAS_PERMITIDAS.has(raw)
            );
          }) as Geofence[];

        return {
          id: found.id,
          name: found.name,
          lat: found.lat,
          lon: found.lon,
          t: found.t,
          speed: found.speed,
          zones,
        };
      });

      setRows(finalRows);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySoloSucursal = async () => {
    const txt = rows.map((r) => getFlag(r)).join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      alert("Columna 'Sucursal' copiada (S/I). Pega en Excel ✅");
    } catch {
      console.log(txt);
      alert("No se pudo copiar automático, pero el texto está en la consola.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">
          Unidades y Geocercas (rápido)
        </h1>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ingresa las unidades (una por línea o separadas por coma)
        </label>
        <textarea
          value={unitInput}
          onChange={(e) => setUnitInput(e.target.value)}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          placeholder={`Ejemplo:\nPAQ-001\nPAQ-002\nCAMION-03`}
        />

        <div className="mt-2 flex gap-2">
          <button
            onClick={handleSearch}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Consultando..." : "Buscar"}
          </button>

          {hasSearched && (
            <button
              onClick={handleCopySoloSucursal}
              className="rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
            >
              Copiar solo columna Sucursal
            </button>
          )}
        </div>

        {!hasSearched ? (
          <div className="mt-6 rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">
            Ingresa primero las unidades y presiona “Buscar”.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm font-semibold text-gray-700">
                  <th className="px-4 py-3">Unidad</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Última posición</th>
                  <th className="px-4 py-3">Latitud / Longitud</th>
                  <th className="px-4 py-3">Geocercas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {getFlag(u)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {fmtDT(hasSignal(u) ? u.t : undefined)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {hasSignal(u) && u.lat != null && u.lon != null
                        ? `${u.lat.toFixed(6)},${u.lon.toFixed(6)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {hasSignal(u) && u.zones.length ? (
                        <div className="flex flex-wrap gap-2">
                          {u.zones.map((z) => (
                            <Badge key={`${u.id}-${z.id}`} label={z.name} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">
                          Sin geocercas
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
