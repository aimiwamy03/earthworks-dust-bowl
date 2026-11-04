const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path=require('path');
const srv = http.createServer((q,r)=>{ r.writeHead(200,{'content-type':'text/html'}); r.end(fs.readFileSync(path.join(__dirname,'..','index.html'))); }).listen(8765);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:420,height:900}, deviceScaleFactor:1.5 });
  await ctx.addInitScript({ path: __dirname + '/mock-room.js' });
  const errs=[]; const mk = async n=>{ const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(n+': '+e.message)); await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); return p; };
  const host = await mk('host'), guest = await mk('guest');
  await host.fill('#nm','Maya'); await host.click('#hostBtn'); await host.waitForTimeout(600);
  const code = (await host.textContent('h1.title')).trim(); console.log('code', code);
  await guest.fill('#nm','Theo');
  const boxes = await guest.$$('.codebox input'); for (let i=0;i<4;i++) await boxes[i].fill(code[i]);
  await guest.click('#joinBtn'); await guest.waitForTimeout(3500);
  await host.click('#addBot'); await host.waitForTimeout(400);
  await host.screenshot({path:'shots/mp_lobby_host.png'}); await guest.screenshot({path:'shots/mp_lobby_guest.png'});
  await host.click('#start'); await host.waitForTimeout(800);
  // guest plows everything (drag across all rows)
  const box = async (p,i) => { const bb = await (await p.$$('#bw .tile'))[i].boundingBox(); return [bb.x+bb.width/2, bb.y+bb.height/2]; };
  for (let r=0;r<6;r++){ const a=await box(guest,r*8), z=await box(guest,r*8+7); await guest.mouse.move(...a); await guest.mouse.down(); await guest.mouse.move(...z,{steps:8}); await guest.mouse.up(); }
  await guest.waitForTimeout(300);
  await guest.click('#lock'); await guest.waitForTimeout(500);
  await host.screenshot({path:'shots/mp_build_host.png'});
  await host.click('#lock'); await host.waitForTimeout(1500);
  await guest.screenshot({path:'shots/mp_force_guest.png'});
  await host.waitForTimeout(7500);
  await guest.screenshot({path:'shots/mp_reveal_guest.png', fullPage:true});
  const gTxt = await guest.textContent('main'); console.log('guest reveal has Theo:', gTxt.includes('Theo'), 'topsoil:', (gTxt.match(/(\d+)%/)||[])[0]);
  await host.click('#next'); await host.waitForTimeout(1500);
  console.log('guest phase after next:', await guest.textContent('#hdrL'));
  console.log('errors', errs);
  await b.close(); srv.close();
})();
