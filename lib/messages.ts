import type { ImageLayout } from './image-geometry';
import type { TextItem } from './text-api';
export type BackgroundRequest = {type:'models'} | {type:'translateText';items:TextItem[]} |
  {type:'translateImage'|'translateSnippet';dataUrl:string} | {type:'fetchImage';url:string;layout:ImageLayout};
export type ApiReply<T> = {ok:true;data:T} | {ok:false;error:string};
