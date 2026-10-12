#!/usr/bin/env python3
"""Build the ID-aware bridge inside a pinned upstream aliyunpan checkout."""
import pathlib,sys,tempfile,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv)!=2:raise SystemExit('Usage: build-ali-bridge.py /path/to/aliyunpan-checkout')
checkout=pathlib.Path(sys.argv[1]).resolve()
if not (checkout/'go.mod').is_file():raise SystemExit('The checkout must contain upstream go.mod')
with tempfile.TemporaryDirectory(prefix='wemovebridge-',dir=checkout) as directory:
 target=pathlib.Path(directory);shutil.copy2(root/'src/bridges/ali.go',target/'main.go')
 subprocess.run(['go','build','-o',str(root/'vendor/ali-bridge'),'./'+target.name],cwd=checkout,check=True)
