#!/usr/bin/env python3
"""One-time extraction-and-patch hook for existing NBA Scout Auto-Update.
Installed pretest hooks execute BEFORE `npm test` in GitHub Actions;
once successful, remove the hook, leaving normal tests and deployment.
"""
from pathlib import Path
import subprocess,sys,json
root=Path(__file__).resolve().parent
for script in ['UPGRADE_RFPP_2_1.py','UPGRADE_RFPP_2_2.py']:
    subprocess.run([sys.executable,str(root/script)],check=True,cwd=root)
config=root/'package.json'
obj=json.loads(config.read_text())
obj['scripts'].pop('pretest',None)
config.write_text(json.dumps(obj,indent=2)+'\n')
print('RFPP 2.2 patched and pretest hook removed; continuing with complete npm test.')
