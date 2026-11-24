"""Refresh the public RASSVET demo's rolling orbit and alert snapshots.

The browser reads only static files on elintir.com. The alerts token is read from
the workflow environment and is never written to the repository or a URL.
"""

import argparse
import base64
import csv
import gzip
import io
import json
import os
import shutil
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import numpy as np
from skyfield.api import EarthSatellite, load
from skyfield.framelib import itrs

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "rassvet" / "data"
KYIV = ZoneInfo("Europe/Kyiv")
IDS = {
    57170, 57179, 57183, 59779, 59780, 59781,
    68360, 68361, 68362, 68364, 68365, 68366, 68367, 68368,
    68369, 68370, 68371, 68372, 68373, 68374, 68375,
    100084, 100085, 100086, 100087, 100088, 100089, 100090,
    100091, 100092, 100093, 100094, 100095, 100096, 100097, 100098,
}
LAUNCHES = ("2023-091", "2024-092", "2026-061", "2026-165")
ALERT_SOURCES = (("kyiv_city", 31), ("kyiv_oblast", 14), ("lviv_oblast", 27))
TS = load.timescale(builtin=True)


def utcnow():
    return datetime.now(timezone.utc)


def iso(value):
    return value.isoformat().replace("+00:00", "Z")


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def request_bytes(url, token=None, modified=None):
    headers = {"User-Agent": "ELINTIR-RASSVET-Demo/1.0 (https://elintir.com/rassvet/)",
               "Accept-Encoding": "gzip"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if modified:
        headers["If-Modified-Since"] = modified
    try:
        with urlopen(Request(url, headers=headers), timeout=30) as response:
            body = response.read()
            if response.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            return body, response.headers, False
    except HTTPError as exc:
        if exc.code == 304 and modified:
            return None, {}, True
        raise RuntimeError(f"Source request failed: HTTP {exc.code} ({url})") from exc


def fetch_gp():
    records = {}
    for launch in LAUNCHES:
        url = f"https://celestrak.org/NORAD/elements/gp.php?INTDES={launch}&FORMAT=CSV"
        body, _, _ = request_bytes(url)
        for row in csv.DictReader(io.StringIO(body.decode("utf-8-sig"))):
            if int(row["NORAD_CAT_ID"]) in IDS:
                records[int(row["NORAD_CAT_ID"])] = row
    missing = IDS - records.keys()
    if missing:
        raise RuntimeError(f"CelesTrak GP lacks {len(missing)} tracked objects; retaining the prior release")
    return [records[sat_id] for sat_id in sorted(IDS)]


def parse_epoch(record):
    value = datetime.fromisoformat(record["EPOCH"].replace("Z", "+00:00"))
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def write_day(target, records, anchor, output):
    start = datetime(target.year, target.month, target.day, tzinfo=KYIV).astimezone(timezone.utc)
    end_day = target + timedelta(days=1)
    end = datetime(end_day.year, end_day.month, end_day.day, tzinfo=KYIV).astimezone(timezone.utc)
    times = [start + timedelta(minutes=i) for i in range(round((end - start).total_seconds() / 60) + 1)]
    grid = TS.from_datetimes(times)
    blob = bytearray()
    satellites = []
    noon = datetime(target.year, target.month, target.day, 12, tzinfo=KYIV).astimezone(timezone.utc)
    for record in records:
        sat_id = int(record["NORAD_CAT_ID"])
        satellite = EarthSatellite.from_omm(TS, record)
        xyz = satellite.at(grid).frame_xyz(itrs).km
        quantized = np.rint(xyz * 10).astype(np.int32)
        delta = np.diff(quantized, axis=1)
        if np.any(np.abs(delta) > 32767):
            raise RuntimeError(f"Orbit encoding overflow for {sat_id}")
        blob.extend(quantized[:, 0].astype("<i4").tobytes())
        blob.extend(delta.T.astype("<i2").tobytes())
        satellites.append({
            "id": sat_id,
            "name": record.get("OBJECT_NAME") or f"OBJECT {sat_id}",
            "epoch": iso(parse_epoch(record)),
            "source": "CelesTrak GP",
            "ageHoursAtNoon": round(abs((parse_epoch(record) - noon).total_seconds()) / 3600, 1),
        })
    payload = {
        "date": target.isoformat(), "startUtc": iso(start), "endUtc": iso(end),
        "stepSeconds": 60, "sampleCount": len(times), "unitsPerKm": 10,
        "modelStatus": "historical" if target < anchor else "current" if target == anchor else "forecast",
        "satellites": satellites, "ecefB64": base64.b64encode(blob).decode("ascii"),
        "maxElementAgeHoursAtNoon": max(s["ageHoursAtNoon"] for s in satellites),
    }
    write_json(output / f"{target.isoformat()}.json", payload)


def fetch_alerts(token, output, anchor):
    first = anchor - timedelta(days=7)
    start = datetime(first.year, first.month, first.day, tzinfo=KYIV).astimezone(timezone.utc)
    sources, regions, alerts = [], {}, {}
    cache_dir = output / "alert-sources"
    for index, (label, uid) in enumerate(ALERT_SOURCES):
        if index:
            time.sleep(32)  # history endpoint: at most two requests per minute
        url = f"https://api.alerts.in.ua/v1/regions/{uid}/alerts/month_ago.json"
        cache_path = cache_dir / f"{label}.json"
        cached = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
        body, headers, unchanged = request_bytes(url, token, cached.get("lastModified"))
        if unchanged:
            rows = cached["rows"]
            last_modified = cached.get("lastModified")
        else:
            response = json.loads(body)
            rows = response["alerts"] if isinstance(response, dict) else response
            last_modified = headers.get("Last-Modified")
        rows = [row for row in rows if not row.get("finished_at") or
                datetime.fromisoformat(row["finished_at"].replace("Z", "+00:00")) >= start]
        fetched = iso(utcnow())
        write_json(cache_path, {"lastModified": last_modified, "rows": rows})
        sources.append({"label": label, "fetchedUtc": fetched, "url": url})
        for row in rows:
            if row.get("alert_type") != "air_raid":
                continue
            began = datetime.fromisoformat(row["started_at"].replace("Z", "+00:00"))
            finished = datetime.fromisoformat(row["finished_at"].replace("Z", "+00:00")) if row.get("finished_at") else None
            if began > utcnow() + timedelta(days=7) or (finished and finished < start):
                continue
            region_uid = str(row["location_uid"])
            regions[region_uid] = {"uid": region_uid, "title": row["location_title"],
                                   "oblast": row.get("location_oblast") or row["location_title"]}
            alerts[str(row["id"])] = {
                "id": row["id"], "uid": region_uid, "startedAt": row["started_at"],
                "finishedAt": row.get("finished_at"), "level": row.get("alert_level"),
                "threats": sorted({item.get("threat_type", "unknown") for item in row.get("threats", [])}),
                "levelHistory": [{"level": item["level"], "startedAt": item["started_at"],
                                  "finishedAt": item.get("finished_at")}
                                 for item in row.get("alert_level_history", [])],
            }
    write_json(output / "alerts.json", {"sources": sources,
        "regions": sorted(regions.values(), key=lambda row: (row["oblast"], row["title"])),
        "alerts": sorted(alerts.values(), key=lambda row: row["startedAt"])})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DATA)
    parser.add_argument("--gp-file", type=Path, help="Offline GP fixture for verification")
    parser.add_argument("--alerts-file", type=Path, help="Offline alert fixture for verification")
    parser.add_argument("--anchor", type=date.fromisoformat, help="Offline date for verification")
    args = parser.parse_args()
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    anchor = args.anchor or datetime.now(KYIV).date()
    token = os.environ.get("ALERTS_API_TOKEN")
    if args.gp_file:
        records = json.loads(args.gp_file.read_text(encoding="utf-8"))
    else:
        records = fetch_gp()
    if len({int(record["NORAD_CAT_ID"]) for record in records} & IDS) != len(IDS):
        raise RuntimeError("GP input does not cover all tracked objects")
    records = sorted((record for record in records if int(record["NORAD_CAT_ID"]) in IDS),
                     key=lambda record: int(record["NORAD_CAT_ID"]))
    if not args.gp_file:
        write_json(output / "latest-gp.json", {"fetchedUtc": iso(utcnow()), "records": records})
        daily = output / "gp-daily" / f"{anchor.isoformat()}.json"
        now = utcnow()
        noon = datetime(anchor.year, anchor.month, anchor.day, 12, tzinfo=timezone.utc)
        previous = json.loads(daily.read_text(encoding="utf-8")) if daily.exists() else None
        if not previous or abs((now - noon).total_seconds()) < abs((datetime.fromisoformat(previous["fetchedUtc"].replace("Z", "+00:00")) - noon).total_seconds()):
            write_json(daily, {"fetchedUtc": iso(now), "records": records})
    for offset in range(-7, 8):
        target = anchor + timedelta(days=offset)
        path = output / f"{target.isoformat()}.json"
        daily = output / "gp-daily" / f"{target.isoformat()}.json"
        if target < anchor and not args.gp_file:
            if daily.exists():
                historical = json.loads(daily.read_text(encoding="utf-8"))["records"]
                write_day(target, historical, anchor, output)
            elif not path.exists():
                raise RuntimeError(f"Missing historical day {target}; retaining prior release")
        else:
            write_day(target, records, anchor, output)
    alerts_status = "retained"
    alerts_path = output / "alerts.json"
    if args.alerts_file:
        shutil.copyfile(args.alerts_file, output / "alerts.json")
        alerts_status = "fixture"
    elif token:
        try:
            fetch_alerts(token, output, anchor)
            alerts_status = "updated"
        except Exception as exc:
            if not alerts_path.exists():
                raise
            print(f"Alert refresh failed; retaining previous snapshot: {exc}")
    elif not alerts_path.exists():
        write_json(alerts_path, {"sources": [], "regions": [], "alerts": []})
        alerts_status = "unavailable"
    for stale in output.glob("20??-??-??.json"):
        if not anchor - timedelta(days=7) <= date.fromisoformat(stale.stem) <= anchor + timedelta(days=7):
            stale.unlink()
    for stale in (output / "gp-daily").glob("20??-??-??.json"):
        if date.fromisoformat(stale.stem) < anchor - timedelta(days=7):
            stale.unlink()
    write_json(output / "manifest.json", {
        "generatedUtc": iso(utcnow()), "anchorDate": anchor.isoformat(),
        "firstDate": (anchor - timedelta(days=7)).isoformat(),
        "lastDate": (anchor + timedelta(days=7)).isoformat(),
        "historicalSource": "daily public GP snapshots", "forecastSource": iso(utcnow()),
        "sampleIntervalSeconds": 60,
    })
    print(f"Updated {anchor.isoformat()}: {len(records)} tracked objects, 15 day files, alerts {alerts_status}")


if __name__ == "__main__":
    main()
