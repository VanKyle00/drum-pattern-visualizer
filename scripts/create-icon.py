from PIL import Image, ImageDraw
from pathlib import Path
out=Path("build")
out.mkdir(exist_ok=True)
im=Image.new("RGBA",(1024,1024),(0,0,0,0))
d=ImageDraw.Draw(im)
d.rounded_rectangle((16,16,1008,1008),radius=215,fill="#182333")
d.ellipse((188,188,836,836),fill="#79d4cb")
d.pieslice((217,217,807,807),180,360,fill="#182333")
im=im.resize((256,256),Image.Resampling.LANCZOS)
im.save(out/"icon.png")
im.save(out/"icon.ico",sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
