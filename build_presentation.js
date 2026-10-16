const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();
pptx.defineLayout({ name: 'CUSTOM_4X3', width: 10, height: 7.5 });
pptx.layout = 'CUSTOM_4X3'; // Match the 4:3 Sociothon template
pptx.author = 'KrishiGuide AI Team';
pptx.subject = 'Sociothon 26 — Social Innovation Hackathon proposal';
pptx.title = 'KrishiGuide AI — Sociothon 26';
pptx.company = 'Student Project';
pptx.lang = 'en-IN';
pptx.theme = {
  headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-IN'
};
pptx.defineSlideMaster({
  title: 'CONTENT',
  background: { color: 'F7F7F0' },
  objects: [
    { line: { x: 0.55, y: 0.66, w: 8.9, h: 0, line: { color: 'DCE5D7', width: 1 } } },
    { text: { text: "SOCIOTHON '26  /  KRISHIGUIDE AI", options: { x: 0.55, y: 0.26, w: 6.2, h: 0.22, fontFace: 'Aptos', fontSize: 8.5, bold: true, color: '59715C', charSpacing: 1.2, margin: 0 } } },
    { text: { text: 'SOCIAL INNOVATION HACKATHON  •  DRAFT', options: { x: 6.6, y: 0.26, w: 2.85, h: 0.22, fontFace: 'Aptos', fontSize: 7.5, bold: true, color: '829081', align: 'right', charSpacing: 0.6, margin: 0 } } },
    { text: { text: 'KRISHIGUIDE AI  •  PROPOSAL DRAFT', options: { x: 0.55, y: 7.13, w: 5.3, h: 0.16, fontFace: 'Aptos', fontSize: 7.5, color: '819080', margin: 0 } } },
  ],
  slideNumber: { x: 9.05, y: 7.1, w: 0.4, h: 0.18, color: '819080', fontFace: 'Aptos', fontSize: 8 }
});

const C = {
  forest: '163D2E', forest2: '214E39', green: '38754B', leaf: '73A15A', lime: 'DDEAB1',
  cream: 'F7F7F0', paper: 'FFFFFF', ink: '203329', muted: '68786B', border: 'DEE6D9',
  pale: 'EDF3E5', pale2: 'E5EEE1', gold: 'E9B85A', red: 'B75A41', sky: 'DCEBE7', white: 'FFFFFF',
  blue: '356A74', gray: 'F0F2EB', lightText: 'D5E5D6'
};
const SH = pptx.ShapeType;
function tx(slide, text, x, y, w, h, opts={}) {
  slide.addText(text, { x,y,w,h, fontFace: opts.fontFace || 'Aptos', fontSize: opts.fontSize ?? 14,
    color: opts.color || C.ink, bold: opts.bold || false, margin: opts.margin ?? 0,
    breakLine: false, valign: opts.valign || 'mid', align: opts.align || 'left',
    fit: opts.fit || 'shrink', paraSpaceAfterPt: opts.paraSpaceAfterPt || 0,
    charSpacing: opts.charSpacing, italic: opts.italic || false, transparency: opts.transparency,
    bullet: opts.bullet, isTextBox: true, underline: opts.underline || false,
    lineSpacingMultiple: opts.lineSpacingMultiple, hyperlink: opts.hyperlink
  });
}
function rect(slide,x,y,w,h,fill, opts={}) {
  slide.addShape(opts.radius ? SH.roundRect : SH.rect, { x,y,w,h, rectRadius: opts.radius ? 0.12 : undefined,
    fill: { color: fill, transparency: opts.transparency || 0 },
    line: { color: opts.line || fill, transparency: opts.line ? (opts.lineTransparency || 0) : 100, width: opts.lineWidth || 0.8 },
    radius: opts.radius ? 0.12 : undefined,
    shadow: opts.shadow ? { type: 'outer', color: '183A28', blur: 3, angle: 45, distance: 1, opacity: 0.12 } : undefined
  });
}
function line(slide,x1,y1,x2,y2,color,width=1,dash) {
  slide.addShape(SH.line,{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color,width,dashType:dash}});
}
function circle(slide,x,y,d,color,opts={}) {
  slide.addShape(SH.ellipse,{x,y,w:d,h:d,fill:{color,transparency:opts.transparency||0},line:{color:opts.line||color,transparency:opts.line?0:100,width:opts.lineWidth||1}});
}
function title(slide, kicker, heading, sub='') {
  tx(slide,kicker.toUpperCase(),0.58,0.85,8.7,0.22,{fontSize:8.5,color:C.green,bold:true,charSpacing:1.7});
  tx(slide,heading,0.56,1.10,8.9,0.52,{fontSize:25.5,color:C.forest,bold:true,fontFace:'Aptos Display'});
  if(sub) tx(slide,sub,0.58,1.65,8.7,0.38,{fontSize:11.5,color:C.muted});
}
function labelPill(slide,text,x,y,w,fill=C.pale,color=C.green){rect(slide,x,y,w,0.29,fill,{radius:true});tx(slide,text,x+0.08,y+0.015,w-0.16,0.24,{fontSize:8.4,bold:true,color,align:'center'});}
function bulletLine(slide, text, x,y,w, opts={}) {
  circle(slide,x,y+0.07,0.075,opts.dot||C.leaf);
  tx(slide,text,x+0.18,y,w-0.18,opts.h||0.45,{fontSize:opts.fontSize||11.5,color:opts.color||C.ink,valign:'top'});
}
function card(slide,x,y,w,h,fill=C.paper,lineColor=C.border) { rect(slide,x,y,w,h,fill,{radius:true,line:lineColor,lineWidth:0.9,shadow:false}); }
function addFieldArt(slide, x,y,w,h) {
  // Framed miniature field illustration made from native editable shapes.
  rect(slide,x,y,w,h,'214D36',{radius:true,line:'3A6847',lineWidth:0.8});
  circle(slide,x+w*0.67,y+h*0.08,h*0.18,C.gold);
  // horizon and hills
  slide.addShape(SH.chevron,{x:x+w*0.48,y:y+h*0.22,w:w*0.48,h:h*0.24,rotate:180,fill:{color:'4F8750'},line:{color:'4F8750',transparency:100}});
  slide.addShape(SH.chevron,{x:x+w*0.05,y:y+h*0.3,w:w*0.6,h:h*0.22,rotate:180,fill:{color:'67975A'},line:{color:'67975A',transparency:100}});
  // field strips / perspective lines
  for(let i=0;i<8;i++) {
    const y1=y+h*(0.48+i*0.065); const y2=y+h*(0.48+i*0.065);
    line(slide,x+w*(0.48-i*0.025),y1,x+w*(0.06+i*0.02),y2+h*0.035,'9DBD6D',1.25);
    line(slide,x+w*(0.50+i*0.025),y1,x+w*(0.92-i*0.02),y2+h*0.035,'AEC977',1.25);
  }
  // top overlay dashboard card
  rect(slide,x+w*0.52,y+h*0.54,w*0.39,h*0.35,'FFFDF6',{radius:true,line:'E5EAD8',lineWidth:0.8,shadow:true});
  tx(slide,'FARM SNAPSHOT',x+w*0.56,y+h*0.59,w*0.31,h*0.045,{fontSize:6.2,bold:true,color:C.muted,charSpacing:0.6});
  tx(slide,'3 crop matches',x+w*0.56,y+h*0.64,w*0.31,h*0.09,{fontSize:10.4,bold:true,color:C.forest});
  rect(slide,x+w*0.56,y+h*0.76,w*0.31,h*0.045,'E1EAD8',{radius:true});
  rect(slide,x+w*0.56,y+h*0.76,w*0.22,h*0.045,C.leaf,{radius:true});
  tx(slide,'budget-aware',x+w*0.56,y+h*0.82,w*0.3,h*0.04,{fontSize:6.6,color:C.muted});
}

// Slide 1 — cover
{
  const s = pptx.addSlide();
  rect(s,0,0,10,7.5,C.forest);
  // soft botanical circles
  circle(s,6.00,0.00,4.00,'214F39',{transparency:4});
  circle(s,7.20,4.30,2.80,'1D4733',{transparency:0});
  tx(s,"PRISM PRESENTS  •  SOCIOTHON '26",0.62,0.54,6.0,0.28,{fontSize:10,color:C.lime,bold:true,charSpacing:1.9});
  line(s,0.62,0.94,4.08,0.94,'709C67',1.6);
  tx(s,'KrishiGuide AI',0.60,1.38,5.25,0.83,{fontSize:35,color:C.white,bold:true,fontFace:'Aptos Display'});
  tx(s,'The next smart decision\nstarts with your soil.',0.63,2.33,4.6,1.05,{fontSize:23,color:'E5EEDB',bold:true,fontFace:'Aptos Display',valign:'top'});
  tx(s,'An explainable crop-planning companion for small farmers — built around season, soil, water and budget.',0.65,3.62,4.25,0.86,{fontSize:13,color:'D2E1D2',valign:'top'});
  labelPill(s,'SDG 2  ZERO HUNGER',0.65,4.77,1.82,'365F42',C.lime);
  labelPill(s,'SDG 8  DECENT WORK',2.58,4.77,1.92,'365F42',C.lime);
  labelPill(s,'SDG 12  RESPONSIBLE USE',0.65,5.16,2.38,'365F42',C.lime);
  tx(s,'NATIONAL SOCIAL INNOVATION HACKATHON',0.65,6.42,5.65,0.22,{fontSize:9,color:'B9D0B6',bold:true,charSpacing:1.2});
  tx(s,'Team: KrishiGuide AI  |  Member details to be added',0.65,6.77,5.65,0.22,{fontSize:9,color:'B9D0B6'});
  addFieldArt(s,5.27,1.16,4.18,4.87);
  // small callout above illustration
  rect(s,6.10,0.75,2.68,0.42,'F8F7EF',{radius:true,line:'D9E4D4',lineWidth:0.8});
  circle(s,6.25,0.87,0.16,C.leaf);
  tx(s,'PLAN  •  COMPARE  •  VERIFY',6.49,0.82,2.10,0.23,{fontSize:8.3,color:C.forest,bold:true,charSpacing:0.4});
}

// Slide 2 — team roster
{
  const s = pptx.addSlide('CONTENT');
  title(s,'01 / Team','Team details','Complete the member information before final submission.');
  card(s,0.58,2.14,8.84,0.60,C.forest,C.forest);
  tx(s,'TEAM NAME',0.82,2.27,1.3,0.22,{fontSize:9,color:C.lime,bold:true,charSpacing:1.2});
  tx(s,'KrishiGuide AI',2.12,2.23,3.8,0.28,{fontSize:18,color:C.white,bold:true,fontFace:'Aptos Display'});
  const x=0.58,y=3.05, widths=[1.75,1.30,2.30,1.35,2.14], rh=0.56;
  const headers=['Team member name','Department / year','Email ID','Mobile no.','College name'];
  let cx=x;
  headers.forEach((h,i)=>{rect(s,cx,y,widths[i],0.52,'E4ECD9',{line:'CCD9C7',lineWidth:0.7});tx(s,h,cx+0.07,y+0.05,widths[i]-0.14,0.40,{fontSize:9.1,color:C.forest,bold:true,align:'center'});cx+=widths[i];});
  for(let r=0;r<4;r++){
    cx=x;
    for(let c=0;c<widths.length;c++){
      rect(s,cx,y+0.52+r*rh,widths[c],rh,(r%2===0?'FFFFFF':'F5F7F0'),{line:'D9E3D6',lineWidth:0.7});
      tx(s,c===0?`Member ${r+1}`:'Add details',cx+0.08,y+0.61+r*rh,widths[c]-0.16,0.30,{fontSize:c===0?10:9.3,color:c===0?C.ink:'9AA596',italic:c!==0,align:c===0?'left':'center'});
      cx+=widths[c];
    }
  }
  rect(s,0.58,6.02,8.84,0.63,'EDF3E5',{radius:true,line:'DDE7D7'});
  tx(s,'Submission checklist',0.80,6.15,1.65,0.22,{fontSize:10.2,color:C.forest,bold:true});
  tx(s,'Add all members • verify emails and mobile numbers • keep one consistent team name across forms.',2.36,6.12,6.72,0.32,{fontSize:10.2,color:C.muted});
}

// Slide 3 — certificate placeholders
{
  const s = pptx.addSlide('CONTENT');
  title(s,'02 / Eligibility','GLE course certificates','Place the actual certificate image or PDF crop for each team member.');
  const boxes=[ [0.65,2.20],[5.15,2.20],[0.65,4.42],[5.15,4.42] ];
  boxes.forEach((p,i)=>{
    card(s,p[0],p[1],4.18,1.90,C.paper,'D4DFD0');
    rect(s,p[0]+0.18,p[1]+0.18,0.56,0.56,C.pale,{radius:true,line:'DCE6D5'});
    tx(s,String(i+1).padStart(2,'0'),p[0]+0.18,p[1]+0.25,0.56,0.34,{fontSize:15,color:C.green,bold:true,align:'center'});
    tx(s,`MEMBER ${i+1}`,p[0]+0.92,p[1]+0.20,2.5,0.24,{fontSize:8.5,color:C.green,bold:true,charSpacing:1.1});
    tx(s,'Insert GLE certificate here',p[0]+0.92,p[1]+0.54,2.85,0.34,{fontSize:12.5,color:C.ink,bold:true});
    tx(s,'Replace this placeholder with the real certificate.',p[0]+0.92,p[1]+1.00,2.85,0.38,{fontSize:9.3,color:C.muted,valign:'top'});
    line(s,p[0]+0.92,p[1]+1.53,p[0]+3.80,p[1]+1.53,'DDE5D8',0.8,'dash');
  });
  tx(s,'Important: this slide is intentionally a placeholder. Do not submit it with empty certificate slots if the certificates are required.',0.68,6.62,8.65,0.28,{fontSize:9.4,color:C.red,bold:true,align:'center'});
}

// Slide 4 — problem statement
{
  const s=pptx.addSlide('CONTENT');
  title(s,'03 / Theme & problem','Smarter agriculture for small farmers','Selected statement from the Sociothon problem-statement list.');
  rect(s,0.58,2.10,8.84,1.23,C.forest,{radius:true,line:C.forest});
  tx(s,'PROBLEM STATEMENT',0.84,2.32,2.05,0.20,{fontSize:8.5,color:C.lime,bold:true,charSpacing:1.2});
  tx(s,'How can AI and data help small farmers make more informed and sustainable decisions about crops, resources and markets?',0.84,2.62,8.05,0.47,{fontSize:17,color:C.white,bold:true,fontFace:'Aptos Display',valign:'top'});
  const cols=[{x:0.58,k:'THE CHALLENGE',h:'Decisions are connected',t:'Crop choice depends on soil, season, water, local conditions, money available and access to reliable information.'},{x:3.57,k:'WHO WE SERVE',h:'Small and resource-limited farms',t:'The first prototype is designed for an Indian farmer who needs a simple shortlist and practical checks before sowing.'},{x:6.56,k:'WHY IT MATTERS',h:'Lower avoidable risk',t:'A clearer plan can help users compare trade-offs and seek local advice before committing land, time and inputs.'}];
  cols.forEach((c,i)=>{card(s,c.x,3.70,2.86,1.85,C.paper);tx(s,c.k,c.x+0.18,3.89,2.48,0.18,{fontSize:8.1,color:C.green,bold:true,charSpacing:0.9});tx(s,c.h,c.x+0.18,4.20,2.50,0.47,{fontSize:13,color:C.forest,bold:true,valign:'top'});tx(s,c.t,c.x+0.18,4.77,2.48,0.58,{fontSize:9.7,color:C.muted,valign:'top'});});
  tx(s,'SUSTAINABLE DEVELOPMENT GOALS',0.62,5.92,2.60,0.20,{fontSize:8.7,color:C.green,bold:true,charSpacing:0.8});
  labelPill(s,'SDG 2  ZERO HUNGER',3.25,5.83,1.88,C.pale,C.green);
  labelPill(s,'SDG 8  DECENT WORK',5.28,5.83,1.94,C.pale,C.green);
  labelPill(s,'SDG 12  RESPONSIBLE USE',7.36,5.83,2.06,C.pale,C.green);
  tx(s,'Proposed pilot focus: Maharashtra; crop recommendations must be validated with district-level agronomic guidance.',0.64,6.48,8.65,0.30,{fontSize:9.7,color:C.muted,italic:true});
}

// Slide 5 — proposed solution
{
  const s=pptx.addSlide('CONTENT');
  title(s,'04 / Proposed solution','One simple workflow. More informed farm decisions.','KrishiGuide AI turns a few farm details into an explainable crop shortlist.');
  // Left workflow stack
  const items=[
    {n:'01',h:'Build a farm profile',d:'District, season, soil, water, acreage, budget and main priority.'},
    {n:'02',h:'Compare suitable crops',d:'A transparent score uses season, soil, water demand, cost range and farmer priority.'},
    {n:'03',h:'Understand trade-offs',d:'Each suggestion shows why it matched, a planning-cost range, duration and cautions.'},
    {n:'04',h:'Check before sowing',d:'Use the official-source links and verify advice with a soil test / local KVK.'}
  ];
  items.forEach((it,i)=>{
    const yy=2.17+i*0.91;
    circle(s,0.67,yy+0.04,0.44,i===0?C.green:(i===1?C.leaf:(i===2?'91B36D':C.gold)));
    tx(s,it.n,0.67,yy+0.11,0.44,0.20,{fontSize:9.4,color:i===3?C.forest:C.white,bold:true,align:'center'});
    tx(s,it.h,1.26,yy,3.25,0.26,{fontSize:13.2,color:C.forest,bold:true});
    tx(s,it.d,1.26,yy+0.31,3.48,0.43,{fontSize:9.8,color:C.muted,valign:'top'});
    if(i<3) line(s,0.89,yy+0.48,0.89,yy+0.88,'BED1B5',1.2);
  });
  // Editable mock UI
  card(s,5.13,2.08,4.25,4.34,'FFFFFF','D3DFD0');
  rect(s,5.13,2.08,4.25,0.54,C.forest,{radius:true,line:C.forest});
  circle(s,5.36,2.23,0.20,C.lime);
  tx(s,'KrishiGuide AI',5.66,2.18,2.05,0.25,{fontSize:12,color:C.white,bold:true});
  labelPill(s,'DEMO UI',8.38,2.20,0.73,'335F42',C.lime);
  tx(s,'Your farm plan',5.42,2.85,2.0,0.25,{fontSize:14.5,color:C.forest,bold:true});
  tx(s,'Example profile • 2 acres • Kharif',5.42,3.12,3.30,0.20,{fontSize:8.9,color:C.muted});
  const cropRows=[['01','Soybean','Best match','93%'],['02','Sorghum','Compare local fit','80%'],['03','Pearl millet','Lower water demand','79%']];
  cropRows.forEach((r,i)=>{
    const yy=3.52+i*0.72;
    rect(s,5.39,yy,3.72,0.60,i===0?'F1F7E9':'F8F9F4',{radius:true,line:i===0?'BBD0AC':'E2E8DD',lineWidth:0.8});
    circle(s,5.54,yy+0.15,0.28,i===0?C.green:'DCE8D2');
    tx(s,r[0],5.54,yy+0.20,0.28,0.15,{fontSize:7.5,color:i===0?C.white:C.green,bold:true,align:'center'});
    tx(s,r[1],5.95,yy+0.09,1.66,0.20,{fontSize:11.1,color:C.forest,bold:true});
    tx(s,r[2],5.95,yy+0.32,1.94,0.16,{fontSize:7.8,color:C.muted});
    tx(s,r[3],8.15,yy+0.15,0.66,0.20,{fontSize:11.3,color:C.green,bold:true,align:'right'});
  });
  rect(s,5.40,5.79,3.72,0.39,'E8F0DF',{radius:true,line:'DAE5D1'});
  tx(s,'Budget planner  •  Farmer-help assistant  •  Marathi / Hindi / English labels',5.55,5.87,3.42,0.20,{fontSize:7.8,color:C.forest,bold:true,align:'center'});
  tx(s,'Interface preview is illustrative; crop scores and costs are demo estimates, not validated local recommendations.',5.31,6.53,4.0,0.30,{fontSize:8.5,color:C.muted,italic:true,align:'center'});
}

// Slide 6 — architecture
{
  const s=pptx.addSlide('CONTENT');
  title(s,'05 / Architecture blueprint','Transparent by design. Connected as data improves.','Architecture distinguishes the working MVP from future integrations.');
  const xs=[0.58,2.40,4.35,6.28,8.00], ws=[1.55,1.67,1.66,1.48,1.38];
  const flow=[
    {n:'01',h:'Farmer inputs',d:'Season, soil, water, area, budget',f:'E8F0DF'},
    {n:'02',h:'Input checks',d:'Validate fields and normalize selections',f:'E8F0DF'},
    {n:'03',h:'Crop catalogue',d:'Curated crop rules + cost bands',f:'E8F0DF'},
    {n:'04',h:'Scoring engine',d:'Explainable deterministic ranking',f:'E8F0DF'},
    {n:'05',h:'Outputs',d:'Ranked crops, cautions, cost plan',f:'DCEBE7'}
  ];
  flow.forEach((b,i)=>{
    card(s,xs[i],2.32,ws[i],1.44,b.f,'D4E0D1');
    tx(s,b.n,xs[i]+0.12,2.45,0.34,0.17,{fontSize:8.5,color:C.green,bold:true});
    tx(s,b.h,xs[i]+0.12,2.70,ws[i]-0.24,0.34,{fontSize:11.1,color:C.forest,bold:true,valign:'top'});
    tx(s,b.d,xs[i]+0.12,3.11,ws[i]-0.24,0.47,{fontSize:8.3,color:C.muted,valign:'top'});
    if(i<flow.length-1) tx(s,'›',xs[i]+ws[i]+0.02,2.79,xs[i+1]-(xs[i]+ws[i])-0.03,0.33,{fontSize:21,color:C.leaf,bold:true,align:'center'});
  });
  // Current vs future
  card(s,0.58,4.20,4.20,1.72,'FFFFFF','D8E2D4');
  labelPill(s,'WORKING MVP',0.82,4.42,1.30,C.pale,C.green);
  tx(s,'Browser-based app',0.82,4.83,3.50,0.26,{fontSize:13.4,color:C.forest,bold:true});
  bulletLine(s,'HTML / CSS / JavaScript; no API key or login required.',0.84,5.20,3.55,{fontSize:9.5,h:0.30});
  bulletLine(s,'Rules-based scores; indicative cost ranges; FAQ-style helper.',0.84,5.52,3.55,{fontSize:9.5,h:0.30});
  card(s,5.02,4.20,4.40,1.72,'F2F6EC','D8E2D4');
  labelPill(s,'NEXT PHASE — NOT CONNECTED',5.26,4.42,2.34,'E4EAD9',C.forest);
  tx(s,'Verified regional data layer',5.26,4.83,3.70,0.26,{fontSize:13.4,color:C.forest,bold:true});
  bulletLine(s,'Soil Health Card + district crop advisories.',5.28,5.20,3.80,{fontSize:9.5,h:0.30});
  bulletLine(s,'IMD weather + AGMARKNET/e-NAM market prices with timestamps.',5.28,5.52,3.80,{fontSize:9.5,h:0.34});
  tx(s,'Production path (future): frontend → Python API → validated data connectors → audited recommendations. Do not present future integrations as live.',0.62,6.35,8.75,0.34,{fontSize:9.2,color:C.muted,italic:true,align:'center'});
}

// Slide 7 — AI, IBM tools and IBM Bob
{
  const s=pptx.addSlide('CONTENT');
  title(s,'06 / AI & tooling','AI with guardrails — not guesswork','The proposal separates what works in the MVP from capabilities planned for a later version.');
  const bx=0.58, by=2.12;
  card(s,bx,by,4.12,2.25,C.forest,C.forest);
  tx(s,'ROLE OF AI',0.84,2.38,2.50,0.22,{fontSize:9,color:C.lime,bold:true,charSpacing:1.4});
  tx(s,'Current MVP',0.84,2.75,3.10,0.28,{fontSize:15,color:C.white,bold:true});
  bulletLine(s,'Explainable rule-based crop ranking.',0.86,3.15,3.40,{fontSize:10.2,color:'E6EFE1',dot:C.lime,h:0.32});
  bulletLine(s,'Keyword-based farmer FAQ; not a generative AI chatbot.',0.86,3.52,3.48,{fontSize:10.2,color:'E6EFE1',dot:C.lime,h:0.42});
  bulletLine(s,'Future: summarize sourced advisories and explain trade-offs in local languages.',0.86,3.92,3.52,{fontSize:10.2,color:'E6EFE1',dot:C.lime,h:0.40});
  card(s,4.98,by,4.44,1.25,C.paper,'D8E2D4');
  tx(s,'IBM TOOL / LABS USED?',5.23,2.35,3.80,0.22,{fontSize:9,color:C.green,bold:true,charSpacing:1.1});
  tx(s,'None used in this build yet.',5.23,2.67,3.80,0.25,{fontSize:13,color:C.forest,bold:true});
  tx(s,'Planned evaluation: IBM tools only after access and hands-on validation.',5.23,2.99,3.85,0.22,{fontSize:9.6,color:C.muted});
  card(s,4.98,3.58,4.44,1.29,'F5F7F0','D8E2D4');
  tx(s,'IBM BOB USED?',5.23,3.79,3.80,0.22,{fontSize:9,color:C.green,bold:true,charSpacing:1.1});
  tx(s,'Not used so far.',5.23,4.10,3.80,0.24,{fontSize:13,color:C.forest,bold:true});
  tx(s,'Possible future use: plan/refactor code, add tests and review documentation; report usage only after it happens.',5.23,4.38,3.88,0.33,{fontSize:8.7,color:C.muted,valign:'top'});
  rect(s,0.58,4.72,4.12,1.02,'E7EFDC',{radius:true,line:'D5E2CC'});
  tx(s,'SAFETY & TRUST',0.83,4.91,2.20,0.20,{fontSize:8.6,color:C.green,bold:true,charSpacing:1.0});
  tx(s,'No guaranteed yield / profit claims. Show estimates as estimates, cite sources, and prompt a local soil test / KVK check.',0.83,5.20,3.53,0.38,{fontSize:10,color:C.forest,valign:'top'});
  rect(s,4.98,5.14,4.44,0.60,'FFF4D8',{radius:true,line:'E9D9AE'});
  tx(s,'Submission note: update this slide after any IBM tool is actually used and documented.',5.20,5.28,4.00,0.29,{fontSize:9.1,color:'745720',bold:true});
  tx(s,'This honesty note is intentional: the current artefact is a student MVP, not a deployed AI service.',0.62,6.27,8.80,0.30,{fontSize:9.3,color:C.muted,italic:true,align:'center'});
}

// Slide 8 — references
{
  const s=pptx.addSlide('CONTENT');
  title(s,'07 / References','Build on trusted agricultural sources','These are reference links for validation and future integration; the prototype does not currently fetch live data.');
  const refs=[
    {n:'01',name:'Soil Health Card Portal',org:'NIC / Ministry of Agriculture & Farmers Welfare',use:'Soil nutrients and soil-test-based fertilizer guidance.',url:'soilhealth.dac.gov.in',full:'https://soilhealth.dac.gov.in'},
    {n:'02',name:'IMD Agromet Advisory Services',org:'India Meteorological Department',use:'District / local-language agro-weather advisories.',url:'mausam.imd.gov.in/responsive/agromet_adv_ser_district_current_lo.php',full:'https://mausam.imd.gov.in/responsive/agromet_adv_ser_district_current_lo.php'},
    {n:'03',name:'ICAR Farmer Advisories',org:'Indian Council of Agricultural Research',use:'Crop-season advisories and regional agronomic context.',url:'icar.gov.in/en/kharif-agro-advisory-farmers',full:'https://icar.gov.in/en/kharif-agro-advisory-farmers'},
    {n:'04',name:'AGMARKNET / e-NAM prices',org:'Government of India market information',use:'Market price and arrivals reference for planning.',url:'enam.gov.in/web/dashboard/agmarknet',full:'https://www.enam.gov.in/web/dashboard/agmarknet'}
  ];
  refs.forEach((r,i)=>{
    const yy=2.15+i*0.94;
    card(s,0.60,yy,8.80,0.78,C.paper,'D9E3D6');
    circle(s,0.82,yy+0.20,0.36,i===0?C.green:(i===1?C.blue:(i===2?C.leaf:C.gold)));
    tx(s,r.n,0.82,yy+0.27,0.36,0.16,{fontSize:8,color:i===3?C.forest:C.white,bold:true,align:'center'});
    tx(s,r.name,1.38,yy+0.11,3.15,0.22,{fontSize:11.4,color:C.forest,bold:true});
    tx(s,r.org,1.38,yy+0.38,3.05,0.18,{fontSize:8.3,color:C.muted});
    tx(s,r.use,4.52,yy+0.12,4.56,0.22,{fontSize:9.6,color:C.ink});
    tx(s,r.url,4.52,yy+0.42,4.56,0.17,{fontSize:7.8,color:C.green,underline:true,hyperlink:{url:r.full}});
  });
  tx(s,'Integration policy: retain source, district / market, timestamp and unit; if data is unavailable or stale, say so instead of inventing a value.',0.66,6.25,8.68,0.44,{fontSize:9.5,color:C.forest,bold:true,align:'center'});
}

// Slide 9 — thank you
{
  const s=pptx.addSlide();
  rect(s,0,0,10,7.5,C.forest);
  circle(s,6.00,0.00,4.00,'214F39',{transparency:2});
  circle(s,7.10,4.40,2.80,'1E4934');
  tx(s,"SOCIOTHON '26",0.68,0.62,3.0,0.26,{fontSize:10,color:C.lime,bold:true,charSpacing:1.8});
  line(s,0.68,1.03,3.95,1.03,'6F9D64',1.5);
  tx(s,'Thank you.',0.64,1.64,5.50,0.80,{fontSize:37,color:C.white,bold:true,fontFace:'Aptos Display'});
  tx(s,'Let’s make every farm decision\nmore informed and more resilient.',0.68,2.70,5.35,0.94,{fontSize:22,color:'E4EDDC',bold:true,fontFace:'Aptos Display',valign:'top'});
  tx(s,'KrishiGuide AI',0.68,4.16,3.10,0.38,{fontSize:17,color:C.lime,bold:true});
  tx(s,'Know your soil. Plan your crop. Verify locally.',0.68,4.59,4.70,0.30,{fontSize:11.8,color:'D4E1D2'});
  addFieldArt(s,5.55,1.55,3.82,4.47);
  tx(s,'Team / contact details to be added',0.69,6.63,4.8,0.24,{fontSize:9.4,color:'B9D0B6'});
  tx(s,'IDEATE  •  INNOVATE  •  IMPACT',0.69,6.97,4.8,0.20,{fontSize:8.8,color:C.lime,bold:true,charSpacing:1.4});
}

pptx.writeFile({ fileName: '/mnt/data/KrishiGuide_AI_Sociothon26_Presentation.pptx' });
