// SPDX-License-Identifier: GPL-3.0-only
// Run after build. Fails when a new runtime library needs a human license review.
import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve(),modules=new Map(),packages=new Map();
for(const browser of ['chrome','firefox']) {
  const directory=`.wxt/license-audit/${browser}`;
  for(const file of await readdir(directory)) {
    if(!file.endsWith('.json'))continue;
    for(const entry of JSON.parse(await readFile(`${directory}/${file}`,'utf8'))) {
      if(!['wxt','@wxt-dev/browser'].includes(entry.name)||entry.license!=='MIT')throw new Error(`Unreviewed runtime dependency: ${entry.name} (${entry.license})`);
      modules.set(entry.file,entry);packages.set(`${entry.name}@${entry.version}`,entry);
    }
  }
}
if(packages.size!==2)throw new Error('Unexpected runtime dependency inventory.');
const inventory=[];
for(const entry of [...modules.values()].sort((a,b)=>a.file.localeCompare(b.file))) {
  const source=resolve(entry.file);
  if(!source.startsWith(root+'/')&&!source.startsWith(root+'\\'))throw new Error('Source escapes project.');
  const destination=`third-party/runtime/${entry.name.replace('/','-').replace('@','')}-${entry.version}/${entry.packageFile}`;
  await mkdir(dirname(destination),{recursive:true});await copyFile(source,destination);
  inventory.push({name:entry.name,version:entry.version,license:entry.license,file:entry.packageFile,source:destination,sha256:createHash('sha256').update(await readFile(source)).digest('hex')});
}
await mkdir('licenses',{recursive:true});
await writeFile('licenses/runtime-inventory.json',JSON.stringify(inventory,null,2)+'\n');
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const dependencies=Object.entries(lock.packages).filter(([path])=>path).map(([path,p])=>({path,version:p.version,license:p.license??'UNDECLARED',integrity:p.integrity,scope:packages.has(`${path.split('node_modules/').at(-1)}@${p.version}`)?'includes-runtime-code':'build-or-test-only'}));
if(dependencies.some(p=>p.license==='UNDECLARED'))throw new Error('Dependency with undeclared license; review before release.');
await writeFile('licenses/dependency-inventory.json',JSON.stringify(dependencies,null,2)+'\n');
const mit=await readFile('licenses/WXT-MIT.txt','utf8');
const notice=`Bilingual Lite — third-party notices\n\nProject-specific code and original artwork: GPL-3.0-only; see LICENSE.\nThe following unmodified library code is included in the compiled extension.\nIts original copyright and MIT permission notice remain applicable.\n\n${[...packages.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`${p.name} ${p.version} — MIT`).join('\n')}\nUpstream: https://github.com/wxt-dev/wxt\nWXT release: https://github.com/wxt-dev/wxt/tree/8fea9b4837282f4ad2a0d085ced6bee1a7de08fb\nExact installed modules and hashes: licenses/runtime-inventory.json in source.\n\n${mit}`;
await writeFile('THIRD_PARTY_NOTICES.txt',notice);
console.log(`PASS license inventory: ${packages.size} MIT runtime packages, ${inventory.length} modules, ${dependencies.length} build/test/runtime package records. Notices and runtime source snapshots generated.`);
