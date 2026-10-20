import importlib.util, pathlib, tempfile, unittest, sqlite3
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('preflight',pathlib.Path(__file__).resolve().parents[1]/'tools/upgrade-preflight.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class Preflight(unittest.TestCase):
 def test_schema_and_space(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);source=root/'source';app=root/'App.app';data=root/'data'
   app.mkdir();data.mkdir()
   for name in ['server.cjs','app.js','lib/task-store.cjs','vendor/ali-bridge']:
    f=source/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_text('fixture')
   self.assertEqual(p.validate(source,app,data)['schemaSupported'],1)
   with patch.object(p.shutil,'disk_usage',return_value=type('Space',(),{'free':0})()):
    self.assertRaisesRegex(RuntimeError,'Insufficient disk',p.validate,source,app,data)
   with sqlite3.connect(data/'tasks.sqlite') as db:db.execute('PRAGMA user_version=999')
   self.assertRaisesRegex(RuntimeError,'Newer database',p.validate,source,app,data)
if __name__=='__main__':unittest.main()
