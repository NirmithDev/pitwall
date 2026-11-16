"""Integration checks for the real ASP.NET API. No third-party Python packages.

Run after dotnet build -c Release. --postgres requires ConnectionStrings__Pitwall.
Creates and deletes its own uniquely identified bookmark; never resets database.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--postgres', action='store_true')
parser.add_argument('--cached-session', help='Also verify an already imported replay survives restart; does not call the provider')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
dll = root / 'backend/Pitwall.Api/bin/Release/net10.0/Pitwall.Api.dll'
base = 'http://127.0.0.1:5088'
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
env = {**os.environ, 'ASPNETCORE_URLS': base, 'ASPNETCORE_ENVIRONMENT': 'Development'}
env['Catalog__AutoRefresh'] = 'false'
connection = os.environ.get('ConnectionStrings__Pitwall')
# Python uppercases os.environ keys on Windows; normalize before copying to a plain dict.
for key in list(env):
    if key.upper() == 'CONNECTIONSTRINGS__PITWALL':
        del env[key]
if args.postgres and not connection:
    raise SystemExit('--postgres requires ConnectionStrings__Pitwall')
if args.postgres:
    env['ConnectionStrings__Pitwall'] = connection
log = tempfile.TemporaryFile(mode='w+')
process = None
bookmark_id = None

def request(path, method='GET', body=None):
    req = urllib.request.Request(base + path, method=method, headers={'Content-Type': 'application/json'}, data=json.dumps(body).encode() if body is not None else None)
    try:
        with opener.open(req, timeout=3) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        return error.code, json.loads(raw) if raw else None

def start():
    global process
    process = subprocess.Popen(['dotnet', str(dll)], cwd=root / 'backend/Pitwall.Api', env=env, stdout=log, stderr=log)
    for _ in range(100):
        if process.poll() is not None:
            log.seek(0)
            raise RuntimeError('API exited during startup:\n' + log.read())
        try:
            status, _ = request('/health')
            if status == 200:
                return
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(.2)
    raise RuntimeError('API did not become healthy')

def stop():
    global process
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    process = None

try:
    start()
    expected = 'postgresql' if args.postgres else 'snapshot'
    assert request('/api/status')[1]['storage'] == expected
    status, race = request('/api/sessions/monza-2024')
    assert status == 200 and len(race['drivers']) == 20 and len(race['laps']) > 1000
    assert len(race['track']) >= 20 and race['totalLaps'] == 53
    assert race['schemaVersion'] >= 2 and len(race['locations']['traces']) == 20
    for trace in race['locations']['traces']:
        samples = trace['samples']
        assert len(samples) > 1
        assert all(samples[i][0] < samples[i+1][0] for i in range(len(samples)-1))
        assert all(0 <= sample[1] <= 800 and 0 <= sample[2] <= 520 for sample in samples)
    assert request('/api/sessions/missing')[0] == 404
    catalog = request('/api/sessions')[1]
    assert len(catalog['sessions']) > 100
    assert catalog['sessions'][0]['year'] >= 2026
    assert request('/api/sessions/missing/import', 'POST')[0] == 404
    assert request('/api/sessions/missing/locations', 'POST')[0] == 404
    assert request('/api/sessions/missing/locations')[0] == 404
    location_job = request('/api/sessions/monza-2024/locations', 'POST')[1]
    assert location_job['status'] == 'completed' and location_job['kind'] == 'locations'
    assert request('/api/sessions/monza-2024/locations')[1]['status'] == 'completed'
    assert request('/api/sessions/monza-2024/import', 'POST')[1]['status'] == 'completed'
    imported = None
    if args.cached_session:
        status, imported = request('/api/sessions/' + args.cached_session)
        assert status == 200 and imported['id'] == args.cached_session
    assert request('/api/unknown')[0] == 404
    path = '/api/sessions/monza-2024/bookmarks'
    for invalid in [
        {'label': '', 'elapsedSeconds': 1},
        {'label': 'x' * 81, 'elapsedSeconds': 1},
        {'label': 'bad time', 'elapsedSeconds': -1},
        {'label': 'bad time', 'elapsedSeconds': race['duration'] + 1},
    ]:
        assert request(path, 'POST', invalid)[0] == 400
    status, bookmark = request(path, 'POST', {'label': 'Integration test moment', 'elapsedSeconds': 123.45})
    assert status == 201 and bookmark['elapsedSeconds'] == 123.45
    bookmark_id = bookmark['id']
    assert any(b['id'] == bookmark_id for b in request(path)[1])
    assert all(b['id'] != bookmark_id for b in request('/api/sessions/session-11412/bookmarks')[1])
    assert request(f'/api/sessions/session-11412/bookmarks/{bookmark_id}', 'DELETE')[0] == 404
    if args.postgres:
        stop()
        start()
        assert any(b['id'] == bookmark_id for b in request(path)[1]), 'Bookmark must persist across process restart'
        assert request('/api/sessions/monza-2024/locations')[1]['status'] == 'completed', 'Cached location status must survive restart'
        if imported:
            assert request('/api/sessions/' + args.cached_session)[1] == imported, 'Imported replay must persist across process restart'
            if imported.get('locations'):
                assert request('/api/sessions/' + args.cached_session + '/locations')[1]['status'] == 'completed'
                assert request('/api/sessions/' + args.cached_session + '/locations', 'POST')[0] == 200
    assert request(f'{path}/{bookmark_id}', 'DELETE')[0] == 204
    assert request(f'{path}/{bookmark_id}', 'DELETE')[0] == 404
    bookmark_id = None
    print(f'PASS: API ({expected}), historical data, validation, bookmark CRUD' + (', restart persistence' if args.postgres else ''))
finally:
    if bookmark_id and process and process.poll() is None:
        request(f'/api/sessions/monza-2024/bookmarks/{bookmark_id}', 'DELETE')
    stop()
    log.close()
