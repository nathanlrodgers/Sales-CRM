import { useState, useRef, useEffect } from "react";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://zyhuaehubpndqokrcltq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5aHVhZWh1YnBuZHFva3JjbHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzkyODQsImV4cCI6MjA4OTk1NTI4NH0.Ez9raNWvvD0KkIW1yk5CcXBywEFNj29orBTMu9NV9Mo";

const sb = {
  async get(table) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    return r.json();
  },
  async upsert(table, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(data)
    });
  },
  async delete(table, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  },
  async deleteWhere(table, col, val) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  }
};

// ─── DB HELPERS ───────────────────────────────────────────────────────────────
// Convert snake_case DB row → camelCase app object
const fromDB = {
  prospect: r => ({
    id: r.id, company: r.company, contact: r.contact, title: r.title,
    email: r.email, phone: r.phone, linkedin: r.linkedin, status: r.status,
    owner: r.owner, source: r.source, angle: r.angle, nextFollowUp: r.next_follow_up,
    ghostedReason: r.ghosted_reason, ghostedNotes: r.ghosted_notes, notes: r.notes,
    tags: r.tags||[], touches: r.touches||[], sequences: r.sequences||[],
    secondaryContacts: r.secondary_contacts||[],
    createdAt: r.created_at, lastActivity: r.last_activity
  }),
  lead: r => ({
    id: r.id, company: r.company, contact: r.contact, title: r.title,
    email: r.email, phone: r.phone, linkedin: r.linkedin, status: r.status,
    owner: r.owner, source: r.source, notes: r.notes,
    tags: r.tags||[], secondaryContacts: r.secondary_contacts||[],
    createdAt: r.created_at, lastActivity: r.last_activity
  }),
  deal: r => ({
    id: r.id, company: r.company, contact: r.contact, email: r.email,
    arr: r.arr, stageId: r.stage_id, owner: r.owner, nrrType: r.nrr_type,
    ttfv: r.ttfv, health: r.health, source: r.source, closeDate: r.close_date,
    notes: r.notes, nextAction: r.next_action, nextActionDue: r.next_action_due,
    winLossReason: r.win_loss_reason, tags: r.tags||[],
    lastActivity: r.last_activity, createdAt: r.created_at
  }),
  activity: r => ({
    id: r.id, dealId: r.deal_id, company: r.company, type: r.type,
    title: r.title, dueDate: r.due_date, owner: r.owner, done: r.done, notes: r.notes
  }),
  activityLog: r => ({ id: r.id, dealId: r.deal_id, type: r.type, author: r.author, text: r.text, ts: r.ts }),
  email: r => ({ id: r.id, dealId: r.deal_id, from: r.from_address, to: r.to_address, subject: r.subject, body: r.body, direction: r.direction, read: r.read, ts: r.ts }),
  stageHistory: r => ({ id: r.id, dealId: r.deal_id, stageId: r.stage_id, enteredAt: r.entered_at })
};

const toDB = {
  prospect: p => ({
    id: p.id, company: p.company, contact: p.contact, title: p.title,
    email: p.email, phone: p.phone||"", linkedin: p.linkedin||"", status: p.status,
    owner: p.owner, source: p.source, angle: p.angle||"", next_follow_up: p.nextFollowUp||null,
    ghosted_reason: p.ghostedReason||null, ghosted_notes: p.ghostedNotes||"", notes: p.notes||"",
    tags: p.tags||[], touches: p.touches||[], sequences: p.sequences||[],
    secondary_contacts: p.secondaryContacts||[], last_activity: p.lastActivity||new Date().toISOString()
  }),
  lead: l => ({
    id: l.id, company: l.company, contact: l.contact, title: l.title||"",
    email: l.email||"", phone: l.phone||"", linkedin: l.linkedin||"", status: l.status,
    owner: l.owner, source: l.source, notes: l.notes||"",
    tags: l.tags||[], secondary_contacts: l.secondaryContacts||[],
    last_activity: l.lastActivity||new Date().toISOString()
  }),
  deal: d => ({
    id: d.id, company: d.company, contact: d.contact||"", email: d.email||"",
    arr: d.arr||null, stage_id: d.stageId, owner: d.owner, nrr_type: d.nrrType,
    ttfv: d.ttfv, health: d.health, source: d.source, close_date: d.closeDate||null,
    notes: d.notes||"", next_action: d.nextAction||"", next_action_due: d.nextActionDue||null,
    win_loss_reason: d.winLossReason||"", tags: d.tags||[],
    last_activity: d.lastActivity||new Date().toISOString()
  }),
  activity: a => ({
    id: a.id, deal_id: a.dealId||null, company: a.company||"", type: a.type,
    title: a.title, due_date: a.dueDate||null, owner: a.owner, done: a.done||false, notes: a.notes||""
  }),
  activityLog: (l, dealId) => ({ id: l.id, deal_id: dealId, type: l.type, author: l.author, text: l.text, ts: l.ts }),
  email: (e, dealId) => ({ id: e.id, deal_id: dealId, from_address: e.from, to_address: e.to, subject: e.subject, body: e.body, direction: e.direction, read: e.read||true, ts: e.ts }),
  stageHistory: (h, dealId) => ({ deal_id: dealId, stage_id: h.stageId, entered_at: h.enteredAt })
};


const P={navy:"#1E3A5F",crimson:"#701427",tan:"#C4B5A6",silver:"#D6D3D1",fog:"#F5F5F5",white:"#FFFFFF",text:"#1C2B3A",muted:"#7A8699",green:"#1A5C3A",amber:"#7C4D00",error:"#9B1A1A"};
const DEFAULT_STAGES=[{id:"s1",name:"Prospecting",color:"#7A8699",rotDays:7},{id:"s2",name:"Discovery",color:"#1E3A5F",rotDays:10},{id:"s3",name:"Proposal",color:"#7C4D00",rotDays:14},{id:"s4",name:"Negotiation",color:"#701427",rotDays:10},{id:"s5",name:"Closed Won",color:"#1A5C3A",rotDays:null},{id:"s6",name:"Closed Lost",color:"#9CA3AF",rotDays:null}];
const NRR_TYPES=["New Logo","Expansion","Churn Save","Renewal"];
const TTFV_STAGES=["Not Started","Onboarding","First Value","Adopted","Expanding"];
const HEALTH=["green","yellow","red"];
const OWNERS=["Nate R.","Stephen"];
const ACT_TYPES=["Note","Call","Email","Meeting","Demo","Follow-up","Task"];
const TAG_PRESETS=["strategic","at-risk","partner-led","upsell-blocker","champion-strong","multi-thread","legal-hold","fast-track"];
const SOURCES=["Inbound","Outbound","Referral","Partner","Event","Cold Email","LinkedIn"];
const LEAD_STATUS=["New","Contacted","Qualified","Disqualified"];
const PROSPECT_STATUS=["Not Contacted","Emailed","Followed Up","Responded","Booked Meeting","Ghosted"];
const PROSPECT_STATUS_COLORS={"Not Contacted":"#7A8699","Emailed":"#1E3A5F","Followed Up":"#7C4D00","Responded":"#5B3A8A","Booked Meeting":"#1A5C3A","Ghosted":"#D6D3D1"};
const TOUCH_TYPES=["Email","LinkedIn","Call","Other"];
const ACT_META={"Note":{icon:"📝",color:"#7A8699"},"Call":{icon:"📞",color:"#1E3A5F"},"Email":{icon:"✉️",color:"#7C4D00"},"Meeting":{icon:"👥",color:"#701427"},"Demo":{icon:"🖥️",color:"#1A5C3A"},"Follow-up":{icon:"🔁",color:"#5B3A8A"},"Task":{icon:"✅",color:"#7C4D00"}};
const STATUS_COLORS={New:"#1E3A5F",Contacted:"#7C4D00",Qualified:"#1A5C3A",Disqualified:"#7A8699"};
const DEFAULT_AUTOMATIONS=[{id:"a1",active:true,name:"Follow-up after Discovery",trigger:"stage_enter",triggerStageId:"s2",action:"create_activity",actionType:"Follow-up",actionNote:"Follow up on discovery findings",delayDays:1},{id:"a2",active:true,name:"Proposal email reminder",trigger:"stage_enter",triggerStageId:"s3",action:"create_activity",actionType:"Email",actionNote:"Send proposal and confirm receipt",delayDays:0},{id:"a3",active:false,name:"Flag health on Negotiation",trigger:"stage_enter",triggerStageId:"s4",action:"set_health",actionType:"yellow",actionNote:"",delayDays:0},{id:"a4",active:true,name:"Kick-off task on Close Won",trigger:"stage_enter",triggerStageId:"s5",action:"create_activity",actionType:"Task",actionNote:"Schedule onboarding kick-off",delayDays:0}];

function daysAgo(d){return Math.floor((Date.now()-new Date(d))/86400000);}
function fmtCurrency(n){if(!n)return"—";return"$"+Number(n).toLocaleString();}
function uid(){return Math.random().toString(36).slice(2,9);}
function fmtDate(iso){return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});}
function fmtTime(iso){return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});}
function addDays(iso,n){return new Date(new Date(iso).getTime()+n*86400000).toISOString();}
const ago=d=>new Date(Date.now()-d*86400000).toISOString();
const future=d=>new Date(Date.now()+d*86400000).toISOString();

const INP={background:"#fff",border:"1.5px solid #D6D3D1",borderRadius:8,color:"#1C2B3A",padding:"9px 13px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit",transition:"border-color 0.2s"};
const SEL={...INP};
const LBL={fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",display:"block",marginBottom:6};
const CARD={background:"#fff",borderRadius:12,border:"1px solid #D6D3D1",boxShadow:"0 1px 4px rgba(30,58,95,0.06)"};
const BP={background:"#701427",border:"none",color:"#fff",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",boxShadow:"0 2px 8px #70142744"};
const BG={background:"transparent",border:"1.5px solid #D6D3D1",color:"#1C2B3A",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"};

const SD=[];
const SL=[];

function HealthDot({health,size=9}){
  const c=health==="green"?"#1A5C3A":health==="yellow"?"#7C4D00":"#9B1A1A";
  const bg=health==="green"?"#D1FAE5":health==="yellow"?"#FEF3C7":"#FEE2E2";
  return <span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",background:c,outline:`2.5px solid ${bg}`,outlineOffset:1,flexShrink:0}}/>;
}
function Tag({label,onRemove}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,background:"#C4B5A615",color:"#1E3A5Fcc",border:"1px solid #C4B5A666",borderRadius:20,padding:"2px 9px",fontWeight:600}}>{label}{onRemove&&<span onClick={onRemove} style={{cursor:"pointer",opacity:.5,fontSize:12}}>×</span>}</span>;
}
function Badge({children,color,bg}){const c=color||"#1E3A5F";return <span style={{fontSize:11,background:bg||(c+"14"),color:c,borderRadius:5,padding:"2px 8px",fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>;}
function Avatar({name,size=28}){
  const cols=["#1E3A5F","#701427","#5B3A8A","#1A5C3A","#7C4D00"];
  const i=(name||"?").charCodeAt(0)%cols.length;
  return <div style={{width:size,height:size,borderRadius:"50%",background:cols[i],color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,flexShrink:0}}>{(name||"?")[0]}</div>;
}
function MentionText({text}){
  const parts=(text||"").split(/(@\w[\w\s.]*\b)/g);
  return <span>{parts.map((p,i)=>p.startsWith("@")?<span key={i} style={{background:"#1E3A5F14",color:"#1E3A5F",borderRadius:4,padding:"1px 4px",fontWeight:700}}>{p}</span>:p)}</span>;
}
function SectionHeader({title,subtitle,action}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24}}>
      <div>
        <h2 style={{margin:0,color:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif",fontSize:24,fontWeight:700,lineHeight:1.1}}>{title}</h2>
        {subtitle&&<p style={{margin:"4px 0 0",color:"#7A8699",fontSize:13}}>{subtitle}</p>}
      </div>
      {action&&<div>{action}</div>}
    </div>
  );
}
function StatCard({label,value,sub,color,icon}){
  return(
    <div style={{...CARD,padding:"20px 22px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:.05,pointerEvents:"none"}}>{icon}</div>
      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:8}}>{label}</div>
      <div style={{fontSize:26,fontWeight:800,color:color||"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:12,color:"#7A8699",marginTop:6}}>{sub}</div>}
    </div>
  );
}

function TagEditor({tags=[],onChange}){
  const [input,setInput]=useState("");const [open,setOpen]=useState(false);
  const sugg=TAG_PRESETS.filter(t=>!tags.includes(t)&&t.includes(input.toLowerCase()));
  const add=t=>{const c=t.trim().toLowerCase().replace(/\s+/g,"-");if(c&&!tags.includes(c))onChange([...tags,c]);setInput("");setOpen(false);};
  return(
    <div style={{gridColumn:"1/-1"}}>
      <span style={LBL}>Tags</span>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>{tags.map(t=><Tag key={t} label={t} onRemove={()=>onChange(tags.filter(x=>x!==t))}/>)}</div>
      <div style={{position:"relative",display:"inline-block"}}>
        <input value={input} onChange={e=>{setInput(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)} onKeyDown={e=>{if(e.key==="Enter"&&input.trim()){e.preventDefault();add(input);}}} placeholder="+ add tag…" style={{...INP,width:160,fontSize:12}}/>
        {open&&sugg.length>0&&<div style={{position:"absolute",top:"110%",left:0,background:"#fff",border:"1px solid #D6D3D1",borderRadius:8,zIndex:50,minWidth:200,boxShadow:"0 8px 24px rgba(30,58,95,0.12)"}}>
          {sugg.slice(0,6).map(s=><div key={s} onMouseDown={()=>add(s)} style={{padding:"8px 14px",cursor:"pointer",color:"#1C2B3A",fontSize:13}} onMouseEnter={e=>e.currentTarget.style.background="#F5F5F5"} onMouseLeave={e=>e.currentTarget.style.background=""}>{s}</div>)}
        </div>}
      </div>
    </div>
  );
}

function ActivityLog({dealId,activityLogs,setActivityLogs}){
  const [type,setType]=useState("Note");const [text,setText]=useState("");const [author,setAuthor]=useState(OWNERS[0]);
  const [mention,setMention]=useState(null);const textRef=useRef();
  const entries=activityLogs[dealId]||[];
  const handleChange=e=>{const val=e.target.value;setText(val);const m=val.slice(0,e.target.selectionStart).match(/@(\w*)$/);setMention(m?{filter:m[1].toLowerCase()}:null);};
  const insertMention=name=>{const c=textRef.current.selectionStart;setText(text.slice(0,c).replace(/@\w*$/,"@"+name+" ")+text.slice(c));setMention(null);textRef.current.focus();};
  const addEntry=()=>{if(!text.trim())return;setActivityLogs(p=>({...p,[dealId]:[{id:uid(),type,author,text:text.trim(),ts:new Date().toISOString()},...(p[dealId]||[])]}));setText("");setMention(null);};
  const mOwners=mention?OWNERS.filter(o=>o.toLowerCase().startsWith(mention.filter)):[];
  return(
    <div>
      <div style={{...CARD,padding:16,marginBottom:20}}>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {ACT_TYPES.map(t=>{const m=ACT_META[t];return <button key={t} onClick={()=>setType(t)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:type===t?700:500,background:type===t?(m.color+"14"):"transparent",border:"1.5px solid "+(type===t?m.color:"#D6D3D1"),color:type===t?m.color:"#7A8699",fontFamily:"inherit"}}>{m.icon} {t}</button>;})}
        </div>
        <div style={{display:"flex",gap:10}}>
          <select value={author} onChange={e=>setAuthor(e.target.value)} style={{...SEL,width:120,flexShrink:0,fontSize:12}}>{OWNERS.map(o=><option key={o}>{o}</option>)}</select>
          <div style={{position:"relative",flex:1}}>
            <textarea ref={textRef} rows={2} value={text} onChange={handleChange} placeholder={"Log a "+type.toLowerCase()+"… @Name to mention"} style={{...INP,resize:"none",lineHeight:1.5}}/>
            {mention&&mOwners.length>0&&<div style={{position:"absolute",left:0,top:"100%",background:"#fff",border:"1px solid #D6D3D1",borderRadius:8,zIndex:20,minWidth:180,boxShadow:"0 8px 24px rgba(30,58,95,0.12)"}}>
              {mOwners.map(o=><div key={o} onMouseDown={()=>insertMention(o)} style={{padding:"8px 14px",cursor:"pointer",color:"#1C2B3A",fontSize:13,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#F5F5F5"} onMouseLeave={e=>e.currentTarget.style.background=""}><Avatar name={o} size={22}/>{o}</div>)}
            </div>}
          </div>
          <button onClick={addEntry} style={BP}>Log</button>
        </div>
      </div>
      {entries.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:"#7A8699",fontSize:13}}>No activity logged yet.</div>}
      {entries.map((e,i)=>{const m=ACT_META[e.type]||ACT_META.Note;return(
        <div key={e.id} style={{display:"flex",gap:14}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:m.color+"12",border:"1.5px solid "+m.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{m.icon}</div>
            {i<entries.length-1&&<div style={{width:1.5,flex:1,background:"#D6D3D1",minHeight:16,margin:"4px 0"}}/>}
          </div>
          <div style={{flex:1,paddingBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:m.color,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em"}}>{e.type}</span><span style={{color:"#1C2B3A",fontSize:13,fontWeight:600}}>{e.author}</span></div>
              <span style={{color:"#7A8699",fontSize:11}}>{fmtDate(e.ts)} · {fmtTime(e.ts)}</span>
            </div>
            <div style={{color:"#1C2B3A",fontSize:13,lineHeight:1.6}}><MentionText text={e.text}/></div>
          </div>
        </div>
      );})}
    </div>
  );
}

function EmailPanel({deal,emails,setEmails}){
  const [compose,setCompose]=useState(false);
  const [to,setTo]=useState(deal.email||"");const [subject,setSubject]=useState("");const [body,setBody]=useState("");
  const thread=emails[deal.id]||[];
  const send=()=>{if(!body.trim())return;setEmails(e=>({...e,[deal.id]:[...(e[deal.id]||[]),{id:uid(),from:"me@co.com",to,subject:subject||"(no subject)",body,ts:new Date().toISOString(),direction:"outbound",read:true}]}));setCompose(false);setTo(deal.email||"");setSubject("");setBody("");};
  const TMPL=[
    {label:"TTFV Check-in",subject:"Checking in on your value journey",body:"Hi "+deal.contact+",\n\nWanted to check in on your TTFV journey. Any blockers we can help remove?\n\nBest,"},
    {label:"NRR Opportunity",subject:"Expansion opportunity for your team",body:"Hi "+deal.contact+",\n\nI see a real NRR expansion opportunity here. Love 20 min to walk through the numbers.\n\nBest,"},
    {label:"Follow-up",subject:"Following up",body:"Hi "+deal.contact+",\n\nFollowing up on our last conversation. Happy to answer any questions.\n\nBest,"},
  ];
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>setCompose(c=>!c)} style={BP}>✉️ Compose</button>
        {TMPL.map(t=><button key={t.label} onClick={()=>{setCompose(true);setSubject(t.subject);setBody(t.body);setTo(deal.email||"");}} style={{...BG,fontSize:12,padding:"7px 12px"}}>{t.label}</button>)}
      </div>
      {compose&&(
        <div style={{...CARD,padding:20,marginBottom:16}}>
          {[["To",to,setTo,"email"],["Subject",subject,setSubject,"text"]].map(([l,v,fn,type])=>(
            <div key={l} style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
              <span style={{...LBL,margin:0,width:52,textAlign:"right",flexShrink:0}}>{l}</span>
              <input type={type} value={v} onChange={e=>fn(e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
            </div>
          ))}
          <textarea rows={5} value={body} onChange={e=>setBody(e.target.value)} style={{...INP,resize:"vertical",lineHeight:1.6,marginBottom:12}}/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>setCompose(false)} style={BG}>Cancel</button>
            <button onClick={send} style={BP}>Send</button>
          </div>
        </div>
      )}
      {thread.length===0&&!compose&&<div style={{textAlign:"center",padding:"32px 0",color:"#7A8699",fontSize:13}}>No emails yet.</div>}
      {[...thread].reverse().map(e=>(
        <div key={e.id} style={{...CARD,padding:"14px 18px",marginBottom:10,borderLeft:"3px solid "+(e.direction==="inbound"?"#1E3A5F":"#C4B5A6")}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,fontWeight:700,color:e.direction==="inbound"?"#1E3A5F":"#7A8699",textTransform:"uppercase",letterSpacing:"0.07em"}}>{e.direction==="inbound"?"↙ Received":"↗ Sent"}</span>
              <span style={{color:"#1C2B3A",fontSize:13,fontWeight:600}}>{e.subject}</span>
              {!e.read&&e.direction==="inbound"&&<span style={{width:7,height:7,borderRadius:"50%",background:"#701427",display:"inline-block"}}/>}
            </div>
            <span style={{color:"#7A8699",fontSize:11}}>{fmtDate(e.ts)}</span>
          </div>
          <div style={{color:"#7A8699",fontSize:11,marginBottom:6}}>{e.direction==="inbound"?"From: "+e.from:"To: "+e.to}</div>
          <div style={{color:"#1C2B3A",fontSize:13,lineHeight:1.7,whiteSpace:"pre-line"}}>{e.body}</div>
        </div>
      ))}
    </div>
  );
}

function DealModal({deal,stages,activityLogs,setActivityLogs,emails,setEmails,onSave,onDelete,onClone,onClose}){
  const isNew=!deal.id;
  const [form,setForm]=useState({...deal,tags:deal.tags||[]});
  const [tab,setTab]=useState("details");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const actCount=(activityLogs[deal.id]||[]).length;
  const unread=(emails[deal.id]||[]).filter(e=>!e.read&&e.direction==="inbound").length;
  const TABS=isNew?[{id:"details",label:"Details"}]:[{id:"details",label:"Details"},{id:"activity",label:"Activity"+(actCount>0?" ("+actCount+")":"")},{id:"email",label:"Email"+(unread>0?" · "+unread+" new":"")}];
  const stage=stages.find(s=>s.id===form.stageId);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(30,58,95,0.3)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:700,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(30,58,95,0.2)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"24px 28px 0",borderBottom:"1px solid #D6D3D1"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              {stage&&<div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:stage.color,marginBottom:4}}>{stage.name}</div>}
              <h2 style={{margin:0,color:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif",fontSize:24,fontWeight:700}}>{isNew?"New Deal":form.company||"Untitled"}</h2>
              {!isNew&&form.arr&&<div style={{color:"#701427",fontSize:15,fontWeight:800,marginTop:4}}>{fmtCurrency(form.arr)}</div>}
              {!isNew&&(form.tags||[]).length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>{(form.tags||[]).map(t=><Tag key={t} label={t}/>)}</div>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {!isNew&&<button onClick={()=>onClone(form)} style={{...BG,fontSize:12,padding:"6px 12px"}}>⧉ Clone</button>}
              <button onClick={onClose} style={{background:"none",border:"none",color:"#7A8699",fontSize:22,cursor:"pointer",padding:4}}>✕</button>
            </div>
          </div>
          {!isNew&&<div style={{display:"flex"}}>
            {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:tab===t.id?"2.5px solid #701427":"2.5px solid transparent",color:tab===t.id?"#701427":"#7A8699",padding:"10px 18px",cursor:"pointer",fontSize:13,fontWeight:tab===t.id?700:500,fontFamily:"inherit",marginBottom:-1}}>{t.label}</button>)}
          </div>}
        </div>
        <div style={{padding:"24px 28px"}}>
          {tab==="details"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
              {[["Company","company",true],["Contact","contact"],["Email","email"],["ARR ($)","arr"],["Close Date","closeDate","date"]].map(([l,k,full])=>(
                <label key={k} style={{display:"flex",flexDirection:"column",...(full===true?{gridColumn:"1/-1"}:{})}}>
                  <span style={LBL}>{l}</span>
                  <input type={k==="closeDate"?"date":"text"} value={form[k]||""} onChange={e=>set(k,e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                </label>
              ))}
              {[["Stage","stageId",stages.map(s=>[s.id,s.name])],["Owner","owner",OWNERS.map(o=>[o,o])],["NRR Type","nrrType",NRR_TYPES.map(n=>[n,n])],["TTFV Stage","ttfv",TTFV_STAGES.map(t=>[t,t])],["Source","source",SOURCES.map(s=>[s,s])],["Health","health",HEALTH.map(h=>[h,h[0].toUpperCase()+h.slice(1)])]].map(([l,k,opts])=>(
                <label key={k} style={{display:"flex",flexDirection:"column"}}>
                  <span style={LBL}>{l}</span>
                  <select value={form[k]||""} onChange={e=>set(k,e.target.value)} style={SEL} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}>
                    {opts.map(([v,lb])=><option key={v} value={v}>{lb}</option>)}
                  </select>
                </label>
              ))}
              <label style={{display:"flex",flexDirection:"column"}}><span style={LBL}>Next Action</span><input value={form.nextAction||""} onChange={e=>set("nextAction",e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/></label>
              <label style={{display:"flex",flexDirection:"column"}}><span style={LBL}>Due Date</span><input type="date" value={form.nextActionDue||""} onChange={e=>set("nextActionDue",e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/></label>
              <label style={{display:"flex",flexDirection:"column",gridColumn:"1/-1"}}><span style={LBL}>Notes</span><textarea rows={3} value={form.notes||""} onChange={e=>set("notes",e.target.value)} style={{...INP,resize:"vertical",lineHeight:1.6}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/></label>
              {(form.stageId==="s5"||form.stageId==="s6")&&<label style={{display:"flex",flexDirection:"column",gridColumn:"1/-1"}}><span style={LBL}>Win / Loss Reason</span><input value={form.winLossReason||""} onChange={e=>set("winLossReason",e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/></label>}
              <TagEditor tags={form.tags||[]} onChange={v=>set("tags",v)}/>
            </div>
          )}
          {tab==="activity"&&!isNew&&<ActivityLog dealId={deal.id} activityLogs={activityLogs} setActivityLogs={setActivityLogs}/>}
          {tab==="email"&&!isNew&&<EmailPanel deal={form} emails={emails} setEmails={setEmails}/>}
        </div>
        <div style={{padding:"16px 28px",borderTop:"1px solid #D6D3D1",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#F5F5F5",borderRadius:"0 0 16px 16px"}}>
          {!isNew?<button onClick={()=>onDelete(form.id)} style={{background:"none",border:"none",color:"#9B1A1A",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>Delete Deal</button>:<div/>}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={BG}>Cancel</button>
            {tab==="details"&&<button onClick={()=>onSave({...form,id:form.id||uid(),lastActivity:form.lastActivity||new Date().toISOString()})} style={BP}>{isNew?"Create Deal":"Save Changes"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PROSPECTS ────────────────────────────────────────────────────────────────
function TodayView({deals,stages,leads,prospects,activities,activityLogs,onOpenDeal,onOpenProspect}){
  const now=new Date();const today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const overdueTasks=activities.filter(a=>!a.done&&new Date(a.dueDate)<today);
  const dueTodayTasks=activities.filter(a=>!a.done&&new Date(a.dueDate)>=today&&new Date(a.dueDate)<tomorrow);
  const staleDeals=deals.filter(d=>{const st=stages.find(s=>s.id===d.stageId);return st?.rotDays&&daysAgo(d.lastActivity)>=st.rotDays&&d.stageId!=="s5"&&d.stageId!=="s6";});
  const overdueDeals=deals.filter(d=>d.nextActionDue&&new Date(d.nextActionDue)<now&&d.stageId!=="s5"&&d.stageId!=="s6");
  const atRiskDeals=deals.filter(d=>d.health==="red"&&d.stageId!=="s5"&&d.stageId!=="s6");
  const prospectsFollowUp=prospects.filter(p=>p.nextFollowUp&&new Date(p.nextFollowUp)<=tomorrow&&p.status!=="Ghosted");
  const readyToPromote=prospects.filter(p=>p.status==="Responded"||p.status==="Booked Meeting");
  const newLeadsCount=leads.filter(l=>l.status==="New").length;

  const Section=({title,count,color,children,empty})=>(
    <div style={{...CARD,marginBottom:16,overflow:"hidden"}}>
      <div style={{padding:"14px 20px",borderBottom:count>0?"1px solid #F5F5F5":"none",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:16,fontWeight:800,color:color||"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif"}}>{count}</span>
        <span style={{fontSize:13,fontWeight:700,color:"#1C2B3A"}}>{title}</span>
      </div>
      {count===0?<div style={{padding:"14px 20px",color:"#7A8699",fontSize:13}}>{empty}</div>:children}
    </div>
  );

  const TaskRow=({a})=>{const isOD=new Date(a.dueDate)<today;const m=ACT_META[a.type]||ACT_META.Note;return(
    <div style={{padding:"10px 20px",borderBottom:"1px solid #F5F5F5",display:"flex",alignItems:"center",gap:12}}>
      <span style={{fontSize:16}}>{m.icon}</span>
      <div style={{flex:1}}><div style={{fontWeight:600,color:"#1C2B3A",fontSize:13}}>{a.title}</div>{a.company&&<div style={{fontSize:11,color:"#7A8699"}}>{a.company}</div>}</div>
      <span style={{fontSize:11,color:isOD?"#9B1A1A":"#7C4D00",fontWeight:700}}>{isOD?"Overdue "+daysAgo(a.dueDate)+"d":"Today"}</span>
      <div style={{display:"flex",alignItems:"center",gap:4}}><Avatar name={a.owner} size={18}/><span style={{fontSize:11,color:"#7A8699"}}>{a.owner}</span></div>
    </div>
  );};

  const DealRow=({d,reason})=>{const st=stages.find(s=>s.id===d.stageId);return(
    <div onClick={()=>onOpenDeal(d)} style={{padding:"10px 20px",borderBottom:"1px solid #F5F5F5",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#F5F5F5"} onMouseLeave={e=>e.currentTarget.style.background=""}>
      <HealthDot health={d.health} size={10}/>
      <div style={{flex:1}}><div style={{fontWeight:600,color:"#1C2B3A",fontSize:13}}>{d.company}</div><div style={{fontSize:11,color:"#7A8699"}}>{st?.name} · {d.contact}</div></div>
      <span style={{fontWeight:800,color:"#701427",fontSize:13}}>{fmtCurrency(d.arr)}</span>
      <Badge color="#9B1A1A">{reason}</Badge>
    </div>
  );};

  return(
    <div>
      <SectionHeader title="Today" subtitle={"Your daily work view — "+new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}/>
      {/* Summary strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:24}}>
        {[
          {l:"Overdue Tasks",v:overdueTasks.length,c:"#9B1A1A"},
          {l:"Due Today",v:dueTodayTasks.length,c:"#7C4D00"},
          {l:"Stale Deals",v:staleDeals.length,c:"#701427"},
          {l:"Follow-ups Due",v:prospectsFollowUp.length,c:"#1E3A5F"},
          {l:"Ready to Promote",v:readyToPromote.length,c:"#1A5C3A"},
          {l:"New Leads",v:newLeadsCount,c:"#5B3A8A"},
        ].map(x=>(
          <div key={x.l} style={{...CARD,padding:"14px 16px",borderBottom:"3px solid "+(x.v>0?x.c:"#D6D3D1")}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:"#7A8699",marginBottom:3,lineHeight:1.3}}>{x.l}</div>
            <div style={{fontSize:24,fontWeight:800,color:x.v>0?x.c:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif"}}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <Section title="Overdue Tasks" count={overdueTasks.length} color="#9B1A1A" empty="Nothing overdue. You're on top of it.">
            {overdueTasks.map(a=><TaskRow key={a.id} a={a}/>)}
          </Section>
          <Section title="Due Today" count={dueTodayTasks.length} color="#7C4D00" empty="Nothing scheduled for today.">
            {dueTodayTasks.map(a=><TaskRow key={a.id} a={a}/>)}
          </Section>
          <Section title="Prospects to Follow Up" count={prospectsFollowUp.length} color="#1E3A5F" empty="No follow-ups due.">
            {prospectsFollowUp.map(p=>(
              <div key={p.id} onClick={()=>onOpenProspect&&onOpenProspect(p)} style={{padding:"10px 20px",borderBottom:"1px solid #F5F5F5",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#F5F5F5"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <Avatar name={p.contact} size={28}/>
                <div style={{flex:1}}><div style={{fontWeight:600,color:"#1C2B3A",fontSize:13}}>{p.company}</div><div style={{fontSize:11,color:"#7A8699"}}>{p.contact} · {p.status}</div></div>
                <Badge color={PROSPECT_STATUS_COLORS[p.status]}>{new Date(p.nextFollowUp)<today?"Overdue":"Today"}</Badge>
              </div>
            ))}
          </Section>
        </div>
        <div>
          <Section title="Stale Deals" count={staleDeals.length} color="#701427" empty="No stale deals. Pipeline is moving.">
            {staleDeals.map(d=><DealRow key={d.id} d={d} reason={"Stale "+daysAgo(d.lastActivity)+"d"}/>)}
          </Section>
          <Section title="Overdue Actions on Deals" count={overdueDeals.length} color="#9B1A1A" empty="No overdue deal actions.">
            {overdueDeals.map(d=><DealRow key={d.id} d={d} reason="Action overdue"/>)}
          </Section>
          <Section title="Ready to Promote to Leads" count={readyToPromote.length} color="#1A5C3A" empty="No prospects ready yet.">
            {readyToPromote.map(p=>(
              <div key={p.id} style={{padding:"10px 20px",borderBottom:"1px solid #F5F5F5",display:"flex",alignItems:"center",gap:12}}>
                <Avatar name={p.contact} size={28}/>
                <div style={{flex:1}}><div style={{fontWeight:600,color:"#1C2B3A",fontSize:13}}>{p.company}</div><div style={{fontSize:11,color:"#7A8699"}}>{p.contact}</div></div>
                <Badge color="#1A5C3A">{p.status}</Badge>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function ProspectModal({prospect,onSave,onDelete,onPromote,onClose}){
  const isNew=!prospect.id;
  const [form,setForm]=useState({...prospect,touches:prospect.touches||[],secondaryContacts:prospect.secondaryContacts||[]});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addTouch=(type)=>{setForm(f=>({...f,touches:[{id:uid(),type,ts:new Date().toISOString(),note:"",opened:false,openedAt:null,replied:false,repliedAt:null,variant:""},...f.touches]}));};
  const updateTouchNote=(i,note)=>setForm(f=>({...f,touches:f.touches.map((t,ti)=>ti===i?{...t,note}:t)}));
  const toggleOpened=(i)=>setForm(f=>({...f,touches:f.touches.map((t,ti)=>ti===i?{...t,opened:!t.opened,openedAt:!t.opened?new Date().toISOString():null}:t)}));
  const toggleReplied=(i)=>setForm(f=>({...f,touches:f.touches.map((t,ti)=>ti===i?{...t,replied:!t.replied,repliedAt:!t.replied?new Date().toISOString():null,opened:!t.replied?true:t.opened}:t)}));
  const updateVariant=(i,v)=>setForm(f=>({...f,touches:f.touches.map((t,ti)=>ti===i?{...t,variant:v}:t)}));
  const removeTouch=(i)=>setForm(f=>({...f,touches:f.touches.filter((_,ti)=>ti!==i)}));
  const addSecondary=()=>setForm(f=>({...f,secondaryContacts:[...f.secondaryContacts,{name:"",title:"",email:"",phone:"",linkedin:""}]}));
  const updateSec=(i,k,v)=>setForm(f=>({...f,secondaryContacts:f.secondaryContacts.map((c,ci)=>ci===i?{...c,[k]:v}:c)}));
  const removeSec=(i)=>setForm(f=>({...f,secondaryContacts:f.secondaryContacts.filter((_,ci)=>ci!==i)}));
  const TOUCH_ICONS={"Email":"✉️","LinkedIn":"💼","Call":"📞","Other":"📝"};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(30,58,95,0.3)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:660,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(30,58,95,0.2)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"24px 28px",borderBottom:"1px solid #D6D3D1",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <h2 style={{margin:0,color:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif",fontSize:22,fontWeight:700}}>{isNew?"New Prospect":form.company}</h2>
            {!isNew&&<div style={{marginTop:6}}><span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:PROSPECT_STATUS_COLORS[form.status]||"#7A8699"}}>{form.status}</span></div>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!isNew&&(form.status==="Responded"||form.status==="Booked Meeting")&&<button onClick={()=>onPromote(form)} style={{...BG,color:"#1A5C3A",borderColor:"#1A5C3A55",fontSize:12,fontWeight:700}}>▶ Move to Leads</button>}
            <button onClick={onClose} style={{background:"none",border:"none",color:"#7A8699",fontSize:22,cursor:"pointer"}}>✕</button>
          </div>
        </div>
        {!isNew&&<div style={{display:"flex",borderBottom:"1px solid #D6D3D1",paddingLeft:28}}>
          {[{id:"details",label:"Details"},{id:"sequences",label:"Email Sequences"+(form.sequences?.length>0?" ("+form.sequences.length+")":"")}].map(t=>(
            <button key={t.id} onClick={()=>setPTab(t.id)} style={{background:"none",border:"none",borderBottom:pTab===t.id?"2.5px solid #701427":"2.5px solid transparent",color:pTab===t.id?"#701427":"#7A8699",padding:"10px 18px",cursor:"pointer",fontSize:13,fontWeight:pTab===t.id?700:500,fontFamily:"inherit",marginBottom:-1}}>{t.label}</button>
          ))}
        </div>}
        <div style={{padding:"24px 28px"}}>
          {(pTab==="details"||isNew)&&<div>
          {/* Company + Status row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <label style={{display:"flex",flexDirection:"column"}}>
              <span style={LBL}>Company</span>
              <input value={form.company||""} onChange={e=>set("company",e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
            </label>
            <label style={{display:"flex",flexDirection:"column"}}>
              <span style={LBL}>Status</span>
              <select value={form.status||"Not Contacted"} onChange={e=>set("status",e.target.value)} style={SEL}>
                {PROSPECT_STATUS.map(s=><option key={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {/* Primary contact */}
          <div style={{background:"#1E3A5F08",border:"1.5px solid #1E3A5F22",borderRadius:10,padding:16,marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#1E3A5F",marginBottom:12}}>⭐ Primary Contact</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["Name","contact"],["Title","title"],["Email","email"],["Phone","phone"]].map(([l,k])=>(
                <label key={k} style={{display:"flex",flexDirection:"column"}}>
                  <span style={LBL}>{l}</span>
                  <input value={form[k]||""} onChange={e=>set(k,e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                </label>
              ))}
              <label style={{display:"flex",flexDirection:"column",gridColumn:"1/-1"}}>
                <span style={LBL}>LinkedIn URL</span>
                <input value={form.linkedin||""} onChange={e=>set("linkedin",e.target.value)} style={INP} placeholder="https://linkedin.com/in/…" onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
              </label>
            </div>
          </div>

          {/* Secondary contacts */}
          {form.secondaryContacts.length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:8}}>Secondary Contacts</div>
              {form.secondaryContacts.map((c,i)=>(
                <div key={i} style={{...CARD,padding:12,marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}><Avatar name={c.name} size={22}/><span style={{fontWeight:600,color:"#1C2B3A",fontSize:13}}>{c.name||"New contact"}</span></div>
                    <button onClick={()=>removeSec(i)} style={{background:"none",border:"none",color:"#D6D3D1",cursor:"pointer",fontSize:16}} onMouseEnter={e=>e.currentTarget.style.color="#9B1A1A"} onMouseLeave={e=>e.currentTarget.style.color="#D6D3D1"}>×</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["Name","name"],["Title","title"],["Email","email"],["Phone","phone"]].map(([l,k])=>(
                      <label key={k} style={{display:"flex",flexDirection:"column"}}>
                        <span style={LBL}>{l}</span>
                        <input value={c[k]||""} onChange={e=>updateSec(i,k,e.target.value)} style={{...INP,fontSize:12}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                      </label>
                    ))}
                    <label style={{display:"flex",flexDirection:"column",gridColumn:"1/-1"}}>
                      <span style={LBL}>LinkedIn</span>
                      <input value={c.linkedin||""} onChange={e=>updateSec(i,"linkedin",e.target.value)} style={{...INP,fontSize:12}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={addSecondary} style={{...BG,width:"100%",fontSize:12,marginBottom:16,color:"#7A8699"}}>+ Add Secondary Contact</button>

          {/* Personalization angle */}
          <label style={{display:"flex",flexDirection:"column",marginBottom:16}}>
            <span style={LBL}>Personalization Angle</span>
            <textarea rows={2} value={form.angle||""} onChange={e=>set("angle",e.target.value)} placeholder="What's your hook? e.g. saw their LinkedIn post about CS hiring…" style={{...INP,resize:"vertical",lineHeight:1.6}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
          </label>
          {form.status==="Ghosted"&&(
            <label style={{display:"flex",flexDirection:"column",marginBottom:16}}>
              <span style={{...LBL,color:"#9B1A1A"}}>Ghosted Reason</span>
              <select value={form.ghostedReason||""} onChange={e=>set("ghostedReason",e.target.value)} style={{...SEL,borderColor:"#9B1A1A44",color:form.ghostedReason?"#1C2B3A":"#7A8699"}}>
                <option value="">Select reason…</option>
                {["No response after 3+ touches","Wrong timing","Wrong person / bad fit","Competitor chosen","Gone dark","Budget issue","Out of office / left company","Other"].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              {form.ghostedReason&&<input value={form.ghostedNotes||""} onChange={e=>set("ghostedNotes",e.target.value)} placeholder="Any additional context…" style={{...INP,marginTop:8,fontSize:12}} onFocus={e=>e.target.style.borderColor="#9B1A1A"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>}
            </label>
          )}

          {/* Owner + Next follow-up */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
            <label style={{display:"flex",flexDirection:"column"}}>
              <span style={LBL}>Owner</span>
              <select value={form.owner||OWNERS[0]} onChange={e=>set("owner",e.target.value)} style={SEL}>{OWNERS.map(o=><option key={o}>{o}</option>)}</select>
            </label>
            <label style={{display:"flex",flexDirection:"column"}}>
              <span style={LBL}>Source</span>
              <select value={form.source||SOURCES[0]} onChange={e=>set("source",e.target.value)} style={SEL}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select>
            </label>
            <label style={{display:"flex",flexDirection:"column"}}>
              <span style={LBL}>Next Follow-up</span>
              <input type="date" value={form.nextFollowUp||""} onChange={e=>set("nextFollowUp",e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
            </label>
          </div>

          {/* Touchpoint log */}
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:10}}>Touchpoints</div>
            {/* Quick log buttons */}
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {TOUCH_TYPES.map(t=>(
                <button key={t} onClick={()=>addTouch(t)} style={{...BG,fontSize:12,padding:"6px 14px",display:"flex",alignItems:"center",gap:5,color:"#1E3A5F",borderColor:"#1E3A5F33"}}>
                  <span>{TOUCH_ICONS[t]}</span> Logged {t}
                </button>
              ))}
            </div>
            {form.touches.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:"#D6D3D1",fontSize:13,border:"1.5px dashed #D6D3D1",borderRadius:8}}>No touchpoints yet — log your first outreach above</div>}
            {form.touches.map((t,i)=>(
              <div key={t.id} style={{...CARD,padding:"12px 14px",marginBottom:8,borderLeft:"3px solid "+(t.replied?"#1A5C3A":t.opened?"#7C4D00":"#1E3A5F")}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14}}>{TOUCH_ICONS[t.type]||"📝"}</span>
                    <span style={{fontSize:11,fontWeight:700,color:"#1E3A5F",textTransform:"uppercase",letterSpacing:"0.07em"}}>{t.type}</span>
                    <span style={{color:"#7A8699",fontSize:11}}>{fmtDate(t.ts)}</span>
                  </div>
                  <button onClick={()=>removeTouch(i)} style={{background:"none",border:"none",color:"#D6D3D1",cursor:"pointer",fontSize:14}} onMouseEnter={e=>e.currentTarget.style.color="#9B1A1A"} onMouseLeave={e=>e.currentTarget.style.color="#D6D3D1"}>×</button>
                </div>
                {/* Open/Reply toggles */}
                {t.type==="Email"&&<div style={{display:"flex",gap:8,marginBottom:8}}>
                  <button onClick={()=>toggleOpened(i)} style={{fontSize:11,padding:"3px 10px",borderRadius:6,cursor:"pointer",fontWeight:600,background:t.opened?"#7C4D0014":"transparent",border:"1.5px solid "+(t.opened?"#7C4D00":"#D6D3D1"),color:t.opened?"#7C4D00":"#7A8699",fontFamily:"inherit",transition:"all 0.15s"}}>
                    {t.opened?"✓ Opened":"○ Mark Opened"}{t.openedAt&&<span style={{marginLeft:4,opacity:.7}}>{fmtDate(t.openedAt)}</span>}
                  </button>
                  <button onClick={()=>toggleReplied(i)} style={{fontSize:11,padding:"3px 10px",borderRadius:6,cursor:"pointer",fontWeight:600,background:t.replied?"#1A5C3A14":"transparent",border:"1.5px solid "+(t.replied?"#1A5C3A":"#D6D3D1"),color:t.replied?"#1A5C3A":"#7A8699",fontFamily:"inherit",transition:"all 0.15s"}}>
                    {t.replied?"✓ Replied":"○ Mark Replied"}{t.repliedAt&&<span style={{marginLeft:4,opacity:.7}}>{fmtDate(t.repliedAt)}</span>}
                  </button>
                </div>}
                {/* Subject variant */}
                {t.type==="Email"&&<input value={t.variant||""} onChange={e=>updateVariant(i,e.target.value)} placeholder="Subject line used (for A/B tracking)…" style={{...INP,fontSize:11,padding:"5px 9px",marginBottom:8,background:"#F5F5F5",border:"1px solid #D6D3D1"}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>}
                <input value={t.note} onChange={e=>updateTouchNote(i,e.target.value)} placeholder="Note… e.g. sent intro email about TTFV post" style={{...INP,fontSize:12,padding:"6px 10px"}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
              </div>
            ))}
          </div>
          </div>}

          {/* SEQUENCES TAB */}
          {(pTab==="sequences"||isNew===false&&pTab==="sequences")&&pTab==="sequences"&&(
          <div>
            <div style={{...CARD,padding:"12px 16px",marginBottom:16,borderLeft:"3px solid #701427"}}>
              <div style={{fontSize:12,color:"#7A8699",lineHeight:1.6}}>Store your cold email sequence here — touch 1, follow-up, final bump. Use <strong style={{color:"#1E3A5F"}}>{"{{name}}"}</strong> and <strong style={{color:"#1E3A5F"}}>{"{{company}}"}</strong> as placeholders.</div>
            </div>
            {(form.sequences||[]).map((s,i)=>(
              <div key={s.id} style={{...CARD,padding:18,marginBottom:12,borderLeft:"3px solid "+(i===0?"#1E3A5F":i===1?"#7C4D00":"#701427")}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:i===0?"#1E3A5F":i===1?"#7C4D00":"#701427",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{i+1}</div>
                    <select value={s.type} onChange={e=>updateSeq(i,"type",e.target.value)} style={{...SEL,width:"auto",fontSize:12,padding:"4px 8px",color:"#1C2B3A"}}>
                      {TOUCH_TYPES.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <button onClick={()=>removeSeq(i)} style={{background:"none",border:"none",color:"#D6D3D1",cursor:"pointer",fontSize:16}} onMouseEnter={e=>e.currentTarget.style.color="#9B1A1A"} onMouseLeave={e=>e.currentTarget.style.color="#D6D3D1"}>×</button>
                </div>
                <label style={{display:"flex",flexDirection:"column",marginBottom:10}}>
                  <span style={LBL}>Subject Line</span>
                  <input value={s.subject} onChange={e=>updateSeq(i,"subject",e.target.value)} placeholder={"Touch "+(i+1)+" subject…"} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                </label>
                <label style={{display:"flex",flexDirection:"column"}}>
                  <span style={LBL}>Body</span>
                  <textarea rows={5} value={s.body} onChange={e=>updateSeq(i,"body",e.target.value)} placeholder={"Hi {{name}},\n\nWrite your touch "+(i+1)+" message here…"} style={{...INP,resize:"vertical",lineHeight:1.7,fontSize:13}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                </label>
              </div>
            ))}
            <button onClick={addSeqEmail} style={{...BG,width:"100%",fontSize:13,color:"#1E3A5F",borderColor:"#1E3A5F33",borderStyle:"dashed"}}>+ Add Touch {(form.sequences||[]).length+1}</button>
          </div>
          )}
        </div>
        <div style={{padding:"16px 28px",borderTop:"1px solid #D6D3D1",display:"flex",justifyContent:"space-between",background:"#F5F5F5",borderRadius:"0 0 16px 16px"}}>
          {!isNew?<button onClick={()=>onDelete(form.id)} style={{background:"none",border:"none",color:"#9B1A1A",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>Delete</button>:<div/>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={BG}>Cancel</button>
            <button onClick={()=>onSave({...form,id:form.id||uid(),createdAt:form.createdAt||new Date().toISOString(),lastActivity:new Date().toISOString()})} style={BP}>{isNew?"Add Prospect":"Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProspectsView({prospects,setProspects,onPromoteToLead}){
  const [modal,setModal]=useState(null);
  const [filter,setFilter]=useState("active");
  const [search,setSearch]=useState("");
  const [showImport,setShowImport]=useState(false);
  const [sel,setSel]=useState(new Set());
  const [bulkStatus,setBulkStatus]=useState("");
  const [toast,setToast]=useState(null);
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(null),3500);};
  const togSel=id=>setSel(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const applyBulkStatus=()=>{
    if(!bulkStatus)return;
    const toPromote=(bulkStatus==="Responded"||bulkStatus==="Booked Meeting")
      ?prospects.filter(p=>sel.has(p.id)&&p.status!=="Responded"&&p.status!=="Booked Meeting")
      :[];
    setProspects(ps=>ps.map(p=>sel.has(p.id)?{...p,status:bulkStatus,lastActivity:new Date().toISOString()}:p));
    if(toPromote.length>0)showToast(toPromote.length+" prospect"+(toPromote.length>1?"s":"")+" → moved to Leads");
    toPromote.forEach(p=>onPromoteToLead({...p,status:bulkStatus}));
    setSel(new Set());setBulkStatus("");
  };

  const shown=prospects.filter(p=>{
    if(filter==="active"&&p.status==="Ghosted")return false;
    if(filter==="ghosted"&&p.status!=="Ghosted")return false;
    if(search&&!(p.company+p.contact).toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const saveProspect=p=>{
    const prev=prospects.find(x=>x.id===p.id);
    const wasPromotable=prev&&(prev.status==="Responded"||prev.status==="Booked Meeting");
    const nowPromotable=(p.status==="Responded"||p.status==="Booked Meeting");
    // Auto-promote when status first becomes Responded or Booked Meeting
    if(nowPromotable&&!wasPromotable){
      setModal(null);
      showToast(p.company+" → moved to Leads as "+(p.status==="Booked Meeting"?"Qualified":"New"));
      onPromoteToLead(p);
      return;
    }
    setProspects(ps=>ps.find(x=>x.id===p.id)?ps.map(x=>x.id===p.id?p:x):[...ps,p]);
    setModal(null);
  };
  const deleteProspect=id=>{sb.delete('prospects',id);setProspects(ps=>ps.filter(p=>p.id!==id));setModal(null);};

  const handleImport=newLeads=>{
    const asProspects=newLeads.map(l=>({...l,status:"Not Contacted",touches:[],angle:"",nextFollowUp:""}));
    setProspects(ps=>[...ps,...asProspects]);
  };

  const statusCounts=PROSPECT_STATUS.reduce((acc,s)=>{acc[s]=prospects.filter(p=>p.status===s).length;return acc;},{});
  const activeCount=prospects.filter(p=>p.status!=="Ghosted").length;
  const ghostedCount=prospects.filter(p=>p.status==="Ghosted").length;
  const respondedCount=prospects.filter(p=>p.status==="Responded"||p.status==="Booked Meeting").length;

  return(
    <div>
      {toast&&<div style={{position:"fixed",bottom:24,right:24,zIndex:2000,background:"#1A5C3A",color:"#fff",borderRadius:10,padding:"12px 20px",fontSize:13,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.15)",display:"flex",alignItems:"center",gap:10,animation:"none"}}>✓ {toast}</div>}
      <SectionHeader title="Prospects" subtitle="Cold outreach targets — log touches, track responses, promote to leads"
        action={<div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowImport(true)} style={{...BG,fontSize:12,padding:"8px 16px",color:"#1E3A5F",borderColor:"#1E3A5F44",fontWeight:700}}>⬆ Import File</button>
          <button onClick={()=>setModal({company:"",contact:"",title:"",email:"",phone:"",linkedin:"",status:"Not Contacted",owner:OWNERS[0],source:SOURCES[0],angle:"",nextFollowUp:"",touches:[],secondaryContacts:[]})} style={BP}>+ Add Prospect</button>
        </div>}/>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:24}}>
        {PROSPECT_STATUS.map(s=>(
          <div key={s} style={{...CARD,padding:"12px 14px",borderBottom:"3px solid "+(PROSPECT_STATUS_COLORS[s]||"#D6D3D1")}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:"#7A8699",marginBottom:3,lineHeight:1.3}}>{s}</div>
            <div style={{fontSize:22,fontWeight:800,color:PROSPECT_STATUS_COLORS[s]||"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif"}}>{statusCounts[s]||0}</div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="Search prospects…" value={search} onChange={e=>setSearch(e.target.value)} style={{...INP,maxWidth:260,fontSize:13}}/>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setFilter("active")} style={{...BG,fontSize:12,padding:"5px 12px",borderColor:filter==="active"?"#1E3A5F":"#D6D3D1",color:filter==="active"?"#1E3A5F":"#7A8699",fontWeight:filter==="active"?700:500}}>Active ({activeCount})</button>
          <button onClick={()=>setFilter("ghosted")} style={{...BG,fontSize:12,padding:"5px 12px",borderColor:filter==="ghosted"?"#7A8699":"#D6D3D1",color:filter==="ghosted"?"#7A8699":"#7A8699",fontWeight:filter==="ghosted"?700:500}}>Ghosted ({ghostedCount})</button>
          <button onClick={()=>setFilter("all")} style={{...BG,fontSize:12,padding:"5px 12px",borderColor:filter==="all"?"#1E3A5F":"#D6D3D1",color:filter==="all"?"#1E3A5F":"#7A8699",fontWeight:filter==="all"?700:500}}>All ({prospects.length})</button>
        </div>
        {respondedCount>0&&<div style={{marginLeft:"auto",background:"#1A5C3A14",border:"1px solid #1A5C3A33",borderRadius:8,padding:"6px 14px",fontSize:12,color:"#1A5C3A",fontWeight:700}}>🎉 {respondedCount} responded — ready to promote</div>}
      </div>
      {sel.size>0&&<div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12,background:"#1E3A5F08",border:"1px solid #1E3A5F22",borderRadius:10,padding:"10px 16px"}}>
        <span style={{color:"#1E3A5F",fontWeight:700,fontSize:13}}>{sel.size} selected</span>
        <span style={{color:"#7A8699",fontSize:13}}>→ Set status:</span>
        <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)} style={{...SEL,width:"auto",fontSize:12,padding:"5px 10px"}}><option value="">Choose status…</option>{PROSPECT_STATUS.map(s=><option key={s}>{s}</option>)}</select>
        {bulkStatus&&<button onClick={applyBulkStatus} style={{...BP,fontSize:12,padding:"6px 16px"}}>Apply to {sel.size}</button>}
        <button onClick={()=>setSel(new Set())} style={{...BG,fontSize:12,padding:"5px 12px",marginLeft:"auto"}}>Clear</button>
      </div>}

      {/* Table */}
      <div style={{...CARD,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#F5F5F5",borderBottom:"1.5px solid #D6D3D1"}}>
            <th style={{padding:"10px 14px",width:36}}><input type="checkbox" onChange={e=>setSel(e.target.checked?new Set(shown.map(p=>p.id)):new Set())} style={{accentColor:"#1E3A5F"}}/></th>
            {["Company","Contact","Status","Touches","Next Follow-up","Owner","Last Activity"].map(h=>(
              <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#7A8699",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {shown.map(p=>{
              const touches=p.touches||[];
              const isOverdue=p.nextFollowUp&&new Date(p.nextFollowUp)<new Date();
              const canPromote=p.status==="Responded"||p.status==="Booked Meeting";
              return(
                <tr key={p.id} style={{borderBottom:"1px solid #F5F5F5",cursor:"pointer",opacity:p.status==="Ghosted"?0.55:1,background:sel.has(p.id)?"#1E3A5F06":""}} onMouseEnter={e=>{if(!sel.has(p.id))e.currentTarget.style.background="#F5F5F5";}} onMouseLeave={e=>{if(!sel.has(p.id))e.currentTarget.style.background="";}}>
                <td style={{padding:"11px 14px"}} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={sel.has(p.id)} onChange={()=>togSel(p.id)} style={{accentColor:"#1E3A5F"}}/></td>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{fontWeight:600,color:"#1C2B3A"}}>{p.company}</div>
                    {(p.secondaryContacts||[]).length>0&&<div style={{fontSize:11,color:"#7A8699",marginTop:1}}>+{p.secondaryContacts.length} contacts</div>}
                  </td>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}><Avatar name={p.contact} size={22}/><div><div style={{color:"#1C2B3A",fontSize:13}}>{p.contact}</div><div style={{color:"#7A8699",fontSize:11}}>{p.title}</div></div></div>
                  </td>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <Badge color={PROSPECT_STATUS_COLORS[p.status]}>{p.status}</Badge>
                      {canPromote&&<span style={{fontSize:11,color:"#1A5C3A",fontWeight:700}}>→ Promote</span>}
                    </div>
                  </td>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontWeight:700,color:touches.length>0?"#1E3A5F":"#D6D3D1",fontSize:14}}>{touches.length}</span>
                      {touches.length>0&&<div style={{display:"flex",gap:3}}>{[...new Set(touches.map(t=>t.type))].map(t=>(<span key={t} style={{fontSize:13}}>{"Email"===t?"✉️":"LinkedIn"===t?"💼":"Call"===t?"📞":"📝"}</span>))}</div>}
                    </div>
                  </td>
                  <td style={{padding:"11px 14px"}}>
                    {p.nextFollowUp
                      ?<span style={{color:isOverdue?"#9B1A1A":"#7A8699",fontWeight:isOverdue?700:400,fontSize:12}}>{isOverdue?"⚠ ":""}{fmtDate(p.nextFollowUp)}</span>
                      :<span style={{color:"#D6D3D1",fontSize:12}}>—</span>}
                  </td>
                  <td style={{padding:"11px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><Avatar name={p.owner} size={20}/><span style={{color:"#1C2B3A",fontSize:12}}>{p.owner}</span></div></td>
                  <td style={{padding:"11px 14px",color:"#7A8699",fontSize:12}}>{daysAgo(p.lastActivity)}d ago</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#7A8699"}}>No prospects here. Import a file or add one above.</div>}
      </div>

      {/* A/B Subject Line Analytics */}
      {prospects.length>0&&(()=>{
        const allTouches=prospects.flatMap(p=>(p.touches||[]).filter(t=>t.type==="Email"&&t.variant&&t.variant.trim()!==""));
        if(allTouches.length===0)return null;
        const byVariant={};
        allTouches.forEach(t=>{
          const v=t.variant.trim();
          if(!byVariant[v])byVariant[v]={sent:0,opened:0,replied:0};
          byVariant[v].sent++;
          if(t.opened)byVariant[v].opened++;
          if(t.replied)byVariant[v].replied++;
        });
        const rows=Object.entries(byVariant).sort((a,b)=>b[1].replied-a[1].replied);
        return(
          <div style={{...CARD,marginTop:24,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #D6D3D1",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>🧪</span>
              <div>
                <div style={{fontWeight:700,color:"#1C2B3A",fontSize:14}}>A/B Subject Line Tracker</div>
                <div style={{color:"#7A8699",fontSize:12,marginTop:1}}>Based on subject lines logged on email touchpoints</div>
              </div>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:"#F5F5F5",borderBottom:"1.5px solid #D6D3D1"}}>
                {["Subject Line","Sent","Opened","Open Rate","Replied","Reply Rate"].map(h=>(
                  <th key={h} style={{padding:"9px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"#7A8699",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map(([variant,s])=>{
                  const openRate=s.sent>0?Math.round((s.opened/s.sent)*100):0;
                  const replyRate=s.sent>0?Math.round((s.replied/s.sent)*100):0;
                  return(
                    <tr key={variant} style={{borderBottom:"1px solid #F5F5F5"}}>
                      <td style={{padding:"10px 16px",fontWeight:600,color:"#1C2B3A",maxWidth:300}}>{variant}</td>
                      <td style={{padding:"10px 16px",color:"#7A8699"}}>{s.sent}</td>
                      <td style={{padding:"10px 16px",color:"#7C4D00",fontWeight:600}}>{s.opened}</td>
                      <td style={{padding:"10px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{height:6,width:80,background:"#F5F5F5",borderRadius:3,border:"1px solid #D6D3D1",overflow:"hidden"}}><div style={{height:"100%",background:"#7C4D00",width:openRate+"%",borderRadius:3}}/></div>
                          <span style={{color:"#7C4D00",fontWeight:700,fontSize:12}}>{openRate}%</span>
                        </div>
                      </td>
                      <td style={{padding:"10px 16px",color:"#1A5C3A",fontWeight:600}}>{s.replied}</td>
                      <td style={{padding:"10px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{height:6,width:80,background:"#F5F5F5",borderRadius:3,border:"1px solid #D6D3D1",overflow:"hidden"}}><div style={{height:"100%",background:"#1A5C3A",width:replyRate+"%",borderRadius:3}}/></div>
                          <span style={{color:"#1A5C3A",fontWeight:700,fontSize:12}}>{replyRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
      {modal&&<ProspectModal prospect={modal} onSave={saveProspect} onDelete={deleteProspect} onPromote={p=>onPromoteToLead(p)} onClose={()=>setModal(null)}/>}
      {showImport&&<ImportWizard onImport={handleImport} onClose={()=>setShowImport(false)}/>}
    </div>
  );
}


// ─── IMPORT WIZARD ────────────────────────────────────────────────────────────
function ImportWizard({onImport,onClose}){
  const [step,setStep]=useState(1); // 1=upload, 2=defaults, 3=resolve, 4=preview
  const [rows,setRows]=useState([]);
  const [groups,setGroups]=useState([]); // [{company, contacts:[], primaryIdx}]
  const [defaults,setDefaults]=useState({source:SOURCES[0],owner:OWNERS[0],status:"New"});
  const fileRef=useRef();

  const parseFile=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const text=ev.target.result;
      const lines=text.split(/\r?\n/).filter(l=>l.trim());
      const headers=lines[0].split(',').map(h=>h.replace(/^"|"$/g,'').trim());
      const data=lines.slice(1).map(line=>{
        const cols=[];let cur='';let inQ=false;
        for(let c of line){if(c==='"'){inQ=!inQ;}else if(c===','&&!inQ){cols.push(cur.trim());cur='';}else{cur+=c;}}
        cols.push(cur.trim());
        const obj={};headers.forEach((h,i)=>{obj[h]=cols[i]||'';});
        return obj;
      }).filter(r=>r['Company Name']||r['company']);
      setRows(data);
      // Group by company
      const map={};
      data.forEach(r=>{
        const co=(r['Company Name']||r['company']||'').trim();
        if(!co)return;
        if(!map[co])map[co]=[];
        map[co].push({
          name:((r['First Name']||'')+' '+(r['Last Name']||'')).trim()||r['contact']||'',
          title:r['Job Title']||r['title']||'',
          email:r['Work Email']||r['email']||'',
          phone:r['Phone Number']||r['phone']||'',
          linkedin:r['LinkedIn Profile URL']||r['linkedin']||'',
        });
      });
      const grps=Object.entries(map).map(([company,contacts])=>({company,contacts,primaryIdx:0}));
      setGroups(grps);
      setStep(2);
    };
    // try to read as text (works for CSV; for xlsx we need different handling)
    if(file.name.endsWith('.csv')){
      reader.readAsText(file);
    } else {
      // xlsx: use FileReader as binary then parse manually via basic approach
      reader.readAsBinaryString(file);
      reader.onload=ev=>{
        // Basic xlsx parsing without external lib — extract shared strings + sheet data
        try{
          const bin=ev.target.result;
          // We'll use a script tag approach — load SheetJS from CDN dynamically
          const script=document.createElement('script');
          script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          script.onload=()=>{
            const wb=window.XLSX.read(bin,{type:'binary'});
            const ws=wb.Sheets[wb.SheetNames[0]];
            const json=window.XLSX.utils.sheet_to_json(ws,{defval:''});
            setRows(json);
            const map={};
            json.forEach(r=>{
              const co=(r['Company Name']||r['company']||'').trim();
              if(!co)return;
              if(!map[co])map[co]=[];
              map[co].push({
                name:((r['First Name']||'')+' '+(r['Last Name']||'')).trim()||r['contact']||'',
                title:r['Job Title']||r['title']||'',
                email:r['Work Email']||r['email']||'',
                phone:r['Phone Number']||r['phone']||'',
                linkedin:r['LinkedIn Profile URL']||r['linkedin']||'',
              });
            });
            const grps=Object.entries(map).map(([company,contacts])=>({company,contacts,primaryIdx:0}));
            setGroups(grps);
            setStep(2);
          };
          document.head.appendChild(script);
        }catch(err){alert('Could not parse file. Please export as CSV from Excel and try again.');}
      };
    }
  };

  const setPrimary=(gIdx,cIdx)=>setGroups(gs=>gs.map((g,i)=>i===gIdx?{...g,primaryIdx:cIdx}:g));

  const doImport=()=>{
    const newLeads=groups.map(g=>{
      const primary=g.contacts[g.primaryIdx];
      const secondaries=g.contacts.filter((_,i)=>i!==g.primaryIdx);
      return {
        id:uid(),company:g.company,
        contact:primary.name,title:primary.title,email:primary.email,
        phone:primary.phone,linkedin:primary.linkedin,
        secondaryContacts:secondaries,
        source:defaults.source,owner:defaults.owner,status:defaults.status,
        notes:'',tags:[],createdAt:new Date().toISOString(),lastActivity:new Date().toISOString(),
      };
    });
    onImport(newLeads);
    onClose();
  };

  const multiGroups=groups.filter(g=>g.contacts.length>1);
  const singleGroups=groups.filter(g=>g.contacts.length===1);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(30,58,95,0.45)",backdropFilter:"blur(4px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:740,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(30,58,95,0.25)"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"24px 28px",borderBottom:"1px solid #D6D3D1",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h2 style={{margin:0,color:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif",fontSize:22,fontWeight:700}}>Import Leads</h2>
            <button onClick={onClose} style={{background:"none",border:"none",color:"#7A8699",fontSize:22,cursor:"pointer"}}>✕</button>
          </div>
          {/* Step indicators */}
          <div style={{display:"flex",gap:0}}>
            {[{n:1,l:"Upload"},{n:2,l:"Defaults"},{n:3,l:"Resolve"},{n:4,l:"Preview"}].map((s,i)=>(
              <div key={s.n} style={{display:"flex",alignItems:"center",gap:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:step>=s.n?"#1E3A5F":"#D6D3D1",color:step>=s.n?"#fff":"#7A8699",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{step>s.n?"✓":s.n}</div>
                  <span style={{fontSize:12,fontWeight:step===s.n?700:400,color:step===s.n?"#1E3A5F":step>s.n?"#1A5C3A":"#7A8699"}}>{s.l}</span>
                </div>
                {i<3&&<div style={{width:32,height:1.5,background:step>s.n?"#1E3A5F":"#D6D3D1",margin:"0 8px"}}/>}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>

          {/* STEP 1 — Upload */}
          {step===1&&(
            <div style={{textAlign:"center",padding:"32px 0"}}>
              <div style={{fontSize:48,marginBottom:16}}>📁</div>
              <div style={{color:"#1C2B3A",fontWeight:700,fontSize:16,marginBottom:8}}>Upload your leads file</div>
              <div style={{color:"#7A8699",fontSize:13,marginBottom:24}}>Supports <strong>.xlsx</strong> and <strong>.csv</strong> files</div>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={parseFile} style={{display:"none"}}/>
              <button onClick={()=>fileRef.current.click()} style={{...BP,fontSize:14,padding:"12px 32px"}}>Choose File</button>
              <div style={{marginTop:24,background:"#F5F5F5",borderRadius:10,padding:16,textAlign:"left"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#1E3A5F",marginBottom:8}}>Expected columns</div>
                <div style={{fontSize:12,color:"#7A8699",lineHeight:1.8}}>First Name · Last Name · Job Title · Work Email · Phone Number · LinkedIn Profile URL · Company Name</div>
              </div>
            </div>
          )}

          {/* STEP 2 — Defaults */}
          {step===2&&(
            <div>
              <div style={{...CARD,padding:20,marginBottom:20,borderLeft:"3px solid #1E3A5F"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#1C2B3A",marginBottom:4}}>📊 File summary</div>
                <div style={{color:"#7A8699",fontSize:13}}><strong style={{color:"#1E3A5F"}}>{groups.length}</strong> companies · <strong style={{color:"#701427"}}>{multiGroups.length}</strong> need primary contact selected · <strong style={{color:"#1A5C3A"}}>{singleGroups.length}</strong> auto-ready</div>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:"#1C2B3A",marginBottom:16}}>Set defaults for all imported leads</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                {[["Status","status",LEAD_STATUS.map(s=>[s,s])],["Owner","owner",OWNERS.map(o=>[o,o])],["Source","source",SOURCES.map(s=>[s,s])]].map(([l,k,opts])=>(
                  <label key={k} style={{display:"flex",flexDirection:"column"}}>
                    <span style={LBL}>{l}</span>
                    <select value={defaults[k]} onChange={e=>setDefaults(d=>({...d,[k]:e.target.value}))} style={SEL}>{opts.map(([v,lb])=><option key={v} value={v}>{lb}</option>)}</select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 — Resolve duplicates */}
          {step===3&&(
            <div>
              <div style={{...CARD,padding:"12px 16px",marginBottom:20,borderLeft:"3px solid #701427",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>👥</span>
                <div><span style={{color:"#1C2B3A",fontWeight:700,fontSize:13}}>{multiGroups.length} companies</span><span style={{color:"#7A8699",fontSize:13}}> have multiple contacts — select the primary for each</span></div>
              </div>
              {groups.filter(g=>g.contacts.length>1).map((g,gi)=>{
                const gIdx=groups.findIndex(x=>x.company===g.company);
                return(
                  <div key={g.company} style={{...CARD,padding:16,marginBottom:12}}>
                    <div style={{fontWeight:700,color:"#1C2B3A",fontSize:14,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                      <span>{g.company}</span>
                      <span style={{fontSize:11,background:"#1E3A5F14",color:"#1E3A5F",borderRadius:10,padding:"2px 8px",fontWeight:600}}>{g.contacts.length} contacts</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {g.contacts.map((c,ci)=>(
                        <div key={ci} onClick={()=>setPrimary(gIdx,ci)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,border:"1.5px solid "+(g.primaryIdx===ci?"#1E3A5F":"#D6D3D1"),background:g.primaryIdx===ci?"#1E3A5F08":"transparent",cursor:"pointer",transition:"all 0.15s"}}>
                          <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(g.primaryIdx===ci?"#1E3A5F":"#D6D3D1"),background:g.primaryIdx===ci?"#1E3A5F":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {g.primaryIdx===ci&&<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
                          </div>
                          <Avatar name={c.name} size={28}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,color:"#1C2B3A",fontSize:13}}>{c.name}</div>
                            <div style={{color:"#7A8699",fontSize:11,marginTop:1}}>{c.title}{c.email&&" · "+c.email}</div>
                          </div>
                          {g.primaryIdx===ci&&<Badge color="#1E3A5F">Primary</Badge>}
                          {g.primaryIdx!==ci&&<span style={{fontSize:11,color:"#7A8699"}}>Secondary</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 4 — Preview */}
          {step===4&&(
            <div>
              <div style={{...CARD,padding:"12px 16px",marginBottom:20,borderLeft:"3px solid #1A5C3A",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>✅</span>
                <div><strong style={{color:"#1A5C3A"}}>{groups.length} leads</strong><span style={{color:"#7A8699",fontSize:13}}> ready to import · {multiGroups.length} with secondary contacts</span></div>
              </div>
              <div style={{...CARD,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr style={{background:"#F5F5F5",borderBottom:"1.5px solid #D6D3D1"}}>
                    {["Company","Primary Contact","Title","Email","Contacts"].map(h=><th key={h} style={{padding:"9px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#7A8699",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {groups.slice(0,20).map(g=>{const p=g.contacts[g.primaryIdx];return(
                      <tr key={g.company} style={{borderBottom:"1px solid #F5F5F5"}}>
                        <td style={{padding:"9px 14px",fontWeight:600,color:"#1C2B3A"}}>{g.company}</td>
                        <td style={{padding:"9px 14px"}}><div style={{display:"flex",alignItems:"center",gap:7}}><Avatar name={p.name} size={22}/><span style={{color:"#1C2B3A"}}>{p.name}</span></div></td>
                        <td style={{padding:"9px 14px",color:"#7A8699",fontSize:12}}>{p.title}</td>
                        <td style={{padding:"9px 14px",color:"#7A8699",fontSize:12}}>{p.email}</td>
                        <td style={{padding:"9px 14px"}}>{g.contacts.length>1?<Badge color="#1E3A5F">{g.contacts.length} total</Badge>:<span style={{color:"#7A8699",fontSize:12}}>1</span>}</td>
                      </tr>
                    );})}
                  </tbody>
                </table>
                {groups.length>20&&<div style={{textAlign:"center",padding:"12px 0",color:"#7A8699",fontSize:12}}>…and {groups.length-20} more</div>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"16px 28px",borderTop:"1px solid #D6D3D1",display:"flex",justifyContent:"space-between",background:"#F5F5F5",borderRadius:"0 0 16px 16px",flexShrink:0}}>
          <button onClick={step===1?onClose:()=>setStep(s=>s-1)} style={BG}>{step===1?"Cancel":"Back"}</button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {step===2&&<span style={{color:"#7A8699",fontSize:12}}>{singleGroups.length} auto-ready · {multiGroups.length} need selection</span>}
            {step<4
              ?<button onClick={()=>setStep(s=>{if(s===2&&multiGroups.length===0)return 4;return s+1;})} disabled={step===1} style={{...BP,opacity:step===1?0.4:1}}>{step===2&&multiGroups.length===0?"Skip to Preview →":"Next →"}</button>
              :<button onClick={doImport} style={{...BP,background:"#1A5C3A",boxShadow:"0 2px 8px #1A5C3A44"}}>Import {groups.length} Leads</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LEAD MODAL ───────────────────────────────────────────────────────────────
function LeadModal({lead,onSave,onDelete,onConvert,onClose}){
  const isNew=!lead.id;
  const [form,setForm]=useState({...lead,tags:lead.tags||[],secondaryContacts:lead.secondaryContacts||[]});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addSecondary=()=>setForm(f=>({...f,secondaryContacts:[...f.secondaryContacts,{name:"",title:"",email:"",phone:"",linkedin:""}]}));
  const updateSecondary=(i,k,v)=>setForm(f=>({...f,secondaryContacts:f.secondaryContacts.map((c,ci)=>ci===i?{...c,[k]:v}:c)}));
  const removeSecondary=i=>setForm(f=>({...f,secondaryContacts:f.secondaryContacts.filter((_,ci)=>ci!==i)}));
  const promoteSecondary=i=>{
    const sec=form.secondaryContacts[i];
    const oldPrimary={name:form.contact,title:form.title,email:form.email,phone:form.phone||"",linkedin:form.linkedin||""};
    const newSecs=form.secondaryContacts.map((c,ci)=>ci===i?oldPrimary:c);
    setForm(f=>({...f,contact:sec.name,title:sec.title,email:sec.email,phone:sec.phone||"",linkedin:sec.linkedin||"",secondaryContacts:newSecs}));
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(30,58,95,0.3)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:620,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(30,58,95,0.2)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"24px 28px",borderBottom:"1px solid #D6D3D1",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h2 style={{margin:0,color:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif",fontSize:22,fontWeight:700}}>{isNew?"New Lead":form.company}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#7A8699",fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{padding:"24px 28px"}}>
          {/* Company */}
          <label style={{display:"flex",flexDirection:"column",marginBottom:16}}>
            <span style={LBL}>Company</span>
            <input value={form.company||""} onChange={e=>set("company",e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
          </label>

          {/* Primary contact */}
          <div style={{background:"#1E3A5F08",border:"1.5px solid #1E3A5F22",borderRadius:10,padding:16,marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#1E3A5F",marginBottom:12}}>⭐ Primary Contact</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["Name","contact"],["Title","title"],["Email","email"],["Phone","phone"]].map(([l,k])=>(
                <label key={k} style={{display:"flex",flexDirection:"column"}}>
                  <span style={LBL}>{l}</span>
                  <input value={form[k]||""} onChange={e=>set(k,e.target.value)} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                </label>
              ))}
              <label style={{display:"flex",flexDirection:"column",gridColumn:"1/-1"}}>
                <span style={LBL}>LinkedIn URL</span>
                <input value={form.linkedin||""} onChange={e=>set("linkedin",e.target.value)} style={INP} placeholder="https://linkedin.com/in/…" onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
              </label>
            </div>
          </div>

          {/* Secondary contacts */}
          {(form.secondaryContacts||[]).length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:10}}>Secondary Contacts</div>
              {(form.secondaryContacts||[]).map((c,i)=>(
                <div key={i} style={{...CARD,padding:14,marginBottom:10,position:"relative"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={c.name} size={24}/><span style={{fontWeight:600,color:"#1C2B3A",fontSize:13}}>{c.name||"New contact"}</span></div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>promoteSecondary(i)} style={{...BG,fontSize:11,padding:"3px 10px",color:"#1E3A5F",borderColor:"#1E3A5F44"}}>⭐ Make Primary</button>
                      <button onClick={()=>removeSecondary(i)} style={{background:"none",border:"none",color:"#D6D3D1",cursor:"pointer",fontSize:18}} onMouseEnter={e=>e.currentTarget.style.color="#9B1A1A"} onMouseLeave={e=>e.currentTarget.style.color="#D6D3D1"}>×</button>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[["Name","name"],["Title","title"],["Email","email"],["Phone","phone"]].map(([l,k])=>(
                      <label key={k} style={{display:"flex",flexDirection:"column"}}>
                        <span style={LBL}>{l}</span>
                        <input value={c[k]||""} onChange={e=>updateSecondary(i,k,e.target.value)} style={{...INP,fontSize:12}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                      </label>
                    ))}
                    <label style={{display:"flex",flexDirection:"column",gridColumn:"1/-1"}}>
                      <span style={LBL}>LinkedIn URL</span>
                      <input value={c.linkedin||""} onChange={e=>updateSecondary(i,"linkedin",e.target.value)} style={{...INP,fontSize:12}} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={addSecondary} style={{...BG,width:"100%",fontSize:12,marginBottom:16,color:"#7A8699"}}>+ Add Secondary Contact</button>

          {/* Lead fields */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
            {[["Status","status",LEAD_STATUS.map(s=>[s,s])],["Owner","owner",OWNERS.map(o=>[o,o])],["Source","source",SOURCES.map(s=>[s,s])]].map(([l,k,opts])=>(
              <label key={k} style={{display:"flex",flexDirection:"column"}}>
                <span style={LBL}>{l}</span>
                <select value={form[k]||opts[0][0]} onChange={e=>set(k,e.target.value)} style={SEL}>{opts.map(([v,lb])=><option key={v} value={v}>{lb}</option>)}</select>
              </label>
            ))}
          </div>
          <label style={{display:"flex",flexDirection:"column",marginBottom:16}}><span style={LBL}>Notes</span><textarea rows={3} value={form.notes||""} onChange={e=>set("notes",e.target.value)} style={{...INP,resize:"vertical",lineHeight:1.6}}/></label>
          <TagEditor tags={form.tags||[]} onChange={v=>set("tags",v)}/>
        </div>
        <div style={{padding:"16px 28px",borderTop:"1px solid #D6D3D1",display:"flex",justifyContent:"space-between",background:"#F5F5F5",borderRadius:"0 0 16px 16px"}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!isNew&&<button onClick={()=>onDelete(form.id)} style={{background:"none",border:"none",color:"#9B1A1A",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>Delete</button>}
            {!isNew&&form.status==="Qualified"&&<button onClick={()=>onConvert(form)} style={{...BG,color:"#1A5C3A",borderColor:"#1A5C3A55",fontSize:12,fontWeight:700}}>▶ Convert to Deal</button>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={BG}>Cancel</button>
            <button onClick={()=>onSave({...form,id:form.id||uid(),createdAt:form.createdAt||new Date().toISOString(),lastActivity:form.lastActivity||new Date().toISOString()})} style={BP}>{isNew?"Add Lead":"Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LEADS INBOX ──────────────────────────────────────────────────────────────
function LeadsInbox({leads,setLeads,onConvertToDeal}){
  const [filter,setFilter]=useState("All");const [sel,setSel]=useState(new Set());const [modal,setModal]=useState(null);const [bOwner,setBOwner]=useState("");const [search,setSearch]=useState("");const [showImport,setShowImport]=useState(false);
  const shown=(filter==="All"?leads:leads.filter(l=>l.status===filter)).filter(l=>!search||(l.company+l.contact).toLowerCase().includes(search.toLowerCase()));
  const togSel=id=>setSel(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const allSel=shown.length>0&&shown.every(l=>sel.has(l.id));
  const stats=LEAD_STATUS.map(s=>({s,count:leads.filter(l=>l.status===s).length}));
  const saveLead=l=>{setLeads(ls=>ls.find(x=>x.id===l.id)?ls.map(x=>x.id===l.id?l:x):[...ls,l]);setModal(null);};
  const delLead=id=>{sb.delete('leads',id);setLeads(ls=>ls.filter(l=>l.id!==id));setModal(null);};
  const handleImport=newLeads=>setLeads(ls=>[...ls,...newLeads]);
  return(
    <div>
      <SectionHeader title="Leads Inbox" subtitle="Cold prospects — qualify and convert to pipeline deals"
        action={<div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowImport(true)} style={{...BG,fontSize:12,padding:"8px 16px",color:"#1E3A5F",borderColor:"#1E3A5F44",fontWeight:700}}>⬆ Import File</button>
          <button onClick={()=>setModal({company:"",contact:"",title:"",email:"",phone:"",linkedin:"",source:SOURCES[0],status:"New",owner:OWNERS[0],notes:"",tags:[],secondaryContacts:[]})} style={BP}>+ Add Lead</button>
        </div>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {stats.map(({s,count})=>(
          <div key={s} onClick={()=>setFilter(f=>f===s?"All":s)} style={{...CARD,padding:"16px 20px",cursor:"pointer",borderBottom:"3px solid "+(filter===s?STATUS_COLORS[s]:"#D6D3D1"),transition:"border-color 0.15s"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:4}}>{s}</div>
            <div style={{fontSize:28,fontWeight:800,color:filter===s?STATUS_COLORS[s]:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif"}}>{count}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="Search leads…" value={search} onChange={e=>setSearch(e.target.value)} style={{...INP,maxWidth:260,fontSize:13}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["All",...LEAD_STATUS].map(s=><button key={s} onClick={()=>setFilter(s)} style={{...BG,fontSize:12,padding:"5px 12px",borderColor:filter===s?(STATUS_COLORS[s]||"#1E3A5F"):"#D6D3D1",color:filter===s?(STATUS_COLORS[s]||"#1E3A5F"):"#7A8699",fontWeight:filter===s?700:500}}>{s}</button>)}
        </div>
        {sel.size>0&&<div style={{display:"flex",gap:8,alignItems:"center",marginLeft:"auto"}}>
          <span style={{color:"#7A8699",fontSize:13}}>{sel.size} selected</span>
          <select value={bOwner} onChange={e=>setBOwner(e.target.value)} style={{...SEL,width:"auto",fontSize:12,padding:"6px 10px"}}><option value="">Assign owner…</option>{OWNERS.map(o=><option key={o}>{o}</option>)}</select>
          {bOwner&&<button onClick={()=>{setLeads(l=>l.map(x=>sel.has(x.id)?{...x,owner:bOwner}:x));setSel(new Set());setBOwner("");}} style={{...BG,fontSize:12,padding:"6px 12px",color:"#1E3A5F",borderColor:"#1E3A5F"}}>Assign</button>}
          <button onClick={()=>{setLeads(l=>l.map(x=>sel.has(x.id)?{...x,status:"Disqualified"}:x));setSel(new Set());}} style={{...BG,fontSize:12,padding:"6px 12px"}}>Disqualify</button>
        </div>}
      </div>
      <div style={{...CARD,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#F5F5F5",borderBottom:"1.5px solid #D6D3D1"}}>
            <th style={{padding:"10px 14px",width:36}}><input type="checkbox" checked={allSel} onChange={()=>setSel(allSel?new Set():new Set(shown.map(l=>l.id)))} style={{accentColor:"#1E3A5F"}}/></th>
            {["Company","Primary Contact","Status","Owner","Source","Contacts","Activity"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#7A8699",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {shown.map(l=>(
              <tr key={l.id} style={{borderBottom:"1px solid #F5F5F5",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#F5F5F5"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={{padding:"11px 14px"}} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={sel.has(l.id)} onChange={()=>togSel(l.id)} style={{accentColor:"#1E3A5F"}}/></td>
                <td style={{padding:"11px 14px"}} onClick={()=>setModal(l)}>
                  <div style={{fontWeight:600,color:"#1C2B3A"}}>{l.company}</div>
                  <div style={{fontSize:11,color:"#7A8699",marginTop:1}}>{l.source}</div>
                </td>
                <td style={{padding:"11px 14px"}} onClick={()=>setModal(l)}>
                  <div style={{fontWeight:500,color:"#1C2B3A",fontSize:13}}>{l.contact}</div>
                  <div style={{fontSize:11,color:"#7A8699",marginTop:1}}>{l.title}</div>
                </td>
                <td style={{padding:"11px 14px"}} onClick={()=>setModal(l)}><Badge color={STATUS_COLORS[l.status]}>{l.status}</Badge></td>
                <td style={{padding:"11px 14px"}} onClick={()=>setModal(l)}><div style={{display:"flex",alignItems:"center",gap:7}}><Avatar name={l.owner} size={22}/><span style={{color:"#1C2B3A"}}>{l.owner}</span></div></td>
                <td style={{padding:"11px 14px",color:"#7A8699",fontSize:12}} onClick={()=>setModal(l)}>{l.source}</td>
                <td style={{padding:"11px 14px"}} onClick={()=>setModal(l)}>
                  {(l.secondaryContacts||[]).length>0
                    ?<Badge color="#1E3A5F">+{(l.secondaryContacts||[]).length} more</Badge>
                    :<span style={{color:"#D6D3D1",fontSize:12}}>—</span>}
                </td>
                <td style={{padding:"11px 14px",color:"#7A8699",fontSize:12}} onClick={()=>setModal(l)}>{daysAgo(l.lastActivity)}d ago</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#7A8699"}}>No leads found.</div>}
      </div>
      {modal&&<LeadModal lead={modal} onSave={saveLead} onDelete={delLead} onConvert={l=>{onConvertToDeal(l);setModal(null);}} onClose={()=>setModal(null)}/>}
      {showImport&&<ImportWizard onImport={handleImport} onClose={()=>setShowImport(false)}/>}
    </div>
  );
}


function DealCard({deal,stages,onOpen,onDragStart,activityLogs}){
  const stage=stages.find(s=>s.id===deal.stageId);
  const isRot=stage?.rotDays&&daysAgo(deal.lastActivity)>=stage.rotDays;
  const overdue=deal.nextActionDue&&new Date(deal.nextActionDue)<new Date();
  const [hovered,setHovered]=useState(false);
  const lastLog=(activityLogs?.[deal.id]||[])[0];
  return(
    <div draggable onDragStart={()=>onDragStart(deal.id)} onClick={()=>onOpen(deal)}
      style={{background:"#fff",border:"1px solid "+(isRot?"#FECACA":"#D6D3D1"),borderLeft:"3px solid "+(stage?.color||"#1E3A5F"),borderRadius:10,padding:"13px 14px",cursor:"pointer",marginBottom:8,transition:"box-shadow 0.15s,transform 0.1s",position:"relative"}}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(30,58,95,0.12)";e.currentTarget.style.transform="translateY(-1px)";setHovered(true);}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="";e.currentTarget.style.transform="";setHovered(false);}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <div style={{fontWeight:700,color:"#1C2B3A",fontSize:13,flex:1,paddingRight:8,lineHeight:1.3}}>{deal.company}</div>
        <HealthDot health={deal.health}/>
      </div>
      <div style={{color:"#7A8699",fontSize:11,marginBottom:8}}>{deal.contact}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:deal.tags?.length>0?8:0}}>
        <span style={{fontWeight:800,color:"#701427",fontSize:14}}>{fmtCurrency(deal.arr)}</span>
        <Badge color={stage?.color||"#7A8699"}>{deal.nrrType}</Badge>
      </div>
      {(deal.tags||[]).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6,marginTop:6}}>{(deal.tags||[]).slice(0,2).map(t=><Tag key={t} label={t}/>)}{deal.tags.length>2&&<span style={{fontSize:10,color:"#7A8699"}}>+{deal.tags.length-2}</span>}</div>}
      {deal.nextAction&&deal.nextAction!=="—"&&<div style={{fontSize:11,color:overdue?"#9B1A1A":"#7A8699",borderTop:"1px solid #F5F5F5",paddingTop:7,marginTop:6}}>{overdue?"⚠ ":""}{deal.nextAction}</div>}
      {isRot&&<div style={{marginTop:5,fontSize:10,color:"#9B1A1A",fontWeight:700}}>🕐 Stale {daysAgo(deal.lastActivity)}d</div>}
      {hovered&&lastLog&&(
        <div style={{position:"absolute",left:0,right:0,top:"100%",zIndex:50,background:"#fff",border:"1px solid #D6D3D1",borderTop:"none",borderRadius:"0 0 10px 10px",padding:"10px 14px",boxShadow:"0 8px 20px rgba(30,58,95,0.12)"}}>
          <div style={{fontSize:10,fontWeight:700,color:ACT_META[lastLog.type]?.color||"#7A8699",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{ACT_META[lastLog.type]?.icon} {lastLog.type} · {lastLog.author} · {fmtDate(lastLog.ts)}</div>
          <div style={{fontSize:12,color:"#1C2B3A",lineHeight:1.5}}><MentionText text={lastLog.text}/></div>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({stage,deals,stages,onOpen,onDragStart,onDrop,activityLogs}){
  const [over,setOver]=useState(false);
  const total=deals.reduce((s,d)=>s+Number(d.arr||0),0);
  return(
    <div style={{minWidth:232,flex:"0 0 232px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:"2px solid "+(stage.color+"22")}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:9,height:9,borderRadius:"50%",background:stage.color,display:"inline-block",flexShrink:0}}/>
          <span style={{color:"#1C2B3A",fontWeight:700,fontSize:13}}>{stage.name}</span>
          <span style={{background:"#F5F5F5",color:"#7A8699",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700,border:"1px solid #D6D3D1"}}>{deals.length}</span>
        </div>
        <span style={{color:"#7A8699",fontSize:11,fontWeight:600}}>{fmtCurrency(total)}</span>
      </div>
      <div style={{minHeight:80,borderRadius:10,padding:6,background:over?"rgba(30,58,95,0.04)":"transparent",border:over?"1.5px dashed #1E3A5F55":"1.5px dashed transparent",transition:"all 0.15s"}}
        onDragOver={e=>{e.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={()=>{onDrop(stage.id);setOver(false);}}>
        {deals.map(d=><DealCard key={d.id} deal={d} stages={stages} onOpen={onOpen} onDragStart={onDragStart} activityLogs={activityLogs}/>)}
        {deals.length===0&&<div style={{textAlign:"center",padding:"20px 10px",color:"#D6D3D1",fontSize:12}}>Drop here</div>}
      </div>
    </div>
  );
}

function DealsTable({deals,stages,onOpen}){
  const [sort,setSort]=useState({col:"company",dir:1});const [search,setSearch]=useState("");const [tagF,setTagF]=useState("");
  const tog=col=>setSort(s=>({col,dir:s.col===col?-s.dir:1}));
  const allTags=[...new Set(deals.flatMap(d=>d.tags||[]))].sort();
  const filtered=deals.filter(d=>(d.company+d.contact+d.owner).toLowerCase().includes(search.toLowerCase())&&(!tagF||(d.tags||[]).includes(tagF))).sort((a,b)=>{let av=a[sort.col],bv=b[sort.col];if(sort.col==="arr"){av=Number(av||0);bv=Number(bv||0);}return av>bv?sort.dir:av<bv?-sort.dir:0;});
  const Th=({col,label})=><th onClick={()=>tog(col)} style={{padding:"10px 14px",textAlign:"left",color:sort.col===col?"#1E3A5F":"#7A8699",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",cursor:"pointer",whiteSpace:"nowrap",userSelect:"none",background:"#F5F5F5"}}>{label}{sort.col===col?sort.dir>0?" ↑":" ↓":""}</th>;
  return(
    <div>
      <SectionHeader title="All Deals" subtitle={filtered.length+" of "+deals.length+" deals"}/>
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{...INP,maxWidth:360,fontSize:13}}/>
        <select value={tagF} onChange={e=>setTagF(e.target.value)} style={{...SEL,width:"auto",color:tagF?"#1E3A5F":"#7A8699",fontSize:13}}><option value="">All tags</option>{allTags.map(t=><option key={t} value={t}>{t}</option>)}</select>
      </div>
      <div style={{...CARD,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead style={{borderBottom:"1.5px solid #D6D3D1"}}><tr><Th col="company" label="Company"/><Th col="arr" label="ARR"/><Th col="stageId" label="Stage"/><Th col="owner" label="Owner"/><Th col="nrrType" label="NRR"/><Th col="health" label="Health"/><Th col="closeDate" label="Close"/><th style={{padding:"10px 14px",background:"#F5F5F5",color:"#7A8699",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Tags</th><Th col="lastActivity" label="Activity"/></tr></thead>
          <tbody>
            {filtered.map(d=>{const stage=stages.find(s=>s.id===d.stageId);const days=daysAgo(d.lastActivity);const isRot=stage?.rotDays&&days>=stage.rotDays;
              return(<tr key={d.id} onClick={()=>onOpen(d)} style={{borderBottom:"1px solid #F5F5F5",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#F5F5F5"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={{padding:"11px 14px"}}><div style={{fontWeight:700,color:"#1C2B3A"}}>{d.company}</div><div style={{fontSize:11,color:"#7A8699",marginTop:1}}>{d.contact}</div></td>
                <td style={{padding:"11px 14px",fontWeight:800,color:"#701427",fontSize:14}}>{fmtCurrency(d.arr)}</td>
                <td style={{padding:"11px 14px"}}><span style={{background:(stage?.color||"#7A8699")+"14",color:stage?.color||"#7A8699",borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:700}}>{stage?.name||d.stageId}</span></td>
                <td style={{padding:"11px 14px"}}><div style={{display:"flex",alignItems:"center",gap:7}}><Avatar name={d.owner} size={22}/><span style={{color:"#1C2B3A",fontSize:12}}>{d.owner}</span></div></td>
                <td style={{padding:"11px 14px",color:"#7A8699",fontSize:12}}>{d.nrrType}</td>
                <td style={{padding:"11px 14px"}}><HealthDot health={d.health}/></td>
                <td style={{padding:"11px 14px",color:"#7A8699",fontSize:12}}>{d.closeDate||"—"}</td>
                <td style={{padding:"11px 14px"}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{(d.tags||[]).slice(0,2).map(t=><Tag key={t} label={t}/>)}{(d.tags||[]).length>2&&<span style={{fontSize:10,color:"#7A8699"}}>+{d.tags.length-2}</span>}</div></td>
                <td style={{padding:"11px 14px"}}>{isRot?<span style={{color:"#9B1A1A",fontWeight:700,fontSize:12}}>🕐 {days}d</span>:<span style={{color:"#7A8699",fontSize:12}}>{days}d ago</span>}</td>
              </tr>);
            })}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#7A8699"}}>No deals match.</div>}
      </div>
    </div>
  );
}

function Dashboard({deals,stages,leads}){
  const open=deals.filter(d=>d.stageId!=="s5"&&d.stageId!=="s6");
  const won=deals.filter(d=>d.stageId==="s5");const lost=deals.filter(d=>d.stageId==="s6");
  const totalPipe=open.reduce((s,d)=>s+Number(d.arr||0),0);const totalWon=won.reduce((s,d)=>s+Number(d.arr||0),0);
  const winRate=(won.length+lost.length)?Math.round(won.length/(won.length+lost.length)*100):0;
  const rotCount=open.filter(d=>{const st=stages.find(s=>s.id===d.stageId);return st?.rotDays&&daysAgo(d.lastActivity)>=st.rotDays;}).length;
  const qualLeads=leads.filter(l=>l.status==="Qualified").length;
  const convRate=leads.length?Math.round((won.length/leads.length)*100):0;
  const srcData=["Inbound","Outbound","Referral","Partner","Event"].map(s=>({src:s,pipe:open.filter(d=>d.source===s).reduce((t,d)=>t+Number(d.arr||0),0),count:open.filter(d=>d.source===s).length,leads:leads.filter(l=>l.source===s).length})).filter(s=>s.count>0||s.leads>0);
  const maxSrc=Math.max(...srcData.map(x=>x.pipe),1);
  const funnelSteps=[{label:"Total Leads",count:leads.length,color:"#1E3A5F"},{label:"Qualified Leads",count:qualLeads,color:"#5B3A8A"},{label:"Open Deals",count:open.length,color:"#7C4D00"},{label:"Closed Won",count:won.length,color:"#1A5C3A"}];
  const maxF=Math.max(...funnelSteps.map(x=>x.count),1);
  const stgB=stages.filter(s=>s.id!=="s5"&&s.id!=="s6").map(s=>({...s,arr:open.filter(d=>d.stageId===s.id).reduce((sum,d)=>sum+Number(d.arr||0),0),count:open.filter(d=>d.stageId===s.id).length}));
  const maxArr=Math.max(...stgB.map(s=>s.arr),1);
  const needAttn=open.filter(d=>{const st=stages.find(s=>s.id===d.stageId);return(st?.rotDays&&daysAgo(d.lastActivity)>=st.rotDays)||(d.nextActionDue&&new Date(d.nextActionDue)<new Date())||d.health==="red";});
  const Bar=({w,color})=><div style={{height:8,background:"#F5F5F5",borderRadius:4,overflow:"hidden",border:"1px solid #D6D3D1",marginTop:5}}><div style={{height:"100%",background:color,width:w+"%",borderRadius:4,transition:"width 0.8s ease"}}/></div>;
  return(
    <div>
      <SectionHeader title="Dashboard" subtitle="Pipeline health, conversion funnel, and source performance"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28}}>
        <StatCard label="Pipeline ARR" value={fmtCurrency(totalPipe)} sub={open.length+" open deals"} color="#1E3A5F" icon="💰"/>
        <StatCard label="Closed Won" value={fmtCurrency(totalWon)} sub={won.length+" deals"} color="#1A5C3A" icon="🏆"/>
        <StatCard label="Win Rate" value={winRate+"%"} sub={won.length+"W · "+lost.length+"L"} color="#701427" icon="📊"/>
        <StatCard label="Qualified Leads" value={qualLeads} sub={"of "+leads.length+" total"} color="#5B3A8A" icon="🎯"/>
        <StatCard label="Lead→Win" value={convRate+"%"} sub="conversion rate" icon="⚡"/>
        <StatCard label="Stale Deals" value={rotCount} sub="need attention" color={rotCount>0?"#9B1A1A":"#1A5C3A"} icon="⏰"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={{...CARD,padding:24}}>
          <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:20}}>Lead → Close Funnel</div>
          {funnelSteps.map((f,i)=>(
            <div key={f.label} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:"#1C2B3A",fontSize:13}}>{f.label}</span><span style={{color:f.color,fontWeight:800,fontSize:14}}>{f.count}</span></div>
              <Bar w={(f.count/maxF)*100} color={f.color}/>
              {i<funnelSteps.length-1&&f.count>0&&<div style={{color:"#7A8699",fontSize:11,marginTop:2}}>↓ {Math.round((funnelSteps[i+1].count/f.count)*100)}% conversion</div>}
            </div>
          ))}
        </div>
        <div style={{...CARD,padding:24}}>
          <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:20}}>Pipeline by Stage</div>
          {stgB.map(s=>(
            <div key={s.id} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#1C2B3A",fontSize:13}}>{s.name}</span><span style={{color:"#7A8699",fontSize:12}}>{fmtCurrency(s.arr)} · {s.count}</span></div>
              <Bar w={(s.arr/maxArr)*100} color={s.color}/>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div style={{...CARD,padding:24}}>
          <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:20}}>Source Channel Performance</div>
          {srcData.length===0?<div style={{color:"#7A8699",fontSize:13}}>No source data yet.</div>:srcData.map(s=>(
            <div key={s.src} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#1C2B3A",fontSize:13}}>{s.src}</span><div><span style={{color:"#1E3A5F",fontWeight:700,fontSize:12}}>{fmtCurrency(s.pipe)}</span><span style={{color:"#7A8699",fontSize:11,marginLeft:8}}>{s.leads} leads · {s.count} deals</span></div></div>
              <div style={{height:8,background:"#F5F5F5",borderRadius:4,overflow:"hidden",border:"1px solid #D6D3D1",marginTop:5}}><div style={{height:"100%",background:"linear-gradient(90deg,#1E3A5F,#C4B5A6)",width:((s.pipe/maxSrc)*100)+"%",borderRadius:4}}/></div>
            </div>
          ))}
        </div>
        <div style={{...CARD,padding:24}}>
          <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:20}}>⚠ Needs Attention</div>
          {needAttn.length===0?<div style={{textAlign:"center",padding:"24px 0",color:"#1A5C3A",fontWeight:600,fontSize:13}}>✓ All deals healthy</div>
            :needAttn.map(d=>{const st=stages.find(s=>s.id===d.stageId);const rot=st?.rotDays&&daysAgo(d.lastActivity)>=st.rotDays;const od=d.nextActionDue&&new Date(d.nextActionDue)<new Date();
              return(<div key={d.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #F5F5F5"}}>
                <HealthDot health={d.health} size={10}/><div style={{flex:1}}><span style={{color:"#1C2B3A",fontWeight:600,fontSize:13}}>{d.company}</span><span style={{color:"#7A8699",fontSize:12,marginLeft:8}}>{st?.name}</span></div>
                <div style={{display:"flex",gap:5}}>{rot&&<Badge color="#9B1A1A">Stale {daysAgo(d.lastActivity)}d</Badge>}{od&&<Badge color="#7C4D00">Overdue</Badge>}{d.health==="red"&&!rot&&!od&&<Badge color="#9B1A1A">At risk</Badge>}</div>
              </div>);
            })
          }
        </div>
      </div>
    </div>
  );
}

function ActivitiesView({activities,setActivities,deals}){
  const [filter,setFilter]=useState("upcoming");const [tF,setTF]=useState("All");const [oF,setOF]=useState("All");const [newAct,setNewAct]=useState(null);
  const today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const shown=activities.filter(a=>{const d=new Date(a.dueDate);if(tF!=="All"&&a.type!==tF)return false;if(oF!=="All"&&a.owner!==oF)return false;if(filter==="overdue")return !a.done&&d<today;if(filter==="today")return !a.done&&d>=today&&d<tomorrow;if(filter==="upcoming")return !a.done&&d>=today;if(filter==="done")return a.done;return true;}).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const saveNew=()=>{if(!newAct?.title?.trim())return;setActivities(as=>[...as,{...newAct,id:uid(),done:false}]);setNewAct(null);};
  const counts={overdue:activities.filter(a=>!a.done&&new Date(a.dueDate)<today).length,today:activities.filter(a=>!a.done&&new Date(a.dueDate)>=today&&new Date(a.dueDate)<tomorrow).length,upcoming:activities.filter(a=>!a.done&&new Date(a.dueDate)>=today).length,done:activities.filter(a=>a.done).length};
  return(
    <div>
      <SectionHeader title="Activities" subtitle="Scheduled calls, meetings, tasks and follow-ups" action={<button onClick={()=>setNewAct({title:"",type:"Call",dueDate:new Date().toISOString().slice(0,10),owner:OWNERS[0],dealId:"",company:"",notes:""})} style={BP}>+ Schedule</button>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[{l:"Overdue",f:"overdue",c:"#9B1A1A"},{l:"Due Today",f:"today",c:"#7C4D00"},{l:"Upcoming",f:"upcoming",c:"#1E3A5F"},{l:"Completed",f:"done",c:"#1A5C3A"}].map(x=>(
          <div key={x.f} onClick={()=>setFilter(x.f)} style={{...CARD,padding:"16px 20px",cursor:"pointer",borderBottom:"3px solid "+(filter===x.f?x.c:"#D6D3D1"),transition:"border-color 0.15s"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:4}}>{x.l}</div>
            <div style={{fontSize:28,fontWeight:800,color:filter===x.f?x.c:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif"}}>{counts[x.f]}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <select value={tF} onChange={e=>setTF(e.target.value)} style={{...SEL,width:"auto",fontSize:12,color:tF!=="All"?"#1E3A5F":"#7A8699"}}><option>All</option>{ACT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
        <select value={oF} onChange={e=>setOF(e.target.value)} style={{...SEL,width:"auto",fontSize:12,color:oF!=="All"?"#1E3A5F":"#7A8699"}}><option>All</option>{OWNERS.map(o=><option key={o}>{o}</option>)}</select>
      </div>
      {newAct&&(
        <div style={{...CARD,padding:18,marginBottom:16,borderLeft:"3px solid #1E3A5F"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <input placeholder="Title…" value={newAct.title} onChange={e=>setNewAct(a=>({...a,title:e.target.value}))} style={INP}/>
            <select value={newAct.type} onChange={e=>setNewAct(a=>({...a,type:e.target.value}))} style={SEL}>{ACT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
            <input type="date" value={newAct.dueDate} onChange={e=>setNewAct(a=>({...a,dueDate:e.target.value}))} style={INP}/>
            <select value={newAct.owner} onChange={e=>setNewAct(a=>({...a,owner:e.target.value}))} style={SEL}>{OWNERS.map(o=><option key={o}>{o}</option>)}</select>
          </div>
          <div style={{display:"flex",gap:8}}>
            <select value={newAct.dealId} onChange={e=>{const d=deals.find(x=>x.id===e.target.value);setNewAct(a=>({...a,dealId:e.target.value,company:d?.company||""}));}} style={{...SEL,flex:1,fontSize:12}}><option value="">Link to deal…</option>{deals.map(d=><option key={d.id} value={d.id}>{d.company}</option>)}</select>
            <input placeholder="Notes…" value={newAct.notes} onChange={e=>setNewAct(a=>({...a,notes:e.target.value}))} style={{...INP,flex:2,fontSize:12}}/>
            <button onClick={saveNew} style={BP}>Save</button>
            <button onClick={()=>setNewAct(null)} style={BG}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {shown.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#7A8699",fontSize:13}}>No activities here.</div>}
        {shown.map(a=>{const m=ACT_META[a.type]||ACT_META.Note;const d=new Date(a.dueDate);const isOD=!a.done&&d<today;const isTD=!a.done&&d>=today&&d<tomorrow;
          return(
            <div key={a.id} style={{...CARD,padding:"13px 16px",display:"flex",alignItems:"center",gap:14,borderLeft:"3px solid "+(isOD?"#9B1A1A":isTD?"#7C4D00":"#D6D3D1")}}>
              <button onClick={()=>setActivities(as=>as.map(x=>x.id===a.id?{...x,done:!x.done}:x))} style={{width:22,height:22,borderRadius:"50%",border:"2px solid "+(a.done?"#1A5C3A":"#D6D3D1"),background:a.done?"#1A5C3A14":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#1A5C3A",fontSize:12,fontFamily:"inherit"}}>{a.done?"✓":""}</button>
              <span style={{fontSize:18,flexShrink:0}}>{m.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                  <span style={{color:a.done?"#7A8699":"#1C2B3A",fontWeight:600,fontSize:13,textDecoration:a.done?"line-through":"none"}}>{a.title}</span>
                  {a.company&&<Badge color="#1E3A5F">{a.company}</Badge>}
                </div>
                {a.notes&&<div style={{color:"#7A8699",fontSize:12}}>{a.notes}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{color:isOD?"#9B1A1A":isTD?"#7C4D00":"#7A8699",fontSize:12,fontWeight:isOD||isTD?700:400}}>{isOD?"Overdue "+daysAgo(a.dueDate)+"d":isTD?"Due today":fmtDate(a.dueDate)}</div>
                <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end",marginTop:2}}><Avatar name={a.owner} size={16}/><span style={{color:"#7A8699",fontSize:11}}>{a.owner}</span></div>
              </div>
              <button onClick={()=>setActivities(as=>as.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:"#D6D3D1",cursor:"pointer",fontSize:18,padding:2}} onMouseEnter={e=>e.currentTarget.style.color="#9B1A1A"} onMouseLeave={e=>e.currentTarget.style.color="#D6D3D1"}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GlobalFeed({deals,stages,activityLogs,onOpen}){
  const all=deals.flatMap(d=>(activityLogs[d.id]||[]).map(e=>({...e,deal:d,stage:stages.find(s=>s.id===d.stageId)}))).sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  return(
    <div style={{maxWidth:680}}>
      <SectionHeader title="Activity Feed" subtitle="All logged activity across your pipeline"/>
      {all.map((e,i)=>{const m=ACT_META[e.type]||ACT_META.Note;return(
        <div key={e.id} style={{display:"flex",gap:14}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:m.color+"12",border:"1.5px solid "+m.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{m.icon}</div>
            {i<all.length-1&&<div style={{width:1.5,flex:1,background:"#D6D3D1",minHeight:12,margin:"4px 0"}}/>}
          </div>
          <div style={{flex:1,paddingBottom:20,cursor:"pointer"}} onClick={()=>onOpen(e.deal)}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:m.color,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em"}}>{e.type}</span>
                <span style={{color:"#1C2B3A",fontSize:13,fontWeight:700}}>{e.deal.company}</span>
                <span style={{color:"#7A8699",fontSize:12}}>· {e.author}</span>
              </div>
              <span style={{color:"#7A8699",fontSize:11}}>{fmtDate(e.ts)}</span>
            </div>
            <div style={{color:"#1C2B3A",fontSize:13,lineHeight:1.6,marginBottom:6}}><MentionText text={e.text}/></div>
            <div style={{display:"flex",gap:6}}><Badge color={e.stage?.color||"#7A8699"}>{e.stage?.name}</Badge><Badge color="#1E3A5F">{e.deal.nrrType}</Badge></div>
          </div>
        </div>
      );})}
    </div>
  );
}

function VelocityView({deals,stages,stageHistory}){
  const openS=stages.filter(s=>s.id!=="s5"&&s.id!=="s6");
  const stTimes=openS.map(stage=>{const sd=deals.filter(d=>d.stageId===stage.id);const times=sd.map(d=>{const e=(stageHistory[d.id]||[]).find(h=>h.stageId===stage.id);return e?daysAgo(e.enteredAt):daysAgo(d.lastActivity);});const avg=times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):0;return{stage,avg,count:sd.length,warn:stage.rotDays&&avg>=stage.rotDays};});
  const maxA=Math.max(...stTimes.map(s=>s.avg),1);
  const won=deals.filter(d=>d.stageId==="s5");const lost=deals.filter(d=>d.stageId==="s6");
  const avgW=won.length?Math.round(won.reduce((s,d)=>s+daysAgo(d.lastActivity),0)/won.length):0;
  const avgL=lost.length?Math.round(lost.reduce((s,d)=>s+daysAgo(d.lastActivity),0)/lost.length):0;
  return(
    <div style={{maxWidth:800}}>
      <SectionHeader title="Velocity" subtitle="How fast deals move through your pipeline"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:28}}>
        <StatCard label="Avg Days to Close (Won)" value={avgW+"d"} color="#1A5C3A" icon="🏆" sub={won.length+" deals"}/>
        <StatCard label="Avg Days to Close (Lost)" value={avgL+"d"} color="#9B1A1A" icon="❌" sub={lost.length+" deals"}/>
        <StatCard label="Open Deals" value={deals.filter(d=>d.stageId!=="s5"&&d.stageId!=="s6").length} color="#1E3A5F" icon="📋" sub="active"/>
      </div>
      <div style={{...CARD,padding:28}}>
        <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:24}}>Average Days per Stage</div>
        {stTimes.map(({stage,avg,count,warn})=>(
          <div key={stage.id} style={{marginBottom:22}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7,alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{width:9,height:9,borderRadius:"50%",background:stage.color,display:"inline-block"}}/><span style={{color:"#1C2B3A",fontSize:14,fontWeight:600}}>{stage.name}</span><span style={{color:"#7A8699",fontSize:12}}>{count} deals</span>{warn&&<Badge color="#9B1A1A">⚠ above threshold</Badge>}</div>
              <span style={{color:warn?"#9B1A1A":"#1C2B3A",fontWeight:800,fontSize:16}}>{avg}d</span>
            </div>
            <div style={{height:10,background:"#F5F5F5",borderRadius:5,overflow:"hidden",border:"1px solid #D6D3D1"}}><div style={{height:"100%",background:warn?"linear-gradient(90deg,"+stage.color+",#9B1A1A)":stage.color,width:((avg/maxA)*100)+"%",borderRadius:5,transition:"width 0.8s ease"}}/></div>
            {stage.rotDays&&<div style={{fontSize:11,color:"#7A8699",marginTop:3}}>Threshold: {stage.rotDays}d</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function WinLossView({deals,prospects=[]}){
  const won=deals.filter(d=>d.stageId==="s5");const lost=deals.filter(d=>d.stageId==="s6");
  const winRate=(won.length+lost.length)?Math.round(won.length/(won.length+lost.length)*100):0;
  const wonARR=won.reduce((s,d)=>s+Number(d.arr||0),0);const lostARR=lost.reduce((s,d)=>s+Number(d.arr||0),0);
  const agg=arr=>{const c={};arr.forEach(d=>{const r=(d.winLossReason||"").trim()||"Not specified";c[r]=(c[r]||0)+1;});return Object.entries(c).sort((a,b)=>b[1]-a[1]);};
  const wonR=agg(won);const lostR=agg(lost);const mW=Math.max(...wonR.map(r=>r[1]),1);const mL=Math.max(...lostR.map(r=>r[1]),1);
  const ownerStats=OWNERS.map(o=>({owner:o,won:won.filter(d=>d.owner===o).length,lost:lost.filter(d=>d.owner===o).length,wonARR:won.filter(d=>d.owner===o).reduce((s,d)=>s+Number(d.arr||0),0)})).filter(o=>o.won+o.lost>0).sort((a,b)=>b.wonARR-a.wonARR);
  const Bar=({reason,count,max,color})=>(<div style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#1C2B3A",fontSize:13}}>{reason}</span><span style={{color,fontWeight:700}}>{count}×</span></div><div style={{height:7,background:"#F5F5F5",borderRadius:4,border:"1px solid #D6D3D1"}}><div style={{height:"100%",background:color,width:((count/max)*100)+"%",borderRadius:4,transition:"width 0.8s ease"}}/></div></div>);
  return(
    <div>
      <SectionHeader title="Win / Loss" subtitle="Closed deal analysis and team performance"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
        <StatCard label="Win Rate" value={winRate+"%"} color="#1E3A5F" icon="📊"/>
        <StatCard label="Won ARR" value={fmtCurrency(wonARR)} color="#1A5C3A" sub={won.length+" deals"} icon="🏆"/>
        <StatCard label="Lost ARR" value={fmtCurrency(lostARR)} color="#9B1A1A" sub={lost.length+" deals"} icon="❌"/>
        <StatCard label="Total Closed" value={won.length+lost.length} icon="🔒"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={{...CARD,padding:24}}><div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#1A5C3A",marginBottom:16}}>✓ Win Reasons</div>{wonR.length===0?<div style={{color:"#7A8699",fontSize:13}}>No won deals yet.</div>:wonR.map(([r,c])=><Bar key={r} reason={r} count={c} max={mW} color="#1A5C3A"/>)}</div>
        <div style={{...CARD,padding:24}}><div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#9B1A1A",marginBottom:16}}>✗ Loss Reasons</div>{lostR.length===0?<div style={{color:"#7A8699",fontSize:13}}>No lost deals yet.</div>:lostR.map(([r,c])=><Bar key={r} reason={r} count={c} max={mL} color="#9B1A1A"/>)}</div>
      </div>
      {ownerStats.length>0&&<div style={{...CARD,padding:24}}><div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:16}}>Performance by Owner</div>{ownerStats.map(o=>(<div key={o.owner} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:14,borderBottom:"1px solid #F5F5F5"}}><div style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={o.owner} size={32}/><div><div style={{color:"#1C2B3A",fontSize:13,fontWeight:600}}>{o.owner}</div><div style={{color:"#7A8699",fontSize:11,marginTop:1}}>{o.won}W · {o.lost}L</div></div></div><div style={{textAlign:"right"}}><div style={{color:"#1A5C3A",fontWeight:800,fontSize:15}}>{fmtCurrency(o.wonARR)}</div><div style={{color:"#7A8699",fontSize:11,marginTop:2}}>{o.won+o.lost>0?Math.round(o.won/(o.won+o.lost)*100):0}% win rate</div></div></div>))}</div>}

      {/* Prospect Ghosted Reasons */}
      {(()=>{
        const ghosted=prospects.filter(p=>p.status==="Ghosted"&&p.ghostedReason);
        if(ghosted.length===0)return null;
        const counts={};ghosted.forEach(p=>{counts[p.ghostedReason]=(counts[p.ghostedReason]||0)+1;});
        const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
        const maxG=Math.max(...rows.map(r=>r[1]),1);
        return(
          <div style={{...CARD,padding:24,marginTop:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#9B1A1A"}}>👻 Prospect Ghosted Reasons</div>
                <div style={{color:"#7A8699",fontSize:12,marginTop:2}}>{ghosted.length} ghosted prospect{ghosted.length!==1?"s":""} with logged reasons</div>
              </div>
              <div style={{marginLeft:"auto",display:"flex",gap:12}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#9B1A1A",fontFamily:"'Playfair Display',Georgia,serif"}}>{ghosted.length}</div><div style={{fontSize:11,color:"#7A8699",textTransform:"uppercase",letterSpacing:"0.07em"}}>Ghosted</div></div>
                <div style={{textAlign:"center",marginLeft:16}}><div style={{fontSize:20,fontWeight:800,color:"#7A8699",fontFamily:"'Playfair Display',Georgia,serif"}}>{prospects.filter(p=>p.status==="Ghosted").length-ghosted.length}</div><div style={{fontSize:11,color:"#7A8699",textTransform:"uppercase",letterSpacing:"0.07em"}}>No reason logged</div></div>
              </div>
            </div>
            {rows.map(([reason,count])=>(
              <div key={reason} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#1C2B3A",fontSize:13}}>{reason}</span><span style={{color:"#9B1A1A",fontWeight:700}}>{count}×</span></div>
                <div style={{height:7,background:"#F5F5F5",borderRadius:4,border:"1px solid #D6D3D1"}}><div style={{height:"100%",background:"#9B1A1A",width:((count/maxG)*100)+"%",borderRadius:4,transition:"width 0.8s ease"}}/></div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function AutomationsView({automations,setAutomations,stages}){
  const [editing,setEditing]=useState(null);
  const tog=id=>setAutomations(as=>as.map(a=>a.id===id?{...a,active:!a.active}:a));
  const save=rule=>{setAutomations(as=>as.find(x=>x.id===rule.id)?as.map(x=>x.id===rule.id?rule:x):[...as,rule]);setEditing(null);};
  const del=id=>setAutomations(as=>as.filter(a=>a.id!==id));
  return(
    <div style={{maxWidth:820}}>
      <SectionHeader title="Automations" subtitle="Auto-trigger actions when deals enter stages" action={<button onClick={()=>setEditing({id:uid(),active:true,name:"",trigger:"stage_enter",triggerStageId:stages[0]?.id,action:"create_activity",actionType:"Follow-up",actionNote:"",delayDays:0})} style={BP}>+ New Rule</button>}/>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {automations.map(a=>{const tS=stages.find(s=>s.id===a.triggerStageId);return(
          <div key={a.id} style={{...CARD,padding:"18px 22px",display:"flex",alignItems:"center",gap:18,opacity:a.active?1:.5,transition:"opacity 0.2s"}}>
            <button onClick={()=>tog(a.id)} style={{width:44,height:24,borderRadius:12,border:"none",background:a.active?"#1E3A5F":"#D6D3D1",cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
              <span style={{position:"absolute",top:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",left:a.active?23:3,boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
            </button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"#1C2B3A",fontWeight:700,fontSize:14,marginBottom:8}}>{a.name||"Unnamed rule"}</div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <Badge color="#5B3A8A" bg="#5B3A8A12">WHEN</Badge>
                <span style={{color:"#7A8699",fontSize:12}}>deal enters</span>
                {tS&&<span style={{background:tS.color+"12",color:tS.color,borderRadius:5,fontSize:11,padding:"2px 8px",fontWeight:700,border:"1px solid "+tS.color+"33"}}>{tS.name}</span>}
                <span style={{color:"#D6D3D1",fontSize:14}}>→</span>
                <Badge color="#1E3A5F" bg="#1E3A5F10">THEN</Badge>
                <span style={{color:"#7A8699",fontSize:12}}>{a.action==="create_activity"?"Create":"Set health"}</span>
                {a.action==="create_activity"&&<Badge color={ACT_META[a.actionType]?.color||"#7A8699"}>{ACT_META[a.actionType]?.icon} {a.actionType}</Badge>}
                {a.action==="set_health"&&<HealthDot health={a.actionType} size={12}/>}
                {a.delayDays>0&&<span style={{color:"#7A8699",fontSize:11}}>after {a.delayDays}d</span>}
              </div>
              {a.actionNote&&<div style={{color:"#7A8699",fontSize:12,marginTop:6,fontStyle:"italic"}}>"{a.actionNote}"</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditing(a)} style={{...BG,fontSize:12,padding:"5px 12px"}}>Edit</button>
              <button onClick={()=>del(a.id)} style={{...BG,fontSize:12,padding:"5px 12px",color:"#9B1A1A",borderColor:"#9B1A1A33"}}>Delete</button>
            </div>
          </div>
        );})}
      </div>
      {editing&&(
        <div style={{position:"fixed",inset:0,background:"rgba(30,58,95,0.3)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setEditing(null)}>
          <div style={{background:"#fff",borderRadius:16,width:500,boxShadow:"0 24px 80px rgba(30,58,95,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"24px 28px",borderBottom:"1px solid #D6D3D1"}}><h3 style={{margin:0,color:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif",fontSize:20,fontWeight:700}}>Edit Rule</h3></div>
            <div style={{padding:"24px 28px",display:"flex",flexDirection:"column",gap:14}}>
              <label style={{display:"flex",flexDirection:"column"}}><span style={LBL}>Rule Name</span><input value={editing.name} onChange={e=>setEditing(x=>({...x,name:e.target.value}))} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/></label>
              <div style={{background:"#1E3A5F06",border:"1.5px solid #1E3A5F20",borderRadius:10,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#5B3A8A",marginBottom:10}}>WHEN — Trigger</div>
                <label style={{display:"flex",flexDirection:"column"}}><span style={LBL}>Deal enters stage</span><select value={editing.triggerStageId} onChange={e=>setEditing(x=>({...x,triggerStageId:e.target.value}))} style={SEL}>{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              </div>
              <div style={{background:"#C4B5A610",border:"1.5px solid #C4B5A644",borderRadius:10,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#1E3A5F",marginBottom:10}}>THEN — Action</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <label style={{display:"flex",flexDirection:"column"}}><span style={LBL}>Action</span><select value={editing.action} onChange={e=>setEditing(x=>({...x,action:e.target.value}))} style={SEL}><option value="create_activity">Create activity</option><option value="set_health">Set health</option></select></label>
                  {editing.action==="create_activity"&&<label style={{display:"flex",flexDirection:"column"}}><span style={LBL}>Type</span><select value={editing.actionType} onChange={e=>setEditing(x=>({...x,actionType:e.target.value}))} style={SEL}>{ACT_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>}
                  {editing.action==="set_health"&&<label style={{display:"flex",flexDirection:"column"}}><span style={LBL}>Health</span><select value={editing.actionType} onChange={e=>setEditing(x=>({...x,actionType:e.target.value}))} style={SEL}>{HEALTH.map(h=><option key={h} value={h}>{h[0].toUpperCase()+h.slice(1)}</option>)}</select></label>}
                </div>
                {editing.action==="create_activity"&&<label style={{display:"flex",flexDirection:"column",marginTop:12}}><span style={LBL}>Activity note</span><input value={editing.actionNote} onChange={e=>setEditing(x=>({...x,actionNote:e.target.value}))} style={INP} onFocus={e=>e.target.style.borderColor="#1E3A5F"} onBlur={e=>e.target.style.borderColor="#D6D3D1"}/></label>}
                <label style={{display:"flex",flexDirection:"column",marginTop:12}}><span style={LBL}>Delay (days)</span><input type="number" min={0} value={editing.delayDays} onChange={e=>setEditing(x=>({...x,delayDays:Number(e.target.value)}))} style={{...INP,width:80}}/></label>
              </div>
            </div>
            <div style={{padding:"16px 28px",borderTop:"1px solid #D6D3D1",display:"flex",gap:10,justifyContent:"flex-end",background:"#F5F5F5",borderRadius:"0 0 16px 16px"}}>
              <button onClick={()=>setEditing(null)} style={BG}>Cancel</button>
              <button onClick={()=>save(editing)} style={BP}>Save Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageManager({stages,onSave,onClose}){
  const [list,setList]=useState(stages.map(s=>({...s})));
  const upd=(id,k,v)=>setList(l=>l.map(s=>s.id===id?{...s,[k]:v}:s));
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(30,58,95,0.3)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:500,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(30,58,95,0.2)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"24px 28px",borderBottom:"1px solid #D6D3D1"}}><h2 style={{margin:0,color:"#1C2B3A",fontFamily:"'Playfair Display',Georgia,serif",fontSize:20,fontWeight:700}}>Customize Stages</h2></div>
        <div style={{padding:"24px 28px"}}>
          {list.map(s=>(
            <div key={s.id} style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
              <input type="color" value={s.color} onChange={e=>upd(s.id,"color",e.target.value)} style={{width:36,height:36,border:"1.5px solid #D6D3D1",borderRadius:8,cursor:"pointer",padding:2}}/>
              <input value={s.name} onChange={e=>upd(s.id,"name",e.target.value)} style={{...INP,flex:1}}/>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>
                <span style={{...LBL,marginBottom:0,width:52,textAlign:"center"}}>Rot</span>
                <input type="number" value={s.rotDays||""} onChange={e=>upd(s.id,"rotDays",e.target.value?Number(e.target.value):null)} placeholder="off" style={{...INP,width:60,textAlign:"center",padding:"6px 8px",fontSize:12}}/>
              </div>
              <button onClick={()=>setList(l=>l.filter(x=>x.id!==s.id))} style={{background:"none",border:"none",color:"#D6D3D1",cursor:"pointer",fontSize:20}} onMouseEnter={e=>e.currentTarget.style.color="#9B1A1A"} onMouseLeave={e=>e.currentTarget.style.color="#D6D3D1"}>×</button>
            </div>
          ))}
          <button onClick={()=>setList(l=>[...l,{id:uid(),name:"New Stage",color:"#1E3A5F",rotDays:14}])} style={{width:"100%",marginTop:8,background:"#F5F5F5",border:"1.5px dashed #D6D3D1",color:"#7A8699",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>+ Add Stage</button>
        </div>
        <div style={{padding:"16px 28px",borderTop:"1px solid #D6D3D1",display:"flex",gap:10,justifyContent:"flex-end",background:"#F5F5F5",borderRadius:"0 0 16px 16px"}}>
          <button onClick={onClose} style={BG}>Cancel</button>
          <button onClick={()=>{onSave(list);onClose();}} style={BP}>Save Stages</button>
        </div>
      </div>
    </div>
  );
}

function ForecastView({deals,stages}){
  // Default stage probabilities
  const DEFAULT_PROBS={"s1":10,"s2":25,"s3":50,"s4":75,"s5":100,"s6":0};
  const [probs,setProbs]=useState(DEFAULT_PROBS);
  const [editProbs,setEditProbs]=useState(false);

  const openDeals=deals.filter(d=>d.stageId!=="s5"&&d.stageId!=="s6"&&d.closeDate&&d.arr);

  // Group by close month
  const byMonth={};
  openDeals.forEach(d=>{
    const m=d.closeDate.slice(0,7); // "2026-04"
    if(!byMonth[m])byMonth[m]={month:m,deals:[],fullARR:0,weightedARR:0};
    const prob=(probs[d.stageId]||0)/100;
    byMonth[m].deals.push({...d,prob:probs[d.stageId]||0});
    byMonth[m].fullARR+=Number(d.arr||0);
    byMonth[m].weightedARR+=Number(d.arr||0)*prob;
  });

  const months=Object.values(byMonth).sort((a,b)=>a.month.localeCompare(b.month));
  const maxW=Math.max(...months.map(m=>m.weightedARR),1);
  const totalW=months.reduce((s,m)=>s+m.weightedARR,0);
  const totalF=months.reduce((s,m)=>s+m.fullARR,0);

  const fmtMonth=m=>{const[y,mo]=m.split("-");return new Date(y,mo-1).toLocaleDateString("en-US",{month:"long",year:"numeric"});};

  return(
    <div style={{maxWidth:900}}>
      <SectionHeader title="Forecast" subtitle="Expected ARR by close month — weighted by stage probability"
        action={<button onClick={()=>setEditProbs(e=>!e)} style={{...BG,fontSize:12,padding:"7px 14px",color:"#1E3A5F",borderColor:"#1E3A5F33"}}>{editProbs?"Done":"⚙ Edit Probabilities"}</button>}/>

      {/* Probability editor */}
      {editProbs&&(
        <div style={{...CARD,padding:20,marginBottom:24}}>
          <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7A8699",marginBottom:14}}>Stage Win Probabilities</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {stages.filter(s=>s.id!=="s6").map(s=>(
              <div key={s.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,fontWeight:700,color:s.color,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{s.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <input type="number" min={0} max={100} value={probs[s.id]||0} onChange={e=>setProbs(p=>({...p,[s.id]:Number(e.target.value)}))}
                    style={{...INP,width:60,textAlign:"center",padding:"6px 8px",fontSize:13,fontWeight:700}}/>
                  <span style={{color:"#7A8699",fontSize:12}}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:28}}>
        <StatCard label="Weighted Forecast" value={"$"+Math.round(totalW/1000)+"K"} color="#1E3A5F" icon="🎯" sub={openDeals.length+" open deals"}/>
        <StatCard label="Full Pipeline ARR" value={"$"+Math.round(totalF/1000)+"K"} color="#7A8699" icon="📋" sub="if all deals close"/>
        <StatCard label="Forecast Coverage" value={totalF>0?Math.round((totalW/totalF)*100)+"%":"—"} color="#701427" icon="📊" sub="weighted / full"/>
      </div>

      {/* Month bars */}
      {months.length===0
        ?<div style={{...CARD,padding:"40px 0",textAlign:"center",color:"#7A8699"}}>No open deals with close dates set. Add close dates to your pipeline deals to see the forecast.</div>
        :months.map(m=>(
          <div key={m.month} style={{...CARD,padding:20,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontWeight:700,color:"#1C2B3A",fontSize:15,fontFamily:"'Playfair Display',Georgia,serif"}}>{fmtMonth(m.month)}</div>
                <div style={{color:"#7A8699",fontSize:12,marginTop:2}}>{m.deals.length} deal{m.deals.length!==1?"s":""}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,color:"#1E3A5F",fontSize:18}}>${Math.round(m.weightedARR/1000)}K <span style={{fontSize:12,fontWeight:400,color:"#7A8699"}}>weighted</span></div>
                <div style={{color:"#7A8699",fontSize:12}}>${Math.round(m.fullARR/1000)}K full</div>
              </div>
            </div>
            {/* Bar */}
            <div style={{height:8,background:"#F5F5F5",borderRadius:4,overflow:"hidden",border:"1px solid #D6D3D1",marginBottom:12}}>
              <div style={{height:"100%",background:"linear-gradient(90deg,#1E3A5F,#701427)",width:((m.weightedARR/maxW)*100)+"%",borderRadius:4,transition:"width 0.8s ease"}}/>
            </div>
            {/* Deal rows */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {m.deals.map(d=>{
                const st=stages.find(s=>s.id===d.stageId);
                const w=Number(d.arr||0)*(d.prob/100);
                return(
                  <div key={d.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"#F5F5F5",borderRadius:8}}>
                    <HealthDot health={d.health} size={8}/>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontWeight:600,color:"#1C2B3A",fontSize:13}}>{d.company}</span>
                      <span style={{color:"#7A8699",fontSize:11,marginLeft:8}}>{d.contact}</span>
                    </div>
                    <span style={{background:(st?.color||"#7A8699")+"14",color:st?.color||"#7A8699",borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700}}>{st?.name}</span>
                    <span style={{color:"#7A8699",fontSize:12,width:36,textAlign:"right"}}>{d.prob}%</span>
                    <span style={{fontWeight:700,color:"#1E3A5F",fontSize:13,width:72,textAlign:"right"}}>${Math.round(w/1000)}K</span>
                    <span style={{color:"#7A8699",fontSize:11,width:64,textAlign:"right"}}>{fmtCurrency(d.arr)} full</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      }
    </div>
  );
}

export default function App(){
  const [deals,setDealsRaw]=useState([]);
  const [stages,setStages]=useState(DEFAULT_STAGES);
  const [leads,setLeadsRaw]=useState([]);
  const [prospects,setProspectsRaw]=useState([]);
  const [activities,setActivitiesRaw]=useState([]);
  const [activityLogs,setActivityLogsRaw]=useState({});
  const [emails,setEmailsRaw]=useState({});
  const [stageHistory,setStageHistoryRaw]=useState({});
  const [automations,setAutomations]=useState(DEFAULT_AUTOMATIONS);
  const [view,setView]=useState("board");
  const [modal,setModal]=useState(null);
  const [stageModal,setStageModal]=useState(false);
  const [loading,setLoading]=useState(true);
  const dragId=useRef(null);

  // ─── Load from Supabase on mount ────────────────────────────────
  useEffect(()=>{
    (async()=>{
      try{
        const [dbDeals,dbLeads,dbProspects,dbActs,dbLogs,dbEmails,dbHist]=await Promise.all([
          sb.get("deals"),sb.get("leads"),sb.get("prospects"),
          sb.get("activities"),sb.get("activity_logs"),sb.get("emails"),sb.get("stage_history")
        ]);
        setDealsRaw((dbDeals||[]).map(fromDB.deal));
        setLeadsRaw((dbLeads||[]).map(fromDB.lead));
        setProspectsRaw((dbProspects||[]).map(fromDB.prospect));
        setActivitiesRaw((dbActs||[]).map(fromDB.activity));
        const logs={};(dbLogs||[]).forEach(r=>{const l=fromDB.activityLog(r);if(!logs[l.dealId])logs[l.dealId]=[];logs[l.dealId].push(l);});
        setActivityLogsRaw(logs);
        const ems={};(dbEmails||[]).forEach(r=>{const e=fromDB.email(r);if(!ems[e.dealId])ems[e.dealId]=[];ems[e.dealId].push(e);});
        setEmailsRaw(ems);
        const hist={};(dbHist||[]).forEach(r=>{const h=fromDB.stageHistory(r);if(!hist[h.dealId])hist[h.dealId]=[];hist[h.dealId].push(h);});
        setStageHistoryRaw(hist);
      }catch(e){console.error("Supabase load error:",e);}
      setLoading(false);
    })();
  },[]);

  // ─── Supabase-synced setters ─────────────────────────────────────
  const setDeals=fn=>{setDealsRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;next.forEach(d=>sb.upsert("deals",[toDB.deal(d)]));return next;});};
  const setLeads=fn=>{setLeadsRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;next.forEach(l=>sb.upsert("leads",[toDB.lead(l)]));return next;});};
  const setProspects=fn=>{setProspectsRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;next.forEach(p=>sb.upsert("prospects",[toDB.prospect(p)]));return next;});};
  const setActivities=fn=>{setActivitiesRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;next.forEach(a=>sb.upsert("activities",[toDB.activity(a)]));return next;});};
  const setActivityLogs=fn=>{setActivityLogsRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;Object.entries(next).forEach(([dealId,logs])=>(logs||[]).forEach(l=>sb.upsert("activity_logs",[toDB.activityLog(l,dealId)])));return next;});};
  const setEmails=fn=>{setEmailsRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;Object.entries(next).forEach(([dealId,ems])=>(ems||[]).forEach(e=>sb.upsert("emails",[toDB.email(e,dealId)])));return next;});};
  const setStageHistory=fn=>{setStageHistoryRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;return next;});};

  if(loading)return(
    <div style={{minHeight:"100vh",background:"#F5F5F5",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:40,height:40,border:"3px solid #D6D3D1",borderTop:"3px solid #1E3A5F",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{color:"#7A8699",fontSize:14,fontWeight:500}}>Loading your CRM…</div>
    </div>
  );

  const runAuto=(deal,sid)=>{
    automations.filter(a=>a.active&&a.trigger==="stage_enter"&&a.triggerStageId===sid).forEach(a=>{
      if(a.action==="create_activity"){const due=addDays(new Date().toISOString(),a.delayDays||0).slice(0,10);setActivities(as=>[...as,{id:uid(),dealId:deal.id,company:deal.company,type:a.actionType,title:a.actionNote||a.actionType+" — auto",dueDate:due,owner:deal.owner,done:false,notes:"Auto: "+a.name}]);setActivityLogs(p=>({...p,[deal.id]:[{id:uid(),type:"Note",author:"Automation",text:"⚡ Auto-created "+a.actionType+": "+a.actionNote,ts:new Date().toISOString()},...(p[deal.id]||[])]}));}
      if(a.action==="set_health")setDeals(ds=>ds.map(d=>d.id===deal.id?{...d,health:a.actionType}:d));
    });
  };

  const newDeal=()=>setModal({company:"",contact:"",email:"",arr:"",stageId:stages[0]?.id||"s1",owner:OWNERS[0],nrrType:NRR_TYPES[0],ttfv:TTFV_STAGES[0],health:"green",source:"Inbound",lastActivity:new Date().toISOString(),closeDate:"",notes:"",nextAction:"",nextActionDue:"",winLossReason:"",tags:[]});

  const saveDeal=d=>{
    setDeals(ds=>{
      const ex=ds.find(x=>x.id===d.id);
      if(ex&&ex.stageId!==d.stageId){const st=stages.find(s=>s.id===d.stageId);setStageHistory(h=>({...h,[d.id]:[...(h[d.id]||[]),{stageId:d.stageId,enteredAt:new Date().toISOString()}]}));setActivityLogs(p=>({...p,[d.id]:[{id:uid(),type:"Note",author:"System",text:"Moved to "+(st?.name||d.stageId),ts:new Date().toISOString()},...(p[d.id]||[])]}));runAuto(d,d.stageId);}
      if(!ex){setStageHistory(h=>({...h,[d.id]:[{stageId:d.stageId,enteredAt:new Date().toISOString()}]}));setActivityLogs(p=>({...p,[d.id]:[]}));setEmails(e=>({...e,[d.id]:[]}));runAuto(d,d.stageId);}
      return ex?ds.map(x=>x.id===d.id?d:x):[...ds,d];
    });setModal(null);
  };

  const delDeal=id=>{
    sb.delete("deals",id);
    sb.deleteWhere("activity_logs","deal_id",id);
    sb.deleteWhere("emails","deal_id",id);
    sb.deleteWhere("activities","deal_id",id);
    sb.deleteWhere("stage_history","deal_id",id);
    setDealsRaw(ds=>ds.filter(d=>d.id!==id));
    setModal(null);
  };
  const cloneDeal=d=>{const c={...d,id:uid(),company:d.company+" (copy)",lastActivity:new Date().toISOString(),stageId:stages[0]?.id||"s1",winLossReason:""};setDeals(ds=>[...ds,c]);setActivityLogs(p=>({...p,[c.id]:[{id:uid(),type:"Note",author:"System",text:"Cloned from "+d.company,ts:new Date().toISOString()}]}));setEmails(e=>({...e,[c.id]:[]}));setStageHistory(h=>({...h,[c.id]:[{stageId:c.stageId,enteredAt:new Date().toISOString()}]}));setModal(c);};
  const convertLead=lead=>{
    sb.delete("leads",lead.id);const d={id:uid(),company:lead.company,contact:lead.contact,email:lead.email,arr:"",stageId:stages[0]?.id||"s1",owner:lead.owner,nrrType:"New Logo",ttfv:"Not Started",health:"green",source:lead.source,lastActivity:new Date().toISOString(),closeDate:"",notes:lead.notes,nextAction:"",nextActionDue:"",winLossReason:"",tags:[...lead.tags]};setDeals(ds=>[...ds,d]);setActivityLogs(p=>({...p,[d.id]:[{id:uid(),type:"Note",author:"System",text:"Converted from Lead: "+lead.company,ts:new Date().toISOString()}]}));setEmails(e=>({...e,[d.id]:[]}));setStageHistory(h=>({...h,[d.id]:[{stageId:d.stageId,enteredAt:new Date().toISOString()}]}));setLeads(ls=>ls.filter(l=>l.id!==lead.id));setView("board");};
  const promoteToLead=(prospect,status)=>{
    sb.delete("prospects",prospect.id);
    const lead={
      id:uid(),company:prospect.company,contact:prospect.contact,title:prospect.title,
      email:prospect.email,phone:prospect.phone||"",linkedin:prospect.linkedin||"",
      secondaryContacts:prospect.secondaryContacts||[],
      source:prospect.source||"Outbound",owner:prospect.owner,
      status:status||( prospect.status==="Booked Meeting"?"Qualified":"New"),
      notes:prospect.angle||"",tags:[],
      createdAt:new Date().toISOString(),lastActivity:new Date().toISOString(),
    };
    setLeads(ls=>[...ls,lead]);
    setProspects(ps=>ps.filter(p=>p.id!==prospect.id));
    setView("leads");
  };
  const onDrop=sid=>{if(!dragId.current)return;const id=dragId.current;const st=stages.find(s=>s.id===sid);const deal=deals.find(d=>d.id===id);setDeals(ds=>ds.map(d=>d.id===id?{...d,stageId:sid,lastActivity:new Date().toISOString()}:d));setStageHistory(h=>({...h,[id]:[...(h[id]||[]),{stageId:sid,enteredAt:new Date().toISOString()}]}));setActivityLogs(p=>({...p,[id]:[{id:uid(),type:"Note",author:"System",text:"Moved to "+(st?.name||sid),ts:new Date().toISOString()},...(p[id]||[])]}));if(deal)runAuto({...deal,stageId:sid},sid);dragId.current=null;};

  const today=new Date();today.setHours(0,0,0,0);
  const rotCount=deals.filter(d=>{const st=stages.find(s=>s.id===d.stageId);return st?.rotDays&&daysAgo(d.lastActivity)>=st.rotDays;}).length;
  const overdueActs=activities.filter(a=>!a.done&&new Date(a.dueDate)<today).length;
  const newProspects=prospects.filter(p=>p.status==="Responded"||p.status==="Booked Meeting").length;
  const newLeads=leads.filter(l=>l.status==="New").length;
  const activeRules=automations.filter(a=>a.active).length;

  const TABS=[
    {id:"today",label:"Today",badge:(overdueActs>0||newProspects>0)?null:null},
    {id:"prospects",label:"Prospects",badge:newProspects>0?newProspects+" ready":null,bc:"#5B3A8A"},
    {id:"leads",label:"Leads",badge:newLeads>0?newLeads:null,bc:"#701427"},
    {id:"board",label:"Pipeline",badge:rotCount>0?rotCount+" stale":null,bc:"#9B1A1A"},
    {id:"dashboard",label:"Dashboard"},
    {id:"list",label:"Deals"},
    {id:"activities",label:"Activities",badge:overdueActs>0?overdueActs+" due":null,bc:"#7C4D00"},
    {id:"feed",label:"Feed"},
    {id:"velocity",label:"Velocity"},
    {id:"forecast",label:"Forecast"},
    {id:"winloss",label:"Win / Loss"},
    {id:"automations",label:"Automations",badge:activeRules>0?activeRules+" on":null,bc:"#1A5C3A"},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#F5F5F5",fontFamily:"'Inter','Helvetica Neue',sans-serif",color:"#1C2B3A"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet"/>
      <div style={{background:"#1E3A5F",height:60,display:"flex",alignItems:"stretch",padding:"0 24px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 16px rgba(30,58,95,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,paddingRight:24,borderRight:"1px solid rgba(255,255,255,0.12)",flexShrink:0}}>
          <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAQ4BDgDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAUGAQIDBwQI/8QASRABAAECAgMKCgcGBgEFAAAAAAECAwQRBQaSEhMWITFRU2GR0TZBUlRxcoGCstIHFCIyobHBIzVCc+HwFTM0Q3TC8SUmY5Oi/8QAGgEBAAMBAQEAAAAAAAAAAAAAAAIDBAYBBf/EAC4RAQACAAQDBwMEAwAAAAAAAAABAgMEERMxMlEFEhQhUnGxIjNBFTSBoUJhkf/aAAwDAQACEQMRAD8A/GQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//Z" alt="FreedomOps" style={width:36,height:36,objectFit:"contain",display:"block"}/>
          <div>
            <div style={{color:"#fff",fontFamily:"'Playfair Display',Georgia,serif",fontSize:16,fontWeight:800,lineHeight:1.1}}>FreedomOps</div>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",marginTop:1}}>Sales CRM</div>
          </div>
        </div>
        <nav style={{display:"flex",alignItems:"stretch",flex:1,overflowX:"auto",paddingLeft:8}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)} style={{background:"transparent",border:"none",borderBottom:view===t.id?"2.5px solid #C4B5A6":"2.5px solid transparent",color:view===t.id?"#fff":"rgba(255,255,255,0.5)",padding:"0 14px",cursor:"pointer",fontSize:12.5,fontWeight:view===t.id?700:400,display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",fontFamily:"inherit",transition:"color 0.15s",marginBottom:-1}}>
              {t.label}
              {t.badge&&<span style={{background:t.bc||"#701427",color:"#fff",borderRadius:10,fontSize:10,padding:"1px 7px",fontWeight:800}}>{t.badge}</span>}
            </button>
          ))}
        </nav>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:24,borderLeft:"1px solid rgba(255,255,255,0.12)",flexShrink:0}}>
          <button onClick={()=>setStageModal(true)} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.8)",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}>⚙ Stages</button>
          <button onClick={newDeal} style={{background:"#701427",border:"none",color:"#fff",borderRadius:8,padding:"7px 18px",cursor:"pointer",fontSize:12.5,fontWeight:700,fontFamily:"inherit",boxShadow:"0 2px 8px #70142766"}} onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>+ New Deal</button>
        </div>
      </div>
      <div style={{padding:"28px",maxWidth:1480,margin:"0 auto"}}>
        {view==="today"&&<TodayView deals={deals} stages={stages} leads={leads} prospects={prospects} activities={activities} activityLogs={activityLogs} onOpenDeal={d=>setModal(d)}/>}
        {view==="prospects"&&<ProspectsView prospects={prospects} setProspects={setProspects} onPromoteToLead={p=>promoteToLead(p)}/>}
        {view==="leads"&&<LeadsInbox leads={leads} setLeads={setLeads} onConvertToDeal={convertLead}/>}
        {view==="board"&&<div><SectionHeader title="Pipeline" subtitle={deals.filter(d=>d.stageId!=="s5"&&d.stageId!=="s6").length+" active deals · drag to move"}/><div style={{display:"flex",gap:16,overflowX:"auto",paddingBottom:16}}>{stages.map(s=><KanbanColumn key={s.id} stage={s} stages={stages} deals={deals.filter(d=>d.stageId===s.id)} onOpen={d=>setModal(d)} onDragStart={id=>{dragId.current=id;}} onDrop={onDrop} activityLogs={activityLogs}/>)}</div></div>}
        {view==="dashboard"&&<Dashboard deals={deals} stages={stages} leads={leads}/>}
        {view==="list"&&<DealsTable deals={deals} stages={stages} onOpen={d=>setModal(d)}/>}
        {view==="activities"&&<ActivitiesView activities={activities} setActivities={setActivities} deals={deals}/>}
        {view==="feed"&&<GlobalFeed deals={deals} stages={stages} activityLogs={activityLogs} onOpen={d=>setModal(d)}/>}
        {view==="velocity"&&<VelocityView deals={deals} stages={stages} stageHistory={stageHistory}/>}
        {view==="forecast"&&<ForecastView deals={deals} stages={stages}/>}
        {view==="winloss"&&<WinLossView deals={deals} prospects={prospects}/>}
        {view==="automations"&&<AutomationsView automations={automations} setAutomations={setAutomations} stages={stages}/>}
      </div>
      {modal&&<DealModal deal={modal} stages={stages} activityLogs={activityLogs} setActivityLogs={setActivityLogs} emails={emails} setEmails={setEmails} onSave={saveDeal} onDelete={delDeal} onClone={cloneDeal} onClose={()=>setModal(null)}/>}
      {stageModal&&<StageManager stages={stages} onSave={setStages} onClose={()=>setStageModal(false)}/>}
    </div>
  );
}
