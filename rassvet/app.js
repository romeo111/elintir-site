(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const KYIV = "Europe/Kyiv";
  let FIRST = "", LAST = "";
  let dataManifest = null;
  const THREAT_NAMES = {
    drones:"дрони",unspecified_missiles:"ракети (без уточнення)",ballistic_missiles:"балістичні ракети",
    cruise_missiles:"крилаті ракети",guided_aerial_bombs:"керовані авіабомби",
    tactic_aircraft_activity:"тактична авіація",strategic_aircraft_activity:"стратегічна авіація",
    mig31k_departure:"МіГ-31К",air_defense:"ППО",unknown:"неуточнена загроза"
  };
  const fmtDate = new Intl.DateTimeFormat("uk-UA",{timeZone:KYIV,day:"numeric",month:"long",year:"numeric"});
  const fmtShortDate = new Intl.DateTimeFormat("uk-UA",{timeZone:KYIV,day:"2-digit",month:"2-digit"});
  const fmtClock = new Intl.DateTimeFormat("uk-UA",{timeZone:KYIV,hour:"2-digit",minute:"2-digit",hour12:false});
  const fmtDateTime = new Intl.DateTimeFormat("uk-UA",{timeZone:KYIV,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
  const clockParts = new Intl.DateTimeFormat("en-GB",{timeZone:KYIV,hour:"2-digit",minute:"2-digit",hour12:false});
  const plural = (n,one,few,many) => n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;
  const DEG = Math.PI/180;
  const cache = new Map();
  let alerts=null, boundaries=null, day=null, observer=null, minute=585, threshold=10, selectedSat=null, placeName="Київ", playing=false, timer=null, passes=[], queryVersion=0, dateTimer=null, coordinateTimer=null;

  function dateAt(offset){
    const value=new Date(Date.parse(FIRST+"T00:00:00Z")+offset*86400000);
    return value.toISOString().slice(0,10);
  }
  function syncDate(){
    const date=dateAt(Number($("date-scrub").value));
    $("date").value=date;
    $("date-label").textContent=fmtDate.format(new Date(date+"T12:00:00Z"));
    $("daily-json").href=`data/${date}.json`;
  }
  function showDataWindow(){
    $("date-scrub").max=String(Math.round((Date.parse(LAST)-Date.parse(FIRST))/86400000));
    $("date-first").textContent=fmtShortDate.format(new Date(FIRST+"T12:00:00Z"));
    $("date-last").textContent=fmtShortDate.format(new Date(LAST+"T12:00:00Z"));
    $("header-range").textContent=`${fmtDate.format(new Date(FIRST+"T12:00:00Z"))} — ${fmtDate.format(new Date(LAST+"T12:00:00Z"))}`;
  }
  function inRing(x,y,ring){
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j];
      if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  function inGeometry(lon,lat,geometry){
    const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
    return polygons.some(polygon=>inRing(lon,lat,polygon[0])&&!polygon.slice(1).some(hole=>inRing(lon,lat,hole)));
  }
  function refreshRegion(){
    const lat=Number($("lat").value),lon=Number($("lon").value);
    const match=$("lat").value&&$("lon").value&&Number.isFinite(lat)&&Number.isFinite(lon)&&
      lat>=-90&&lat<=90&&lon>=-180&&lon<=180?
      boundaries?.features.find(f=>f.properties.uid==="31"&&inGeometry(lon,lat,f.geometry))||
      boundaries?.features.find(f=>inGeometry(lon,lat,f.geometry)):null;
    $("region").value=match?.properties.uid||"";
    $("region-label").textContent=match?.properties.name||"Історія недоступна";
    $("region-help").textContent=match?"Визначено за координатами":"Для цієї точки немає завантажених тривог";
    document.querySelector(".region-result").classList.toggle("unavailable",!match);
    return match;
  }

  function kyivLocalToUtc(date,time){
    const [y,m,d]=date.split("-").map(Number),[h,min]=time.split(":").map(Number);
    if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||!Number.isInteger(h)||!Number.isInteger(min))return null;
    const candidates=[];
    for(const offset of [120,180]){
      const utc=Date.UTC(y,m-1,d,h,min)-offset*60000;
      const parts=new Intl.DateTimeFormat("en-GB",{timeZone:KYIV,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(utc));
      const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
      if(Number(p.year)===y&&Number(p.month)===m&&Number(p.day)===d&&Number(p.hour)===h&&Number(p.minute)===min)candidates.push(utc);
    }
    return candidates.length?Math.min(...candidates):null;
  }

  function makeObserver(lat,lon){
    const a=6378.137,e2=6.69437999014e-3,phi=lat*DEG,lam=lon*DEG;
    const sLat=Math.sin(phi),cLat=Math.cos(phi),sLon=Math.sin(lam),cLon=Math.cos(lam);
    const N=a/Math.sqrt(1-e2*sLat*sLat);
    return {sLat,cLat,sLon,cLon,x:N*cLat*cLon,y:N*cLat*sLon,z:N*(1-e2)*sLat};
  }

  function decode(payload){
    const binary=atob(payload.ecefB64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
    let offset=0;
    for(const sat of payload.satellites){
      const xyz=new Int32Array(payload.sampleCount*3);
      for(let k=0;k<3;k++){xyz[k]=view.getInt32(offset,true);offset+=4;}
      for(let i=1;i<payload.sampleCount;i++)for(let k=0;k<3;k++){
        xyz[i*3+k]=xyz[(i-1)*3+k]+view.getInt16(offset,true);offset+=2;
      }
      sat.xyz=xyz;
    }
    if(offset!==bytes.length)throw Error("Неповний файл орбітальних позицій");
    payload.startMs=Date.parse(payload.startUtc);payload.endMs=Date.parse(payload.endUtc);
    return payload;
  }

  async function loadDay(date){
    if(cache.has(date))return cache.get(date);
    const response=await fetch(`data/${date}.json`,{cache:"no-store"});
    if(!response.ok)throw Error(`Дані за ${date} недоступні`);
    const value=decode(await response.json());cache.set(date,value);return value;
  }

  function look(sat,atMinute){
    const i=atMinute*3,v=sat.xyz;
    const dx=v[i]/day.unitsPerKm-observer.x,dy=v[i+1]/day.unitsPerKm-observer.y,dz=v[i+2]/day.unitsPerKm-observer.z;
    const east=-observer.sLon*dx+observer.cLon*dy;
    const north=-observer.sLat*observer.cLon*dx-observer.sLat*observer.sLon*dy+observer.cLat*dz;
    const up=observer.cLat*observer.cLon*dx+observer.cLat*observer.sLon*dy+observer.sLat*dz;
    const range=Math.hypot(east,north,up);
    return {az:(Math.atan2(east,north)/DEG+360)%360,el:Math.asin(up/range)/DEG,range};
  }

  function makeSegment(track,start,end,low,high,className,title){
    const s=Math.max(low,Math.min(high,start)),e=Math.max(low,Math.min(high,end));
    if(e<=s)return;
    const segment=document.createElement("span");segment.className="segment "+className;
    segment.style.left=`${100*(s-low)/(high-low)}%`;
    segment.style.width=`${100*(e-s)/(high-low)}%`;
    segment.title=title;track.appendChild(segment);
  }

  function dayAlerts(){
    const uid=$("region").value;
    return alerts.alerts.filter(a=>a.uid===uid&&Date.parse(a.startedAt)<day.endMs&&(a.finishedAt?Date.parse(a.finishedAt):Infinity)>day.startMs);
  }

  function renderTimeline(){
    const coverage=$("coverage-track"),alarm=$("alert-track");
    coverage.replaceChildren();alarm.replaceChildren();
    let start=null,total=0,spans=0;
    for(let i=0;i<day.sampleCount-1;i++){
      const covered=day.satellites.some(s=>look(s,i).el>=threshold);
      if(covered){total++;if(start===null)start=i;}
      if(!covered&&start!==null){makeSegment(coverage,start,i,0,day.sampleCount-1,"",`Прохід: ${start}–${i} хв`);spans++;start=null;}
    }
    if(start!==null){makeSegment(coverage,start,day.sampleCount-1,0,day.sampleCount-1,"","Прохід до кінця доби");spans++;}
    $("coverage-total").textContent=`${total} хв · ${spans} ${plural(spans,"інтервал","інтервали","інтервалів")}`;
    passes=[];
    for(const sat of day.satellites){
      let rise=null,peak=0,maxEl=-90;
      for(let i=0;i<day.sampleCount-1;i++){
        const el=look(sat,i).el;
        if(el>=threshold){if(rise===null){rise=i;peak=i;maxEl=el;}if(el>maxEl){peak=i;maxEl=el;}}
        else if(rise!==null){passes.push({sat,rise,peak,end:i,maxEl});rise=null;}
      }
      if(rise!==null)passes.push({sat,rise,peak,end:day.sampleCount-1,maxEl});
    }
    const region=dayAlerts();
    for(const a of region){
      const segments=a.levelHistory?.length?a.levelHistory:[{level:a.level,startedAt:a.startedAt,finishedAt:a.finishedAt}];
      for(const segment of segments){
        makeSegment(alarm,Date.parse(segment.startedAt),segment.finishedAt?Date.parse(segment.finishedAt):day.endMs,
          day.startMs,day.endMs,segment.level==="red"?"red":"yellow",`${a.id} · ${segment.level||"тривога"}`);
      }
    }
    $("alert-total").textContent=$("region").value?`${region.length} ${plural(region.length,"запис","записи","записів")}`:"Немає даних";
    const cursor1=document.createElement("span"),cursor2=document.createElement("span");
    cursor1.className=cursor2.className="cursor";coverage.appendChild(cursor1);alarm.appendChild(cursor2);
    moveCursor();
  }

  function moveCursor(){
    const pct=100*minute/(day.sampleCount-1);
    for(const cursor of document.querySelectorAll(".track .cursor"))cursor.style.left=`${pct}%`;
  }

  function skyPosition(pos){const r=168*(90-pos.el)/90,a=pos.az*DEG;return [220+r*Math.sin(a),220-r*Math.cos(a)];}
  function svgEl(name,attributes){const el=document.createElementNS("http://www.w3.org/2000/svg",name);for(const [key,value] of Object.entries(attributes))el.setAttribute(key,String(value));return el;}

  function renderSky(visible){
    const group=$("sky-marks");group.replaceChildren();
    for(const row of visible){
      const [x,y]=skyPosition(row.pos);
      const mark=svgEl("circle",{cx:x.toFixed(1),cy:y.toFixed(1),r:row.sat.id===selectedSat?9:7,
        class:`sat-dot${row.sat.id===selectedSat?" selected":""}`,tabindex:"0",role:"button",
        "aria-label":`Супутник ${row.sat.id}, піднесення ${row.pos.el.toFixed(1)} градуса, азимут ${row.pos.az.toFixed(1)} градуса`});
      const choose=()=>{selectedSat=row.sat.id;render();};
      mark.addEventListener("click",choose);
      mark.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();choose();}});
      group.appendChild(mark);
    }
  }

  function renderSatList(visible){
    const list=$("sat-list");list.replaceChildren();
    if(!visible.length){const p=document.createElement("p");p.className="sat-empty";p.textContent="За цим GP-знімком супутників над горизонтом немає.";list.appendChild(p);return;}
    for(const row of visible.slice(0,18)){
      const b=document.createElement("button");b.type="button";b.className=`sat-row${row.sat.id===selectedSat?" selected":""}`;
      for(const value of [`№ ${row.sat.id}`,`${row.pos.el.toFixed(1)}° вис.`,`${row.pos.az.toFixed(0)}° аз.`,`${Math.round(row.pos.range)} км`]){
        const span=document.createElement("span");span.textContent=value;b.appendChild(span);
      }
      b.addEventListener("click",()=>{selectedSat=row.sat.id;render();});list.appendChild(b);
    }
  }

  function renderPasses(){
    const list=$("pass-list");list.replaceChildren();
    const nearest=[...passes].sort((a,b)=>{
      const da=minute<a.rise?a.rise-minute:minute>a.end?minute-a.end:0;
      const db=minute<b.rise?b.rise-minute:minute>b.end?minute-b.end:0;
      return da-db||Math.abs(a.peak-minute)-Math.abs(b.peak-minute)||a.sat.id-b.sat.id;
    }).slice(0,6);
    if(!nearest.length){const p=document.createElement("p");p.className="sat-empty";p.textContent="За цю добу проходів вище порога немає.";list.appendChild(p);return;}
    for(const pass of nearest){
      const row=document.createElement("button");row.className="pass-row";row.type="button";
      const clock=index=>fmtClock.format(new Date(day.startMs+index*day.stepSeconds*1000));
      for(const value of [`№ ${pass.sat.id}`,clock(pass.rise),`${pass.maxEl.toFixed(0)}° пік`,clock(pass.end)]){
        const span=document.createElement("span");span.textContent=value;row.appendChild(span);
      }
      row.title=`Прохід ${clock(pass.rise)}–${clock(pass.end)}. Натисніть для переходу до піка.`;
      row.addEventListener("click",()=>{stop();minute=pass.peak;selectedSat=pass.sat.id;render();});
      list.appendChild(row);
    }
  }

  function exportPassesCsv(){
    if(!day)return;
    const at=index=>new Date(day.startMs+index*day.stepSeconds*1000).toISOString();
    const cell=value=>`"${String(value??"").replaceAll('"','""')}"`;
    const columns=["norad_id","name","rise_utc","peak_utc","end_utc","peak_elevation_deg",
      "peak_azimuth_deg","peak_range_km","latitude_deg","longitude_deg","threshold_deg",
      "gp_epoch_utc","gp_age_hours_at_peak","model_status"];
    const lat=Number($("lat").value),lon=Number($("lon").value);
    const rows=passes.map(pass=>{
      const peak=look(pass.sat,pass.peak),peakUtc=at(pass.peak);
      return [pass.sat.id,pass.sat.name,at(pass.rise),peakUtc,at(pass.end),pass.maxEl.toFixed(2),
        peak.az.toFixed(2),peak.range.toFixed(1),lat.toFixed(6),lon.toFixed(6),threshold,
        pass.sat.epoch,(Math.abs(Date.parse(peakUtc)-Date.parse(pass.sat.epoch))/3600000).toFixed(1),day.modelStatus];
    });
    const csv="\uFEFF"+[columns.join(","),...rows.map(row=>row.map(cell).join(","))].join("\r\n")+"\r\n";
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=`rassvet-passes-${day.date}.csv`;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  function render(){
    if(!day||!alerts)return;
    minute=Math.max(0,Math.min(day.sampleCount-2,minute));
    const timeMs=day.startMs+minute*day.stepSeconds*1000;
    const visible=day.satellites.map(sat=>({sat,pos:look(sat,minute)})).filter(row=>row.pos.el>=0)
      .sort((a,b)=>b.pos.el-a.pos.el);
    const count=visible.filter(row=>row.pos.el>=threshold).length;
    if(selectedSat!==null&&!visible.some(row=>row.sat.id===selectedSat))selectedSat=null;
    if(selectedSat===null&&visible.length)selectedSat=visible[0].sat.id;
    const maxAge=Math.max(0,...day.satellites.map(s=>Math.abs(timeMs-Date.parse(s.epoch))/3600000));
    $("result-heading").textContent=`${placeName} · ${fmtDateTime.format(new Date(timeMs))}`;
    $("count").textContent=String(count);
    $("count-note").textContent=`поріг ${threshold}° · розрахунок, не радіоприйом`;
    $("highest").textContent=visible.length?`${visible[0].pos.el.toFixed(1)}°`:`< 0°`;
    const status=day.modelStatus;
    $("quality").textContent=status==="forecast"?`Прогноз · GP до ${maxAge.toFixed(0)} год`:status==="historical"?`Архів GP · до ${maxAge.toFixed(0)} год`:`Поточний GP · до ${maxAge.toFixed(0)} год`;
    $("quality").classList.toggle("old",status==="forecast"||maxAge>24);
    const source=status==="historical"?"архів CelesTrak":`GP-знімок ${dataManifest.forecastSource}`;
    $("provenance").textContent=`${source} · ${day.satellites.length} об'єктів · ${status==="forecast"?"орієнтовне положення; точність з часом погіршується":"розрахунок положення за орбітальними елементами"}`;
    const region=alerts.regions.find(r=>r.uid===$("region").value);
    const sourceLabel=!region?null:region.uid==="31"?"kyiv_city":region.oblast==="Київська область"?"kyiv_oblast":"lviv_oblast";
    const fetched=Date.parse(alerts.sources.find(s=>s.label===sourceLabel)?.fetchedUtc||0);
    const current=dayAlerts().filter(a=>Date.parse(a.startedAt)<=timeMs&&(a.finishedAt?Date.parse(a.finishedAt):fetched)>timeMs);
    if(!region){$("alert-short").textContent="Немає даних";$("alert-detail").textContent="район поза завантаженою історією";}
    else if(timeMs>fetched){$("alert-short").textContent="Ще не оновлено";$("alert-detail").textContent=`знімок тривог до ${fmtDateTime.format(new Date(fetched))}`;}
    else if(current.length){$("alert-short").textContent="Є тривога";$("alert-detail").textContent=region?.title||"обраний район";}
    else{$("alert-short").textContent="Немає запису";$("alert-detail").textContent=region?.title||"обраний район";}
    if(!region){$("alert-explanation").textContent="Для цієї точки історію тривог не завантажено. Прольоти супутників розраховані, але зіставлення з тривогами недоступне.";}
    else if(timeMs>fetched){$("alert-explanation").textContent=status==="forecast"?"Майбутні тривоги невідомі. Прогноз супутників з одного GP-знімка на кілька діб уперед є орієнтовним; точний час проходу може змінитися.":"Історія тривог на цей час ще не завантажена. Висновок про відсутність тривоги або удару зробити не можна.";}
    else if(current.length){
      const threats=[...new Set(current.flatMap(a=>a.threats))];
      const info=threats.length?`За весь інтервал API вказує: ${threats.map(x=>THREAT_NAMES[x]||x).join(", ")}.`:
        "Тип загрози в цих записах не вказаний.";
      $("alert-explanation").textContent=`У вибраний час є запис про тривогу. ${info} Часова близькість до проходу супутника не доводить зв'язку між ними.`;
    }else{$("alert-explanation").textContent="";}
    $("alert-explanation").hidden=!$("alert-explanation").textContent;
    $("visible-count").textContent=`${visible.length} із ${day.satellites.length}`;
    const groups=[...new Set(day.satellites.map(s=>s.group||"RASSVET"))];
    $("scene-live-label").textContent=`${groups.length===1?groups[0]:groups.length+" групи"} · ${day.satellites.length} GP`;
    $("scrub").value=String(minute);
    const parts=Object.fromEntries(clockParts.formatToParts(new Date(timeMs)).map(x=>[x.type,x.value]));
    $("time").value=`${parts.hour}:${parts.minute}`;
    $("time-label").textContent=fmtClock.format(new Date(timeMs));
    moveCursor();renderSky(visible);renderSatList(visible);renderPasses();
    window.RassvetScene?.update({visible,minute,day,selectedSat,threshold,look});
    const selected=visible.find(row=>row.sat.id===selectedSat);
    $("sat-detail").textContent=selected?
      `№ ${selected.sat.id} · ${selected.sat.name} · азимут ${selected.pos.az.toFixed(1)}° · піднесення ${selected.pos.el.toFixed(1)}° · відстань ${Math.round(selected.pos.range)} км · GP ${fmtDateTime.format(new Date(selected.sat.epoch))}`:
      "Оберіть супутник на схемі або у списку.";
  }

  function error(message){$("form-error").hidden=!message;$("form-error").textContent=message||"";}
  function stop(){playing=false;clearInterval(timer);timer=null;$("play").textContent="Відтворити";}
  async function applyQuery(){
    const version=++queryVersion;
    stop();error("");
    const date=$("date").value,time=$("time").value,lat=Number($("lat").value),lon=Number($("lon").value);
    if(date<FIRST||date>LAST||!time||!$("lat").value||!$("lon").value||!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180){
      error("Перевірте дату, київський час і координати у межах −90…90° / −180…180°.");return;
    }
    const timeMs=kyivLocalToUtc(date,time);
    if(timeMs===null){error("Цей місцевий час не існує через перехід на літній час.");return;}
    try{
      const loaded=await loadDay(date);
      if(version!==queryVersion)return;
      day=loaded;observer=makeObserver(lat,lon);threshold=Number($("threshold").value);
      refreshRegion();
      window.RassvetScene?.setLocation(lat,lon);
      minute=Math.round((timeMs-day.startMs)/(day.stepSeconds*1000));
      if(minute<0||minute>=day.sampleCount-1)throw Error("Час поза межами вибраної доби");
      $("scrub").max=String(day.sampleCount-2);
      renderTimeline();render();
    }catch(e){if(version===queryVersion)error(e.message||"Не вдалося завантажити дані");}
  }

  async function init(){
    try{
      const manifestResponse=await fetch("data/manifest.json",{cache:"no-store"});
      if(!manifestResponse.ok)throw Error("Немає опису вікна даних");
      dataManifest=await manifestResponse.json();
      FIRST=dataManifest.firstDate;LAST=dataManifest.lastDate;
      showDataWindow();
      $("date-scrub").value=String(Math.round((Date.parse(dataManifest.anchorDate)-Date.parse(FIRST))/86400000));
      syncDate();
      const [alertsResponse,boundaryResponse]=await Promise.all([fetch("data/alerts.json",{cache:"no-store"}),fetch("data/alert-boundaries.geojson")]);
      if(!alertsResponse.ok)throw Error("Немає файлу історії тривог");
      if(!boundaryResponse.ok)throw Error("Немає меж районів");
      alerts=await alertsResponse.json();boundaries=await boundaryResponse.json();
      refreshRegion();
      for(const id of ["lat","lon"]){
        $(id).addEventListener("input",()=>{
          placeName="Моя точка";refreshRegion();clearTimeout(coordinateTimer);
          const lat=Number($("lat").value),lon=Number($("lon").value);
          if($("lat").value&&$("lon").value&&Number.isFinite(lat)&&Number.isFinite(lon)&&
             lat>=-90&&lat<=90&&lon>=-180&&lon<=180){
            coordinateTimer=setTimeout(applyQuery,500);
          }
        });
        $(id).addEventListener("keydown",event=>{
          if(event.key==="Enter"){event.preventDefault();clearTimeout(coordinateTimer);applyQuery();}
        });
      }
      $("date-scrub").addEventListener("input",()=>{
        syncDate();clearTimeout(dateTimer);dateTimer=setTimeout(applyQuery,160);
      });
      $("show").addEventListener("click",()=>{clearTimeout(coordinateTimer);applyQuery();});
      $("export-passes").addEventListener("click",exportPassesCsv);
      $("locate").addEventListener("click",()=>{
        const status=$("location-status"),button=$("locate");
        status.hidden=false;
        if(!navigator.geolocation){status.textContent="Геолокація недоступна у цьому браузері.";return;}
        button.disabled=true;status.textContent="Очікуємо дозвіл на визначення місця…";
        navigator.geolocation.getCurrentPosition(position=>{
          button.disabled=false;
          $("lat").value=position.coords.latitude.toFixed(6);
          $("lon").value=position.coords.longitude.toFixed(6);
          placeName="Моя точка";refreshRegion();clearTimeout(coordinateTimer);
          status.textContent=`Координати визначено · точність близько ${Math.round(position.coords.accuracy)} м.`;
          applyQuery();
        },failure=>{
          button.disabled=false;
          status.textContent=failure.code===1?"Доступ до місцеположення не надано. Координати можна ввести вручну.":
            "Не вдалося визначити місцеположення. Введіть координати вручну.";
        },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
      });
      document.addEventListener("rassvet-satellite-select",event=>{
        selectedSat=event.detail.id;
        render();
      });
      $("threshold").addEventListener("change",()=>{threshold=Number($("threshold").value);if(day){renderTimeline();render();}});
      $("scrub").addEventListener("input",()=>{stop();minute=Number($("scrub").value);render();});
      $("prev").addEventListener("click",()=>{stop();minute-=10;render();});
      $("next").addEventListener("click",()=>{stop();minute+=10;render();});
      $("now").addEventListener("click",()=>{
        stop();clearTimeout(dateTimer);
        const current=new Date();
        const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:KYIV,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(current).map(x=>[x.type,x.value]));
        const today=`${parts.year}-${parts.month}-${parts.day}`;
        if(today<FIRST||today>LAST){error("Для поточної дати дані ще не завантажено.");return;}
        $("date-scrub").value=String(Math.round((Date.parse(today)-Date.parse(FIRST))/86400000));
        syncDate();$("time").value=`${parts.hour}:${parts.minute}`;applyQuery();
      });
      $("play").addEventListener("click",()=>{
        if(!day)return;
        if(playing){stop();return;}playing=true;$("play").textContent="Пауза";
        timer=setInterval(()=>{minute+=2;if(minute>=day.sampleCount-1){minute=day.sampleCount-2;stop();}render();},130);
      });
      applyQuery();
      setInterval(async()=>{
        try{
          const response=await fetch("data/manifest.json",{cache:"no-store"});
          if(!response.ok)return;
          const next=await response.json();
          if(next.generatedUtc===dataManifest.generatedUtc)return;
          const alertsResponse=await fetch("data/alerts.json",{cache:"no-store"});
          if(!alertsResponse.ok)return;
          const selected=$("date").value;
          alerts=await alertsResponse.json();dataManifest=next;cache.clear();
          FIRST=next.firstDate;LAST=next.lastDate;showDataWindow();
          const date=selected>=FIRST&&selected<=LAST?selected:next.anchorDate;
          $("date-scrub").value=String(Math.round((Date.parse(date)-Date.parse(FIRST))/86400000));
          syncDate();applyQuery();
        }catch(_){/* Keep the last valid snapshot until the next scheduled check. */}
      },15*60*1000);
    }catch(e){error(e.message||"Не вдалося завантажити сторінку");}
  }
  init();
})();
