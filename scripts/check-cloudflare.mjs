import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const options={cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(root,'test-results/wrangler.log')}};
for(const args of [
  ['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','wrangler.pantry.jsonc','--outdir','test-results/cf-bundle'],
  ['--test','tests/cloudflare/runtime.test.mjs','tests/cloudflare-range.test.mjs'],
]){const result=spawnSync(process.execPath,args,options);if(result.status!==0)process.exit(result.status??1);}
