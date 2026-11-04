const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('file://' + __dirname + '/../index.html');
  await p.waitForTimeout(800);
  await p.fill('#nm', 'Maya');
  await p.screenshot({ path: __dirname+'/shots/1_join.png', fullPage: true });
  await p.click('#soloBtn'); await p.waitForTimeout(300);
  await p.screenshot({ path: __dirname+'/shots/2_lobby.png', fullPage: true });
  await p.click('#start'); await p.waitForTimeout(300);
  // paint: wheat already default tool on prairie → paint most tiles wheat; tree column at c=0 and c=4
  const tiles = await p.$$('#bw .tile');
  const box = async i => { const bb = await (await p.$$('#bw .tile'))[i].boundingBox(); return [bb.x+bb.width/2, bb.y+bb.height/2]; };
  // drag paint rows 0..5 cols 1..7 wheat
  for (let r=0;r<6;r++){ const a=await box(r*8+1), z=await box(r*8+7); await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...z,{steps:8}); await p.mouse.up(); }
  await p.click('.tool[data-t="S"]');
  for (let r=0;r<6;r++){ if (r===3) continue; const a=await box(r*8+0); await p.mouse.click(...a); }
  await p.waitForTimeout(200);
  await p.screenshot({ path: __dirname+'/shots/3_build.png', fullPage: true });
  await p.click('#lock'); await p.waitForTimeout(600);
  await p.screenshot({ path: __dirname+'/shots/4_force_early.png', fullPage: true });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: __dirname+'/shots/5_force_mid.png', fullPage: true });
  await p.waitForTimeout(4500);
  await p.screenshot({ path: __dirname+'/shots/6_reveal.png', fullPage: true });
  await p.click('#next'); await p.waitForTimeout(300);
  await p.screenshot({ path: __dirname+'/shots/7_build2.png', fullPage: true });
  await p.click('#lock'); await p.waitForTimeout(8500);
  await p.screenshot({ path: __dirname+'/shots/8_reveal2.png', fullPage: true });
  await p.click('#next'); await p.waitForTimeout(300);
  await p.click('#lock'); await p.waitForTimeout(8500);
  await p.screenshot({ path: __dirname+'/shots/9_reveal3.png', fullPage: true });
  await p.click('#next'); await p.waitForTimeout(400);
  await p.screenshot({ path: __dirname+'/shots/10_final.png', fullPage: true });
  console.log('errors:', errs);
  await b.close();
})();
