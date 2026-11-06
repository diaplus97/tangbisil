import * as T from 'three';

// Solve in body space; the palm and cup stay upright while the elbow bends.
export function armReach(shoulder:T.Vector3,target:T.Vector3){
 const upper=.29,lower=.27,down=new T.Vector3(0,-1,0),direction=target.clone().sub(shoulder),distance=T.MathUtils.clamp(direction.length(),.025,upper+lower-.002);direction.normalize();
 const bend=down.clone().addScaledVector(direction,-down.dot(direction));
 if(bend.lengthSq()<1e-6)bend.set(0,0,1);bend.normalize();
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,height),end=shoulder.clone().addScaledVector(direction,distance);
 const shoulderRotation=new T.Quaternion().setFromUnitVectors(down,elbow.clone().sub(shoulder).normalize()),forearmRotation=new T.Quaternion().setFromUnitVectors(down,end.clone().sub(elbow).normalize());
 return {shoulder:shoulderRotation,elbow:shoulderRotation.clone().invert().multiply(forearmRotation)};
}
