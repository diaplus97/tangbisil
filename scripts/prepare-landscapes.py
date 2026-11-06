"""Prepare licensed footage; sources stay outside the shipped assets."""
import argparse, hashlib, json, subprocess
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--ffmpeg', required=True)
parser.add_argument('--sources', default='test-results')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
source=root/args.sources
target=root/'src/assets/environments'
def run(*parts):
    subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-y',*map(str,parts)],check=True,cwd=root)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

metadata={'prepared':'2026-11-06','items':[]}
for key,filename,length,details in [
    ('forest','forest-moss-original.mp4',10,{'creator':'Mixkit; individual cinematographer not identified on the item page','license':'Mixkit Stock Video Free License','licenseUrl':'https://mixkit.co/license/#videoFree','termsUrl':'https://mixkit.co/terms/','sourcePage':'https://mixkit.co/free-stock-video/a-serene-scene-of-the-forest-landscape-full-of-mossy-50854/','sourceFile':'https://assets.mixkit.co/videos/50854/50854-720.mp4'}),
    ('fire','fire-pexels-original.mp4',14,{'creator':'Joshua Woroniecki','license':'Pexels License','licenseUrl':'https://www.pexels.com/license/','termsUrl':'https://www.pexels.com/terms-of-service/','sourcePage':'https://www.pexels.com/video/mesmerizing-campfire-flames-at-night-30669823/','sourceFile':'https://videos.pexels.com/video-files/30669823/13124179_3840_2160_30fps.mp4'}),
]:
    original=source/filename
    working=original
    edits=['audio removed','24 fps','1280x640 centre crop','1 second overlap dissolve at loop boundary','H.264 and VP9; still poster from the first output frame']
    if key=='forest':
        transforms=source/'forest.trf';working=source/'forest-stable.mp4'
        relative=transforms.relative_to(root).as_posix()
        run('-i',original,'-vf',f'vidstabdetect=tripod=1:shakiness=5:accuracy=15:result={relative}','-an','-f','null','-')
        run('-i',original,'-vf',f'vidstabtransform=input={relative}:tripod=1:optzoom=1:zoom=3:interpol=bicubic','-an','-c:v','libx264','-preset','fast','-crf','18',working)
        edits.insert(0,'virtual tripod stabilization of small camera movement, static zoom and crop; no fabricated foliage motion')
    mp4=target/f'pantry-{key}-loop.mp4';webm=mp4.with_suffix('.webm');poster=target/f'pantry-{key}-v1.jpg'
    filters=f'[0:v]scale=1280:720,crop=1280:640,setsar=1,split=2[a][b];[a]trim=start=1:end={length},setpts=PTS-STARTPTS,fps=24[main];[b]trim=start=0:end=1,setpts=PTS-STARTPTS,fps=24[head];[main][head]xfade=transition=fade:duration=1:offset={length-2},format=yuv420p[out]'
    run('-i',working,'-filter_complex',filters,'-map','[out]','-an','-c:v','libx264','-preset','slow','-crf','22','-movflags','+faststart',mp4)
    run('-i',mp4,'-an','-c:v','libvpx-vp9','-b:v','0','-crf','34','-row-mt','1','-cpu-used','3',webm)
    run('-i',mp4,'-frames:v','1','-q:v','2',poster)
    metadata['items'].append({'id':key,**details,'originalSha256':sha(original),'edits':edits,'durationSeconds':length-1,'assets':{p.name:{'sha256':sha(p),'bytes':p.stat().st_size}for p in [mp4,webm,poster]}})
(target/'landscape-video.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'assets':[{item['id']:item['assets']}for item in metadata['items']]},ensure_ascii=False))
