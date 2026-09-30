import jsQR from 'jsqr';

// Match the visible guide to the video pixels, including object-fit: cover cropping.
export function guideCrop(videoWidth,videoHeight,videoRect,guideRect){
 const scale=Math.max(videoRect.width/videoWidth,videoRect.height/videoHeight);
 const hiddenX=(videoWidth-videoRect.width/scale)/2,hiddenY=(videoHeight-videoRect.height/scale)/2;
 const x=Math.max(0,hiddenX+(guideRect.left-videoRect.left)/scale);
 const y=Math.max(0,hiddenY+(guideRect.top-videoRect.top)/scale);
 return {x,y,width:Math.min(guideRect.width/scale,videoWidth-x),height:Math.min(guideRect.height/scale,videoHeight-y)};
}

// A resumed scanner must see a new ticket, or a clear frame before the same ticket.
// Brief detection gaps do not re-arm the previous code.
export function createScanGate(previousCode=null){
 let ignored=previousCode,candidate=null,since=0,clearSince=null;
 return {
  get waitingForRemoval(){return ignored!==null},
  read(code,now){
   if(!code){candidate=null;if(clearSince===null)clearSince=now;if(now-clearSince>=650)ignored=null;return null}
   clearSince=null;
   if(code===ignored){candidate=null;return null}
   if(code!==candidate){candidate=code;since=now;return null}
   if(now-since<200)return null;
   return code;
  }
 };
}

// jsQR returns one match. Mask each decoded QR so a ticket sheet can offer every
// distinct code for selection instead of silently choosing the first ticket.
export function imageQRCodes(imageData){
 const {width,height}=imageData,pixels=new Uint8ClampedArray(imageData.data),codes=[];
 const regions=[{x:0,y:0,width,height}];
 // Multiple finder patterns can confuse a single-code decoder. Overlapping
 // regions isolate the tickets, including codes crossing a half-image boundary.
 for(const axis of ['x','y'])for(const position of [0,.4])regions.push({x:axis==='x'?Math.floor(width*position):0,y:axis==='y'?Math.floor(height*position):0,width:axis==='x'?Math.ceil(width*.6):width,height:axis==='y'?Math.ceil(height*.6):height});
 for(const x of [0,.4])for(const y of [0,.4])regions.push({x:Math.floor(width*x),y:Math.floor(height*y),width:Math.ceil(width*.6),height:Math.ceil(height*.6)});
 let found=0;
 for(const region of regions){
  const rw=Math.min(region.width,width-region.x),rh=Math.min(region.height,height-region.y);
  while(found<12){
   const cropped=new Uint8ClampedArray(rw*rh*4);
   for(let row=0;row<rh;row++){const start=((region.y+row)*width+region.x)*4;cropped.set(pixels.subarray(start,start+rw*4),row*rw*4)}
   const decoded=jsQR(cropped,rw,rh);
   if(!decoded?.data)break;
   found++;
   if(!codes.includes(decoded.data))codes.push(decoded.data);
   const corners=['topLeftCorner','topRightCorner','bottomLeftCorner','bottomRightCorner'].map(key=>decoded.location[key]);
   const left=Math.max(0,region.x+Math.floor(Math.min(...corners.map(p=>p.x)))-2),right=Math.min(width,region.x+Math.ceil(Math.max(...corners.map(p=>p.x)))+2);
   const top=Math.max(0,region.y+Math.floor(Math.min(...corners.map(p=>p.y)))-2),bottom=Math.min(height,region.y+Math.ceil(Math.max(...corners.map(p=>p.y)))+2);
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=pixels[i+3]=255}
  }
 }
 return codes;
}
