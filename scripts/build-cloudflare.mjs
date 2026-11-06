import {spawnSync} from 'node:child_process';
import {mkdir,copyFile,readdir,unlink,stat,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir','dist-cf'],{cwd:root,stdio:'inherit',windowsHide:true});
if(build.status!==0)process.exit(build.status??1);
// The old Pages SPA rule loops on Workers Assets. Only remove this build copy.
await unlink(join(root,'dist-cf/_redirects')).catch(error=>{if(error.code!=='ENOENT')throw error;});
const mediaSizes={};
for(const name of await readdir(join(root,'dist-cf/assets'))){
  const size=(await stat(join(root,'dist-cf/assets',name))).size;
  if(size>25*1024*1024)throw Error('Static asset exceeds 25 MiB: '+name);
  if(/^pantry-(sea|forest|fire)-loop-/.test(name))mediaSizes['/assets/'+name]=size;
}
await writeFile(join(root,'dist-cf/media-manifest.json'),JSON.stringify(mediaSizes));
for(const folder of ['audio','environments']){
  const from=join(root,'src/assets',folder),to=join(root,'dist-cf/credits',folder);await mkdir(to,{recursive:true});
  for(const name of await readdir(from))if(name.includes('CREDITS'))await copyFile(join(from,name),join(to,name));
}
