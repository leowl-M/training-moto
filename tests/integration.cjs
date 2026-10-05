// Con il server di sviluppo acceso: node tests/integration.cjs [percorso-di-playwright]
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const output=path.join(__dirname,'tmp');fs.mkdirSync(output,{recursive:true});
const transitions=['slingshot','zigzag','fan','origami','stepped','rubberband','conveyor','weave','iris','diamond','diagonal','blinds','checker','comb'];
const loops=['orbit','figure8','heartbeat','turntable','shearwave','interference'];
(async()=>{
 const browser=await chromium.launch({headless:true});let page;
 try {
 page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async p=>{await p.goto(process.env.MOTO_URL||'http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__moto?.motionApi.HIST.last);};
 await open(page);
 const reset=async()=>page.evaluate(async()=>{const a=window.__moto,m=a.motionApi;await m.applyPreset(a.defaults(),true);a.setPlay(false);clearTimeout(m.HIST.tm);m.HIST.u=[];m.HIST.r=[];m.HIST.last=a.seqApi.snap();m.TLD.zoom=1;m.TLD.marker=null;m.drawTimeline();});
 await reset();
 const effectReport=await page.evaluate(({transitions,loops})=>{
  const a=window.__moto,fail=[],check=(v,t)=>{if(!v)fail.push(t)},numeric=(v,label)=>{if(typeof v==='number')check(Number.isFinite(v),label);else if(v&&typeof v==='object')Object.values(v).forEach(x=>numeric(x,label))};
  check(new Set(a.FX.map(f=>f.id)).size===a.FX.length,'unique transitions');check(new Set(a.LOOPS.map(f=>f.id)).size===a.LOOPS.length,'unique loops');
  const units=[{i:0,n:1,cx:0,cy:0,w:250,by0:-70,by1:10},{i:2,n:7,cx:-120,cy:30,w:65,by0:-70,by1:10}];
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=180;const ctx=canvas.getContext('2d');
  const state=()=>({...a.defaults(),font:15,text:'MOTO',fs:78,fit:false,transparent:true,delay:0,dIn:1,hold:1,dOut:1,tail:0,inS:a.mkSlot('fade',{stagger:0,split:'all'}),outMode:'mirror'});
  const pixels=()=>{const data=ctx.getImageData(0,0,400,180).data;let n=0;for(let i=3;i<data.length;i+=4)if(data[i])n++;return n;};
  for(const id of [...transitions,...loops]){
   const fx=a.FXMAP[id]||a.LMAP[id],isLoop=loops.includes(id),params=Object.fromEntries(fx.p.map(d=>[d.k,d.v])),variants=[params];
   for(const d of fx.p)for(const v of d.t==='r'?[d.min,d.max]:d.t==='s'?d.o.map(x=>x[0]):[true,false])variants.push({...params,[d.k]:v});
   for(const o of variants)for(const u of units)for(const t of [-.2,0,.1,.5,.9,1,1.2]){const s={x:0,y:0,sx:1,sy:1,rot:0,skx:0,op:1,blur:0,mix:0,px:0,py:0};fx.f(s,t,u,o,isLoop?1:{L:1});numeric(s,id);if(s.slices)for(let j=0;j<s.slices.n;j++)numeric(s.slices.off(j),id);}
   const st=state();if(isLoop){st.dIn=.01;st.loop={fx:id,when:'always',prms:{}};}else st.inS=a.mkSlot(id,{split:'all',stagger:0});const lay=a.layout(st,ctx,400,180);
   if(!isLoop){a.renderFrame(ctx,st,lay,0,400,180,1);check(pixels()===0,id+' starts hidden');}
   a.renderFrame(ctx,st,lay,isLoop?.1:.55,400,180,1);check(pixels()>0,id+' middle visible');const middle=canvas.toDataURL();
   a.renderFrame(ctx,st,lay,isLoop?.65:1,400,180,1);check(pixels()>0,id+' rest visible');check(middle!==canvas.toDataURL(),id+' moves');
   if(!isLoop){a.renderFrame(ctx,st,lay,3,400,180,1);check(pixels()===0,id+' mirror exit');st.inS=a.mkSlot('fade',{split:'all',stagger:0});st.outMode='custom';st.outS=a.mkSlot(id,{split:'all',stagger:0});a.renderFrame(ctx,st,lay,3,400,180,1);check(pixels()===0,id+' custom exit');}
  }
  return {fail,transitions:a.FX.length,loops:a.LOOPS.length};
 },{transitions,loops});
 assert.deepEqual(effectReport.fail,[]);console.log('PASS 20 Studio effects: rendering, entry/exit, parameter extremes; all original effects retained');
 await page.locator('#lTabs [data-l="fx"]').click();await page.locator('#q').fill('scacchiera');
 assert.equal(await page.locator('.tile:visible').count(),1);await page.locator('.tile[data-id="checker"]:visible').click();
 assert.equal(await page.evaluate(()=>window.__moto.getS().inS.fx),'checker');await page.locator('#q').fill('');
 await reset();
 await page.locator('#tlAdd').click();await page.locator('#tlDuplicate').click();assert.equal(await page.locator('.tl-track').count(),3);
 await page.locator('[data-block="0"] .tl-select').click();assert.equal(await page.evaluate(()=>window.__moto.getS().cur),0);
 await page.evaluate(()=>{const a=window.__moto,s=a.getS();s.fit=false;s.block.mode='keys';s.block.keys=[{t:.5,x:0,y:0,s:1,r:0,op:1,ease:'linear'},{t:1.5,x:20,y:0,s:1,r:0,op:1,ease:'linear'}];a.buildInspector();a.relayout();a.motionApi.histCommit();a.motionApi.TLD.snap=false;});
 const before=await page.evaluate(()=>{const s=window.__moto.getS();return {delay:s.delay,keys:s.block.keys.map(k=>k.t)}});
 const drag=async(selector,seconds,cancel=false)=>{const box=await page.locator(selector).boundingBox(),px=await page.evaluate(seconds=>{const a=window.__moto;return seconds/a.clipTotal()*(document.querySelector('#tl').offsetWidth-136)},seconds);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+px,box.y+box.height/2,{steps:8});if(cancel)await page.keyboard.press('Escape');await page.mouse.up();};
 await drag('[data-block="0"] [data-move="text"]',.5);
 const moved=await page.evaluate(()=>{const s=window.__moto.getS();return {delay:s.delay,keys:s.block.keys.map(k=>k.t)}});
 assert.ok(Math.abs(moved.delay-before.delay-.5)<=1/30);assert.ok(Math.abs(moved.keys[0]-before.keys[0]-(moved.delay-before.delay))<1e-6);
 await page.evaluate(()=>window.__moto.motionApi.undo());assert.ok(Math.abs(await page.evaluate(()=>window.__moto.getS().delay)-before.delay)<1e-6);
 await page.evaluate(()=>window.__moto.motionApi.redo());assert.ok(Math.abs(await page.evaluate(()=>window.__moto.getS().delay)-moved.delay)<1e-6);
 const cancelBefore=await page.evaluate(()=>({delay:window.__moto.getS().delay,keys:window.__moto.getS().block.keys}));await drag('[data-block="0"] [data-move="text"]',.3,true);
 assert.deepEqual(await page.evaluate(()=>({delay:window.__moto.getS().delay,keys:window.__moto.getS().block.keys})),cancelBefore);
 const phase=page.locator('[data-block="0"] [data-phase="dIn"]');await phase.focus();const dIn=await page.evaluate(()=>window.__moto.getS().dIn);await page.keyboard.press('ArrowRight');assert.ok(Math.abs(await page.evaluate(()=>window.__moto.getS().dIn)-dIn-1/30)<1e-6);
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.phase),'dIn');
 await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();assert.ok(await page.evaluate(()=>window.__moto.motionApi.TLD.zoom>2));await page.locator('#zoomFit').click();
 console.log('PASS text tracks, coordinated keyframe movement, undo/redo, Escape cancellation, keyboard phase editing and zoom');
 await page.evaluate(()=>window.__moto.motionApi.setTime(1.2));await page.locator('#addMarker').click();await page.locator('#markerName').fill('Intro <test>');await page.keyboard.press('Enter');assert.equal(await page.locator('.tl-marker').innerText(),'◆Intro <test>');
 await page.locator('[data-block="0"] [data-key="0"]').click();await page.locator('#copyKey').click();await page.evaluate(()=>window.__moto.motionApi.setTime(2.5));await page.locator('#pasteKey').click();await page.locator('#pasteKey').click();assert.equal(await page.evaluate(()=>window.__moto.getS().block.keys.filter(k=>Math.abs(k.t-2.5)<.001).length),1);
 await page.evaluate(()=>window.__moto.motionApi.setTime(.5));await page.locator('#rangeIn').click();await page.evaluate(()=>window.__moto.motionApi.setTime(1));await page.locator('#rangeOut').click();await page.evaluate(()=>window.__moto.motionApi.setTime(0));await page.locator('#bPlay').click();await page.waitForTimeout(750);assert.ok(await page.evaluate(()=>{const a=window.__moto;return a.motionApi.getPlaying()&&a.motionApi.getTime()>=.5&&a.motionApi.getTime()<=1}));await page.locator('#cLoop').uncheck();await page.waitForFunction(()=>!window.__moto.motionApi.getPlaying());assert.ok(Math.abs(await page.evaluate(()=>window.__moto.motionApi.getTime())-1)<.001);
 console.log('PASS clip markers, keyframe copy/paste without duplicates and preview range');
 await reset();
 await page.evaluate(()=>{const a=window.__moto,s=a.getS();s.inS=a.mkSlot('origami');s.timeline={markers:[{t:.7,name:'Prima clip'}],range:{enabled:false,start:0,end:0}};s.seq.clips.push({id:'motion-second',kind:'motion',track:'G2',name:'Seconda',start:5,dur:3.8,inp:0,auto:true,scene:{...a.defaults(),text:'Seconda',timeline:{markers:[{t:1,name:'Seconda clip'}],range:{enabled:false,start:0,end:0}}}});a.relayout();});
 await page.evaluate(()=>window.__moto.seqApi.activateClip('motion-second'));assert.equal(await page.evaluate(()=>window.__moto.getS().timeline.markers[0].name),'Seconda clip');
 await page.evaluate(()=>{const a=window.__moto;a.motionApi.setTime(.5);a.motionApi.setPreviewEdge('start');a.motionApi.setTime(1);a.motionApi.setPreviewEdge('end')});assert.deepEqual(await page.evaluate(()=>window.__moto.motionApi.playbackBounds()),{start:5.5,end:6});
 await page.evaluate(()=>{const a=window.__moto;a.seqApi.activateClip(a.getS().seq.clips.find(c=>c.id!=='motion-second').id)});assert.equal(await page.evaluate(()=>window.__moto.getS().inS.fx),'origami');assert.equal(await page.evaluate(()=>window.__moto.getS().timeline.markers[0].name),'Prima clip');
 const project=await page.evaluate(()=>window.__moto.seqApi.projectData());await reset();await page.evaluate(d=>window.__moto.seqApi.loadProjectData(d,null,'Unificato'),project);assert.equal(await page.evaluate(()=>window.__moto.getS().seq.clips.length),2);assert.equal(await page.evaluate(()=>window.__moto.getS().inS.fx),'origami');
 console.log('PASS independent graphic scenes, local/global preview times and complete .moto project round-trip');
 await reset();
 await page.evaluate(async()=>{const a=window.__moto,st=a.defaults(),rec={id:'mask-test',name:'Immagine',src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="red"/></svg>')};st.images=[rec];st.layers=[{id:'image-test',img:rec.id,mode:'free',x:50,y:50,size:30,rot:0,op:1,z:'above',tint:'none',start:0,end:6,fx:'iris',dIn:1,dOut:1,outMode:'mirror',ease:'fx',prms:{},lp:{fx:'none',prms:{}}},a.mkSvgLayer('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M10 10 H70 V70 H10Z" fill="blue"/></svg>','Logo')];await a.motionApi.applyPreset(st,true);a.setPlay(false);});
 assert.equal(await page.locator('.tl-image-track').count(),2);assert.ok(await page.evaluate(()=>{const a=window.__moto;return a.clipTotal()>=6&&a.getS().seq.clips[0].dur>=6}));assert.equal(await page.locator('.tl-image-track').last().locator('.tl-kind').innerText(),'SVG');assert.ok(!(await page.locator('#tl').innerHTML()).includes('NaN'));
 await page.locator('.tl-image-track').last().locator('.tl-select').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#insp').getAttribute('data-ctx'),'svg');
 const imageMasks=await page.evaluate(()=>{const a=window.__moto,s=a.getS(),c=document.createElement('canvas');c.width=400;c.height=180;const x=c.getContext('2d'),st={...s,text:'',layers:[s.layers[0]],transparent:true},lay=a.layout(st,x,400,180),counts=[];for(const id of ['iris','diamond','diagonal','blinds','checker','comb']){st.layers[0].fx=id;const n=t=>{a.renderFrame(x,st,lay,t,400,180,1);const d=x.getImageData(0,0,400,180).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n;};counts.push({id,mid:n(.4),rest:n(1.1)})}return counts;});assert.ok(imageMasks.every(x=>x.mid>0&&x.mid<x.rest));
 console.log('PASS image masks, extended duration, SVG layer tracks and valid geometry');
 await reset();
 // Media reali generati nel test: video MP4 e audio PCM, senza file esterni.
 const mediaReport=await page.evaluate(async()=>{
  const a=window.__moto,c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d'),stream=c.captureStream(30),mime=['video/mp4;codecs=avc1.42001e','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m)),rec=new MediaRecorder(stream,{mimeType:mime}),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>rec.onstop=resolve);rec.start();let frame=0;const timer=setInterval(()=>{x.fillStyle=frame++%2?'#237bce':'#e36835';x.fillRect(0,0,160,90)},25);await new Promise(r=>setTimeout(r,400));rec.stop();await done;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());
  await a.seqApi.addFiles([{file:new File(chunks,'prova.mp4',{type:mime})}],{T:0,track:'V1'});
  const rate=16000,n=8000,bytes=new Uint8Array(44+n*2),view=new DataView(bytes.buffer),str=(at,s)=>[...s].forEach((c,i)=>bytes[at+i]=c.charCodeAt(0));str(0,'RIFF');view.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,n*2,true);for(let i=0;i<n;i++)view.setInt16(44+i*2,Math.sin(i/rate*Math.PI*880)*4000,true);
  await a.seqApi.addFiles([{file:new File([bytes],'prova.wav',{type:'audio/wav'})}],{T:0,track:'A1'});a.setPlay(false);return {kinds:a.getS().seq.clips.map(c=>c.kind),media:a.getS().media.length};
 });
 assert.ok(mediaReport.kinds.includes('video')&&mediaReport.kinds.includes('audio'));assert.equal(mediaReport.media,2);
 await page.evaluate(()=>{window.__moto.seqApi.setTG(.2);window.__moto.relayout()});const downloaded=page.waitForEvent('download');await page.locator('#bExport').click();await page.locator('#expMenu [data-x="frame"]').click();const png=await downloaded;assert.ok(png.suggestedFilename().endsWith('.png'));assert.equal(fs.readFileSync(await png.path()).subarray(1,4).toString(),'PNG');
 console.log('PASS video/audio import and PNG export of the combined sequence');
 await page.locator('#bHelp').click();await page.waitForFunction(()=>document.querySelector('.app').inert);assert.equal(await page.evaluate(()=>document.activeElement.id),'helpClose');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'helpClose');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.app').inert);assert.equal(await page.evaluate(()=>document.activeElement.id),'bHelp');
 await page.locator('#tc').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#tc input').count(),1);await page.locator('#tc input').fill('0:01:00');await page.keyboard.press('Enter');assert.ok(Math.abs(await page.evaluate(()=>window.__moto.seqApi.TG())-1)<.001);
 await page.locator('#lTabs [data-l="fx"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#lTabs [data-l="layers"]').getAttribute('aria-selected'),'true');
 assert.ok(await page.locator('#insp input[aria-labelledby]').count()>0);
 console.log('PASS dialog focus/return, timecode keyboard access, accessible inspector labels and tab navigation');
 await reset();await page.evaluate(()=>window.__moto.motionApi.setTime(1.5));await page.waitForTimeout(100);await page.screenshot({path:path.join(output,'unified-desktop.png'),fullPage:true});
 for(const viewport of [{width:1280,height:720},{width:390,height:844}]){await page.setViewportSize(viewport);await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No horizontal overflow ${viewport.width}`);if(viewport.width===390)await page.screenshot({path:path.join(output,'unified-mobile.png'),fullPage:true});}
 const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:1440,height:900}});await open(reduced);assert.equal(await reduced.evaluate(()=>window.__moto.motionApi.getPlaying()),false);await reduced.close();
 assert.deepEqual(errors,[]);console.log('PASS desktop/mobile layout, reduced-motion preference and no browser errors');
 console.log('All integration checks passed');
 } catch(error){if(page)await page.screenshot({path:path.join(output,'integration-failure.png'),fullPage:true}).catch(()=>{});throw error} finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
