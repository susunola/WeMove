#!/usr/bin/env python3
"""Install into the local macOS bundle with an app backup and automatic startup rollback.
Credentials and task databases stay outside the bundle. A restart requires drained tasks.
"""
import argparse, pathlib, shutil, subprocess, time, urllib.request, urllib.parse, json
parser=argparse.ArgumentParser();parser.add_argument('--app',default=str(pathlib.Path.home()/'Applications/网盘搬运助手.app'));parser.add_argument('--source',default=str(pathlib.Path(__file__).resolve().parent.parent));args=parser.parse_args();app=pathlib.Path(args.app);source=pathlib.Path(args.source);data=pathlib.Path.home()/'Library/Application Support/PanMover';urlfile=data/'session-url.txt'
def state():
 u=urllib.parse.urlsplit(urlfile.read_text().strip());return json.load(urllib.request.urlopen(urllib.parse.urlunsplit((u.scheme,u.netloc,'/state',u.query,'')),timeout=2))
try:
 s=state()
 if s.get('busy'):raise SystemExit('Pause active tasks and wait for them to drain before installing.')
except (OSError,ValueError):pass
node=shutil.which('node');assert node,'Node is required for the pre-install syntax check'
for f in [source/'server.cjs',source/'app.js',*list((source/'lib').glob('*.cjs'))]:subprocess.run([node,'--check',str(f)],check=True,capture_output=True)
backup=app.with_name(app.stem+'-rollback-'+time.strftime('%Y%m%d-%H%M%S')+'.app');subprocess.run(['osascript','-e','tell application "网盘搬运助手" to quit'],check=True);time.sleep(8);shutil.copytree(app,backup,symlinks=True)
try:
 resources=app/'Contents/Resources'
 for f in ['server.cjs','app.js','i18n.js','styles.css','index.html','compare.js','package.json']:shutil.copy2(source/f,resources/f)
 for d in ['lib','assets']:shutil.copytree(source/d,resources/d,dirs_exist_ok=True)
 shutil.copy2(source/'vendor/ali-bridge',resources/'vendor/ali-bridge')
 subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True,capture_output=True);subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True,capture_output=True);subprocess.run(['open',str(app)],check=True)
 for i in range(60):
  try:state();break
  except (OSError,ValueError):time.sleep(.5)
 else:raise RuntimeError('Updated app failed its local health check')
 print('Installed and health-checked. Rollback bundle: '+str(backup))
except BaseException:
 subprocess.run(['osascript','-e','tell application "网盘搬运助手" to quit']);time.sleep(8);shutil.rmtree(app);shutil.copytree(backup,app,symlinks=True);subprocess.run(['open',str(app)]);raise
