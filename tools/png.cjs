// 최소 PNG 인코더(RGBA, filter 0) + 픽셀 크롭
const zlib=require('zlib');
const CRC=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}return b=>{let c=-1;for(const x of b)c=t[(c^x)&255]^(c>>>8);return (c^-1)>>>0;};})();
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(CRC(td));return Buffer.concat([len,td,crc]);}
function encodePNG(rgba,w,h){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function crop(rgba,W,H,x,y,w,h){const out=Buffer.alloc(w*h*4);for(let r=0;r<h;r++){const sy=y+r;if(sy<0||sy>=H)continue;rgba.copy(out,r*w*4,(sy*W+x)*4,(sy*W+x+w)*4);}return out;}
module.exports={encodePNG,crop};
