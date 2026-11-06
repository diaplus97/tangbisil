// Shorts may loop without an ENDED event. Only accept a continuous, measured
// end-to-start boundary from the official player API, never elapsed wall time.
export function createTvBoundary(){
  let previous=null,continuous=0;
  return {
    reset(){previous=null;continuous=0;},
    sample({time,duration,expectedDuration,at,rate=1,state,eligible=true}){
      if(!eligible||![1,3].includes(state)||!Number.isFinite(time)||!Number.isFinite(duration)||Math.abs(duration-expectedDuration)>.4||rate<=0||rate>2){this.reset();return false;}
      if(state===3)return false;
      const old=previous;previous={time,duration,at,rate};
      if(!old)return false;
      const dt=(at-old.at)/1000,advance=dt*rate;
      if(dt<=0||dt>1.4||Math.abs(old.rate-rate)>.05||Math.abs(old.duration-duration)>.1){continuous=0;return false;}
      // The previous poll can be more than .35s from the end at 2x speed or
      // after a delayed poll. Bound it by the measured advance of this interval.
      const remaining=duration-old.time;
      const loop=continuous>=Math.min(3,duration*.3)&&remaining>=0&&remaining<=advance+.2&&time<1.2&&Math.abs(advance-remaining-time)<.2;
      if(loop){this.reset();return true;}
      // A seek, a long stall, or an inconsistent clock disarms this boundary.
      if(time<old.time-.03||Math.abs(time-old.time-advance)>.55)continuous=0;
      else if(time>old.time+.02)continuous+=Math.min(time-old.time,advance+.1);
      return false;
    },
  };
}
