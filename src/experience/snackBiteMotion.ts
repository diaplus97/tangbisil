import type {SnackKind} from '../../shared/snacks.mjs';

// Cut geometry, local sound, hand movement and repeat input share one contact clock.
export const snackBiteProfiles={
 lemonPie:{duration:1450,contact:460,liftIn:410,returnMs:600,pressStart:300,pressEnd:650,squash:0,rebound:0,lift:[.24,.65,.62],tilt:[-.28,.13,-.07]},
 fruitMochi:{duration:1450,contact:460,liftIn:410,returnMs:600,pressStart:300,pressEnd:650,squash:.055,rebound:0,lift:[.24,.65,.62],tilt:[-.28,.13,-.07]},
 layeredMochi:{duration:1240,contact:390,liftIn:340,returnMs:480,pressStart:270,pressEnd:570,squash:.115,rebound:0,lift:[.16,.57,.58],tilt:[-.18,.06,-.04]},
 dubaiCookie:{duration:1640,contact:540,liftIn:450,returnMs:660,pressStart:300,pressEnd:1050,squash:.15,rebound:.028,lift:[.27,.67,.65],tilt:[-.32,.17,-.10]},
} as const satisfies Record<SnackKind,unknown>;
const clamp=(n:number)=>Math.max(0,Math.min(1,n)),smooth=(n:number)=>{const x=clamp(n);return x*x*(3-2*x);};
export function snackBiteMotion(kind:SnackKind,age:number,reduced=false){
 const p=snackBiteProfiles[kind],active=!reduced&&age>=0&&age<p.duration,contact=reduced||age>=p.contact;
 const lift=active?smooth(Math.min(age/p.liftIn,(p.duration-age)/p.returnMs)):0;
 // Layered rice compresses briefly; the chewy shell holds pressure and recovers slowly.
 const press=active?p.squash*(age<=p.contact?smooth((age-p.pressStart)/(p.contact-p.pressStart)):1-smooth((age-p.contact)/(p.pressEnd-p.contact))):0;
 const rebound=active&&age>p.pressEnd?p.rebound*Math.sin(clamp((age-p.pressEnd)/240)*Math.PI):0;
 return {active,contact,lift,press,rebound,profile:p};
}
