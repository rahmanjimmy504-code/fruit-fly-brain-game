/* Adapter for the existing brain-worker.js. Keeps game code independent of a particular connectome. */
class FlyBrainAdapter {
  constructor(url='brain-worker.js'){this.worker=new Worker(url);this.ready=false;this.state={};this.worker.onmessage=e=>this.onMessage?.(e.data||{});}
  init(tier='desktop'){this.worker.postMessage({type:'init',tier});}
  stimulate(input,pulse=false){if(this.ready)this.worker.postMessage({type:'stimulus',input,pulse});}
  onMessage(m){if(m.type==='ready')this.ready=true;if(m.groups)this.state={...this.state,...m.groups};if(m.motor)this.state={...this.state,...m.motor};}
  destroy(){this.worker.terminate();}
}
window.FlyBrainAdapter=FlyBrainAdapter;
