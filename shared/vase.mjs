export const flowers=[{id:'cosmos',name:'하얀 코스모스',color:'#f5eddf'},{id:'poppy',name:'살구빛 양귀비',color:'#e6a08c'},{id:'cornflower',name:'푸른 수레국화',color:'#8babc8'}];
export function validArrangement(position,tilt){return typeof position==='number'&&Number.isFinite(position)&&position>=-.6&&position<=.6&&typeof tilt==='number'&&Number.isFinite(tilt)&&tilt>=-.35&&tilt<=.35;}
