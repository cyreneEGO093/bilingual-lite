// SPDX-License-Identifier: GPL-3.0-only
import type { ImageLayout } from './image-geometry';
import type { TextItem } from './text-api';
import type { TextScope } from './text-scope';
export type BackgroundRequest = {type:'models'} | {type:'translateText';items:TextItem[]} |
  {type:'translateImage'|'translateSnippet';dataUrl:string} | {type:'fetchImage';url:string;layout:ImageLayout} |
  {type:'getTextScope'} | {type:'setTextScope';scope:TextScope} | {type:'getOverlayStyle'};
export type ApiReply<T> = {ok:true;data:T} | {ok:false;error:string;code?:'output-format';status?:number};
