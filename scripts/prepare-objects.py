"""Edit CC0 appliance recordings. Requires numpy and an explicit ffmpeg path."""
import argparse,json,subprocess,wave,hashlib
from pathlib import Path
import numpy as np
parser=argparse.ArgumentParser();parser.add_argument('--ffmpeg',required=True);parser.add_argument('--inspect',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;raw=root/'data/object-sources';out=root/'src/assets/audio';rate=44100
sources={
 '823844':{'title':'Nespresso machine making coffee','author':'bassimat','page':'https://freesound.org/people/bassimat/sounds/823844/','download':'https://cdn.freesound.org/previews/823/823844_15636277-hq.mp3'},
 '573696':{'title':'Fridge - Open:Close 1.wav','author':'MWsfx','page':'https://freesound.org/people/MWsfx/sounds/573696/','download':'https://cdn.freesound.org/previews/573/573696_12956274-hq.mp3'},
}
def decode(id,filters='highpass=f=100,lowpass=f=5000'):
 return np.frombuffer(subprocess.check_output([args.ffmpeg,'-v','error','-i',str(raw/(id+'.mp3')),'-ac','1','-ar',str(rate),'-af',filters,'-f','f32le','pipe:1']),dtype='<f4').copy()
if args.inspect:
 for id in sources:
  x=decode(id);step=rate//4;print(id,[(round(i/rate,2),round(float(20*np.log10(max(1e-9,np.sqrt(np.mean(x[i:i+step]**2))))),1)) for i in range(0,len(x),step)])
 raise SystemExit
files=[]
for name,id,start,duration,peak in [('coffee-machine','823844',1.1,4.5,-18),('fridge-open','573696',0,.65,-17),('fridge-close','573696',6.42,.48,-17)]:
 x=decode(id)[int(start*rate):int((start+duration)*rate)].astype(float);x-=np.mean(x)
 threshold=max(np.sqrt(np.mean(x*x))*5,.005);x=np.tanh(x/threshold)*threshold
 fade=int(.025*rate);tail=int(.08*rate);x[:fade]*=np.linspace(0,1,fade)**2;x[-tail:]*=np.linspace(1,0,tail)**2
 x*=10**(peak/20)/max(1e-9,np.max(np.abs(x)));pcm=np.round(x*32767).astype('<i2');file=out/(name+'.wav')
 with wave.open(str(file),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
 source={**sources[id],'license':'https://creativecommons.org/publicdomain/zero/1.0/','retrieved':'2026-11-05','format':'Public HQ MP3 preview, not lossless original','sha256':hashlib.sha256((raw/(id+'.mp3')).read_bytes()).hexdigest()}
 files.append({'file':file.name,'source':source,'edit':{'start':start,'seconds':len(x)/rate,'mono_hz':rate,'highpass':100,'lowpass':5000,'soft_compression':'tanh at 5x RMS, min .005','fade_ms':[25,80],'peak_dbfs':peak},'measured':{'rms_dbfs':round(float(20*np.log10(np.sqrt(np.mean(x*x)))),2),'clipped_samples':int(np.sum(np.abs(pcm.astype(int))>=32767)),'first_sample':int(pcm[0]),'last_sample':int(pcm[-1]),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}})
(out/'object-sources.json').write_text(json.dumps({'verification':'Numerical and browser timing only. No subjective headphone listening claimed.','files':files},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
credits=['TANGBISIL / OBJECT FOLEY','All recordings CC0 1.0. Public HQ MP3 previews, retrieved 2026-11-05.','Numeric edits verified; headphone listening remains required.','']
for f in files:
 s=f['source'];e=f['edit'];credits.extend([f['file'],s['title']+' — '+s['author'],s['page'],s['license'],s['download'],json.dumps(e),''])
credits.extend(['Candy wrapper: existing rustle-a/b/c and foil-touch CC0 recordings; shorter 0.15s grains at 1.22 playback rate and lower gain distinguish the small wrapper from lemon pie.','Cup contact: existing cup-down.wav. Source/edit information is in CREDITS.txt.'])
(out/'OBJECT_CREDITS.txt').write_text('\n'.join(credits)+'\n',encoding='utf-8');print(json.dumps(files,ensure_ascii=False,indent=2))
