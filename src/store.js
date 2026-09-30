const first = ['Alex','Jordan','Sam','Taylor','Morgan','Jamie','Casey','Riley','Charlie','Robin','Avery','Cameron','Drew','Frankie','Harper','Jules','Kai','Lee','Quinn','Reese'];
const last = ['Morgan','Patel','Wilson','Chen','Campbell','Reid','Ahmed','Scott','Thompson','Clarke','Brown','Singh','Evans','Walker','Ross'];
export function createState() {
  const attendees = Array.from({length:300}, (_,i)=>({id:`DIBI-${String(i+1).padStart(4,'0')}`,name:`${first[i%20]} ${last[Math.floor(i/20)]}`,company:['Independent','Studio North','Made Thought','Fable','Brightside','Orbit'][i%6],type:i%17===0?'Speaker':'General admission',checkedIn:null}));
  attendees[0] = {...attendees[0],name:'Alex Morgan',company:'Studio North'};
  attendees[1] = {...attendees[1],name:'Priya Patel',company:'Fable'};
  attendees[2] = {...attendees[2],name:'Jamie Chen',company:'Independent'};
  const now = Date.now();
  for(let i=3;i<45;i++) attendees[i].checkedIn = new Date(now-(45-i)*47000).toISOString();
  return {version:1,attendees,queue:[],activity:attendees.filter(a=>a.checkedIn).slice(-5).reverse().map(a=>({id:a.id,name:a.name,time:a.checkedIn,method:'QR scan'}))};
}
export function findAttendee(state, raw) {
  // External payloads (including URLs) are case-sensitive and never opened.
  return state.attendees.find(a=>(a.qrCodes||[]).includes(raw)) ||
    state.attendees.find(a=>a.id===raw.trim().toUpperCase());
}
export function registerQR(state, raw, {attendeeId, name, company='', email=''}) {
  if(typeof raw!=='string'||!raw.trim()) throw new Error('Scan or enter a QR code first.');
  if(raw.length>8192) throw new Error('This QR code is too long to register.');
  const owner=findAttendee(state,raw);
  if((state.sharedQRCodes||[]).includes(raw)) throw new Error('This is a shared event QR. Use a name or individual ticket code to check in.');
  if(owner) throw new Error(`This QR code is already registered to ${owner.name}.`);
  let attendee;
  if(attendeeId) {
    attendee=state.attendees.find(a=>a.id===attendeeId);
    if(!attendee) throw new Error('Choose an attendee from the guest list.');
  } else {
    if(!name?.trim()) throw new Error('Enter the attendee’s name.');
    if(email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address or leave it blank.');
    let number=state.attendees.length+1;
    while(state.attendees.some(a=>a.id===`GUEST-${number}`)) number++;
    attendee={id:`GUEST-${number}`,name:name.trim(),company:company.trim(),email:email.trim(),detailsCollected:true,type:state.knownTickets?.[raw]?.type||'General admission',checkedIn:null};
    state.attendees.push(attendee);
  }
  attendee.qrCodes=[...(attendee.qrCodes||[]),raw];
  return attendee;
}
export function checkIn(state, raw, method='QR scan') {
  const id=raw;
  if((state.sharedQRCodes||[]).includes(raw)) return {status:'shared',id};
  const attendee=findAttendee(state,raw);
  if(!attendee) return {status:'unknown',id};
  if(attendee.checkedIn) return {status:'duplicate',attendee};
  attendee.checkedIn=new Date().toISOString();
  state.activity.unshift({id:attendee.id,name:attendee.name,time:attendee.checkedIn,method});
  state.queue=state.queue.filter(q=>q.ticket!==id&&q.ticket!==attendee.id&&!(attendee.qrCodes||[]).includes(q.ticket));
  return {status:'success',attendee};
}
export function addToQueue(state, result) {
 const ticket=result.attendee?.id||result.id;
 if(state.queue.some(q=>q.ticket===ticket)) return false;
 state.queue.push({ticket,name:result.attendee?.name||'Unrecognised ticket',reason:result.status==='duplicate'?'Already checked in':'Ticket not found',time:new Date().toISOString()});
 return true;
}

export function registerSharedQR(state, raw) {
  if(typeof raw!=='string'||!raw.trim()||raw.length>8192) throw new Error('Enter valid QR content (up to 8192 characters).');
  if(findAttendee(state,raw)) throw new Error('This QR is already assigned to an individual attendee.');
  state.sharedQRCodes=[...new Set([...(state.sharedQRCodes||[]),raw])];
}

export function createDeskState(legacy) {
  // Preserve earlier registrations, keeping the old demo dataset untouched.
  const attendees=(legacy?.attendees||[]).filter(a=>!a.id.startsWith('DIBI-')&&a.company!=='Provided event ticket').map(a=>({...a,qrCodes:[...(a.qrCodes||[])],detailsCollected:true}));
  const ids=new Set(attendees.map(a=>a.id));
  return {version:2,target:300,attendees,queue:[],sharedQRCodes:[...(legacy?.sharedQRCodes||[])],activity:(legacy?.activity||[]).filter(a=>ids.has(a.id)).map(a=>({...a})),knownTickets:{'DEMO-EB-001':{type:'Early Bird'},'DEMO-EB-002':{type:'Early Bird'}}};
}
export function updateGuestDetails(state,id,{name,email='',company=''}) {
  if(!name?.trim()) throw new Error('Enter the guest’s full name.');
  if(email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address or leave it blank.');
  const guest=state.attendees.find(a=>a.id===id);
  if(!guest) throw new Error('Guest not found.');
  Object.assign(guest,{name:name.trim(),email:email.trim(),company:company.trim(),detailsCollected:true});
  state.activity.filter(a=>a.id===id).forEach(a=>{a.name=guest.name});
  return guest;
}

// The desk logs supplied QR payloads directly. A first scan creates the record;
// a repeat returns its original timestamp without changing the attendance count.
export function recordTicketScan(state, raw, method='QR scan') {
  if(typeof raw!=='string'||!raw.trim()) throw new Error('No ticket code was read. Please scan again.');
  if(raw.length>8192) throw new Error('This QR is too long to record. Enter the printed ticket code instead.');
  if((state.sharedQRCodes||[]).includes(raw)) return {status:'shared',id:raw};
  let ticket=state.attendees.find(a=>(a.qrCodes||[]).includes(raw));
  if(!ticket) {
    let number=state.attendees.length+1;
    while(state.attendees.some(a=>a.id===`SCAN-${number}`)) number++;
    ticket={id:`SCAN-${number}`,name:/^[a-zA-Z0-9_-]{1,30}$/.test(raw)?`Ticket ${raw}`:`Ticket ${number}`,company:'',email:'',detailsCollected:false,type:state.knownTickets?.[raw]?.type||'Ticket',qrCodes:[raw],checkedIn:null};
    state.attendees.push(ticket);
  }
  return checkIn(state,raw,method);
}
