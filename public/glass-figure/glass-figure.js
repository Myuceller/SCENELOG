/*!
 * glass-figure.js — a translucent glass figure that looks toward the pointer, wears glasses it pushes up
 * when you tap them, and fans out a row of cards when you tap its head. No dependencies.
 *
 *   <div id="figure" style="width:100%;height:100vh"></div>
 *   <script src="glass-figure.js"></script>
 *   <script>
 *     var figure = mountGlassFigure(document.getElementById('figure'), {
 *       accent: '#ff8a1f',                              // glasses + card accent colour
 *       cards: [{ label: 'Watched · 2024.03.14', title: 'Paper Lanterns', lines: ['★★★★☆', 'Drama · 112 min', 'Rainy Sunday rewatch'] }],
 *       onCardClick: function (index) {},               // a card was tapped
 *       onToggle: function (isOpen) {},                 // cards opened / closed
 *       offsetX: 0, zoom: 0, hint: true, blur: 15, startOpen: false
 *     });
 *     // figure.open(), figure.close(), figure.isOpen(), figure.setCards([...]),
 *     // figure.pushGlasses('side' | 'middle'), figure.nod(), figure.pulse(), figure.destroy()
 *   </script>
 *
 * The container needs a size (width and height). Interactions: move/drag = the head follows; tap the glasses = hand pushes
 * them up (3 taps in a row = middle finger on the bridge); tap the head = cards rise; drag sideways = turn the row;
 * swipe down or Esc = cards fly away.
 */
(function (root) {
  'use strict';
  var SAMPLE_CARDS = [
    { label: 'Watched · 2024.03.14', title: 'Paper Lanterns', lines: ['★★★★☆', 'Drama · 112 min', 'Rainy Sunday rewatch'] },
    { label: 'Watched · 2024.05.02', title: 'Night Ferry', lines: ['★★★★★', 'Thriller · 98 min', 'Saw it twice in a week'] },
    { label: 'Watched · 2024.06.21', title: 'The Quiet Orchard', lines: ['★★★☆☆', 'Family · 104 min', 'Slow, but the ending lands'] },
    { label: 'Watched · 2024.08.09', title: 'Salt & Neon', lines: ['★★★★☆', 'Romance · 121 min', 'Best soundtrack this year'] },
    { label: 'Watched · 2024.09.30', title: 'Low Tide', lines: ['★★★★★', 'Mystery · 109 min', 'Did not see the twist coming'] },
    { label: 'Watched · 2024.11.17', title: 'Glass Summer', lines: ['★★★☆☆', 'Coming of age · 95 min', 'Pretty, a little thin'] },
    { label: 'Watched · 2025.01.05', title: 'Seventeen Stairs', lines: ['★★★★☆', 'Horror · 91 min', 'Watched with the lights on'] },
    { label: 'Watched · 2025.02.22', title: 'After the Parade', lines: ['★★★★★', 'Comedy · 102 min', 'Laughed the whole way home'] },
    { label: 'Watched · 2025.04.11', title: 'North of Morning', lines: ['★★★★☆', 'Road movie · 117 min', 'Made me want to drive north'] },
    { label: 'Watched · 2025.06.03', title: 'Small Hours', lines: ['★★★☆☆', 'Documentary · 84 min', 'Quiet and honest'] }
  ];
  var CSS = [
    '.gf-root{position:relative;overflow:hidden;touch-action:pan-y;background:#ebe8fb;--gf-ink:#0d0f2e;--gf-muted:#595d85;--gf-accent:#ff8a1f;-webkit-user-select:none;user-select:none}',
    '.gf-root [hidden]{display:none!important}',
    '.gf-root>canvas{display:block;width:100%;height:100%}',
    '.gf-root.gf-open{cursor:grab;touch-action:none}',
    '.gf-root.gf-open:active{cursor:grabbing}',
    '.gf-ring{position:absolute;left:0;top:0;width:0;height:0;perspective:1500px;transform-style:preserve-3d;pointer-events:none;z-index:1}',
    '.gf-card{position:absolute;left:0;top:0;box-sizing:border-box;width:var(--cw,220px);height:var(--ch,310px);display:flex;flex-direction:column;padding:calc(var(--cw,220px)*.085) calc(var(--cw,220px)*.09);border-radius:20px;background:linear-gradient(160deg,rgba(255,255,255,.82),rgba(255,255,255,.5));color:var(--gf-ink);box-shadow:inset 0 0 0 1px rgba(255,255,255,.95),0 34px 60px -34px rgba(40,44,130,.45);will-change:transform,opacity;opacity:0;pointer-events:auto}',
    '.gf-card small{font-size:calc(var(--cw,220px)*.046);font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--gf-muted);font-variant-numeric:tabular-nums}',
    '.gf-card b{margin-top:7%;font-size:calc(var(--cw,220px)*.135);font-weight:400;letter-spacing:-.035em;line-height:1.06;text-wrap:balance}',
    '.gf-card ul{margin:auto 0 0;padding:0;list-style:none;display:grid;gap:.4em;font-size:calc(var(--cw,220px)*.054);color:var(--gf-muted)}',
    '.gf-card li{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.gf-card li::before{content:"";display:inline-block;width:.34em;height:.34em;margin-right:.65em;border-radius:50%;background:var(--gf-accent);vertical-align:middle}',
    '.gf-card li:first-child{color:var(--gf-accent);letter-spacing:.08em}',
    '.gf-hint{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:2;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;padding:9px 16px;border-radius:999px;font-size:13px;font-weight:500;color:var(--gf-ink);background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 1px rgba(255,255,255,.8);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);pointer-events:none;transition:opacity .6s ease}',
    '.gf-hint.is-used{opacity:0}',
    '.gf-hint i{width:6px;height:6px;border-radius:50%;background:#ff4f86;box-shadow:0 0 10px #ff4f86}'
  ].join('\n');

  function mountGlassFigure(stage, opts) {
    opts = opts || {};
    if (!document.getElementById('gf-style')) { var st = document.createElement('style'); st.id = 'gf-style'; st.textContent = CSS; document.head.appendChild(st); }
    stage.classList.add('gf-root');
    var accentHex = String(opts.accent || '#ff8a1f').replace('#', '');
    if (accentHex.length !== 6) accentHex = 'ff8a1f';
    stage.style.setProperty('--gf-accent', '#' + accentHex);
    var blurMax = opts.blur == null ? 15 : opts.blur;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'A translucent glass figure wearing glasses');
    var ring = document.createElement('div'); ring.className = 'gf-ring'; ring.hidden = true;
    var hint = document.createElement('div'); hint.className = 'gf-hint'; hint.innerHTML = '<i></i><span></span>';
    var hintText = hint.lastChild;
    if (opts.hint === false) hint.hidden = true;
    stage.appendChild(canvas); stage.appendChild(ring); stage.appendChild(hint);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var listeners = [], observers = [], dead = false;
    function on(t, type, fn, o) { t.addEventListener(type, fn, o); listeners.push([t, type, fn, o]); }
    var fig = { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, pulse: 0, last: -1e9, used: false, slide: 0.9, g: -1, s0: 0, s1: 0, mode: 'side', queue: null, taps: 0, lastTap: -1e9 };
    function nod() { fig.vp -= 5.5; fig.pulse = 1; }

    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) { hint.hidden = true; canvas.style.background = 'linear-gradient(180deg,#ebe8fb,#cfd5f8)'; return null; }

    var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;uniform float uTime;uniform vec2 uLook;uniform float uShift;uniform float uPulse;uniform float uBreath;uniform float uZoom;',
    'uniform float uHand;uniform float uSlide;uniform vec3 uE;uniform vec3 uW;uniform vec3 uHc;uniform vec3 uH[20];uniform vec3 uAccent;',
    'const float FL=2.2;',
    'const vec3 RO=vec3(0.,-.42,3.4);',
    'const vec3 PIV=vec3(0.,-.55,-.02);',
    'const vec3 PIV2=vec3(0.,-1.7,0.);',
    'vec2 cH,sH,cT,sT;', // cos/sin of (yaw,pitch) for head and torso
    'float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}',
    'float smax(float a,float b,float k){return -smin(-a,-b,k);}',
    'float ell(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/k1;}',
    'float cap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}',
    'float cap2(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(r1,r2,h);}',
    'vec3 spin(vec3 p,vec3 piv,vec2 c,vec2 s){p-=piv;',
    '  p.xz=vec2(c.x*p.x-s.x*p.z,s.x*p.x+c.x*p.z);',
    '  p.yz=vec2(c.y*p.y-s.y*p.z,s.y*p.y+c.y*p.z);',
    '  return p+piv;}',
    'vec3 toHead(vec3 p){return spin(p,PIV,cH,sH);}',
    'float sdHead(vec3 p){',
    '  vec3 q=vec3(abs(p.x),p.y,p.z);',
    '  float d=ell(p-vec3(0.,.12,-.03),vec3(.40,.46,.47));',
    '  d=smin(d,ell(p-vec3(0.,-.17,.08),vec3(.285,.35,.33)),.16);',
    '  d=smin(d,ell(p-vec3(0.,-.405,.245),vec3(.09,.07,.08)),.11);',
    '  d=smin(d,ell(q-vec3(.13,.09,.375),vec3(.12,.028,.05)),.09);',
    '  d=smin(d,cap(p,vec3(0.,.07,.405),vec3(0.,-.12,.482),.024),.045);',
    '  d=smin(d,length(p-vec3(0.,-.143,.482))-.029,.06);',
    '  d=smin(d,length(q-vec3(.03,-.166,.448))-.017,.045);',
    '  d=smax(d,-(length(q-vec3(.165,-.005,.48))-.08),.09);',
    '  d=smin(d,ell(p-vec3(0.,-.262,.377),vec3(.1,.021,.042)),.03);',
    '  d=smin(d,ell(p-vec3(0.,-.303,.372),vec3(.086,.026,.042)),.03);',
    '  d=smax(d,-ell(p-vec3(0.,-.283,.425),vec3(.104,.005,.03)),.012);',
    '  d=smax(d,-ell(p-vec3(0.,-.215,.462),vec3(.012,.026,.018)),.02);',
    '  vec3 e=q-vec3(.398,-.045,-.04);e.xy=vec2(e.x*.985-e.y*.17,e.x*.17+e.y*.985);',
    '  float er=ell(e-vec3(0.,.015,0.),vec3(.026,.1,.058));',
    '  er=smin(er,ell(e-vec3(-.004,-.095,.012),vec3(.02,.034,.026)),.03);',
    '  er=smax(er,-ell(e-vec3(.03,.02,.008),vec3(.024,.062,.03)),.018);',
    '  d=smin(d,er,.022);',
    '  return d;}',
    'float fing(vec3 p,vec3 a,vec3 b,vec3 c,vec3 e,float r){',
    '  float m=cap2(p,a,b,r*1.55,r*1.4);',
    '  float f=smin(cap2(p,b,c,r*1.06,r*.96),cap2(p,c,e,r*.96,r*.8),.006);',
    '  return smin(m,f,.02);}',
    'float sdHand(vec3 p){',
    '  float d=fing(p,uH[0],uH[1],uH[2],uH[3],.033);',
    '  d=smin(d,fing(p,uH[4],uH[5],uH[6],uH[7],.029),.04);',
    '  d=smin(d,fing(p,uH[8],uH[9],uH[10],uH[11],.031),.04);',
    '  d=smin(d,fing(p,uH[12],uH[13],uH[14],uH[15],.029),.04);',
    '  d=smin(d,fing(p,uH[16],uH[17],uH[18],uH[19],.025),.04);',
    '  return d;}',
    'float sdBody(vec3 p){',
    '  float d=sdHead(toHead(p));',
    '  vec3 t=spin(p,PIV2,cT,sT);',
    '  vec3 q=vec3(abs(t.x),t.y,t.z);',
    '  d=smin(d,cap(t,vec3(0.,-.40,-.04),vec3(0.,-.9,-.08),.15),.1);',
    '  float s=ell(t-vec3(0.,-1.28+uBreath,-.06),vec3(.86,.34,.32));',
    '  s=smin(s,length(q-vec3(.77,-1.27+uBreath,-.06))-.25,.2);',
    '  s=smin(s,cap(t,vec3(-.83,-1.36,-.06),vec3(-.9,-2.6,-.04),.2),.12);',
    '  float a=cap2(t,vec3(.79,-1.3,-.06),uE,.2,.155);',
    '  float fa=cap2(t,uE,uW,.155,.076);',
    '  a=smin(a,fa,.05);',
    '  s=smin(s,a,.12);',
    '  float hb=length(t-uHc)-.52;',
    '  if(hb<.08)hb=smin(sdHand(t),fa,.03);',
    '  s=smin(s,ell(t-vec3(0.,-1.84,-.0),vec3(.76,.78,.38+uBreath)),.25);',
    '  s=smin(s,cap(q,vec3(.11,-.74,-.11),vec3(.5,-1.0+uBreath,-.11),.07),.17);',
    '  s=smin(s,cap(q,vec3(.08,-1.035+uBreath,.165),vec3(.58,-.975+uBreath,.065),.026),.07);',
    '  return min(smin(d,s,.22),hb);}',
    'float folds(vec3 p){',
    '  float f=sin(p.x*44.+sin(p.y*29.)*1.8)*sin(p.y*38.+sin(p.z*33.)*1.8)*sin(p.z*36.+sin(p.x*31.)*1.8);',
    '  return smoothstep(0.,.4,abs(f));}',
    'float sdBrain(vec3 p){',
    '  vec3 q=vec3(abs(p.x),p.y,p.z);',
    '  float d=ell(p-vec3(0.,.24,-.03),vec3(.25,.16,.28));',
    '  d=smin(d,ell(q-vec3(.07,.1,-.2),vec3(.095,.06,.1)),.06);',
    '  return d;}',
    'float brainAt(vec3 h){float bb=length(h-vec3(0.,.02,-.06))-.56;if(bb>.08)return bb;return sdBrain(h);}',
    'float sdGl(vec3 p){',
    '  p.y+=.05*uSlide;p.z-=.022*uSlide;',
    '  vec3 q=vec3(abs(p.x),p.y,p.z);',
    '  float zc=.472-q.x*q.x*1.1;',
    '  vec2 w=abs(q.xy-vec2(.155,-.01))-vec2(.07,.03);',
    '  float r2=length(max(w,0.))+min(max(w.x,w.y),0.)-.022;',
    '  float band=abs(r2-.011)-.011;',
    '  vec2 bw=abs(q.xy-vec2(0.,.024))-vec2(.045,.018);',
    '  band=min(band,length(max(bw,0.))+min(max(bw.x,bw.y),0.));',
    '  float d=length(max(vec2(band,abs(p.z-zc)-.01),0.))-.007;',
    '  d=smin(d,cap(q,vec3(.265,.03,.395),vec3(.41,.05,-.04),.014),.015);',
    '  return d;}',
    'float glAt(vec3 p){vec3 h=toHead(p);float b=length(h-vec3(0.,0.,.2))-.62;if(b>.1)return b;return sdGl(h)*.8;}',
    'vec3 nGl(vec3 p){vec2 e=vec2(.002,-.002);',
    '  return normalize(e.xyy*glAt(p+e.xyy)+e.yyx*glAt(p+e.yyx)+e.yxy*glAt(p+e.yxy)+e.xxx*glAt(p+e.xxx));}',
    'vec3 nBody(vec3 p){vec2 e=vec2(.0025,-.0025);',
    '  return normalize(e.xyy*sdBody(p+e.xyy)+e.yyx*sdBody(p+e.yyx)+e.yxy*sdBody(p+e.yxy)+e.xxx*sdBody(p+e.xxx));}',
    'vec3 nBrain(vec3 p){vec2 e=vec2(.003,-.003);',
    '  return normalize(e.xyy*sdBrain(p+e.xyy)+e.yyx*sdBrain(p+e.yyx)+e.yxy*sdBrain(p+e.yxy)+e.xxx*sdBrain(p+e.xxx));}',
    'float l2(vec2 v){return dot(v,v);}',
    'vec3 bg(vec2 uv){', // uv in absolute screen units (y in -1..1)
    '  float asp=uRes.x/uRes.y;',
    '  vec3 c=mix(vec3(.800,.830,.975),vec3(.925,.912,.988),smoothstep(-1.,.9,uv.y));',
    '  c=mix(c,vec3(1.,.82,.93),.8*exp(-l2(uv-vec2(asp*.78+.08*sin(uTime*.23),.55+.06*cos(uTime*.19)))*1.1));',
    '  c=mix(c,vec3(.70,.84,1.),.75*exp(-l2(uv-vec2(uShift-.75+.07*cos(uTime*.17),-.55))*1.3));',
    '  c=mix(c,vec3(1.),.55*exp(-l2(uv-vec2(uShift,.25))*.9));',
    '  return c;}',
    'vec3 env(vec3 d){',
    '  vec3 c=mix(vec3(.60,.65,.93),vec3(.97,.95,1.),smoothstep(-.7,.8,d.y));',
    '  c=mix(c,vec3(1.,.80,.93),smoothstep(.1,1.,d.x)*.55);',
    '  c+=vec3(1.7)*smoothstep(.90,.965,dot(d,normalize(vec3(-.55,.6,.58))));',
    '  c+=vec3(1.2,1.05,1.3)*smoothstep(.07,.0,abs(d.x-.72))*smoothstep(-.35,.05,d.y)*smoothstep(.85,.45,d.y)*step(-.5,d.z);',
    '  c+=vec3(.8)*smoothstep(.86,.99,d.y);',
    '  c+=vec3(1.3)*smoothstep(.05,.0,abs(d.x+.2)-.12)*smoothstep(.04,.0,abs(d.y-.25)-.16)*step(.2,d.z);',
    '  return c;}',
    'vec3 shadeG(vec3 n,vec3 rd){',
    '  vec3 L=normalize(vec3(-.45,.6,.66));',
    '  float dif=clamp(dot(n,L),0.,1.);',
    '  vec3 c=uAccent*(.62+.5*dif);',
    '  float f=.04+.96*pow(1.-max(dot(n,-rd),0.),5.);',
    '  c=mix(c,env(reflect(rd,n)),f*.55+.05);',
    '  c+=vec3(1.)*pow(max(dot(reflect(rd,n),L),0.),50.)*.55;',
    '  return c;}',
    'void main(){',
    '  cH=cos(uLook);sH=sin(uLook);cT=cos(uLook*.22);sT=sin(uLook*.22);',
    '  vec2 uvA=(gl_FragCoord.xy*2.-uRes)/uRes.y;',
    '  vec2 uv=uvA-vec2(uShift,0.);',
    '  vec3 rd=normalize(vec3(uv,-FL*uZoom));',
    '  vec3 col=bg(uvA);',
    '  float t=2.1,minD=1e3,d=1.;',
    '  float mat=0.;',
    '  for(int i=0;i<76;i++){vec3 pp=RO+rd*t;d=sdBody(pp);float g=glAt(pp);mat=0.;if(g<d){d=g;mat=1.;}minD=min(minD,d);if(d<.0016||t>6.5)break;t+=d;}',
    '  if(d<.0016&&mat>.5){col=shadeG(nGl(RO+rd*t),rd);}else if(d<.0016){',
    '    vec3 p=RO+rd*t;vec3 n=nBody(p);',
    '    float ndv=max(dot(n,-rd),0.);',
    '    float F=.045+.955*pow(1.-ndv,3.4);',
    '    vec3 refl=env(reflect(rd,n));',
    '    vec3 rr=refract(rd,n,1./1.16);',
    '    vec3 pi=p-n*.02;float ti=0.,glow=0.;bool hitB=false;',
    '    for(int i=0;i<46;i++){',
    '      vec3 x=pi+rr*ti;float db=brainAt(toHead(x));float dout=-sdBody(x);',
    '      float st=max(min(db*.7,max(dout,.02)),.008);',
    '      glow+=exp(-max(db,0.)*8.)*st;',
    '      if(db<.003){hitB=true;break;}',
    '      if(dout<.004)break;',
    '      ti+=st;if(ti>3.)break;}',
    '    vec3 tint=exp(-min(ti,1.1)*vec3(.58,.27,.05));',
    '    vec3 x=pi+rr*ti;vec3 inner;',
    '    if(hitB){',
    '      vec3 h=toHead(x);vec3 nb=nBrain(h);',
    '      float dif=clamp(dot(nb,normalize(vec3(-.45,.55,.7))),0.,1.);',
    '      float cav=1.;',
    '      vec3 bc=mix(vec3(.90,.52,.66),vec3(1.,.76,.84),dif*.75+.25);',
    '      bc*=mix(.90,1.,cav);',
    '      bc*=1.+uPulse*.3;',
    '      vec3 rh=toHead(x+rr)-h;',
    '      float al=smoothstep(.0,.6,dot(nb,-rh))*.58;',
    '      inner=mix(bg(uvA)*vec3(.72,.84,.97),bc,al);',
    '    }else{',
    '      vec3 n2=-nBody(x);',
    '      vec3 d2=refract(rr,n2,1.16);',
    '      if(dot(d2,d2)<.01)d2=reflect(rr,n2);',
    '      vec3 P=x+d2*1.6;',
    '      vec2 uvP=(P.xy-RO.xy)/max(RO.z-P.z,.6)*FL*uZoom+vec2(uShift,0.);',
    '      inner=bg(uvP);',
    '      float F2=.04+.96*pow(1.-max(dot(n2,-rr),0.),3.);',
    '      inner=mix(inner,env(reflect(rr,n2))*.9,F2*.6);',
    '      if(uHand>.01){',
    '        float t2=.05,d3=1.,m3=0.;vec3 x2=x;',
    '        for(int j=0;j<28;j++){x2=x+d2*t2;d3=sdBody(x2);float g=glAt(x2);m3=0.;if(g<d3){d3=g;m3=1.;}if(d3<.003||t2>2.5)break;t2+=d3;}',
    '        if(d3<.003){',
    '          if(m3>.5){inner=shadeG(nGl(x2),d2);}',
    '          else{vec3 n3=nBody(x2);float f3=.05+.95*pow(1.-max(dot(n3,-d2),0.),3.4);inner=mix(bg(uvA)*vec3(.76,.86,.97),env(reflect(d2,n3)),f3);}',
    '        }',
    '      }',
    '      inner*=tint;',
    '    }',
    '    inner+=vec3(1.,.52,.68)*glow*(.30+uPulse*.9);',
    '    inner=mix(inner,vec3(.86,.89,1.),(1.-exp(-ti*.8))*.42);',
    '    float frm=clamp(dot(n,normalize(vec3(-.5,.55,.67))),0.,1.);',
    '    inner*=.86+.17*frm;',
    '    inner+=vec3(.9,.95,1.)*pow(frm,10.)*.10;',
    '    col=mix(inner,refl,F);',
    '    vec3 ir=.5+.5*cos(6.2832*(vec3(0.,.33,.67)+ndv*1.5+n.y*.5+n.x*.3+uTime*.03));',
    '    col+=ir*F*(1.-F)*.55;',
    '    col+=vec3(1.)*pow(max(dot(reflect(rd,n),normalize(vec3(-.5,.62,.6))),0.),160.)*.9;',
    '  }else{',
    '    col=mix(col,vec3(.80,.84,1.),smoothstep(.014,0.,minD)*.55);',
    '  }',
    '  col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;',
    '  gl_FragColor=vec4(col,1.);',
    '}'
    ].join('\n');

    function compile(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    var prog = gl.createProgram();
    if (vs && fs) { gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); }
    if (!vs || !fs || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      hint.hidden = true; canvas.style.background = 'linear-gradient(180deg,#ebe8fb,#cfd5f8)'; return null;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uRes', 'uTime', 'uLook', 'uShift', 'uPulse', 'uBreath', 'uZoom', 'uHand', 'uSlide', 'uE', 'uW', 'uHc', 'uH[0]', 'uAccent'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    /* ---------- sizing with adaptive resolution ---------- */
    var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    var scale = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5);
    var rect = { left: 0, top: 0, width: 1, height: 1 }, shift = 0, shift0 = 0, zoom = 1;
    function resize() {
      rect = stage.getBoundingClientRect();
      var w = Math.max(rect.width, 1), h = Math.max(rect.height, 1);
      var cap = coarse ? 520000 : 1500000, s = scale;
      if (w * h * s * s > cap) s = Math.sqrt(cap / (w * h));
      canvas.width = Math.max(2, Math.round(w * s)); canvas.height = Math.max(2, Math.round(h * s));
      gl.viewport(0, 0, canvas.width, canvas.height);
      zoom = opts.zoom || (w / h > 1.05 ? 1 : 1.22);
      shift0 = (opts.offsetX || 0) * (w / h); shift = shift0;         // offsetX: -1..1, where the figure sits sideways (0 = centre)
      setHint();
    }
    function setHint() {
      var open = deck && deck.open;
      hintText.textContent = open
        ? 'Drag sideways \u00b7 swipe down to close'
        : (coarse ? 'Tap the head or the glasses' : 'Click the head or the glasses');
    }
    resize();
    on(window, 'resize', resize);
    if (window.ResizeObserver) { var ro = new ResizeObserver(resize); ro.observe(stage); observers.push(ro); }

    /* ---------- pointer / touch: the head looks toward it ---------- */
    /* ---------- glasses: where they are on screen, and the push-up gesture ---------- */
    var GEST = 2.1;                                   // seconds for the whole hand gesture
    function glassesAt() {                            // screen position + size of the glasses
      var s = fig.slide, lx = 0, ly = -0.05 * s + 0.55, lz = 0.47 + 0.022 * s + 0.02;
      var cp = Math.cos(fig.pitch), sp = Math.sin(fig.pitch), cy = Math.cos(fig.yaw), sy = Math.sin(fig.yaw);
      var y1 = ly * cp + lz * sp, z1 = -ly * sp + lz * cp;
      var x2 = lx * cy + z1 * sy, z2 = -lx * sy + z1 * cy;
      var px = x2, py = y1 - 0.55, pz = z2 - 0.02;
      var r = stage.getBoundingClientRect(), k = 2.2 * zoom / (3.4 - pz), half = r.height / 2;
      return { x: r.left + r.width / 2 + (px * k + shift) * half, y: r.top + half - (py + 0.42) * k * half, u: k * half };
    }
    function onGlasses(cx, cy) {
      var g = glassesAt();
      return Math.abs(cx - g.x) < 0.31 * g.u && Math.abs(cy - g.y) < 0.13 * g.u;
    }
    var TAPWIN = 4500;                                // taps closer together than this count as "in a row"
    function pushGlasses(now) {
      fig.taps = (now - fig.lastTap < TAPWIN) ? fig.taps + 1 : 1; fig.lastTap = now;
      var mode = fig.taps >= 3 ? 'mid' : 'side';      // 3+ taps in a row: middle finger on the bridge
      if (fig.g < 0) startGesture(mode); else if (mode === 'mid') fig.queue = mode;
    }
    function startGesture(mode) { fig.g = 0; fig.mode = mode; fig.s0 = fig.slide; fig.s1 = Math.max(fig.slide, 0.6); fig.queue = null; }
    function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function add(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function nrm(a) { var n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function bend(base, tip, L, out) {                // middle joint of a two-bone finger reaching for `tip`
      var m = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2];
      var d = Math.hypot(tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]);
      var h = d < L ? Math.sqrt(L * L / 4 - d * d / 4) : 0;
      return add(m, nrm(out), h);
    }
    var SH = [0.79, -1.3, -0.06], L1 = 0.84, L2 = 0.8;
    var HS = 1.4;                                     // hand size
    var FK = [0, 0.165, 0.175, 0.165, 0.15].map(function (v) { return v * HS; }), FO = [0, 0.045, 0.015, -0.015, -0.043].map(function (v) { return v * HS; }), FLEN = [0, 0.15, 0.165, 0.15, 0.12].map(function (v) { return v * HS; });
    // Hand = wrist W, finger direction f, palm normal n. 20 joints: for thumb + 4 fingers: palm start, knuckle, middle joint, tip.
    function buildHand(W, f, n, spec) {
      f = nrm(f); n = nrm(add(n, f, -dot(n, f))); var sd = cross(n, f), out = [], i;
      var tb = add(add(add(W, sd, 0.075 * HS), f, 0.07 * HS), n, 0.02 * HS), tmid, ttip;
      if (spec.to[0]) { ttip = spec.to[0]; tmid = bend(tb, ttip, 0.135 * HS, add(sd, n, -0.6)); }
      else if (spec.thumb === 'fold') {
        tmid = add(tb, nrm(add(add([0, 0, 0], f, 0.55), n, 0.85)), 0.075 * HS);
        ttip = add(tmid, nrm(add(add(add([0, 0, 0], sd, -0.85), f, 0.25), n, 0.3)), 0.06 * HS);
      } else {
        tmid = add(tb, nrm(add(add(add([0, 0, 0], f, 0.55), sd, 0.65), n, 0.3)), 0.075 * HS);
        ttip = add(tmid, nrm(add(add(add([0, 0, 0], f, 0.7), sd, 0.35), n, 0.45)), 0.06 * HS);
      }
      out.push(add(add(W, sd, 0.03 * HS), f, 0.02 * HS), tb, tmid, ttip);
      for (i = 1; i <= 4; i++) {
        var ms = add(add(W, sd, FO[i] * 0.55), f, 0.02 * HS), base = add(add(W, f, FK[i]), sd, FO[i]), mid, tip;
        if (spec.to[i]) { tip = spec.to[i]; mid = bend(base, tip, FLEN[i], add([0, 0, 0], n, -1)); }
        else {
          var c = spec.curl[i], a1 = c * 1.45, a2 = a1 + c * 1.7;
          mid = add(base, add(add([0, 0, 0], f, Math.cos(a1)), n, Math.sin(a1)), FLEN[i] * 0.55);
          tip = add(mid, add(add([0, 0, 0], f, Math.cos(a2)), n, Math.sin(a2)), FLEN[i] * 0.45);
        }
        out.push(ms, base, mid, tip);
      }
      return { W: W, pts: out, c: add(W, f, 0.17 * HS) };
    }
    function handFor(mode, slide) {
      var gy = -0.05 * slide, gz = 0.022 * slide;
      if (mode === 'side') {                          // thumb and index pinch the outer corner of the frame
        return buildHand([0.275 + 0.15 * HS, -0.01 + gy - 0.215 * HS, 0.42 + gz + 0.08 * HS], [-0.3, 0.93, -0.08], [0, 0, 1],
          { to: [[0.275, -0.072 + gy, 0.425 + gz], [0.275, 0.055 + gy, 0.42 + gz]], curl: [0, 0, 0.25, 0.38, 0.5] });
      }
      if (mode === 'mid') {                           // middle finger alone on the bridge, the rest in a fist
        var T = [0, 0.035 + gy, 0.5 + gz], fd = nrm([-0.25, 0.9, -0.36]);
        return buildHand(add(T, fd, -0.335 * HS), fd, [0, -0.38, -0.92],
          { to: [null, null, T], curl: [0, 1, 0, 1, 1], thumb: 'fold' });
      }
      return buildHand([SH[0] + 0.1, SH[1] - 1.62, SH[2] + 0.04], [0.03, -1, 0.06], [-1, 0, 0.15],
        { to: [], curl: [0, 0.25, 0.3, 0.35, 0.4] });
    }
    var handBuf = new Float32Array(60);
    function armPose(k, mode, slide) {                // k: 0 = arm down, 1 = hand on the glasses
      var A = handFor('rest', slide), B = handFor(mode, slide), i, j;
      var sw = Math.sin(k * Math.PI) * 0.22;          // swing forward so the arm clears the chest
      for (i = 0; i < 20; i++) for (j = 0; j < 3; j++) handBuf[i * 3 + j] = A.pts[i][j] + (B.pts[i][j] - A.pts[i][j]) * k + (j === 2 ? sw : 0);
      var W = [0, 0, 0], C = [0, 0, 0];
      for (j = 0; j < 3; j++) { W[j] = A.W[j] + (B.W[j] - A.W[j]) * k; C[j] = A.c[j] + (B.c[j] - A.c[j]) * k; }
      W[2] += sw; C[2] += sw;
      var d = [W[0] - SH[0], W[1] - SH[1], W[2] - SH[2]], n = Math.hypot(d[0], d[1], d[2]);
      var len = Math.min(n, L1 + L2 - 0.002); d = [d[0] / n, d[1] / n, d[2] / n];
      var a = (L1 * L1 - L2 * L2 + len * len) / (2 * len), h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
      var pole = [0.85, -0.5, -0.1], dp = dot(pole, d);
      pole = nrm([pole[0] - d[0] * dp, pole[1] - d[1] * dp, pole[2] - d[2] * dp]);
      var E = [SH[0] + d[0] * a + pole[0] * h, SH[1] + d[1] * a + pole[1] * h, SH[2] + d[2] * a + pole[2] * h];
      return { E: E, W: W, C: C };
    }
    var accent = [parseInt(accentHex.slice(0, 2), 16) / 255, parseInt(accentHex.slice(2, 4), 16) / 255, parseInt(accentHex.slice(4, 6), 16) / 255];

    /* ---------- memory cards: tap the head, the figure blurs and cards rise into a slow curved row ---------- */
    var deck = { open: !!opts.startOpen, t: opts.startOpen ? 1 : 0, rot: 0, v: 0, R: 300, els: [], was: null, pull: 0, drift: 0.03, driftNow: 0.03 };   // drift: slow rad/s; its sign follows the last sideways swipe
    function setCards(list) {                         // [{ label, title, lines: [..] }]
      ring.textContent = ''; deck.els = [];
      (list || []).forEach(function (m) {
        var el = document.createElement('div'); el.className = 'gf-card';
        var sm = document.createElement('small'); sm.textContent = m.label || '';
        var bb = document.createElement('b'); bb.textContent = m.title || '';
        var ul = document.createElement('ul');
        (m.lines || []).slice(0, 4).forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
        el.appendChild(sm); el.appendChild(bb); el.appendChild(ul); ring.appendChild(el); deck.els.push(el);
      });
    }
    setCards(opts.cards || SAMPLE_CARDS);
    function onHead(cx, cy) { var g = glassesAt(); return Math.hypot(cx - g.x, cy - (g.y - 0.12 * g.u)) < 0.5 * g.u; }
    function backOut(p) { var q = p - 1; return 1 + 2.2 * q * q * q + 1.2 * q * q; }
    function updateCards(dt) {
      var N = deck.els.length, i, wide = stage.clientWidth > 700;
      deck.t = Math.max(0, Math.min(1, deck.t + (deck.open ? dt / 1.1 : -dt / 0.6)));
      var k = ease(deck.t);
      shift = shift0 * (1 - k);                        // the figure slides to the centre while the cards are out
      if (deck.was !== deck.open) {
        deck.was = deck.open; stage.classList.toggle('gf-open', deck.open);
        setHint();
        if (deck.open) hint.classList.remove('is-used');
        if (opts.onToggle) opts.onToggle(deck.open);
      }
      canvas.style.filter = k > 0.01 ? 'blur(' + (k * blurMax).toFixed(1) + 'px)' : '';
      if (deck.t <= 0) { if (!ring.hidden) ring.hidden = true; return; }
      if (ring.hidden) ring.hidden = false;
      deck.v *= Math.exp(-dt * 3);
      if (!press || press.axis !== 'y') deck.pull *= Math.exp(-dt * 14);   // let go without closing: cards settle back
      var q = deck.open ? 0 : 1 - deck.t;                                   // 0..1 while the cards are flying away
      deck.driftNow += (deck.drift - deck.driftNow) * Math.min(1, dt * 3);   // ease into the new direction instead of snapping
      if (!press) deck.rot += dt * deck.driftNow + deck.v * dt;   // very slow drift (in the direction of the last swipe), plus whatever the last drag left
      var r = stage.getBoundingClientRect();
      var cw = Math.max(130, Math.min(300, r.width * (wide ? 0.2 : (opts.cardWidth || 0.44)))), ch = Math.min(cw * 1.42, r.height * 0.58);
      var R = cw * 3.1, step = Math.min(1.07 * cw / R, 6.2832 / Math.max(N, 1)), span = Math.max(N * step, 3.2); deck.R = R;   // wide radius = gentle curve; many cards squeeze together instead of wrapping onto each other
      ring.style.left = (r.width / 2) + 'px'; ring.style.top = (r.height * 0.62) + 'px';
      ring.style.setProperty('--cw', cw.toFixed(1) + 'px'); ring.style.setProperty('--ch', ch.toFixed(1) + 'px');
      for (i = 0; i < N; i++) {
        var a = i * step + deck.rot; a = a - span * Math.round(a / span);   // 0 = front; cards wrap around out of sight
        var c = Math.cos(a), p = deck.open ? Math.max(0, Math.min(1, deck.t * 1.6 - Math.abs(a) / 1.5 * 0.6)) : 1, e = p <= 0 ? 0 : backOut(p);
        var vis = Math.max(0, Math.min(1, (c - 0.12) / 0.3)), el = deck.els[i];
        var rnd = Math.sin(i * 12.9898) * 43758.5453; rnd = (rnd - Math.floor(rnd)) * 2 - 1;      // fixed -1..1 per card
        var qi = Math.max(0, Math.min(1, q * 1.5 - (rnd + 1) * 0.2)), fly = qi * qi;
        var dy = (1 - e) * ch * 0.95 + deck.pull * 0.85 + fly * r.height * (1.1 + 0.4 * rnd);
        el.style.opacity = (Math.min(1, p * 1.8) * vis * (1 - qi * qi)).toFixed(3);
        el.style.transform = 'translate(-50%,-50%) translate(' + (fly * rnd * 260).toFixed(1) + 'px,' + dy.toFixed(1) + 'px) translateZ(' + (-R).toFixed(1) + 'px) rotateY(' +
          ((a + (1 - ease(p)) * 0.5 * (a < 0 ? -1 : 1)) * 57.2958).toFixed(2) + 'deg) translateZ(' + R.toFixed(1) + 'px) rotateZ(' + (fly * rnd * 38 + deck.pull * rnd * 0.03).toFixed(2) + 'deg)';
      }
    }

    function aim(cx, cy) {
      if (fig.g >= 0) return;
      var r = stage.getBoundingClientRect();
      var hx = r.left + r.width / 2 + shift * r.height / 2;
      var hy = r.top + r.height * (1 - 0.304 * zoom) / 2;
      var nx = (cx - hx) / (Math.max(window.innerWidth, 320) * 0.5);
      var ny = (cy - hy) / (Math.max(window.innerHeight, 320) * 0.5);
      fig.ty = Math.max(-1, Math.min(1, nx)) * 0.85;
      fig.tp = -Math.max(-1, Math.min(1, ny)) * 0.5;
      fig.last = performance.now();
      if (!fig.used) { fig.used = true; hint.classList.add('is-used'); }
    }
    on(window, 'pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      aim(e.clientX, e.clientY);
      stage.style.cursor = onGlasses(e.clientX, e.clientY) ? 'pointer' : '';
    }, { passive: true });
    on(window, 'touchstart', function (e) { var t = e.touches[0]; if (t) aim(t.clientX, t.clientY); }, { passive: true });
    on(window, 'touchmove', function (e) { var t = e.touches[0]; if (t) aim(t.clientX, t.clientY); }, { passive: true });
    var press = null;
    on(window, 'pointerdown', function (e) {
      if (!stage.contains(e.target) || e.target.closest('button, a, input, textarea, select')) return;
      press = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, axis: null, vy: 0, t: performance.now() };
      aim(e.clientX, e.clientY);
    }, { passive: true });
    on(window, 'pointermove', function (e) {
      if (!press || !deck.open) return;
      var dx = e.clientX - press.lx, dy = e.clientY - press.ly, now = performance.now();
      press.vy = press.vy * 0.5 + dy / Math.max(1, now - press.t) * 0.5; press.t = now;
      press.lx = e.clientX; press.ly = e.clientY; press.moved += Math.abs(dx) + Math.abs(dy);
      if (!press.axis && press.moved > 10) press.axis = Math.abs(e.clientY - press.y) > Math.abs(e.clientX - press.x) ? 'y' : 'x';
      if (press.axis === 'x') { deck.rot += dx / deck.R; deck.v = deck.v * 0.6 + dx / deck.R * 24; if (dx) deck.drift = (dx > 0 ? 1 : -1) * Math.abs(deck.drift); }   // sideways: turn the row; keep drifting the way it was swiped
      if (press.axis === 'y') deck.pull = Math.max(0, e.clientY - press.y);                            // downward: cards follow the finger
    }, { passive: true });
    on(window, 'pointerup', function (e) {
      var p = press; press = null;
      if (!p) return;
      if (p.axis === 'y' && deck.open && (deck.pull > 90 || (p.vy > 0.8 && deck.pull > 30))) { deck.open = false; return; }   // pulled down far or fast: fling the cards away
      if (p.moved > 8) return;                                                             // that was a drag, not a tap
      var ce = deck.open && e.target.closest ? e.target.closest('.gf-card') : null;
      if (ce) { if (opts.onCardClick) opts.onCardClick(deck.els.indexOf(ce)); return; }       // tap a card
      if (onGlasses(e.clientX, e.clientY)) { pushGlasses(performance.now()); return; }     // tap the glasses: the hand pushes them up
      if (onHead(e.clientX, e.clientY) && !deck.open) { deck.open = true; deck.pull = 0; } // tap the head: cards rise
      fig.pulse = 1;                                                                       // and the brain lights up
    }, { passive: true });
    on(window, 'pointercancel', function () { press = null; }, { passive: true });
    on(window, 'keydown', function (e) { if (e.key === 'Escape') deck.open = false; });

    /* ---------- loop ---------- */
    var visible = true, running = false, prev = 0, slow = 0, frames = 0;
    if (window.IntersectionObserver) { var io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }); io.observe(stage); observers.push(io); }
    on(document, 'visibilitychange', kick);
    function kick() { if (!running && visible && !document.hidden) { running = true; prev = 0; requestAnimationFrame(frame); } }

    function frame(now) {
      if (dead || !visible || document.hidden) { running = false; return; }
      var dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0.016; prev = now;
      var time = now / 1000;

      // idle: after 3s without input, look around slowly
      if (now - fig.last > 3000 && !reduce) {
        fig.ty = Math.sin(time * 0.45) * 0.42 + Math.sin(time * 0.17) * 0.12;
        fig.tp = Math.sin(time * 0.31) * 0.10 - 0.02;
      }
      // glasses slip down slowly; the gesture pushes them back up
      var hand = 0;
      if (fig.g >= 0) {
        fig.g += dt; var u = fig.g / GEST;
        if (u < 0.38) { hand = ease(u / 0.38); fig.slide = fig.s0 + (fig.s1 - fig.s0) * hand; }
        else if (u < 0.58) { hand = 1; fig.slide = fig.s1 * (1 - ease((u - 0.38) / 0.2)); }
        else if (u < 0.68) { hand = 1; fig.slide = 0; }
        else hand = 1 - ease((u - 0.68) / 0.32);
        if (u < 0.75) { fig.ty = 0; fig.tp = -0.03; fig.last = now; }
        if (u >= 1) { fig.g = -1; hand = 0; if (fig.queue) startGesture(fig.queue); }
      } else if (fig.slide < 1) fig.slide = Math.min(1, fig.slide + dt / 18);
      var pose = armPose(hand, fig.mode, fig.slide);
      gl.uniform1f(U.uHand, hand); gl.uniform1f(U.uSlide, fig.slide);
      gl.uniform3fv(U.uE, pose.E); gl.uniform3fv(U.uW, pose.W); gl.uniform3fv(U.uHc, pose.C); gl.uniform3fv(U['uH[0]'], handBuf);
      gl.uniform3fv(U.uAccent, accent);
      // spring toward target (slight overshoot feels alive)
      var k = 46, damp = 10.5;
      fig.vy += ((fig.ty - fig.yaw) * k - fig.vy * damp) * dt; fig.yaw += fig.vy * dt;
      fig.vp += ((fig.tp - fig.pitch) * k - fig.vp * damp) * dt; fig.pitch += fig.vp * dt;
      fig.pulse *= Math.exp(-dt * 2.2);

      updateCards(dt);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uLook, fig.yaw, fig.pitch);
      gl.uniform1f(U.uShift, shift);
      gl.uniform1f(U.uZoom, zoom);
      gl.uniform1f(U.uPulse, fig.pulse + (reduce ? 0 : 0.12 + 0.12 * Math.sin(time * 1.6)));
      gl.uniform1f(U.uBreath, reduce ? 0 : Math.sin(time * 1.25) * 0.012);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // drop resolution if the device can't keep up
      frames++; if (dt > 0.03) slow++;
      if (frames >= 40) {
        if (slow > 20 && scale > 0.4) { scale *= 0.8; resize(); }
        frames = 0; slow = 0;
      }
      requestAnimationFrame(frame);
    }
    kick();

    return {
      open: function () { deck.open = true; deck.pull = 0; },
      close: function () { deck.open = false; },
      isOpen: function () { return deck.open; },
      setCards: setCards,
      pushGlasses: function (mode) { if (fig.g < 0) startGesture(mode === 'middle' ? 'mid' : 'side'); },
      nod: nod,
      pulse: function () { fig.pulse = 1; },
      destroy: function () {
        dead = true;
        listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        observers.forEach(function (o) { o.disconnect(); });
        stage.textContent = ''; stage.classList.remove('gf-root', 'gf-open'); stage.style.cursor = '';
      }
    };
  }

  root.mountGlassFigure = mountGlassFigure;
  if (typeof module === 'object' && module.exports) module.exports = mountGlassFigure;
})(typeof window !== 'undefined' ? window : this);
