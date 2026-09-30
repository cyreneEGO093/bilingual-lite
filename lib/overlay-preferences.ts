import { browser } from 'wxt/browser';
import { DEFAULT_OVERLAY_STYLE, validateOverlayStyle, type OverlayStyle } from './overlay-style';
export async function getOverlayStyle():Promise<OverlayStyle> {
  const {overlayStyle}=await browser.storage.local.get('overlayStyle');
  try{return validateOverlayStyle(overlayStyle);}catch{return {...DEFAULT_OVERLAY_STYLE};}
}
export async function saveOverlayStyle(value:unknown):Promise<void> {
  await browser.storage.local.set({overlayStyle:validateOverlayStyle(value)});
}
