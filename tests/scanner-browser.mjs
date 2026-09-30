import {chromium,expect} from '@playwright/test';
import QRCode from 'qrcode';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.testCamera={streams:[],urls:[]};
  navigator.mediaDevices.getUserMedia=async()=>{
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1280,720);
   const stream=canvas.captureStream(20);window.testCamera.streams.push(stream);
   const timer=setInterval(()=>{if(stream.getTracks().every(t=>t.readyState==='ended'))clearInterval(timer);else ctx.drawImage(canvas,0,0)},50);
   window.testCamera.draw=async(centerUrl,outerUrl)=>{
    ctx.fillStyle='#fff';ctx.fillRect(0,0,1280,720);
    const video=document.querySelector('#camera').getBoundingClientRect(),guide=document.querySelector('.live-scan-frame').getBoundingClientRect();
    const scale=Math.max(video.width/1280,video.height/720);
    const centerX=640+((guide.left+guide.width/2)-(video.left+video.width/2))/scale;
    const centerY=360+((guide.top+guide.height/2)-(video.top+video.height/2))/scale;
    for(const [url,x,y] of [[outerUrl,20,20],[centerUrl,centerX-110,centerY-110]])if(url){const image=new Image();image.src=url;await image.decode();ctx.drawImage(image,x,y,220,220)}
   };
   return stream;
  };
 });
 await page.goto('http://localhost:5173');
 const a=await QRCode.toDataURL('CAMERA-TICKET-A',{width:256}),b=await QRCode.toDataURL('CAMERA-TICKET-B',{width:256});
 await page.getByRole('button',{name:'Open camera',exact:true}).click();
 await expect(page.locator('#camera')).toBeVisible();
 await page.evaluate(()=>window.testCamera.originalVideo=document.querySelector('#camera'));
 // A is outside the visible guide. B is centred inside it.
 await page.evaluate(([a,b])=>window.testCamera.draw(b,a),[a,b]);
 await expect(page.getByRole('heading',{name:'Ticket scanned',exact:true})).toBeVisible();
 await expect(page.locator('.scan-receipt')).toContainText('CAMERA-TICKET-B');
 await expect(page.locator('.count')).toHaveText('1 / 300');
 expect(await page.evaluate(()=>window.testCamera.streams.length)).toBe(1);
 expect(await page.evaluate(()=>window.testCamera.streams[0].getVideoTracks()[0].readyState)).toBe('live');
 expect(await page.evaluate(()=>window.testCamera.originalVideo===document.querySelector('#camera'))).toBe(true);
 await page.getByRole('button',{name:'Scan next ticket'}).click();
 await expect(page.locator('#camera')).toBeVisible();
 await page.evaluate(b=>window.testCamera.draw(b),b);
 await expect(page.locator('#camera-status')).toContainText('Move the previous ticket');
 // Keep the old ticket visible long enough to catch an immediate re-scan.
 await page.waitForTimeout(900);
 await expect(page.locator('dialog[open]')).toHaveCount(0);
 await page.evaluate(a=>window.testCamera.draw(a),a);
 await expect(page.getByRole('heading',{name:'Ticket scanned',exact:true})).toBeVisible();
 await expect(page.locator('.scan-receipt')).toContainText('CAMERA-TICKET-A');
 await expect(page.locator('.count')).toHaveText('2 / 300');
 // Successful camera scans automatically resume without another click or stream.
 await expect(page.locator('dialog[open]')).toHaveCount(0,{timeout:3000});
 expect(await page.evaluate(()=>window.testCamera.streams.length)).toBe(1);
 expect(await page.evaluate(()=>window.testCamera.originalVideo===document.querySelector('#camera'))).toBe(true);
 await expect(page.locator('#camera')).toBeVisible();
 // After a clear frame the same ticket is correctly flagged as a duplicate.
 await page.evaluate(()=>window.testCamera.draw());await page.waitForTimeout(1100);
 await page.evaluate(a=>window.testCamera.draw(a),a);
 await expect(page.getByRole('heading',{name:'Already scanned',exact:true})).toBeVisible();
 await expect(page.locator('.count')).toHaveText('2 / 300');
 // Amber results stay up for review while the same camera stream remains live.
 await page.waitForTimeout(1600);
 await expect(page.getByRole('heading',{name:'Already scanned',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.testCamera.streams[0].getVideoTracks()[0].readyState)).toBe('live');
 await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Turn camera off',exact:true}).click();
 expect(await page.evaluate(()=>window.testCamera.streams[0].getVideoTracks()[0].readyState)).toBe('ended');
 await expect(page.getByRole('button',{name:'Open camera',exact:true})).toBeVisible();
 // The off control also works during green feedback and cancels auto-resume.
 await page.getByRole('button',{name:'Open camera',exact:true}).click();
 await expect(page.locator('#camera')).toBeVisible();
 await page.evaluate(url=>window.testCamera.draw(url),await QRCode.toDataURL('CAMERA-TICKET-C'));
 await expect(page.getByRole('heading',{name:'Ticket scanned',exact:true})).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Turn camera off',exact:true}).click();
 await page.waitForTimeout(1600);
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.evaluate(()=>window.testCamera.streams.at(-1).getVideoTracks()[0].readyState)).toBe('ended');
 await page.getByRole('button',{name:'Scan next ticket',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open camera',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.testCamera.streams.length)).toBe(2);
 // Two QRs in one uploaded image must require an explicit selection.
 const multi=await page.evaluate(async([a,b])=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=340;
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,640,340);
  for(const [url,x] of [[a,20],[b,350]]){const img=new Image();img.src=url;await img.decode();ctx.drawImage(img,x,30,256,256)}
  return canvas.toDataURL('image/png').split(',')[1];
 },[await QRCode.toDataURL('UPLOAD-TICKET-A'),await QRCode.toDataURL('UPLOAD-TICKET-B')]);
 await page.locator('#qr-upload').setInputFiles({name:'two-tickets.png',mimeType:'image/png',buffer:Buffer.from(multi,'base64')});
 await expect(page.getByRole('heading',{name:'Choose a ticket.'})).toBeVisible();
 await expect(page.locator('.count')).toHaveText('3 / 300');
 await page.getByRole('button',{name:/UPLOAD-TICKET-B/}).click();
 await expect(page.locator('.scan-receipt')).toContainText('UPLOAD-TICKET-B');
 await expect(page.locator('.count')).toHaveText('4 / 300');
 await page.getByRole('button',{name:'Scan next ticket'}).click();
 await page.locator('#qr-upload').setInputFiles({name:'two-tickets.png',mimeType:'image/png',buffer:Buffer.from(multi,'base64')});
 await page.getByRole('button',{name:/UPLOAD-TICKET-A/}).click();
 await expect(page.locator('.scan-receipt')).toContainText('UPLOAD-TICKET-A');
 await expect(page.locator('.count')).toHaveText('5 / 300');
 expect(errors).toEqual([]);
 console.log('PASS: one continuous camera stream, automatic next scan, previous-ticket guard, amber review, camera-off controls, guide crop and multi-QR upload.');
}finally{await browser.close()}
