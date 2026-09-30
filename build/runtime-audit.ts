// SPDX-License-Identifier: GPL-3.0-only
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Record only third-party modules that contribute bytes to release chunks. */
export function runtimeAudit(browser: string): Plugin {
  return {
    name:'bilingual-runtime-license-audit',
    generateBundle(_options,bundle) {
      const directory=resolve('.wxt','license-audit',browser);
      mkdirSync(directory,{recursive:true});
      for(const chunk of Object.values(bundle)) {
        if(chunk.type!=='chunk')continue;
        writeFileSync(join(directory,`${chunk.name.replaceAll('/','_')}.modules.txt`),Object.entries(chunk.modules).filter(([,info])=>info.renderedLength).map(([id])=>id.replaceAll('\\','/').replace(resolve().replaceAll('\\','/'),'<project>')).sort().join('\n')+'\n');
        const modules=[];
        for(const [id,info] of Object.entries(chunk.modules)) {
          if(!info.renderedLength || !id.replaceAll('\\','/').includes('/node_modules/'))continue;
          const file=id.split('?')[0]!;
          let dir=dirname(file);
          while(dir!==dirname(dir)) {
            try {
              const pkg=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));
              if(pkg.name&&pkg.version) {
                modules.push({name:pkg.name,version:pkg.version,license:pkg.license,file:relative(resolve(),file).replaceAll('\\','/'),packageRoot:relative(resolve(),dir).replaceAll('\\','/'),packageFile:relative(dir,file).replaceAll('\\','/')});
                break;
              }
            }catch{/* Continue to the nearest named package. */}
            dir=dirname(dir);
          }
        }
        writeFileSync(join(directory,`${chunk.name.replaceAll('/','_')}.json`),JSON.stringify(modules,null,2)+'\n');
      }
    }
  };
}
