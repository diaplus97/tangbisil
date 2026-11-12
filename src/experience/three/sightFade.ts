import * as T from 'three';
import type {Workshop} from './assets';

type Point = {x:number; z:number};

// Each group owns its fade materials. The same leaf texture is also used by
// the watering station, whose leaves must remain visible and interactive.
export function createSightFade(kit:Workshop, group:T.Group, decorative:boolean, fadedOpacity:number) {
  const copies = new Map<T.Material,T.Material>();
  const skipRaycast=()=>{};
  group.traverse(mesh => {
    if (!(mesh instanceof T.Mesh) || Array.isArray(mesh.material) || !mesh.material.visible) return;
    const original:T.Material = mesh.material;
    if (decorative) {
      mesh.userData.decorativeCanopy = true;
      // Decorative foliage always passes input through, including after it fades back in.
      mesh.raycast=skipRaycast;
    } else if (!original.transparent || original.opacity >= .9) {
      mesh.userData.blocksSelection = true;
    }
    let material = copies.get(original);
    if (!material) {
      material = original.clone();
      if (decorative) material.forceSinglePass = true;
      copies.set(original, material);
      kit.materials.set('sight-' + material.uuid, material as T.MeshStandardMaterial);
    }
    mesh.material = material;
  });
  group.updateWorldMatrix(true, true);
  const bounds = new T.Box3().setFromObject(group);
  const ray = new T.Ray(), delta = new T.Vector3(), hit = new T.Vector3();
  const materials = [...copies.values()].map(material => ({
    material, opacity:material.opacity, transparent:material.transparent, depthWrite:material.depthWrite
  }));
  let opacity = 1;

  function crosses(camera:T.Camera, x:number, y:number, z:number) {
    delta.set(x,y,z).sub(camera.position);
    const length = delta.length();
    if (length < .001) return false;
    ray.set(camera.position, delta.multiplyScalar(1 / length));
    return ray.intersectBox(bounds,hit) !== null && hit.distanceTo(camera.position) < length - .05;
  }

  return (camera:T.Camera, actor:Point|null, reduced:boolean, marker?:T.Vector3|null) => {
    const blocks = actor !== null && (
      (decorative && bounds.distanceToPoint(camera.position) < .8) ||
      bounds.containsPoint(camera.position) ||
      crosses(camera,actor.x,.55,actor.z) || crosses(camera,actor.x,1.25,actor.z) ||
      crosses(camera,actor.x,1.85,actor.z) ||
      (decorative && !!marker && crosses(camera,marker.x,marker.y,marker.z))
    );
    const target = blocks ? fadedOpacity : 1;
    if (opacity === target) return blocks;
    opacity = reduced || !actor ? target : T.MathUtils.lerp(opacity,target,.24);
    if (Math.abs(opacity-target)<.008) opacity=target;
    for (const base of materials) {
      const transparent = base.transparent || opacity < 1;
      if (base.material.transparent !== transparent) {
        base.material.transparent = transparent;
        base.material.needsUpdate = true;
      }
      base.material.opacity = base.opacity * opacity;
      base.material.depthWrite = base.depthWrite && opacity === 1;
    }
    return blocks;
  };
}
