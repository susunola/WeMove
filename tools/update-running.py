#!/usr/bin/env python3
"""Pause/drain, install, and resume only the tasks previously running."""
import pathlib, urllib.request, urllib.parse, json, time, subprocess
urlfile=pathlib.Path.home()/'Library/Application Support/PanMover/session-url.txt'
def call(route, body=None):
    p=urllib.parse.urlsplit(urlfile.read_text().strip())
    req=urllib.request.Request(urllib.parse.urlunsplit((p.scheme,p.netloc,route,p.query,'')),data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(req,timeout=10))
s=call('/state');ids=[j['id'] for j in s.get('jobs',[]) if j['status'] not in ['failed','canceled','complete','paused']]
for identity in ids:call('/pause',{'id':identity})
for attempt in range(120):
    if not call('/state').get('busy'):break
    time.sleep(.5)
else:raise SystemExit('Tasks did not drain; no installation performed')
try:
    subprocess.run(['python3',str(pathlib.Path(__file__).with_name('update-local.py'))],check=True)
finally:
    # Installer restores the matching app/database on startup failure. Original paused jobs stay paused.
    for identity in ids:
        try:call('/resume',{'id':identity})
        except Exception:print('A previously running task could not resume; inspect the task queue')
print('Update finished; previously running tasks resumed')
