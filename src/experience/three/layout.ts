// World coordinates are shared by furniture, people, trays and interaction labels.
export const roomBounds={width:16,depth:14.4,backZ:-6,centerZ:1.2,ceilingY:4.56};
export const pantryOffset={x:-2.6,z:-.8};
import {tableCenter,seats,stations} from '../../../shared/space.mjs';
export {tableCenter,seats};
// The hinge opens towards +Z. Frame the shelves from the handle side even before the door opens.
export const fridgeShelfView={...stations.fridge,viewOffset:.74};
export const sharedPlate={x:tableCenter.x,z:-.45};
export const windowOpening={width:14.48,height:3.98,y:2.23,z:roomBounds.backZ-.11};
export const coffeePosition={x:-4.42+pantryOffset.x,y:1.36,z:-1.3+pantryOffset.z};
