import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {guideCrop,createScanGate,imageQRCodes} from '../src/scanner.js';

test('the guide maps to the visible object-fit cover region, not the entire camera',()=>{
 const crop=guideCrop(1280,720,{left:20,top:200,width:350,height:380},{left:120,top:290,width:150,height:150});
 assert.ok(Math.abs(crop.x-497.89473684210526)<.001);
 assert.ok(Math.abs(crop.y-170.5263157894737)<.001);
 assert.ok(Math.abs(crop.width-284.2105263157895)<.001);
 assert.ok(Math.abs(crop.height-284.2105263157895)<.001);
});
test('next scan ignores the old QR still in view but accepts a different stable QR',()=>{
 const gate=createScanGate('TICKET-A');
 assert.equal(gate.read('TICKET-A',0),null);
 assert.equal(gate.read('TICKET-A',1000),null);
 assert.equal(gate.read('TICKET-B',1100),null);
 assert.equal(gate.read('TICKET-B',1260),null);
 assert.equal(gate.read('TICKET-B',1420),'TICKET-B');
});
test('a momentary missed frame cannot re-scan the old ticket; removing it can',()=>{
 const gate=createScanGate('TICKET-A');
 gate.read(null,0);gate.read(null,160);
 assert.equal(gate.read('TICKET-A',320),null);
 gate.read(null,500);gate.read(null,1200);
 assert.equal(gate.read('TICKET-A',1300),null);
 assert.equal(gate.read('TICKET-A',1620),'TICKET-A');
});
test('unstable alternating codes are not recorded',()=>{
 const gate=createScanGate();
 for(let i=0;i<8;i++)assert.equal(gate.read(i%2?'A':'B',i*160),null);
});
test('an uploaded ticket sheet returns both distinct QR values without changing the image',()=>{
 const width=800,height=500,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const [value,x,y] of [['TICKET-A',30,30],['TICKET-B',440,180]]){
  const {modules}=QRCode.create(value),scale=8;
  for(let row=0;row<modules.size;row++)for(let col=0;col<modules.size;col++)if(modules.get(row,col)){
   for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
    const offset=((y+row*scale+dy)*width+x+col*scale+dx)*4;
    data[offset]=data[offset+1]=data[offset+2]=0;
   }
  }
 }
 const original=new Uint8ClampedArray(data);
 assert.deepEqual(imageQRCodes({data,width,height}).sort(),['TICKET-A','TICKET-B']);
 assert.deepEqual(data,original);
});
