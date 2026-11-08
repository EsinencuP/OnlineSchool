import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = new URL('../../../', import.meta.url), out = new URL('./', import.meta.url);
const paths = ['package.json', 'apps/api/src/core/core.module.ts',
  'apps/api/src/modules/platform/platform.dto.ts', 'apps/api/src/modules/platform/platform.module.ts',
  'apps/api/src/modules/manager/me/manager-me.service.ts', 'apps/api/src/modules/manager/dto/manager-me.response.dto.ts',
  'apps/api/src/modules/manager/context/manager-context.ts', 'apps/api/src/modules/manager/payments/manager-payments.controller.ts',
  'apps/api/src/modules/schedule/outcomes.service.ts', 'apps/api/src/modules/schedule/schedule.module.ts',
  'apps/api/src/modules/finance/payments.service.ts', 'apps/api/src/modules/finance/finance-ledger.service.ts',
  'apps/api/src/modules/finance/manager-payments/workflow.service.ts', 'tests/unit/manager-http.test.mjs'];
const hashes=[];
for(const path of paths) {
 const target = new URL('before/'+path,out); await mkdir(new URL('./',target),{recursive:true});
 await cp(new URL(path,root),target);
 hashes.push({path,sha256:createHash('sha256').update(await readFile(new URL(path,root))).digest('hex')});
}
const git=(...args)=>execFileSync('git',['--no-optional-locks','-c','core.safecrlf=false',...args],{cwd:root});
await writeFile(new URL('status-before.txt',out),git('status','--porcelain=v1'));
await writeFile(new URL('before.json',out),JSON.stringify({head:git('rev-parse','HEAD').toString().trim(),branch:git('branch','--show-current').toString().trim(),hashes},null,2)+'\n');
console.log('Captured limited edit basis',hashes.length);
