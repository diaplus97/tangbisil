"""Prepare licensed field recordings; no synthesized noise is used.
Usage: python scripts/prepare-foley.py --ffmpeg /path/to/ffmpeg
Public HQ preview URLs, source hashes, cuts and measured levels are retained.
Requires numpy. Raw downloads live in ignored data/audio-sources/.
"""
import argparse, hashlib, json, subprocess, wave
from pathlib import Path
import numpy as np

parser=argparse.ArgumentParser();parser.add_argument('--ffmpeg',default='ffmpeg');parser.add_argument('--inspect',action='store_true');parser.add_argument('--review',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;raw=root/'data/audio-sources';out=root/'src/assets/audio';out.mkdir(parents=True,exist_ok=True)
rate=44100
if args.review:
    # Listening aid only: isolated processed clips at 60%, not an interactive in-game mix.
    review=root/'test-results';review.mkdir(exist_ok=True);chunks=[np.zeros(rate//2,dtype='<i2')];cursor=.5
    notes=['Edited recording review, isolated clips at 60% gain. In-game motion, distance and envelopes are not reproduced.','Biscuit bite is optional and OFF by default in the game.','']
    manifest=json.loads((out/'sources.json').read_text(encoding='utf-8'))
    for item in manifest['files']:
        with wave.open(str(out/item['file']),'rb') as w:x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
        notes.append(f"{cursor:.2f}s: {item['file']}");chunks.extend([np.round(x*.6).astype('<i2'),np.zeros(int(rate*.7),dtype='<i2')]);cursor+=len(x)/rate+.7
    with wave.open(str(review/'foley-review.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(np.concatenate(chunks).tobytes())
    (review/'foley-review.txt').write_text('\n'.join(notes)+'\n',encoding='utf-8');print(review/'foley-review.wav');raise SystemExit
def decode(source,filters=None):
    command=[args.ffmpeg,'-v','error','-i',str(raw/(source+'.mp3')),'-ac','1','-ar',str(rate)]
    if filters: command+=['-af',filters]
    return np.frombuffer(subprocess.check_output(command+['-f','f32le','pipe:1']),dtype='<f4').copy()
def db(value):return round(float(20*np.log10(max(float(value),1e-9))),2)
if args.inspect:
    for source in sorted(raw.glob('*.mp3')):
        x=decode(source.stem);step=rate//4
        print(source.stem,'seconds',round(len(x)/rate,3),'quarter-second RMS dB',[(round(i/rate,2),db(np.sqrt(np.mean(x[i:i+step]**2)))) for i in range(0,len(x),step)])
    raise SystemExit
# Start/duration are in decoded source seconds. Deliberately short, separate takes.
cuts=[('rustle-a','561036',1.25,1.0,-11,150,6200),('rustle-b','561036',4.1,1.1,-11,150,6200),('rustle-c','561036',6.65,1.05,-11,150,6200),
      ('foil-touch','714213',4.44,.72,-13,150,6000),('wrapper-open','590195',.43,.34,-13,120,6500),
      ('cup-down','568757',0,.39,-14,130,5800),('tea-pour','240125',.42,2.15,-15,150,6500),('biscuit-bite','334210',.72,.46,-16,170,5000)]
sources=json.loads((raw/'sources.json').read_text(encoding='utf-8-sig'));by_id={s['id']:s for s in sources};manifest=[]
for name,source,start,duration,peak,low,high in cuts:
    filtered=decode(source,f'highpass=f={low},lowpass=f={high}')
    x=filtered[int(start*rate):int((start+duration)*rate)].astype(np.float64);x-=np.mean(x)
    # Gentle peak compression keeps isolated wrapper clicks below the surrounding texture.
    threshold=max(np.sqrt(np.mean(x*x))*5,0.005);x=np.tanh(x/threshold)*threshold
    x=np.frombuffer(subprocess.check_output([args.ffmpeg,'-v','error','-f','f32le','-ar',str(rate),'-ac','1','-i','pipe:0','-af',f'lowpass=f={high},lowpass=f={high}','-f','f32le','pipe:1'],input=x.astype('<f4').tobytes()),dtype='<f4').astype(np.float64)
    fade_in=min(int(.012*rate),len(x)//4);fade_out=min(int(.045*rate),len(x)//4)
    x[:fade_in]*=np.sin(np.linspace(0,np.pi/2,fade_in))**2;x[-fade_out:]*=np.cos(np.linspace(0,np.pi/2,fade_out))**2
    x*=10**(peak/20)/max(np.max(np.abs(x)),1e-9)
    pcm=np.round(x*32767).astype('<i2');target=out/(name+'.wav')
    with wave.open(str(target),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
    spectrum=np.abs(np.fft.rfft(x))**2;freq=np.fft.rfftfreq(len(x),1/rate)
    source_info=dict(by_id[source]);source_info['sha256']=hashlib.sha256((raw/(source+'.mp3')).read_bytes()).hexdigest()
    windows=np.array([np.sqrt(np.mean(x[i:i+441]**2)) for i in range(0,len(x),441)])
    manifest.append({'file':name+'.wav','source':source_info,'edit':{'start_seconds':start,'duration_seconds':round(len(x)/rate,4),'mono_hz':rate,'highpass_hz':low,'lowpass_hz':high,'post_compression_lowpass_passes':2,'soft_peak_compression':'tanh, threshold 5x RMS, minimum .005','fade_in_ms':12,'fade_out_ms':45,'peak_target_dbfs':peak},'measured':{'peak_dbfs':db(np.max(np.abs(x))),'rms_dbfs':db(np.sqrt(np.mean(x*x))),'first_sample':int(pcm[0]),'last_sample':int(pcm[-1]),'clipped_samples':int(np.sum(np.abs(pcm.astype(int))>=32767)),'frames_below_minus_55_db':int(np.sum(windows<10**(-55/20))),'total_10ms_frames':len(windows),'energy_above_8khz_percent':round(float(spectrum[freq>8000].sum()/spectrum.sum()*100),3),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}})
(out/'sources.json').write_text(json.dumps({'license':'https://creativecommons.org/publicdomain/zero/1.0/','method':'Edited real recordings from public high-quality MP3 previews, not original lossless masters. Objective analysis only; headphone listening still needed.','files':manifest},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
credits=['TANGBISIL / RECORDED FOLEY','All sources: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/','Retrieved 2026-11-04. Public high-quality MP3 previews were used; these are not lossless originals.','No account, payment, voice generation or synthesized noise was used.','Source selection and edits were checked numerically. Headphone listening is still required.','']
for m in manifest:
    s=m['source'];e=m['edit'];credits += [m['file'],s['title']+' — '+s['author'],s['page'],'Public preview: '+s['download'],f"Cut {e['start_seconds']:.2f}s + {e['duration_seconds']:.2f}s; mono 44.1kHz PCM16; highpass {e['highpass_hz']}Hz; lowpass {e['lowpass_hz']}Hz; soft peak compression; post-filter; 12ms/45ms fades; peak {e['peak_target_dbfs']}dBFS.",'']
(out/'CREDITS.txt').write_text('\n'.join(credits),encoding='utf-8')
print(json.dumps([{**{'file':m['file']},**m['measured']} for m in manifest],indent=2))
