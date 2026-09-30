import {chromium,expect} from '@playwright/test';
import QRCode from 'qrcode';

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const sizes=[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:932}];
try {
 for(const viewport of sizes){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:5173');
  const fitsScreen=async locator=>{
   const box=await locator.boundingBox();
   expect(box).not.toBeNull();
   expect(box.x).toBeGreaterThanOrEqual(0);
   expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);
   expect(box.y).toBeGreaterThanOrEqual(0);
   expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);
  };
  await fitsScreen(page.getByRole('button',{name:'Open camera'}));
  await fitsScreen(page.locator('nav'));
  const navBox=await page.locator('nav').boundingBox();
  expect(Math.round(navBox.y+navBox.height)).toBe(viewport.height);
  for(const button of await page.locator('nav button').all()){
   expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(48);
  }
  await page.screenshot({animations:'disabled',path:`/private/tmp/dibi-mobile-${viewport.width}.png`,fullPage:true});

  // A real QR image exercises decoding, recording and the mobile result together.
  const code='MOBILE-CASE-Sensitive-001';
  await page.locator('#qr-upload').setInputFiles({name:'ticket.png',mimeType:'image/png',buffer:await QRCode.toBuffer(code)});
  await expect(page.getByRole('heading',{name:'Ticket scanned',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-tone','success');
  const resultBox=await page.getByRole('dialog').boundingBox();
  expect(resultBox).toEqual({x:0,y:0,width:viewport.width,height:viewport.height});
  await page.screenshot({animations:'disabled',path:`/private/tmp/dibi-success-${viewport.width}.png`});
  await fitsScreen(page.getByRole('button',{name:'Scan next ticket',exact:true}));
  await page.getByRole('button',{name:'Scan next ticket',exact:true}).tap();
  await page.getByRole('button',{name:'Enter ticket code'}).tap();
  const input=page.getByLabel('Ticket code',{exact:true});
  expect(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await expect(input).toHaveAttribute('autocapitalize','none');
  await input.fill(code);
  await page.getByRole('button',{name:'Check ticket',exact:true}).tap();
  await expect(page.getByRole('heading',{name:'Already scanned',exact:true})).toBeVisible();
  await expect(page.locator('.count')).toHaveText('1 / 300');
  await expect(page.getByRole('dialog')).toHaveAttribute('data-tone','duplicate');
  await page.screenshot({animations:'disabled',path:`/private/tmp/dibi-amber-${viewport.width}.png`});
  await fitsScreen(page.getByRole('button',{name:'Scan next ticket',exact:true}));
  await fitsScreen(page.getByRole('button',{name:'Send to help queue'}));
  await page.getByRole('button',{name:'Scan next ticket',exact:true}).tap();

  // Long payloads must never bury the next ticket action or widen the scan log.
  await page.getByRole('button',{name:'Enter ticket code'}).tap();
  await input.fill('https://tickets.example/event/'+ 'long-ticket-reference-'.repeat(100));
  await page.getByRole('button',{name:'Check ticket',exact:true}).tap();
  await page.screenshot({animations:'disabled',path:'/private/tmp/dibi-long-result.png'});
  await fitsScreen(page.getByRole('button',{name:'Scan next ticket',exact:true}));
  await page.getByRole('dialog').getByRole('button',{name:'View scan log',exact:true}).tap();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.table-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.getByRole('searchbox').fill(code);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.screenshot({animations:'disabled',path:`/private/tmp/dibi-mobile-log-${viewport.width}.png`,fullPage:true});
  await page.getByRole('button',{name:'View ticket',exact:true}).tap();
  await page.getByRole('button',{name:'Add guest details (optional)'}).tap();
  // Simulate the reduced visible space of a keyboard, then rotate to landscape.
  await page.setViewportSize({width:viewport.width,height:360});
  await page.getByLabel('Full name').fill('Mobile Guest');
  await page.getByRole('button',{name:'Save details',exact:true}).tap();
  await expect(page.locator('tbody')).toContainText('Mobile Guest');
  await page.locator('nav').getByRole('button',{name:'Check-in',exact:true}).tap();
  await page.setViewportSize({width:667,height:375});
  await page.getByRole('button',{name:'Enter ticket code'}).tap();
  await input.fill(code);
  await page.getByRole('button',{name:'Check ticket',exact:true}).tap();
  const landscapeAction=await page.getByRole('button',{name:'Scan next ticket',exact:true}).boundingBox();
  expect(landscapeAction.y).toBeGreaterThanOrEqual(0);
  expect(landscapeAction.y+landscapeAction.height).toBeLessThanOrEqual(375);
  await page.getByRole('button',{name:'Scan next ticket',exact:true}).tap();
  await page.setViewportSize(viewport);
  await page.locator('#qr-upload').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await expect(page.getByRole('heading',{name:'Image not readable'})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-tone','error');
  await fitsScreen(page.getByRole('button',{name:'Upload another image'}));
  await expect(page.locator('.count')).toHaveText('2 / 300');
  await page.screenshot({animations:'disabled',path:`/private/tmp/dibi-error-${viewport.width}.png`});
  await page.getByRole('dialog').getByRole('button',{name:'Enter ticket code',exact:true}).tap();
  await expect(page.getByRole('dialog')).not.toHaveClass(/status-screen/);
  await page.getByRole('button',{name:'Close dialog'}).tap();
  const blankImage=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=200;return canvas.toDataURL('image/png').split(',')[1]});
  await page.locator('#qr-upload').setInputFiles({name:'no-qr.png',mimeType:'image/png',buffer:Buffer.from(blankImage,'base64')});
  await expect(page.getByRole('heading',{name:'QR not found',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-tone','error');
  await expect(page.locator('.count')).toHaveText('2 / 300');
  await page.getByRole('button',{name:'Back to scanner'}).tap();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#qr-upload').setInputFiles({name:'empty-ticket.png',mimeType:'image/png',buffer:await QRCode.toBuffer(' ')});
  await expect(page.getByRole('heading',{name:'Scan failed',exact:true})).toBeVisible();
  expect(await page.locator('.result-symbol').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await expect(page.locator('.count')).toHaveText('2 / 300');
  await page.getByRole('button',{name:'Back to scanner'}).tap();
  expect(errors).toEqual([]);
  await context.close();
  console.log(`PASS mobile ${viewport.width}×${viewport.height}: touch navigation, QR image, duplicate, long QR, scan log, details, landscape, full-screen colours, failures and reduced motion.`);
 }
}finally{await browser.close()}
