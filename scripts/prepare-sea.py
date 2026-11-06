"""Bake a periodic water-only cinemagraph and edit a licensed wave recording.

No runtime displacement, generated sound or external media URLs are required.
Requires Python + numpy + Pillow and an FFmpeg executable with libx264/libvpx.
"""
import argparse, hashlib, json, math, subprocess, wave
from pathlib import Path
import numpy as np
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('--ffmpeg',required=True)
parser.add_argument('--video',action='store_true')
parser.add_argument('--audio',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
out=root/'src/assets/environments';out.mkdir(parents=True,exist_ok=True)
qa=root/'test-results';qa.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
db=lambda v:round(20*math.log10(max(float(v),1e-10)),3)

if args.video:
    width,height,fps,seconds=1280,640,24,24
    original=out/'pantry-sea-v1.jpg'
    still=np.asarray(Image.open(original).convert('RGB').resize((width,height),Image.Resampling.LANCZOS),dtype=np.float32)
    y,x=np.mgrid[0:height,0:width].astype(np.float32)
    depth=np.clip((y/height-.505)/.495,0,1)
    shore_y=np.array([.59,.64,.70,.76,.82,.88,.94,1.0])
    shore_x=np.array([1.0,.985,.955,.905,.855,.815,.77,.72])
    shore=np.interp(y/height,shore_y,shore_x)
    mask=np.clip((shore*width-x-7)/13,0,1)*np.clip((y/height-.505)/.025,0,1)
    mask=mask*mask*(3-2*mask)
    depth=depth**1.1
    def frame(t):
        # Integer temporal cycles give matching velocity across the loop boundary.
        phase=2*np.pi*t/seconds
        a=x*.031+y*.19-phase*4
        b=x*.067-y*.13+phase*7
        c=x*.013+y*.046-phase*2
        dx=depth*mask*(2.5*np.sin(a)+1.1*np.sin(b)+.8*np.sin(c))
        dy=depth*mask*(1.05*np.sin(a+.7)+.5*np.sin(b-.4))
        sx=np.clip(x+dx,0,width-1.001);sy=np.clip(y+dy,0,height-1.001)
        ix=sx.astype(np.int32);iy=sy.astype(np.int32);fx=(sx-ix)[...,None];fy=(sy-iy)[...,None]
        warped=(still[iy,ix]*(1-fx)+still[iy,ix+1]*fx)*(1-fy)+(still[iy+1,ix]*(1-fx)+still[iy+1,ix+1]*fx)*fy
        # Restrained glints follow the small wave slopes; the sky/islands stay still.
        shimmer=(np.sin(b)*np.sin(a+.4))*.009*depth*mask
        result=warped*(1+shimmer[...,None])
        result=still*(1-mask[...,None])+result*mask[...,None]
        return np.clip(result,0,255).astype(np.uint8)
    target=out/'pantry-sea-loop.mp4'
    command=[args.ffmpeg,'-y','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{width}x{height}','-framerate',str(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','slow','-crf','21','-pix_fmt','yuv420p','-g',str(fps*2),'-movflags','+faststart',str(target)]
    process=subprocess.Popen(command,stdin=subprocess.PIPE)
    try:
        for i in range(fps*seconds):
            rendered=frame(i/fps);process.stdin.write(rendered.tobytes())
            if i in (0,144,288,575):Image.fromarray(rendered).save(qa/f'sea-frame-{i:03}.png')
            if i%144==0:print(f'Video {i}/{fps*seconds}',flush=True)
    finally:process.stdin.close()
    if process.wait()!=0:raise RuntimeError('Video encoding failed')
    # MP4 is the broad-compatibility fallback; WebM uses the same frame content.
    webm=out/'pantry-sea-loop.webm'
    subprocess.run([args.ffmpeg,'-y','-v','error','-i',str(target),'-an','-c:v','libvpx-vp9','-b:v','0','-crf','33','-row-mt','1','-cpu-used','3',str(webm)],check=True)
    delta=np.abs(frame(0).astype(float)-frame(seconds).astype(float))
    seam=np.abs(frame((fps*seconds-1)/fps).astype(float)-frame(0).astype(float))
    normal=np.abs(frame(1/fps).astype(float)-frame(0).astype(float))
    info={'method':'Water-only periodic cinemagraph baked from the existing generated landscape; not filmed ocean footage. Static camera, sky, islands and shoreline.','source':{'file':original.name,'sha256':sha(original)},'width':width,'height':height,'fps':fps,'seconds':seconds,'silent':True,'periodic_frame_max_delta':float(delta.max()),'last_to_first_mean_delta':float(seam.mean()),'ordinary_step_mean_delta':float(normal.mean()),'files':[{'file':p.name,'bytes':p.stat().st_size,'sha256':sha(p)} for p in (target,webm)]}
    (out/'sea-video.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8');print(json.dumps(info),flush=True)

if args.audio:
    source=root/'data/sea-sources/baltic-sea-339517-hq.mp3';rate=32000
    command=[args.ffmpeg,'-v','error','-ss','12','-i',str(source),'-t','48','-ac','2','-ar',str(rate),'-af','highpass=f=85,lowpass=f=4800','-f','f32le','pipe:1']
    raw=np.frombuffer(subprocess.check_output(command),dtype='<f4').reshape(-1,2).astype(np.float64)
    if len(raw)<48*rate:raise RuntimeError('Recording shorter than the selected edit')
    raw-=raw.mean(axis=0);mid=raw.mean(axis=1,keepdims=True);raw=mid+(raw-mid)*.6
    threshold=np.sqrt(np.mean(raw*raw))*5;raw=np.tanh(raw/threshold)*threshold
    n=4*rate;t=np.arange(n)/n
    join=raw[-n:]*np.cos(t*np.pi/2)[:,None]+raw[:n]*np.sin(t*np.pi/2)[:,None]
    loop=np.concatenate([raw[n:-n],join])
    loop*=min(10**(-23/20)/np.sqrt(np.mean(loop*loop)),10**(-8/20)/np.max(np.abs(loop)))
    pcm=np.round(loop*32767).astype('<i2');target=out/'sea-waves.wav'
    with wave.open(str(target),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
    info={'file':target.name,'source':{'title':'Waves at Baltic Sea shore.wav','author':'pulswelle','page':'https://freesound.org/people/pulswelle/sounds/339517/','download':'https://cdn.freesound.org/previews/339/339517_2367966-hq.mp3','license':'https://creativecommons.org/publicdomain/zero/1.0/','retrieved':'2026-11-05','format':'Downloaded prefix of public HQ MP3 preview, not original lossless WAV','sha256':sha(source)},'edit':{'start_seconds':12,'input_seconds':48,'loop_seconds':len(loop)/rate,'overlap_seconds':4,'sample_rate':rate,'channels':2,'highpass_hz':85,'lowpass_hz':4800,'stereo_width':.6,'crossfade':'Equal power last four seconds into first four seconds; starts after head overlap, continuous sample boundary.'},'measured':{'rms_dbfs':db(np.sqrt(np.mean(loop*loop))),'peak_dbfs':db(np.max(np.abs(loop))),'clipped_samples':int(np.sum(np.abs(pcm.astype(int))>=32767)),'seam_step_dbfs':db(np.max(np.abs(loop[-1]-loop[0]))),'bytes':target.stat().st_size,'sha256':sha(target)},'verification':'Numerical edit and browser audio-graph validation; no claim of headphone listening.'}
    (out/'sea-audio.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    (out/'SEA_CREDITS.txt').write_text('TANGBISIL — SEA AMBIENCE\n\nVideo: original periodic water animation baked from pantry-sea-v1.jpg, an existing generated landscape. Not filmed footage. No external video-generation service was used.\n\nAudio: Waves at Baltic Sea shore.wav — pulswelle\nhttps://freesound.org/people/pulswelle/sounds/339517/\nCC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/\nPublic HQ MP3 preview prefix edited 2026-11-05; not lossless source audio.\n48-second excerpt, filtered and stereo narrowed, four-second equal-power overlap, 44-second PCM loop. See sea-audio.json for full parameters and hashes.\n',encoding='utf-8')
    print(json.dumps(info),flush=True)
