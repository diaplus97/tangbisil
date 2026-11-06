"""Cut CC0 recordings. Run with --ffmpeg; originals stay in ignored data/object-sources."""
import argparse, hashlib, json, subprocess, wave
from pathlib import Path
import numpy as np

p=argparse.ArgumentParser();p.add_argument('--ffmpeg',required=True);args=p.parse_args()
root=Path(__file__).resolve().parent.parent;out=root/'src/assets/audio';rate=44100
sources={
 '516923':{'title':'scrabble and soft sand pour.mp3','author':'mariethompson','source':'https://freesound.org/people/mariethompson/sounds/516923/','download':'https://cdn.freesound.org/previews/516/516923_2094018-hq.mp3'},
 '700536':{'title':'stone_slab2.wav','author':'NistuGgner','source':'https://freesound.org/people/NistuGgner/sounds/700536/','download':'https://cdn.freesound.org/previews/700/700536_13373037-hq.mp3'}
}
def decoded(path,filters='highpass=f=160,lowpass=f=4600'):
 return np.frombuffer(subprocess.check_output([args.ffmpeg,'-v','error','-i',str(path),'-ac','1','-ar',str(rate),'-af',filters,'-f','f32le','pipe:1']),dtype='<f4').astype(float)
def write(path,x):
 pcm=np.round(np.clip(x,-.999,.999)*32767).astype('<i2')
 with wave.open(str(path),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
 return {'duration':len(x)/rate,'peak_dbfs':round(20*np.log10(max(1e-9,np.max(np.abs(x)))),2),'rms_dbfs':round(20*np.log10(max(1e-9,np.sqrt(np.mean(x*x)))),2),'endpoints':[int(pcm[0]),int(pcm[-1])],'clipped_samples':int(np.sum(abs(pcm.astype(int))>=32767)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
records=[];clips={}
for sid,meta in sources.items():
 raw=root/f'data/object-sources/{sid}.mp3';x=decoded(raw)
 meta.update(license='https://creativecommons.org/publicdomain/zero/1.0/',retrieved='2026-11-06',format='Public HQ MP3 preview; not the lossless original',source_sha256=hashlib.sha256(raw.read_bytes()).hexdigest())
 # Distinct, moderately energetic intervals; chosen by waveform statistics, not listening.
 cuts=[('sand-a.wav',2.4,.52,-23),('sand-b.wav',5.6,.52,-23),('sand-c.wav',11.2,.52,-23)] if sid=='516923' else [('sand-stone.wav',.02,.25,-26)]
 for name,start,duration,peak in cuts:
  y=x[round(start*rate):round((start+duration)*rate)].copy();y-=y.mean()
  threshold=max(.001,np.sqrt(np.mean(y*y))*3);y=np.tanh(y/threshold)*threshold
  head,tail=(18,65) if sid=='516923' else (5,85)
  y[:round(head*rate/1000)]*=np.linspace(0,1,round(head*rate/1000))**2;y[-round(tail*rate/1000):]*=np.linspace(1,0,round(tail*rate/1000))**2
  gain=10**(peak/20)/max(1e-9,max(abs(y)));y*=gain;clips[name]=y
  records.append({'file':name,**meta,'edit':{'start_seconds':start,'duration':duration,'mono_hz':rate,'highpass_hz':160,'lowpass_hz':4600,'compression':'tanh at 3x RMS','gain_after_compression':gain,'fade_ms':[head,tail]},'verification':write(out/name,y)})
credits=out/'REST_CREDITS.json';old=json.loads(credits.read_text(encoding='utf-8'));old['sand_recordings']=records;old['listening']='Numerical/timing checks only; subjective listening not performed.'
credits.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
txt=out/'REST_CREDITS.txt';base=txt.read_text(encoding='utf-8').split('\nSAND RECORDINGS')[0]
txt.write_text(base+'\nSAND RECORDINGS\n'+ '\n\n'.join(r['file']+' — '+r['title']+' / '+r['author']+'\n'+r['source']+'\n'+r['license']+'\n'+r['download']+'\n'+json.dumps(r['edit']) for r in records)+'\nHQ previews, retrieved 2026-11-06. Source/output hashes and numerical results: REST_CREDITS.json. No subjective listening claimed.\n',encoding='utf-8')
preview=root/'test-results';preview.mkdir(exist_ok=True)
sea=decoded(root/'src/assets/environments/sea-waves.wav','anull')[:rate*12]*.4*.6
sea[:rate]*=np.linspace(0,1,rate);sea[-rate:]*=np.linspace(1,0,rate);mix=sea.copy()
for i,start in enumerate([2,2.35,2.7,5.4,5.75,6.1,8.5]):
 y=clips[['sand-a.wav','sand-b.wav','sand-c.wav'][i%3]]*.6*.7;n=round(start*rate);mix[n:n+len(y)]+=y
y=clips['sand-stone.wav']*.6;n=round(10*rate);mix[n:n+len(y)]+=y
write(preview/'sound-A-waves.wav',sea);write(preview/'sound-B-waves-and-sand.wav',mix)
print(json.dumps([{'file':r['file'],**r['verification']} for r in records]))
