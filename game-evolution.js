/* Feature layer loaded before game.js. Kept separate so the core game remains recoverable. */
window.FlyEvolution = {
  version:'2.0',
  features:['FlyWire sensory tiers','procedural habitat','articulated fly animation','odor/taste/touch fields','closed-loop motor behavior','learning-ready reward channel'],
  reward:{food:1,damage:-1,escape:0.4},
  encodeSensory({vision=0,odor=0,taste=0,touch=0}={}){return {VISION:vision,ODOR:odor,TASTE:taste,TOUCH:touch};},
  chooseTier(){return matchMedia('(max-width:900px)').matches?'mobile':(navigator.deviceMemory&&navigator.deviceMemory<4?'mobile':'desktop');}
};
