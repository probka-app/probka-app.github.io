/* YuVi · Сцена (лише власник, dev/). Імпровізована анімація: модель пише код малювання кожної сцени під сенс фрази
   й таймінги слів; рушій дає лише основу (час, слова, камеру, палітру, героя-капсулу, звук). Шаблонів дій немає.
   Безпека: код від моделі виконується в пісочниці (iframe sandbox без same-origin + CSP без мережі) — він не бачить
   сайт, сесію, localStorage і не може нічого надіслати. Кадри повертаються картинками (ImageBitmap). */
(() => {
  "use strict";
  const W = 1080, H = 1920, FPS = 30, SR = 44100;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  // ---------- набір для сцени (живе всередині пісочниці) ----------
  const KIT = String.raw`
const W=1080,H=1920,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t;
const E={lin:t=>t,in:t=>t*t,out:t=>1-(1-t)*(1-t),inOut:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,back:t=>{const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)},elastic:t=>t<=0?0:t>=1?1:Math.pow(2,-10*t)*Math.sin((t*10-.75)*2*Math.PI/3)+1,pop:t=>t<.6?E.back(t/.6):1};
function rnd(i){const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)}
function hx(h){h=String(h||"#888").replace("#","");if(h.length===3)h=h.split("").map(x=>x+x).join("");const n=parseInt(h.slice(0,6),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function mix(a,b,t){const A=hx(a),B=hx(b);return"rgb("+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")+")"}
function rgba(a,al){const A=hx(a);return"rgba("+A.join(",")+","+al+")"}
let GRAIN=null;function grain(){if(GRAIN)return GRAIN;const g=new OffscreenCanvas(256,256),x=g.getContext("2d"),d=x.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=Math.floor(rnd(i*.37)*255);d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}x.putImageData(d,0,0);GRAIN=g;return g}
let DOTS=null;function dots(){if(DOTS)return DOTS;const g=new OffscreenCanvas(24,24),x=g.getContext("2d");x.fillStyle="#000";x.beginPath();x.arc(6,6,3.2,0,Math.PI*2);x.arc(18,18,3.2,0,Math.PI*2);x.fill();DOTS=g;return g}
function mkKit(c,sc,S,T){const P=S.pal,M=S.mode,norm=s=>String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
 const FONT=S.font||"system-ui, -apple-system, Segoe UI, sans-serif";
 // фарбування контуру в мові стилю: одна функція для всіх фігур і героя
 const paint=(o,box)=>{const col=o.fill||P.a,al=o.alpha==null?1:clamp(o.alpha),[x0,y0,w,h]=box;c.globalAlpha=al;
  if(o.fill===null&&!o.stroke)return;
  if(M==="line"){const acc=o.fill&&o.fill!==P.paper&&o.fill!==P.bg&&o.fill!==P.ink;if(o.fill!==null){c.save();if(acc&&!o.solid){c.shadowColor=rgba(col,.9);c.shadowBlur=0;c.shadowOffsetX=14;c.shadowOffsetY=14}c.fillStyle=o.solid?col:P.paper;c.fill();c.restore()}c.lineWidth=o.lw||5;c.lineJoin="round";c.strokeStyle=o.stroke||P.ink;c.stroke();return}
  if(M==="neon"){if(o.fill!==null){c.fillStyle=rgba(P.bg,.88);c.fill()}c.save();c.shadowColor=o.stroke||col;c.shadowBlur=34;c.lineWidth=o.lw||7;c.strokeStyle=o.stroke||col;c.stroke();c.shadowBlur=12;c.lineWidth=Math.max(2,(o.lw||7)*.3);c.strokeStyle="rgba(255,255,255,.85)";c.stroke();c.restore();return}
  if(M==="glass"){if(o.shadow!==false){c.save();c.shadowColor=rgba(col,.45);c.shadowBlur=60;c.fillStyle=rgba(col,.22);c.fill();c.restore()}const g=c.createLinearGradient(x0,y0,x0+w,y0+h);g.addColorStop(0,"rgba(255,255,255,.30)");g.addColorStop(.5,rgba(col,.20));g.addColorStop(1,"rgba(255,255,255,.06)");c.fillStyle=g;if(o.fill!==null)c.fill();c.lineWidth=o.lw||3;c.strokeStyle=o.stroke||"rgba(255,255,255,.55)";c.stroke();return}
  if(M==="clay"){if(o.shadow!==false){c.save();c.shadowColor=rgba(P.ink,.22);c.shadowBlur=60;c.shadowOffsetY=34;c.fillStyle=col;c.fill();c.restore()}const g=c.createLinearGradient(x0,y0,x0,y0+h);g.addColorStop(0,mix(col,"#ffffff",.32));g.addColorStop(.55,col);g.addColorStop(1,mix(col,"#000000",.22));c.fillStyle=g;if(o.fill!==null)c.fill();c.save();c.clip();const hl=c.createRadialGradient(x0+w*.3,y0+h*.18,0,x0+w*.3,y0+h*.18,Math.max(w,h)*.7);hl.addColorStop(0,"rgba(255,255,255,.55)");hl.addColorStop(.4,"rgba(255,255,255,.08)");hl.addColorStop(1,"rgba(255,255,255,0)");c.fillStyle=hl;c.fillRect(x0,y0,w,h);c.restore();if(o.stroke){c.lineWidth=o.lw||6;c.strokeStyle=o.stroke;c.stroke()}return}
  if(M==="paper"){c.save();if(o.shadow!==false){c.shadowColor="rgba(20,16,10,.30)";c.shadowBlur=0;c.shadowOffsetX=9;c.shadowOffsetY=12}c.fillStyle=col;if(o.fill!==null)c.fill();c.restore();c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=al*.22;c.fillStyle=c.createPattern(grain(),"repeat");c.fillRect(x0-4,y0-4,w+8,h+8);c.restore();if(o.stroke){c.lineWidth=o.lw||4;c.strokeStyle=o.stroke;c.stroke()}return}
  if(M==="riso"){c.save();c.globalCompositeOperation="multiply";c.shadowColor=rgba(o.fill===P.b?P.a:P.b,.6);c.shadowBlur=0;c.shadowOffsetX=-7;c.shadowOffsetY=6;c.fillStyle=rgba(col,.9);if(o.fill!==null)c.fill();c.shadowColor="transparent";c.clip();c.globalAlpha=al*.35;c.fillStyle=c.createPattern(dots(),"repeat");c.fillRect(x0,y0+h*.55,w,h*.45);c.restore();if(o.stroke){c.lineWidth=o.lw||5;c.strokeStyle=o.stroke;c.stroke()}return}
  if(o.shadow!==false){c.save();c.shadowColor="rgba(0,0,0,.28)";c.shadowBlur=o.blur==null?24:o.blur;c.shadowOffsetY=o.sy==null?10:o.sy;c.fillStyle=col;if(o.fill!==null)c.fill();c.restore()}else{c.fillStyle=col;if(o.fill!==null)c.fill()}if(o.stroke){c.lineWidth=o.lw||6;c.strokeStyle=o.stroke;c.stroke()}};
 const k={W,H,P,E,lerp,clamp,rnd,mix,rgba,dur:sc.d,style:S.id,
  p:(t,a,b)=>clamp((t-a)/Math.max(.001,b-a)),
  at:(w)=>{const q=norm(w).slice(0,6);const f=sc.words.find(x=>norm(x.w).startsWith(q)||q.startsWith(norm(x.w).slice(0,6)));return f?f.t:0},
  bg:(col)=>{const b=col||P.bg,t=T||0;c.save();
   if(M==="neon"){c.fillStyle=b;c.fillRect(0,0,W,H);const g=c.createLinearGradient(0,H*.55,0,H);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,rgba(P.d,.35));c.fillStyle=g;c.fillRect(0,0,W,H);c.strokeStyle=rgba(P.b,.22);c.lineWidth=2;for(let i=-12;i<=12;i++){c.beginPath();c.moveTo(W/2+i*40,H*.62);c.lineTo(W/2+i*260,H);c.stroke()}for(let j=0;j<10;j++){const yy=H*.62+Math.pow((j+((t*.4)%1))/10,2)*H*.38;c.beginPath();c.moveTo(0,yy);c.lineTo(W,yy);c.stroke()}const hz=c.createRadialGradient(W/2,H*.6,0,W/2,H*.6,W*.9);hz.addColorStop(0,rgba(P.a,.18));hz.addColorStop(1,"rgba(0,0,0,0)");c.fillStyle=hz;c.fillRect(0,0,W,H)}
   else if(M==="glass"){c.fillStyle=b;c.fillRect(0,0,W,H);c.globalCompositeOperation="lighter";[[P.a,.25,.3,.35],[P.b,.75,.55,.3],[P.c,.4,.85,.28]].forEach(([cl,fx,fy,al],i)=>{const x=W*fx+Math.sin(t*.3+i*2)*120,y=H*fy+Math.cos(t*.25+i)*140,g=c.createRadialGradient(x,y,0,x,y,W*.75);g.addColorStop(0,rgba(cl,al));g.addColorStop(1,"rgba(0,0,0,0)");c.fillStyle=g;c.fillRect(0,0,W,H)})}
   else if(M==="clay"){const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,mix(b,"#ffffff",.25));g.addColorStop(1,mix(b,P.c,.18));c.fillStyle=g;c.fillRect(0,0,W,H);const f=c.createRadialGradient(W/2,H*.78,0,W/2,H*.78,W*.7);f.addColorStop(0,"rgba(255,255,255,.35)");f.addColorStop(1,"rgba(255,255,255,0)");c.fillStyle=f;c.fillRect(0,0,W,H)}
   else if(M==="paper"||M==="riso"||M==="line"){c.fillStyle=b;c.fillRect(0,0,W,H);c.globalCompositeOperation="multiply";c.globalAlpha=M==="line"?.06:.13;c.fillStyle=c.createPattern(grain(),"repeat");c.fillRect(0,0,W,H);c.globalAlpha=1;c.globalCompositeOperation="source-over";if(M==="paper"){c.strokeStyle="rgba(0,0,0,.05)";c.lineWidth=1;for(let i=0;i<40;i++){const y=rnd(i)*H;c.beginPath();c.moveTo(0,y);c.lineTo(W,y+rnd(i+9)*30);c.stroke()}}}
   else{c.fillStyle=b;c.fillRect(0,0,W,H);const g=c.createRadialGradient(W/2,H*.45,H*.15,W/2,H*.5,H*.75);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.45)");c.fillStyle=g;c.fillRect(0,0,W,H)}
   c.restore()},
  ground:(y,o={})=>{const yy=y==null?H*.72:y;c.save();if(M==="line"){k.line(80,yy,W-80,yy,{lw:4})}else if(M==="neon"){}else{const g=c.createLinearGradient(0,yy,0,H);g.addColorStop(0,o.color||mix(P.bg,P.ink,M==="clay"?.08:.25));g.addColorStop(1,mix(P.bg,P.ink,.45));c.globalAlpha=o.alpha==null?(M==="glass"?.35:.85):o.alpha;c.fillStyle=g;c.fillRect(0,yy,W,H-yy)}c.restore()},
  rect:(x,y,w,h,o={})=>{c.save();c.translate(x,y);if(o.rot)c.rotate(o.rot);if(o.s!=null)c.scale(o.s,o.s);const r=Math.min(o.r==null?(S.radius||0):o.r,Math.abs(w)/2,Math.abs(h)/2);c.beginPath();c.roundRect(-w/2,-h/2,w,h,r);paint(o,[-w/2,-h/2,w,h]);c.restore()},
  circle:(x,y,r,o={})=>{c.save();c.beginPath();c.arc(x,y,Math.max(0,r),0,Math.PI*2);paint(o,[x-r,y-r,2*r,2*r]);c.restore()},
  poly:(pts,o={})=>{if(!pts||pts.length<2)return;c.save();let a=1e9,b=1e9,e=-1e9,f=-1e9;for(const q of pts){a=Math.min(a,q[0]);b=Math.min(b,q[1]);e=Math.max(e,q[0]);f=Math.max(f,q[1])}c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(const q of pts.slice(1))c.lineTo(q[0],q[1]);if(o.close===false){c.globalAlpha=o.alpha==null?1:clamp(o.alpha);c.lineWidth=o.lw||6;c.lineCap="round";c.lineJoin="round";c.strokeStyle=o.stroke||P.ink;if(M==="neon"){c.shadowColor=o.stroke||P.a;c.shadowBlur=28}c.stroke()}else{c.closePath();paint(o,[a,b,e-a,f-b])}c.restore()},
  line:(x1,y1,x2,y2,o={})=>{c.save();c.globalAlpha=o.alpha==null?1:clamp(o.alpha);c.lineWidth=o.lw||6;c.lineCap="round";c.strokeStyle=o.color||P.ink;if(M==="neon"){c.shadowColor=o.color||P.a;c.shadowBlur=26}if(o.dash)c.setLineDash(o.dash);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.restore()},
  label:(s,x,y,o={})=>{c.save();c.globalAlpha=o.alpha==null?1:clamp(o.alpha);c.translate(x,y);if(o.rot)c.rotate(o.rot);if(o.s!=null)c.scale(o.s,o.s);const fam=o.font||FONT,wt=o.weight||S.weight||800;c.font=wt+" "+(o.size||56)+"px "+fam;c.textAlign=o.align||"center";c.textBaseline="middle";if(S.track)c.letterSpacing=S.track;c.fillStyle=o.color||P.ink;const t=String(s==null?"":s);if(o.maxW){let f=o.size||56;while(f>14&&c.measureText(t).width>o.maxW){f-=2;c.font=wt+" "+f+"px "+fam}}if(M==="neon"){c.shadowColor=o.color||P.a;c.shadowBlur=30}c.fillText(S.upper?t.toUpperCase():t,0,0);c.restore()},
  light:(x,y,r,col,a=.5)=>{c.save();const g=c.createRadialGradient(x,y,0,x,y,Math.max(1,r));g.addColorStop(0,col||P.light);g.addColorStop(1,"rgba(0,0,0,0)");c.globalAlpha=clamp(a*(M==="line"||M==="paper"||M==="riso"?.35:1));c.globalCompositeOperation=(M==="line"||M==="paper"||M==="riso")?"multiply":"lighter";c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore()},
  cone:(x,y,len,ang,spread,col,a=.25)=>{c.save();c.globalAlpha=clamp(a*((M==="line"||M==="paper"||M==="riso")?.45:1));c.globalCompositeOperation=(M==="line"||M==="paper"||M==="riso")?"multiply":"lighter";const g=c.createLinearGradient(x,y,x+Math.cos(ang)*len,y+Math.sin(ang)*len);g.addColorStop(0,col||P.light);g.addColorStop(1,"rgba(0,0,0,0)");c.fillStyle=g;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(ang-spread)*len,y+Math.sin(ang-spread)*len);c.lineTo(x+Math.cos(ang+spread)*len,y+Math.sin(ang+spread)*len);c.closePath();c.fill();c.restore()},
  particles:(n,seed,t,o={})=>{c.save();if(M==="neon"||M==="glass")c.globalCompositeOperation="lighter";for(let i=0;i<Math.min(n,400);i++){const a=rnd(seed+i)*Math.PI*2,sp=(o.speed||120)*(.4+rnd(seed+i+.5)),life=((t*(o.rate||.5)+rnd(seed+i*3))%1);const px=(o.x==null?W/2:o.x)+Math.cos(a)*sp*life*(o.spread||3),py=(o.y==null?H/2:o.y)+Math.sin(a)*sp*life*(o.spread||3)-(o.rise||0)*life;c.globalAlpha=(1-life)*(o.alpha||.8);c.fillStyle=o.color||(M==="line"?P.ink:P.light);c.beginPath();c.arc(px,py,(o.size||6)*(1-life*.5),0,Math.PI*2);c.fill()}c.restore()},
  cam:(fn,o={})=>{c.save();const sh=o.shake?o.shake*(rnd(Math.floor((o.t||T||0)*30))-.5)*2:0;c.translate(W/2+(o.x||0)+sh,H/2+(o.y||0)+sh*.6);if(o.rot)c.rotate(o.rot);const z=o.zoom||1;c.scale(z,z);c.translate(-W/2,-H/2);fn();c.restore()},
  hero:(x,y,s=1,o={})=>{const t=o.t==null?(T||0):o.t,pose=o.pose||"stand",look=clamp(o.look||0,-1,1),col=o.color||P.hero,scf=o.scarf||P.scarf,ink=M==="neon"?P.ink:P.ink;c.save();c.translate(x,y);c.scale(s,s);const bob=pose==="walk"?Math.abs(Math.sin(t*8))*-10:Math.sin(t*2)*4,sq=pose==="shock"?1.08:1;c.translate(0,bob);
   if(M!=="neon"&&M!=="line"){c.fillStyle=M==="glass"?"rgba(0,0,0,.35)":"rgba(0,0,0,.18)";c.beginPath();c.ellipse(0,-bob+8,90,16,0,0,Math.PI*2);c.fill()}
   const leg=pose==="walk"?Math.sin(t*8)*18:0;const limb=(M==="neon"?col:M==="glass"?"rgba(255,255,255,.75)":ink);c.strokeStyle=limb;c.lineWidth=M==="line"?7:15;c.lineCap="round";if(M==="neon"){c.shadowColor=col;c.shadowBlur=24}if(pose!=="sit"){c.beginPath();c.moveTo(-28,-40);c.lineTo(-28-leg,0);c.moveTo(28,-40);c.lineTo(28+leg,0);c.stroke()}c.shadowBlur=0;
   const top=pose==="sit"?-250:-300,bh=pose==="sit"?230:270;c.save();c.scale(1/sq,sq);c.beginPath();c.roundRect(-75,top,150,bh,75);paint({fill:col},[-75,top,150,bh]);c.restore();
   const ey=top+80,eyeW=M==="line"||M==="neon"?"rgba(0,0,0,0)":"#fff";c.globalAlpha=1;c.fillStyle=eyeW;c.beginPath();c.ellipse(-24+look*14,ey,17,pose==="shock"?24:19,0,0,Math.PI*2);c.ellipse(26+look*14,ey,17,pose==="shock"?24:19,0,0,Math.PI*2);c.fill();
   const bl=(o.blink!==false&&(t%3.2)<.12)?.15:1,pupil=M==="neon"?"#fff":M==="glass"?"#0b1020":ink;c.fillStyle=pupil;c.beginPath();c.ellipse(-24+look*20,ey+2,8,9*bl,0,0,Math.PI*2);c.ellipse(26+look*20,ey+2,8,9*bl,0,0,Math.PI*2);c.fill();
   c.strokeStyle=pupil;c.lineWidth=7;c.beginPath();const my=ey+52;if(pose==="happy"){c.arc(look*10,my-12,22,.15*Math.PI,.85*Math.PI)}else if(pose==="sad"||pose==="think"){c.arc(look*10,my+14,18,1.15*Math.PI,1.85*Math.PI)}else if(pose==="shock"){c.ellipse(look*10,my,11,16,0,0,Math.PI*2)}else{c.moveTo(-14+look*10,my);c.lineTo(14+look*10,my)}c.stroke();
   c.beginPath();c.roundRect(-82,top+130,164,34,16);paint({fill:scf,shadow:false},[-82,top+130,164,34]);const fl=Math.sin(t*5)*12;c.beginPath();c.moveTo(50,top+150);c.lineTo(96+fl,top+215);c.lineTo(66+fl*.6,top+222);c.closePath();paint({fill:scf,shadow:false},[50,top+150,50,72]);
   c.globalAlpha=1;c.strokeStyle=M==="line"?ink:M==="neon"?col:M==="glass"?"rgba(255,255,255,.75)":col;c.lineWidth=M==="line"?8:22;c.lineCap="round";if(M==="neon"){c.shadowColor=col;c.shadowBlur=24}c.beginPath();const ay=top+175;if(pose==="point"){c.moveTo(70,ay);c.lineTo(165,ay-55)}else if(pose==="shock"){c.moveTo(-70,ay);c.lineTo(-130,ay-120);c.moveTo(70,ay);c.lineTo(130,ay-120)}else if(pose==="think"){c.moveTo(60,ay);c.lineTo(40,top+120)}else{const sw=pose==="walk"?Math.sin(t*8)*20:0;c.moveTo(-70,ay);c.lineTo(-92-sw,ay+80);c.moveTo(70,ay);c.lineTo(92+sw,ay+80)}c.stroke();c.restore()}
 };return k}
// фінальна обробка кадру в мові стилю: зерно, віньєтка, тон
function post(c,S,t){const p=S.post||{};c.save();if(p.grain){c.globalCompositeOperation="overlay";c.globalAlpha=p.grain;const g=grain();c.translate(-(Math.floor(t*30)*37)%256,-(Math.floor(t*30)*61)%256);c.fillStyle=c.createPattern(g,"repeat");c.fillRect(0,0,W+512,H+512);c.setTransform(1,0,0,1,0,0)}
 if(p.vignette){c.globalCompositeOperation="source-over";c.globalAlpha=1;const v=c.createRadialGradient(W/2,H/2,H*.28,W/2,H/2,H*.72);v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(0,0,0,"+p.vignette+")");c.fillStyle=v;c.fillRect(0,0,W,H)}
 if(p.tint){c.globalCompositeOperation="soft-light";c.globalAlpha=p.tint[1];c.fillStyle=p.tint[0];c.fillRect(0,0,W,H)}c.restore()}
const FALL=(c,t,k)=>{k.bg();k.ground();k.light(W/2,H*.3,700,k.P.light,.25);k.hero(W/2,H*.68,1.3,{t,pose:"think"})};
let SC=[],ST=null,CV=null,CX=null;
onmessage=async(ev)=>{const m=ev.data||{};
 if(m.op==="load"){ST=m.style;SC=(m.scenes||[]).map(s=>{let fn=null,err="";if(String(s.code||"").trim()){try{fn=new Function("c","t","k",String(s.code))}catch(e){err="синтаксис: "+String(e&&e.message||e).slice(0,140)}}return{...s,fn,err}});
  CV=new OffscreenCanvas(W,H);CX=CV.getContext("2d",{alpha:false});
  const errs=[];for(const s of SC){if(s.err){errs.push({id:s.id,err:s.err});continue}if(!s.fn)continue;postMessage({op:"testing",id:s.id});try{const tt=Math.min(s.d*.5,1),k=mkKit(CX,s,ST,tt);CX.save();s.fn(CX,tt,k);CX.restore()}catch(e){s.err="виконання: "+String(e&&e.message||e).slice(0,140);errs.push({id:s.id,err:s.err})}}
  postMessage({op:"loaded",errs});return}
 if(m.op==="frame"){const T=m.t||0;let s=SC.find(x=>T>=x.t0&&T<x.t1)||SC[SC.length-1];CX.setTransform(1,0,0,1,0,0);CX.globalAlpha=1;CX.fillStyle="#000";CX.fillRect(0,0,W,H);
  if(s){const lt=clamp(T-s.t0,0,s.d),k=mkKit(CX,s,ST,lt);CX.save();try{if(s.fn&&!s.err)s.fn(CX,lt,k);else FALL(CX,lt,k)}catch(e){s.err="виконання: "+String(e&&e.message||e).slice(0,140);CX.restore();CX.save();FALL(CX,lt,k);postMessage({op:"err",id:s.id,err:s.err})}CX.restore();CX.setTransform(1,0,0,1,0,0);CX.globalAlpha=1;CX.globalCompositeOperation="source-over";post(CX,ST,T);
   const nx=SC[SC.indexOf(s)+1];if(nx&&s.t1-T<.12){CX.globalAlpha=clamp(1-(s.t1-T)/.12)*.35;CX.fillStyle="#000";CX.fillRect(0,0,W,H);CX.globalAlpha=1}}
  const w=m.w||W,h=Math.round(w*H/W);const bmp=w===W?await createImageBitmap(CV):await createImageBitmap(CV,{resizeWidth:w,resizeHeight:h,resizeQuality:"medium"});postMessage({op:"frame",n:m.n,bmp},[bmp]);return}};
postMessage({op:"ready"});`;

  // пісочниця: iframe без same-origin і без мережі (CSP); код сцен виконується у Worker усередині неї —
  // зациклена сцена не блокує сторінку, а iframe просто перестворюється
  const SANDBOX = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:"><script>
const src=${JSON.stringify(KIT)};const w=new Worker(URL.createObjectURL(new Blob([src],{type:"text/javascript"})));
w.onmessage=(e)=>{const m=e.data||{};parent.postMessage(m,"*",m.bmp?[m.bmp]:[])};
w.onerror=(e)=>{parent.postMessage({op:"werr",err:String(e.message||e)},"*")};
onmessage=(e)=>{if(e.source===parent)w.postMessage(e.data)};
<\/script>`;

  // ---------- пісочниця ----------
  function sandbox() { let fr = null, ready = null, n = 0, testing = null; const wait = new Map(); let onErr = null;
    const boot = () => { fr?.remove(); fr = document.createElement("iframe"); fr.setAttribute("sandbox", "allow-scripts"); fr.style.cssText = "position:fixed;width:1px;height:1px;left:-9px;top:-9px;opacity:0;pointer-events:none;border:0";
      ready = new Promise((ok) => { const h = (ev) => { if (ev.source !== fr.contentWindow) return; const m = ev.data || {};
        if (m.op === "ready") ok(); else if (m.op === "testing") testing = m.id;
        else if (m.op === "loaded") { const k = [...wait.keys()].find((x) => String(x).startsWith("load")); const w = k && wait.get(k); if (w) { wait.delete(k); w(m); } }
        else if (m.op === "frame") { const w = wait.get(m.n); if (w) { wait.delete(m.n); w(m); } }
        else if (m.op === "err") onErr?.(m); }; window.addEventListener("message", h); fr._h = h; });
      fr.srcdoc = SANDBOX; document.body.appendChild(fr); };
    boot();
    const ask = (msg, key, ms) => new Promise((ok, no) => { const tm = setTimeout(() => { wait.delete(key); no(new Error("timeout")); }, ms); wait.set(key, (m) => { clearTimeout(tm); ok(m); }); fr.contentWindow.postMessage(msg, "*"); });
    let last = null, q = Promise.resolve();
    // усі звернення до пісочниці — строго по черзі: паралельні load/frame плутали відповіді й хибно «вішали» сцени
    const run = (f) => { const p = q.then(f, f); q = p.catch(() => {}); return p; };
    const load = async (scenes, style, tries = 0) => { await ready; last = { scenes, style }; testing = null; const key = "load" + (++n);
      try { return await ask({ op: "load", scenes, style }, key, 6000); }
      catch (e) { // сцена зависла на перевірці — прибираємо її код і пробуємо ще раз
        const bad = scenes.find((s) => s.id === testing); if (!bad || tries > 6) throw e; bad.code = ""; const hung = { id: bad.id, err: "сцена зависла — замінено запасною" }; onErr?.(hung);
        window.removeEventListener("message", fr._h); boot(); await ready; const r = await load(scenes, style, tries + 1); r.errs = [...(r.errs || []), hung]; return r; } };
    const frame = async (t, w) => { await ready; const k = ++n; try { return (await ask({ op: "frame", t, w, n: k }, k, 4000)).bmp; }
      catch (e) { // зависла сцена (нескінченний цикл) — перезапускаємо пісочницю, сцену позначаємо зламаною
        const bad = last?.scenes.find((s) => t >= s.t0 && t < s.t1); if (bad) { bad.code = ""; onErr?.({ id: bad.id, err: "сцена зависла — замінено запасною" }); }
        window.removeEventListener("message", fr._h); boot(); if (last) await load(last.scenes, last.style); throw e; } };
    return {
      load: (scenes, style) => run(() => load(scenes, style)),
      frame: (t, w) => run(() => frame(t, w)),
      onErr(f) { onErr = f; }, kill() { window.removeEventListener("message", fr?._h); fr?.remove(); } }; }

  // ---------- слова й таймінги ----------
  const splitW = (s) => String(s || "").split(/\s+/).map((w) => w.trim()).filter(Boolean);
  function wordTimes(vo, d) { const ws = splitW(vo), wt = ws.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2), tot = wt.reduce((a, b) => a + b, 0) || 1; let acc = 0;
    return ws.map((w, i) => { const t = +(d * .94 * acc / tot).toFixed(2); acc += wt[i]; return { w, t }; }); }
  function scenesFrom(board) { return (board?.scenes || []).map((z) => { const t0 = +z.t_start || 0, t1 = Math.max(t0 + .4, +z.t_end || t0 + 2), d = +(t1 - t0).toFixed(2); return { id: z.id, t0, t1, d, vo: z.vo || "", words: wordTimes(z.vo, d), z }; }); }

  // ---------- звук: звуки подій + тихий фон, що притихає під голос ----------
  function synth(kind, sr = SR) { const L = (s) => new Float32Array(Math.round(s * sr)); let y;
    const env = (i, n, a = .005, rel = 1) => { const t = i / sr; return Math.min(1, t / a) * Math.pow(1 - i / n, rel * 3); };
    const noise = () => Math.random() * 2 - 1;
    switch (kind) {
      case "pop": y = L(.12); for (let i = 0; i < y.length; i++) { const t = i / sr, f = 700 - 4200 * t; y[i] = Math.sin(2 * Math.PI * f * t) * env(i, y.length, .002, 1.4) * .7; } break;
      case "click": y = L(.03); for (let i = 0; i < y.length; i++) y[i] = noise() * env(i, y.length, .001, 2) * .5; break;
      case "tick": y = L(.05); for (let i = 0; i < y.length; i++) y[i] = Math.sin(2 * Math.PI * 2200 * i / sr) * env(i, y.length, .001, 2) * .45; break;
      case "ding": y = L(1.1); for (let i = 0; i < y.length; i++) { const t = i / sr; y[i] = (Math.sin(2 * Math.PI * 1320 * t) + .5 * Math.sin(2 * Math.PI * 1980 * t) + .25 * Math.sin(2 * Math.PI * 2640 * t)) * env(i, y.length, .002, 1.6) * .32; } break;
      case "chime": { y = L(1.3); [0, .12, .24].forEach((o, j) => { const f = [1046, 1318, 1568][j]; for (let i = Math.round(o * sr); i < y.length; i++) { const t = i / sr - o; y[i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 4) * .2; } }); break; }
      case "thud": case "boom": { const s = kind === "boom" ? .9 : .3; y = L(s); for (let i = 0; i < y.length; i++) { const t = i / sr, f = (kind === "boom" ? 70 : 110) * Math.exp(-t * 6) + 38; y[i] = (Math.sin(2 * Math.PI * f * t) * .9 + (t < .015 ? noise() * .4 : 0)) * env(i, y.length, .002, kind === "boom" ? .6 : 1.2) * .85; } break; }
      case "whoosh": case "swoosh": { y = L(.42); let lp = 0; for (let i = 0; i < y.length; i++) { const p = i / y.length, a = .04 + .5 * Math.sin(Math.PI * p); lp += a * (noise() - lp); y[i] = lp * Math.sin(Math.PI * p) * 1.6; } break; }
      case "riser": { y = L(1.1); let lp = 0; for (let i = 0; i < y.length; i++) { const p = i / y.length, t = i / sr; lp += (.05 + .4 * p) * (noise() - lp); y[i] = (lp * .8 + Math.sin(2 * Math.PI * (200 + 900 * p * p) * t) * .25) * p * p * .8; } break; }
      case "glitch": { y = L(.28); for (let i = 0; i < y.length; i++) { const seg = Math.floor(i / (sr * .02)); y[i] = ((seg % 3 ? 1 : -1) * Math.sign(Math.sin(2 * Math.PI * (300 + (seg * 137) % 900) * i / sr)) * .25 + noise() * .1) * env(i, y.length, .001, .8); } break; }
      case "paper": { y = L(.32); let lp = 0; for (let i = 0; i < y.length; i++) { lp += .6 * (noise() - lp); y[i] = (Math.random() < .08 ? lp : lp * .2) * env(i, y.length, .01, .8) * .7; } break; }
      case "heartbeat": { y = L(.7); [0, .22].forEach((o) => { for (let i = Math.round(o * sr); i < Math.min(y.length, Math.round((o + .16) * sr)); i++) { const t = i / sr - o; y[i] += Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 22) * .9; } }); break; }
      default: y = null; }
    return y; }
  const KINDS = ["pop", "click", "tick", "ding", "chime", "thud", "boom", "whoosh", "riser", "glitch", "paper", "heartbeat", "silence"];
  function mixdown(voice, scenes, anim) { const n = voice.length + Math.round(.3 * SR), out = new Float32Array(n); out.set(voice);
    // обвідна голосу для притишення фону
    const blk = 1024, envV = new Float32Array(Math.ceil(n / blk)); for (let b = 0; b < envV.length; b++) { let s = 0; for (let i = b * blk; i < Math.min(voice.length, (b + 1) * blk); i++) s += Math.abs(voice[i]); envV[b] = Math.min(1, s / blk * 8); }
    const silent = []; let ev = 0;
    scenes.forEach((s) => { const a = anim?.[s.id]; (a?.sfx || []).forEach((e) => { const kind = String(e.kind || "").toLowerCase(); if (!KINDS.includes(kind)) return;
      const f = s.words.find((w) => w.w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").startsWith(String(e.word || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").slice(0, 6))); const t = s.t0 + (f ? f.t : 0) + (+e.dt || 0);
      if (kind === "silence") { silent.push([t, t + 1.2]); return; } const y = synth(kind); if (!y) return; ev++; const at = Math.round(t * SR), g = .55;
      for (let i = 0; i < y.length && at + i < n; i++) if (at + i >= 0) out[at + i] += y[i] * g; }); });
    // фон: тихий акорд, що «дихає», притихає під голос і зникає на навмисній тиші
    const fq = [110, 164.81, 220, 277.18]; let sm = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; let q = 1; for (const [a, b] of silent) if (t >= a - .05 && t < b) q = 0; sm += (q - sm) * .0008;
      const v = envV[Math.floor(i / blk)] || 0, g = .028 * (1 - .65 * v) * sm * Math.min(1, t / 1.5) * Math.min(1, (n / SR - t) / 1.2);
      let p = 0; for (let j = 0; j < fq.length; j++) p += Math.sin(2 * Math.PI * fq[j] * t + j) * (j ? .5 : 1); out[i] += p * g * (.8 + .2 * Math.sin(t * .7)); }
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i])); if (pk > .98) for (let i = 0; i < n; i++) out[i] *= .98 / pk;
    return { y: out, events: ev }; }
  function wav(y) { const b = new ArrayBuffer(44 + y.length * 2), v = new DataView(b), s = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    s(0, "RIFF"); v.setUint32(4, 36 + y.length * 2, true); s(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, "data"); v.setUint32(40, y.length * 2, true);
    for (let i = 0; i < y.length; i++) v.setInt16(44 + i * 2, clamp(y[i], -1, 1) * 32767, true); return b; }


  // ---------- стилі: «шкурки» рушія (механіка від них не залежить) ----------
  const PAL = (bg, a, b, c, d, ink, paper, hero, scarf, light) => ({ bg, a, b, c, d, ink, paper, hero, scarf, danger: "#ff3b4e", light });
  const STYLES = [
    { id: "flat", name: "Пласкі кольори", mode: "flat", pal: PAL("#151824", "#4cc3b0", "#f2b84b", "#ff6b5b", "#7aa2ff", "#101114", "#f5f1e8", "#4cc3b0", "#f2b84b", "rgba(255,236,190,1)"), radius: 18, post: { grain: .05, vignette: .35 },
      manner: "Плаский кольоровий 2D: чисті геометричні форми з м'якою тінню, насичені кольори на темному тлі, теплий конус світла, пил у промені. Читається як сучасна інфографіка-історія." },
    { id: "clay", name: "М'який 3D", mode: "clay", pal: PAL("#e9e3f5", "#6c63ff", "#ff8a65", "#2ec4b6", "#ffd166", "#2b2d42", "#ffffff", "#6c63ff", "#ffd166", "rgba(255,255,255,1)"), radius: 48, font: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif", weight: 800, post: { grain: .03, vignette: .12 },
      manner: "Преміальний «пластилін/софт-3D» як у рекламі Apple: великі округлі об'ємні форми з м'яким світлом зверху-ліворуч, глибокі розмиті тіні під предметами, пастельне тло-студія з підлогою. Мало предметів, багато повітря, предмети ніби іграшкові й дорогі. Об'єкти плавно підстрибують, стискаються й розтягуються (squash & stretch)." },
    { id: "neon", name: "Неоновий нуар", mode: "neon", pal: PAL("#07070c", "#ff2e88", "#00e5ff", "#b4ff39", "#8a5cff", "#e9e9f2", "#111118", "#00e5ff", "#ff2e88", "rgba(0,229,255,1)"), radius: 22, font: "'Avenir Next', 'Helvetica Neue', system-ui, sans-serif", weight: 700, upper: true, track: "6px", post: { grain: .07, vignette: .55 },
      manner: "Кіберпанк-нуар уночі: усе — світні неонові контури на чорному, перспективна сітка підлоги, туман, дощ (частинки вниз), відблиски. Світло — головний актор: спалахи, мерехтіння вивісок, промені. Напруга й кіно. Написи — як неонові вивіски великими літерами." },
    { id: "collage", name: "Редакційний колаж", mode: "paper", pal: PAL("#efe9df", "#e63b2e", "#1f3a5f", "#f2b134", "#8fa998", "#161616", "#fbf8f2", "#1f3a5f", "#e63b2e", "rgba(255,240,200,1)"), radius: 4, font: "Georgia, 'Times New Roman', serif", weight: 700, post: { grain: .08, vignette: .18 },
      manner: "Журнальний колаж як у The New Yorker / Bloomberg Businessweek: вирізки з паперу з жорсткою тінню, текстура паперу, червоний акцент, сміливі пропорції (величезний предмет поруч із крихітною людиною), серифні заголовки-написи на предметах, діагональні композиції, смуги й рамки. Розумно, іронічно, дорого." },
    { id: "line", name: "Мінімал-лінія", mode: "line", pal: PAL("#f6f3ec", "#c8a15a", "#2f5d50", "#b5543c", "#7d8ca3", "#111111", "#f6f3ec", "#c8a15a", "#111111", "rgba(255,236,190,1)"), radius: 10, font: "'Didot', 'Bodoni 72', Georgia, serif", weight: 400, track: "2px", post: { grain: .04 },
      manner: "Люксовий мінімалізм: тонкі чорні лінії на кремовому тлі, один золотий акцент, величезний негативний простір, предмети з одного-двох штрихів, елегантні серифні написи. Рух повільний і точний, як у рекламі годинників. Ніякого нагромадження — 1–3 предмети в кадрі." },
    { id: "glass", name: "Скло й аврора", mode: "glass", pal: PAL("#0b1020", "#7c5cff", "#2de1c2", "#ff7ab6", "#ffc46b", "#f4f6ff", "#1a2240", "#7c5cff", "#2de1c2", "rgba(180,200,255,1)"), radius: 40, font: "'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif", weight: 600, post: { grain: .04, vignette: .4 },
      manner: "Футуристичний інтерфейсний стиль: матові скляні панелі й предмети з тонкою світлою рамкою на темному тлі з повільною кольоровою авророю, м'яке світіння кольором предмета, плаваючі картки на різній глибині, мікроанімація як у преміальному додатку. Відчуття технологій і майбутнього." },
    { id: "riso", name: "Ризограф", mode: "riso", pal: PAL("#f4efe6", "#ff4f79", "#0078bf", "#ffe800", "#00a95c", "#1d1d1d", "#f4efe6", "#0078bf", "#ff4f79", "rgba(255,232,0,1)"), radius: 14, font: "'Futura', 'Avenir Next Condensed', system-ui, sans-serif", weight: 800, upper: true, post: { grain: .1 },
      manner: "Ризограф-постер: 2–3 яскраві плашкові кольори (рожевий, синій, жовтий), що накладаються з легким зсувом друку, растрові крапки, зерно, сміливі геометричні форми й великі гротескні написи. Арт-зін, музика, молодь — живо, сміливо, незвично." } ];
  const styleOf = (id) => STYLES.find((x) => x.id === id) || STYLES[0];
  const styleMsg = (st) => ({ id: st.id, mode: st.mode, pal: st.pal, font: st.font, weight: st.weight, upper: !!st.upper, track: st.track || "", radius: st.radius, post: st.post || {} });
  const PREMIUM = `Преміальна подача (обов'язково):
- Обмежена палітра стилю, багато повітря, одна головна думка в кадрі; не кліпарт і не «дитячий малюнок».
- Глибина: передній план (рамка, розмитий предмет, край), середній (дія), задній (локація, силует); шари рухаються з різною швидкістю при русі камери.
- Різні локації під зміст історії (кухня, офіс, вулиця вночі, метро, космос, всередині телефона, мікросвіт, абстрактний простір) — будуй їх простими формами стилю, локація змінюється, коли змінюється думка.
- Різні плани й композиції: макро на предмет, загальний, вид згори, розділений кадр, предмет-велетень поруч із крихітним героєм, асиметрія; не став усе в центр щоразу.
- Нестандартні форми: не лише прямокутники — дуги, хвилі, зрізані кути, сходинки, орбіти, складні силуети з кількох фігур.
- Рух з характером: перебіг (overshoot), затримка, squash & stretch, інерція; переходи через предмет (зум у екран, двері, око).`;
  // ---------- промт аніматора ----------
  const P_ANIM = `Ти — аніматор вірусних вертикальних 2D-відео і пишеш КОД анімації. Для кожної сцени ти пишеш тіло JavaScript-функції (c, t, k), яка малює ОДИН кадр сцени на canvas 1080×1920 у момент t (секунди від початку сцени). Функція викликається 30 разів на секунду; усе малюй заново щокадру, стану між кадрами немає.

Головне — показати сенс фрази дією, а не намалювати окреме слово. Шаблонних дій немає: імпровізуй під саме цю історію, як режисер. Дія сцени стартує на своєму ключовому слові: k.at("слово") повертає секунду, коли це слово звучить у сцені.

Набір k (інших API немає — ні DOM, ні мережі, ні зображень, ні шрифтів):
- k.W=1080, k.H=1920, k.dur — тривалість сцени; k.P — палітра стилю: bg, a, b, c, d, ink, paper, hero, scarf, danger, light.
- k.p(t, a, b) → прогрес 0..1 між секундами a і b; k.E.lin/in/out/inOut/back/elastic/pop(x) — пом'якшення; k.lerp(a,b,x); k.clamp(x); k.rnd(i) — стабільне випадкове 0..1 (Math.random НЕ використовуй — кадри мають бути однакові при повторі).
- k.bg(колір?) — фон з віньєткою. Малюй фон першим.
- k.rect(x, y, w, h, {r, fill, stroke, lw, rot, s, alpha, shadow:false}) — x,y — ЦЕНТР; k.circle(x, y, r, {…}); k.poly([[x,y],…], {fill, stroke, lw, close:false для ламаної}); k.line(x1,y1,x2,y2,{lw,color,dash,alpha}).
- k.label(текст, x, y, {size, color, weight, rot, s, alpha, maxW}) — ТІЛЬКИ напис на предметі (табличка, екран, календар, документ), не титр поверх кадру.
- k.hero(x, y, масштаб, {t, pose:"stand|walk|point|shock|sit|think|happy|sad", look:-1..1}) — герой-капсула з шарфом; x,y — точка між ногами; висота ≈ 320×масштаб.
- k.light(x, y, r, колір, сила) — світіння; k.cone(x, y, довжина, кут, розкид, колір, сила) — промінь; k.particles(n, seed, t, {x, y, spread, color, size, speed, rise, alpha}).
- k.cam(() => { …малювання… }, {zoom, x, y, rot, shake, t}) — камера навколо центру кадру (наїзд, тряска, нахил).
- k.ground(y?, {color, alpha}) — підлога/горизонт у мові стилю; k.mix(колір1, колір2, 0..1) і k.rgba(колір, прозорість) — відтінки палітри.
- Усі фігури й герой автоматично малюються в мові обраного стилю (об'єм, неон, скло, папір, лінія, друк) — передавай кольори з k.P, а не власні hex.
- Можна й напряму c (CanvasRenderingContext2D): c.save()/restore(), шляхи, градієнти. Не змінюй c.canvas.

Правила кадру:
- Щось рухається щосекунди (мікрорух: дихання, блимання, пил, світло); головна дія — чітка, читається за 1 с.
- Ключові предмети великі (не дрібніше ~180 px), композиція по центру 70% ширини, верх і низ по 200 px — без важливого (там інтерфейс соцмережі).
- Наскрізні образи й герой — ті самі в усіх сценах (кольори з k.P, однакові форми), щоб ролик був одним світом. Петля: остання сцена повторює образ першої в новому стані.
- Без циклів довших за 400 ітерацій і без рекурсії: функція має працювати за кілька мілісекунд.
- Код — лише тіло функції, без function/=>, без коментарів, без зворотних лапок \`. Не більше ~2500 символів на сцену.

{STYLE}

{PREMIUM}

Для кожної сцени також sfx — звуки подій: [{"word":"слово зі сцени","kind":"…","dt":0}], kind один з: ${KINDS.join(", ")}. "silence" — навмисна тиша фону на ударній фразі (максимум 2 на ролик). Перелік — окремий звук на кожен пункт.

Відповідь — тег <result> і в ньому лише JSON:
<result>{"scenes":[{"id":1,"code":"k.bg(); …","sfx":[{"word":"","kind":"pop","dt":0}]}]}</result>`;

  // ---------- стан і UI ----------
  const ST = { anim: null, sb: null, audio: null, url: "", playing: false, raf: 0, pending: false, vid: "", style: (() => { try { return localStorage.getItem("yvLabStyle") || "flat"; } catch (e) { return "flat"; } })() };
  const LSK = "yvLabAnim";
  const ls = { get() { try { return JSON.parse(localStorage.getItem(LSK) || "null"); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(LSK, JSON.stringify(v)); } catch (e) {} } };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sig = (board) => (board?.scenes || []).map((z) => z.vo).join("|").slice(0, 400) + (board?.scenes || []).length;

  async function generate(api, onProg, only) { const board = api.board(), sc = scenesFrom(board), st = styleOf(ST.style); if (!sc.length) throw new Error("no_board");
    const style = board.style || {}, motifs = api.motifs(), A = (only && ST.anim?.sig === sig(board)) ? ST.anim : { sig: sig(board), scenes: {}, style: st.id };
    const todo = only ? sc.filter((s) => only.includes(s.id)) : sc, chunks = []; for (let i = 0; i < todo.length; i += 3) chunks.push(todo.slice(i, i + 3)); // по 3 сцени — відповідь вкладається в ліміт часу сервера
    const head = `<film>\nКонцепт: ${board.concept || "—"}\nСтиль ролику: «${st.name}» (палітра й мова форм задані рушієм; з розкадровки бери лише настрій і концепт: ${JSON.stringify({ mood: style.mood, look: style.look }).slice(0, 300)})\n${motifs ? `Наскрізні образи: ${motifs}\n` : ""}Усі сцени коротко (для цілісності світу):\n${sc.map((s) => `${s.id}. [${s.t0}–${s.t1} с] «${s.vo}» — ${String(s.z.action || "").slice(0, 160)}`).join("\n")}\n</film>`;
    let done = 0; const run = async (ch) => {
      const user = `${head}\n\n<scenes>\n${ch.map((s) => JSON.stringify({ id: s.id, dur: s.d, vo: s.vo, words: s.words, action: s.z.action, shows: s.z.shows, camera: s.z.camera, text_in_scene: s.z.text_in_scene, sfx: s.z.sfx, retention: s.z.retention, prev: sc[sc.indexOf(s) - 1]?.z.action || "", next: sc[sc.indexOf(s) + 1]?.z.action || "" })).join("\n")}\n</scenes>\nНапиши код для сцен: ${ch.map((s) => s.id).join(", ")}.`;
      const r = await api.askJson(P_ANIM.replace("{STYLE}", `Стиль ролику — «${st.name}»: ${st.manner}`).replace("{PREMIUM}", PREMIUM), user, 8000, (x) => x && Array.isArray(x.scenes) && x.scenes.length);
      r.scenes.forEach((q) => { if (ch.some((s) => s.id === +q.id) && typeof q.code === "string") A.scenes[+q.id] = { code: q.code.slice(0, 6000), sfx: Array.isArray(q.sfx) ? q.sfx.slice(0, 8) : [], err: "" }; });
      done += ch.length; onProg(done, todo.length); };
    const q = [...chunks], workers = Array.from({ length: Math.min(4, q.length) }, async () => { while (q.length) { const ch = q.shift(); try { await run(ch); } catch (e) { console.warn("stage chunk", e); done += ch.length; onProg(done, todo.length, e); } } });
    await Promise.all(workers); ST.anim = A; ls.set(A); return A; }

  async function loadSandbox(api) { const board = api.board(), sc = scenesFrom(board), A = ST.anim; if (!ST.sb) { ST.sb = sandbox(); ST.sb.onErr((m) => { if (A.scenes[m.id]) { A.scenes[m.id].err = m.err; ls.set(A); } api.redraw?.(); }); }
    const list = sc.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1, d: s.d, words: s.words, code: /завис/.test(A.scenes[s.id]?.err || "") ? "" : A.scenes[s.id]?.code || "" }));
    const r = await ST.sb.load(list, styleMsg(styleOf(ST.style))); (r.errs || []).forEach((e) => { if (A.scenes[e.id]) A.scenes[e.id].err = e.err; }); sc.forEach((s) => { const a = A.scenes[s.id]; if (a && !(r.errs || []).some((e) => e.id === s.id) && !/завис/.test(a.err || "")) a.err = a.code ? "" : "немає коду"; }); ls.set(A); return r; }

  function buildAudio(api) { const v = api.voice(), sc = scenesFrom(api.board()); const m = mixdown(v.y, sc, ST.anim?.scenes); if (ST.url) URL.revokeObjectURL(ST.url);
    ST.url = URL.createObjectURL(new Blob([wav(m.y)], { type: "audio/wav" })); ST.mix = m; return m; }

  function stop() { ST.playing = false; cancelAnimationFrame(ST.raf); try { ST.audio?.pause(); } catch (e) {} }
  async function play(cv, api, btn) { if (ST.playing) { stop(); btn.textContent = "▶︎ Дивитися"; return; } const x = cv.getContext("2d"); if (!ST.audio) ST.audio = new Audio(); if (ST.audio.src !== ST.url) ST.audio.src = ST.url;
    ST.playing = true; btn.textContent = "⏸ Пауза"; try { await ST.audio.play(); } catch (e) {} const dur = api.voice().dur;
    const loop = async () => { if (!ST.playing) return; const t = ST.audio.currentTime || 0; if (t >= dur || ST.audio.ended) { stop(); btn.textContent = "▶︎ Дивитися ще"; return; }
      if (!ST.pending) { ST.pending = true; try { const bmp = await ST.sb.frame(t, cv.width); x.drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.(); } catch (e) {} ST.pending = false; }
      ST.raf = requestAnimationFrame(loop); }; loop(); }

  async function exportMp4(api, onProg) { const M = await import("https://cdn.jsdelivr.net/npm/mediabunny@1.45.0/+esm"); if (!window.VideoEncoder) throw new Error("noenc");
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d", { alpha: false });
    const BR = 8e6, can = (c) => M.canEncodeVideo(c, { width: W, height: H, bitrate: BR }).catch(() => false), vc = (await can("avc")) ? "avc" : (await can("vp9")) ? "vp9" : null; if (!vc) throw new Error("noenc");
    const aac = vc === "avc" && await M.canEncodeAudio("aac").catch(() => false), webm = vc !== "avc";
    const out = new M.Output({ format: webm ? new M.WebMOutputFormat() : aac ? new M.Mp4OutputFormat({ fastStart: "in-memory" }) : new M.MovOutputFormat({ fastStart: "in-memory" }), target: new M.BufferTarget() });
    const vs = new M.CanvasSource(cv, { codec: vc, bitrate: BR, keyFrameInterval: 2 }), as = new M.AudioBufferSource(webm ? { codec: "opus", bitrate: 160e3 } : aac ? { codec: "aac", bitrate: 192e3 } : { codec: "pcm-s16" });
    out.addVideoTrack(vs, { frameRate: FPS }); out.addAudioTrack(as); await out.start();
    const A = ST.mix.y, dur = A.length / SR; let aPos = 0;
    const push = async (upto) => { upto = Math.min(A.length, Math.round(upto)); if (upto <= aPos) return; const ab = new AudioBuffer({ length: upto - aPos, numberOfChannels: 2, sampleRate: SR }), part = A.subarray(aPos, upto); ab.copyToChannel(part, 0); ab.copyToChannel(part, 1); aPos = upto; await as.add(ab); };
    const N = Math.max(1, Math.round(dur * FPS));
    for (let i = 0; i < N; i++) { if (i % FPS === 0) await push((i / FPS + 1) * SR); let bmp = null; try { bmp = await ST.sb.frame(Math.min(i / FPS, dur - .001), W); } catch (e) { try { bmp = await ST.sb.frame(Math.min(i / FPS, dur - .001), W); } catch (e2) {} }
      if (bmp) { x.drawImage(bmp, 0, 0); bmp.close?.(); } await vs.add(i / FPS, 1 / FPS); onProg((i + 1) / N); }
    await push(A.length); vs.close(); as.close(); await out.finalize();
    const [type, ext] = webm ? ["video/webm", "webm"] : aac ? ["video/mp4", "mp4"] : ["video/quicktime", "mov"]; return { blob: new Blob([out.target.buffer], { type }), ext }; }

  // мініатюри стилів: одна й та сама демо-сцена в кожному стилі (окрема пісочниця)
  const DEMO = 'k.bg();k.ground(1380);k.cone(540,0,1500,Math.PI/2,.32,k.P.light,.22);const p=k.E.back(k.p(t,.1,.7));k.rect(540,760,560*p+1,340,{fill:k.P.paper,r:28,rot:-.05});k.label("2027",540,760,{size:150,s:p,color:k.P.ink});k.circle(250,560,70,{fill:k.P.b});k.poly([[820,1180],[900,1040],[980,1180]],{fill:k.P.c});k.rect(880,1300,190,160,{fill:k.P.d,r:20});k.hero(470,1400,1.25,{t,pose:"point",look:.6});k.particles(24,3,t,{x:540,y:500,spread:4})';
  const PREV = {};
  async function previews(root) { const cvs = [...root.querySelectorAll("canvas[data-stp]")]; if (!cvs.length) return; if (!ST.psb) ST.psb = sandbox();
    for (const cv of cvs) { const id = cv.dataset.stp, x = cv.getContext("2d"); try { if (!PREV[id]) { await ST.psb.load([{ id: 1, t0: 0, t1: 3, d: 3, words: [], code: DEMO }], styleMsg(styleOf(id))); PREV[id] = await ST.psb.frame(1.4, 216); } x.drawImage(PREV[id], 0, 0, cv.width, cv.height); } catch (e) { console.warn("stage preview", e); } } }

  // UI картки «Відео» в лабораторії; api дає доступ до стану лабораторії
  function card(C, api) { const board = api.board(), sc = scenesFrom(board), v = api.voice(); const saved = ls.get(); if (!ST.anim && saved?.sig === sig(board)) ST.anim = saved; if (ST.anim && ST.anim.sig !== sig(board)) { ST.anim = null; stop(); }
    const A = ST.anim, n = sc.length, ok = A ? sc.filter((s) => A.scenes[s.id]?.code && !A.scenes[s.id]?.err).length : 0;
    C.innerHTML = `<h4><i>5</i>Відео</h4><p class="hint">AI пише анімацію кожної сцени під сенс фрази й таймінги слів — без шаблонів. Стиль — палітра розкадровки й герой-капсула.</p>
      ${!v ? `<p class="st err">Спершу зроби озвучку (крок 3) — анімація прив'язується до неї.</p>` : ""}
      <p class="hint" style="margin:0">Стиль — ${esc(styleOf(ST.style).name)}${A && A.style && A.style !== ST.style ? " · анімацію писали під інший стиль — перемальовано, для найкращого результату «Анімувати заново»" : ""}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px">${STYLES.map((x) => `<button type="button" data-sty="${x.id}" style="padding:0;border-radius:12px;overflow:hidden;border:2px solid ${x.id === ST.style ? "#4cc3b0" : "rgba(255,255,255,.12)"};background:#000;color:#f5f5f7;cursor:pointer;text-align:left"><canvas data-stp="${x.id}" width="216" height="384" style="width:100%;aspect-ratio:9/16;display:block"></canvas><span style="display:block;font:600 11.5px/1.3 system-ui;padding:5px 6px">${esc(x.name)}</span></button>`).join("")}</div>
      <div class="row"><button class="btn main" type="button" id="sgen" ${v && n ? "" : "disabled"}>🎬 ${A ? "Анімувати заново" : `Анімувати ${n} сцен`}</button></div><p class="st" id="sst">${A ? `Готово сцен: ${ok}/${n}${ok < n ? " — зламані замінено запасною, їх можна перегенерувати нижче" : ""}` : `Орієнтовно 2–5 хв: сцени пишуться по 3, паралельно.`}</p>
      ${A && v ? `<canvas id="scv" width="540" height="960" style="width:100%;max-width:360px;aspect-ratio:9/16;border-radius:14px;background:#000;display:block;margin:6px auto"></canvas>
        <div class="row"><button class="btn" type="button" id="splay">▶︎ Дивитися</button><button class="btn main" type="button" id="sexp">⬇️ Зібрати MP4</button></div><p class="st" id="sxst"></p><div id="sout"></div>
        <details><summary class="hint">Сцени (${n})${ok < n ? ` · ⚠️ ${n - ok}` : ""}</summary>${sc.map((s) => { const a = A.scenes[s.id]; return `<div class="sc"><b><span class="tag">${s.t0.toFixed(1)}</span>«${esc(s.vo)}»</b>
          <span class="m">${a?.code ? (a.err ? `⚠️ ${esc(a.err)}` : `✓ ${a.code.length} симв. · звуки: ${(a.sfx || []).map((e) => esc(e.kind)).join(", ") || "—"}`) : "⚠️ немає коду"}</span>
          <button class="chip" type="button" data-sre="${s.id}">⟳ Перегенерувати сцену</button></div>`; }).join("")}</details>` : ""}
      <button class="chip" type="button" id="lcopy" style="margin-top:8px">📋 Розкадровка для vizavi-motion</button>`;
    const st = C.querySelector("#sst"), redraw = () => card(C, api); api.redraw = redraw;
    C.querySelector("#lcopy").onclick = api.copy;
    previews(C);
    C.querySelectorAll("[data-sty]").forEach((b) => b.onclick = async () => { ST.style = b.dataset.sty; try { localStorage.setItem("yvLabStyle", ST.style); } catch (e) {} api.track("style", { v: ST.style }); stop(); ST.loadedSig = ""; redraw(); });
    const gen = async (only) => { stop(); const b = C.querySelector("#sgen"); b.disabled = true; st.className = "st"; st.textContent = only ? "Перегенеровую сцену…" : `Пишу анімацію: 0/${n} сцен…`; const t0 = Date.now();
      try { await generate(api, (d, all, e) => { st.textContent = `Пишу анімацію: ${d}/${all} сцен…${e ? " (частина не вдалась)" : ""}`; }, only); st.textContent = "Перевіряю код у пісочниці…"; await loadSandbox(api); buildAudio(api);
        api.track("anim_ok", { n, s: Math.round((Date.now() - t0) / 1000), only: !!only }); redraw(); }
      catch (e) { console.warn("stage gen", e); st.className = "st err"; st.textContent = api.errText(e); b.disabled = false; api.track("anim_fail", { v: String(e?.message || e).slice(0, 40) }); } };
    C.querySelector("#sgen").onclick = () => gen(null);
    C.querySelectorAll("[data-sre]").forEach((b) => b.onclick = () => gen([+b.dataset.sre]));
    const cv = C.querySelector("#scv"); if (!cv) return;
    (async () => { try { if (!ST.sb || !ST.loadedSig || ST.loadedSig !== A.sig + ok + ST.style) { await loadSandbox(api); ST.loadedSig = A.sig + ok + ST.style; } if (!ST.mix) buildAudio(api); const bmp = await ST.sb.frame(Math.min(1, v.dur / 2), cv.width); cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height); } catch (e) { console.warn("stage first", e); } })();
    const pb = C.querySelector("#splay"); pb.onclick = () => play(cv, api, pb);
    C.querySelector("#sexp").onclick = async (e) => { const b = e.currentTarget, xs = C.querySelector("#sxst"); stop(); pb.textContent = "▶︎ Дивитися"; b.disabled = true; xs.className = "st"; const t0 = Date.now();
      try { if (!ST.mix) buildAudio(api); const r = await exportMp4(api, (p) => { xs.textContent = `Збираю відео… ${Math.round(p * 100)}%`; }); if (ST.vid) URL.revokeObjectURL(ST.vid); ST.vid = URL.createObjectURL(r.blob);
        xs.textContent = `✓ Готово за ${Math.round((Date.now() - t0) / 1000)} с · ${(r.blob.size / 1048576).toFixed(1)} МБ`;
        C.querySelector("#sout").innerHTML = `<video src="${ST.vid}" controls playsinline style="width:100%;max-width:360px;display:block;margin:6px auto;border-radius:14px"></video><a class="btn main" href="${ST.vid}" download="yuvi-video.${r.ext}" style="text-align:center;text-decoration:none;display:block">💾 Зберегти відео</a>`;
        api.track("export_ok", { s: Math.round((Date.now() - t0) / 1000), mb: +(r.blob.size / 1048576).toFixed(1) }); }
      catch (err) { console.warn("stage export", err); xs.className = "st err"; xs.textContent = err?.message === "noenc" ? "Цей браузер не вміє збирати відео. Онови Safari/Chrome або спробуй на комп'ютері." : "Не вдалося зібрати відео: " + String(err?.message || err).slice(0, 80); api.track("export_fail", { v: String(err?.message || err).slice(0, 40) }); }
      b.disabled = false; }; }

  window.YVStage = { card, stop, _t: { scenesFrom, wordTimes, synth, mixdown, KIT, SANDBOX, P_ANIM, STYLES, DEMO } };
})();
