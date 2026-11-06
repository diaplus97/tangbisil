// A smaller lounge with low furniture, an open rear aisle and six real seats.
export const healingSeats=[[-3,1.65,Math.PI*2/3],[-.8,1.65,-Math.PI*2/3],[1.3,1.65,Math.PI*2/3],[3.5,1.65,-Math.PI*2/3],[-2.4,-1.65,Math.PI*2/3],[.1,-1.65,-Math.PI*2/3]];
export const healingTables=[{id:'soft-west',name:'빈백 · 조용한 쪽',x:-1.9,z:.95,y:.51,width:1.18,length:1.1},{id:'soft-east',name:'빈백 · 입구 쪽',x:2.4,z:.95,y:.51,width:1.18,length:1.1},{id:'window',name:'창가 자리',x:-1.15,z:-2.35,y:.66,width:1.32,length:1.15}];
export const healingBounds={minX:-4.15,maxX:4.55,minZ:-3.85,maxZ:4.05};
export const healingStations={flower:{name:'한 송이 꽃 선반',x:-.5,z:4.1,y:1.12,approach:{x:-.5,z:3.1},yaw:0},sand:{name:'모래 트레이 선반',x:-3.5,z:4.1,y:.95,approach:{x:-3.5,z:3.1},yaw:0}};
export const portals={pantry:{id:'healingDoor',name:'힐링방으로',to:'healing',x:7.82,z:-2.8,y:1.5,approach:{x:7.05,z:-2.8},yaw:Math.PI/2},healing:{id:'pantryDoor',name:'탕비실로 돌아가기',to:'pantry',x:4.82,z:3.1,y:1.5,approach:{x:3.95,z:3.1},yaw:Math.PI/2}};
