export const advancedToolIds = ['form-responses','chronology','arithmetic-check','pdf-sanitize','pdf-layers','pdf-measure','number-compare','field-collector','invoice-visual-check','page-gaps','ocr-review','pseudonymize','attachment-links','best-scans','document-reconcile','comment-export','pdf-repair','scan-split','pdf-markdown','pdf-html','pdf-epub','split-size','batch','workflows','auto-rename','smart-split','table-export','search-redact','visual-compare','scan-enhance','cover-toc','mail-merge','qr-barcode','link-editor','attachment-manager','camera-scan'] as const;
export type AdvancedTool = typeof advancedToolIds[number];
export const isAdvancedTool = (id:string):id is AdvancedTool => (advancedToolIds as readonly string[]).includes(id);
export const serverToolIds = ['pdf-audio','optimize-pdf','ebook-pdf','pdf-powerpoint','html-pdf','auto-orient','book-dewarp','form-detect','redaction-check','print-check','accessibility-check','translate-pdf','zugferd-create','word-mail-merge','pdf-word','email-pdf','office-pdf','pdfa','xrechnung-validate','certificate-sign'] as const;
export type ServerTool = typeof serverToolIds[number];
export const isServerTool = (id:string):id is ServerTool => (serverToolIds as readonly string[]).includes(id);
export type ExportFile = {blob:Blob;filename:string;kind:'pdf'|'zip'|'data';pages:number;note?:string};
export type RunContext = {signal:AbortSignal;report:(value:{percent:number;label:string})=>void};
export const checkAbort=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Abgebrochen','AbortError');};
export const safeName=(name:string)=>name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/^\.+/,'').trim().slice(0,150)||'Dokument';
export function uniqueNames(names:string[]){const used=new Set<string>();return names.map(name=>{name=safeName(name);let n=1,candidate=name;const dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';while(used.has(candidate.toLowerCase()))candidate=`${stem}-${++n}${ext}`;used.add(candidate.toLowerCase());return candidate;});}
