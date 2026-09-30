/** Hide originals without replacing their nodes or dropping page event handlers. */
export function hideOriginal(source:HTMLElement,translation:HTMLElement):()=>void {
  const restore:(()=>void)[]=[];
  // A translated block can be a whole recommendation card. Keep its media,
  // interactive controls and the ancestor chain that gives them their layout.
  const keep='img,picture,svg,canvas,video,audio,iframe,object,embed,input,button,select,textarea,[role="button"],[role="img"],[contenteditable]:not([contenteditable="false"]),[translate="no"],[data-bl-owned]';
  const preserved=new Set<Element>(),paths=new Set<Element>();
  for(const element of [source,...source.querySelectorAll('*')]){
    const background=getComputedStyle(element).backgroundImage;
    if(element===translation||element.matches(keep)||(background&&background!=='none')){
      preserved.add(element);
      for(let parent:Element|null=element;parent;parent=parent.parentElement){paths.add(parent);if(parent===source)break;}
    }
  }
  const hide=(element:HTMLElement)=>{
    const hadStyle=element.hasAttribute('style');
    const old=element.style.getPropertyValue('display'),priority=element.style.getPropertyPriority('display');
    element.style.setProperty('display','none','important');
    restore.push(()=>{if(element.style.getPropertyValue('display')==='none'&&element.style.getPropertyPriority('display')==='important'){
      if(old)element.style.setProperty('display',old,priority);else element.style.removeProperty('display');
      if(!hadStyle&&!element.getAttribute('style'))element.removeAttribute('style');
    }});
  };
  const walk=(parent:HTMLElement)=>{for(const child of Array.from(parent.childNodes)){
    if(child===translation)continue;
    if(child instanceof HTMLElement){
      if(preserved.has(child))continue;
      if(paths.has(child))walk(child);else hide(child);
    }else if(child.nodeType===Node.TEXT_NODE&&child.textContent?.trim()){
      const wrapper=document.createElement('span');wrapper.dataset.blOwned='source-wrapper';wrapper.style.setProperty('display','none','important');child.before(wrapper);wrapper.append(child);
      restore.push(()=>{wrapper.replaceWith(...wrapper.childNodes);});
    }
  }};
  if(translation.parentElement!==source&&!paths.has(source))hide(source);
  else walk(source);
  source.dataset.blOriginalHidden='true';
  return ()=>{for(const reset of restore)reset();delete source.dataset.blOriginalHidden;};
}
