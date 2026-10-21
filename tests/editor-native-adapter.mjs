/** The same native operations as the production worker, without browser workers. */
export const editorNativeAdapter = `
import {readFile} from 'node:fs/promises';
import {createNativeEngine,removeNativeRegions,inspectNativeObjects,inspectNativeObjectTree,readNativeImage} from './native-pdf-core.mjs';
import {editNativeDocument} from './nested-native.mjs';
let api;
const engine=()=>api ||= readFile('public/vendor/pdfium/pdfium.wasm').then(b=>createNativeEngine(new Uint8Array(b)));
export const removeRegions=async(bytes,removals)=>removeNativeRegions(await engine(),bytes,removals);
export const inspectObjects=async(bytes,page,signal,path=[])=>inspectNativeObjects(await engine(),bytes,page,path);
export const inspectObjectTree=async(bytes,page)=>inspectNativeObjectTree(await engine(),bytes,page);
export const readImage=async(bytes,page,index,signal,path=[],region)=>readNativeImage(await engine(),bytes,page,index,path,region);
export const editObjects=async(bytes,page,changes,signal,path=[])=>editNativeDocument(await engine(),bytes,page,changes,path);
`;
