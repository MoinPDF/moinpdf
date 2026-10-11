import {spawnSync} from 'node:child_process';
const suites=['pdf','studio','document-check','tool-search','editor','extra-tools','document-tools','security-invoice','advanced-tools','size-split','document-server','conversion','recovery','evidence','century','native-pdf','pro-tools','ocr-languages','project-archive','content-compare'];
for(const suite of suites){const result=spawnSync(process.execPath,[`tests/${suite}-smoke.mjs`],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log(`PASS: ${suites.length} browser-engine test suites.`);
