/** Hide originals without replacing their nodes or dropping page event handlers. */
export function hideOriginal(source:HTMLElement,translation:HTMLElement):()=>void {
  const restore:(()=>void)[]=[];
  const hide=(element:HTMLElement)=>{
    const old=element.style.getPropertyValue('display'),priority=element.style.getPropertyPriority('display');
    element.style.setProperty('display','none','important');
    restore.push(()=>{if(element.style.getPropertyValue('display')==='none'&&element.style.getPropertyPriority('display')==='important'){
      if(old)element.style.setProperty('display',old,priority);else element.style.removeProperty('display');
    }});
  };
  if(translation.parentElement!==source)hide(source);
  else for(const child of Array.from(source.childNodes)){
    if(child===translation)continue;
    if(child instanceof HTMLElement)hide(child);
    else if(child.nodeType===Node.TEXT_NODE){
      const wrapper=document.createElement('span');wrapper.dataset.blOwned='source-wrapper';wrapper.style.setProperty('display','none','important');child.before(wrapper);wrapper.append(child);
      restore.push(()=>{wrapper.replaceWith(...wrapper.childNodes);});
    }
  }
  source.dataset.blOriginalHidden='true';
  return ()=>{for(const reset of restore)reset();delete source.dataset.blOriginalHidden;};
}
