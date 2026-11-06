"""Reproducible cut of the licensed spray recording; no synthesized replacement."""
import argparse,subprocess,wave,json,hashlib
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--ffmpeg',required=True);args=p.parse_args()
root=Path(__file__).resolve().parent.parent;raw=root/'data/object-sources/212178.mp3';out=root/'src/assets/audio';rate=44100
x=np.frombuffer(subprocess.check_output([args.ffmpeg,'-v','error','-i',str(raw),'-ac','1','-ar',str(rate),'-af','highpass=f=120,lowpass=f=6500','-f','f32le','pipe:1']),dtype='<f4')[int(.61*rate):int(1.09*rate)].astype(float)
x-=x.mean();threshold=max(.005,np.sqrt(np.mean(x*x))*4);x=np.tanh(x/threshold)*threshold
fade=int(.012*rate);tail=int(.08*rate);x[:fade]*=np.linspace(0,1,fade)**2;x[-tail:]*=np.linspace(1,0,tail)**2;x*=10**(-19/20)/max(1e-9,np.max(np.abs(x)))
pcm=np.round(x*32767).astype('<i2');dest=out/'plant-spray.wav'
with wave.open(str(dest),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
record={'file':dest.name,'title':'Spray Bottle','author':'OwlStorm / Ashe Kirk','source':'https://freesound.org/people/OwlStorm/sounds/212178/','license':'https://creativecommons.org/publicdomain/zero/1.0/','download':'https://cdn.freesound.org/previews/212/212178_140737-hq.mp3','retrieved':'2026-11-06','format':'Public HQ MP3 preview, not lossless original','source_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'edit':{'start_seconds':.61,'duration':len(x)/rate,'mono_hz':rate,'highpass_hz':120,'lowpass_hz':6500,'soft_compression':'tanh at 4x RMS','fade_ms':[12,80],'peak_dbfs':-19},'verification':{'clipped_samples':int(np.sum(np.abs(pcm.astype(int))>=32767)),'endpoints':[int(pcm[0]),int(pcm[-1])],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'headphone_listening':'Not performed'}}
(out/'REST_CREDITS.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(out/'REST_CREDITS.txt').write_text('TANGBISIL / REST OBJECTS\nSpray Bottle — OwlStorm / Ashe Kirk\n'+record['source']+'\n'+record['license']+'\n'+record['download']+'\nPublic HQ MP3 preview, retrieved 2026-11-06.\nCut 0.61–1.09s, mono 44.1kHz PCM16, HP120 / LP6500 Hz, soft compression, fades12/80ms, peak-19dBFS.\nNumerical and browser timing verification; no subjective headphone listening claimed.\n\nTea uses existing tea-pour.wav and cup-down.wav; tea bag uses a short low-gain segment of foil-touch.wav. Original sources and edits: CREDITS.txt.\nStone and leaf-stroke deliberately have no artificial sound.\n',encoding='utf-8')
print(json.dumps(record,ensure_ascii=False))
