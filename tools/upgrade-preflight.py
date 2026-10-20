"""Read-only local installer preflight; no credentials or raw database rows emitted."""
import pathlib, sqlite3, shutil

def validate(source, app, data):
    for name in ['server.cjs','app.js','lib/task-store.cjs','vendor/ali-bridge']:
        if not (source / name).is_file(): raise RuntimeError('Missing release file: '+name)
    database=data/'tasks.sqlite'
    if database.exists():
        with sqlite3.connect(database.as_uri()+'?mode=ro',uri=True) as db:
            if db.execute('PRAGMA user_version').fetchone()[0]>1: raise RuntimeError('Newer database schema; downgrade blocked')
            if db.execute('PRAGMA quick_check').fetchone()[0]!='ok': raise RuntimeError('Task database integrity check failed')
    # Full application backup plus database checkpoint and conservative installation headroom.
    size=sum(p.stat().st_size for p in app.rglob('*') if p.is_file() and not p.is_symlink())
    required=size*2+(database.stat().st_size if database.exists() else 0)+256*1024**2
    if shutil.disk_usage(app.parent).free<required: raise RuntimeError('Insufficient disk space for safe update and rollback')
    return {'schemaSupported':1,'requiredBytes':required}
