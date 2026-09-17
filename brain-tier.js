/* Runtime tier selection. Full 139K is available to dedicated research builds;
 * GitHub Pages defaults to mobile/desktop browser-safe tiers to avoid killing phones. */
window.selectFlyBrainTier=function(){
  if(location.search.includes('fullbrain=1')) return 'full';
  if(matchMedia('(max-width:900px)').matches || (navigator.deviceMemory||8)<4) return 'mobile';
  return 'desktop';
};
