import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,checkIn,addToQueue} from '../src/store.js';
test('300 guests, check-in succeeds once and duplicate scans never increase attendance',()=>{const s=createState();assert.equal(s.attendees.length,300);const before=s.attendees.filter(a=>a.checkedIn).length;assert.equal(checkIn(s,' dibi-0001 ').status,'success');assert.equal(checkIn(s,'DIBI-0001').status,'duplicate');assert.equal(s.attendees.filter(a=>a.checkedIn).length,before+1)});
test('unknown ticket never grants entry and repeated help requests are deduplicated',()=>{const s=createState();const before=JSON.stringify(s.attendees);const r=checkIn(s,'malicious <ticket>');assert.equal(r.status,'unknown');assert.equal(JSON.stringify(s.attendees),before);assert.equal(addToQueue(s,r),true);assert.equal(addToQueue(s,r),false);assert.equal(s.queue.length,1)});
test('manual check-in resolves a matching pending issue and records staff action',()=>{const s=createState();addToQueue(s,{status:'unknown',id:'DIBI-0001'});checkIn(s,'DIBI-0001','Staff check-in');assert.equal(s.queue.length,0);assert.equal(s.activity[0].method,'Staff check-in')});

test('existing QR payloads preserve case, identify the assigned guest and prevent duplicates',async()=>{
 const {registerQR}=await import('../src/store.js');const s=createState();
 registerQR(s,'DEMO-EB-001',{attendeeId:'DIBI-0001'});
 assert.equal(checkIn(s,'demo-eb-001').status,'unknown');
 assert.equal(checkIn(s,'DEMO-EB-001').attendee.name,'Alex Morgan');
 assert.equal(checkIn(s,'DEMO-EB-001').status,'duplicate');
 assert.throws(()=>registerQR(s,'DEMO-EB-001',{attendeeId:'DIBI-0002'}),/already registered/);
 assert.equal(checkIn(s,'DIBI-0001').status,'duplicate');
});
test('booking URLs remain exact and registration for later does not admit anyone',async()=>{
 const {registerQR}=await import('../src/store.js');const s=createState();
 const raw='https://tickets.example/event?ticket=AbC&order=123';
 const a=registerQR(s,raw,{name:'New Guest',company:'Studio'});
 assert.equal(a.checkedIn,null);assert.equal(s.attendees.length,301);
 assert.equal(checkIn(s,raw.toLowerCase()).status,'unknown');
 addToQueue(s,{status:'unknown',id:raw});
 assert.equal(checkIn(s,raw).attendee.id,a.id);assert.equal(s.queue.length,0);
 assert.equal(checkIn(JSON.parse(JSON.stringify(s)),raw).status,'duplicate');
});
test('shared event QR opens lookup without checking anyone in',async()=>{
 const {registerQR,registerSharedQR}=await import('../src/store.js');const s=createState();const raw='https://event.example/check-in';
 registerSharedQR(s,raw);registerSharedQR(s,raw);
 const before=s.attendees.filter(a=>a.checkedIn).length;
 assert.equal(checkIn(s,raw).status,'shared');assert.equal(s.sharedQRCodes.length,1);
 assert.equal(s.attendees.filter(a=>a.checkedIn).length,before);
 assert.throws(()=>registerQR(s,raw,{attendeeId:'DIBI-0001'}),/shared event QR/);
 assert.throws(()=>registerSharedQR(s,'dibi-0001'),/individual attendee/);
});
test('invalid registration never creates a guest or changes ownership',async()=>{
 const {registerQR}=await import('../src/store.js');const s=createState();
 for(const [raw,details] of [['',{name:'A'}],['foo',{name:' '}],['foo',{attendeeId:'missing'}],['x'.repeat(8193),{name:'A'}]]) assert.throws(()=>registerQR(s,raw,details));
 assert.equal(s.attendees.length,300);
});

test('desk starts empty with supplied tickets ready for details collection',async()=>{
 const {createDeskState,registerQR}=await import('../src/store.js');const s=createDeskState();
 assert.equal(s.attendees.length,0);assert.equal(s.activity.length,0);
 assert.equal(checkIn(s,'DEMO-EB-001').status,'unknown');
 const a=registerQR(s,'DEMO-EB-001',{name:'Real Guest',email:'guest@example.com',company:'Studio'});
 assert.equal(a.type,'Early Bird');assert.equal(a.email,'guest@example.com');assert.equal(a.checkedIn,null);
 assert.equal(checkIn(s,'DEMO-EB-001').status,'success');assert.equal(checkIn(s,'DEMO-EB-001').status,'duplicate');
});
test('desk migration preserves named registrations without copying fake guests or ticket placeholders',async()=>{
 const {createDeskState,registerQR}=await import('../src/store.js');const legacy=createState();
 registerQR(legacy,'DEMO-EB-001',{name:'Ticket 1',company:'Provided event ticket'});
 registerQR(legacy,'real-code',{name:'Real Guest'});checkIn(legacy,'real-code');
 const before=JSON.stringify(legacy),desk=createDeskState(legacy);
 assert.equal(desk.attendees.length,1);assert.equal(desk.attendees[0].name,'Real Guest');
 assert.equal(desk.activity.length,1);assert.equal(JSON.stringify(legacy),before);
});
test('guest details can be corrected without changing ticket ownership or attendance',async()=>{
 const {createDeskState,registerQR,updateGuestDetails}=await import('../src/store.js');const s=createDeskState();
 const a=registerQR(s,'DEMO-EB-002',{name:'Guest'});checkIn(s,'DEMO-EB-002');const arrival=a.checkedIn;
 updateGuestDetails(s,a.id,{name:'Correct Name',email:'correct@example.com',company:'Team'});
 assert.equal(a.checkedIn,arrival);assert.equal(s.activity[0].name,'Correct Name');
 assert.equal(checkIn(s,'DEMO-EB-002').status,'duplicate');
 assert.throws(()=>updateGuestDetails(s,a.id,{name:'Guest',email:'invalid'}),/email/);
 assert.throws(()=>registerQR(s,'another',{name:'Guest',email:'invalid'}),/email/);
 assert.equal(s.attendees.length,1);
});

test('scan-only desk records each distinct supplied QR once without personal details',async()=>{
 const {createDeskState,recordTicketScan}=await import('../src/store.js');const s=createDeskState();
 const first=recordTicketScan(s,'DEMO-EB-001');const timestamp=first.attendee.checkedIn;
 assert.equal(first.status,'success');assert.equal(first.attendee.detailsCollected,false);assert.equal(first.attendee.email,'');
 assert.equal(recordTicketScan(s,'DEMO-EB-001').status,'duplicate');
 assert.equal(s.attendees[0].checkedIn,timestamp);assert.equal(s.activity.length,1);
 assert.equal(recordTicketScan(s,'DEMO-EB-002').status,'success');
 assert.equal(recordTicketScan(s,'BrandNew-Ticket').status,'success');
 assert.equal(s.attendees.length,3);
 assert.equal(recordTicketScan(JSON.parse(JSON.stringify(s)),'DEMO-EB-001').status,'duplicate');
});
test('scan-only identifiers are exact, including URLs, casing and generated record IDs',async()=>{
 const {createDeskState,recordTicketScan}=await import('../src/store.js');const s=createDeskState();
 for(const raw of ['CodeA','codea','https://tickets.example/A?x=1','https://tickets.example/a?x=1','SCAN-1']) assert.equal(recordTicketScan(s,raw).status,'success');
 assert.equal(s.attendees.length,5);assert.equal(s.attendees[4].qrCodes[0],'SCAN-1');
 for(const raw of ['CodeA','codea','https://tickets.example/A?x=1','https://tickets.example/a?x=1','SCAN-1']) assert.equal(recordTicketScan(s,raw).status,'duplicate');
});
test('300 unique tickets can be logged without double-counting any repeat',async()=>{
 const {createDeskState,recordTicketScan}=await import('../src/store.js');const s=createDeskState();
 for(let i=0;i<300;i++) assert.equal(recordTicketScan(s,`EVENT-${i}`).status,'success');
 for(let i=0;i<300;i++) assert.equal(recordTicketScan(s,`EVENT-${i}`).status,'duplicate');
 assert.equal(s.attendees.filter(a=>a.checkedIn).length,300);assert.equal(s.activity.length,300);
});
test('invalid scans and configured shared QR values do not add a ticket',async()=>{
 const {createDeskState,recordTicketScan,registerSharedQR}=await import('../src/store.js');const s=createDeskState();
 for(const raw of ['', ' ', null, 'x'.repeat(8193)]) assert.throws(()=>recordTicketScan(s,raw));
 registerSharedQR(s,'https://event.example/shared');
 assert.equal(recordTicketScan(s,'https://event.example/shared').status,'shared');
 assert.equal(s.attendees.length,0);
});
