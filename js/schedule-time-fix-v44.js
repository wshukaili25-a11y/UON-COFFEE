// Schedule V44 compatibility fix: current schedule rows are stored in 24-hour
// format, while the legacy reader treats 01:00–07:59 without an explicit period
// as ambiguous. Mark those legacy values as AM before schedule.js reads them.
const KEY='uon-v7-schedule';
try{
  const raw=localStorage.getItem(KEY);
  if(raw){
    const rows=JSON.parse(raw);
    if(Array.isArray(rows)){
      let changed=false;
      const fixed=rows.map(row=>{
        if(!row||typeof row!=='object')return row;
        const next={...row};
        for(const field of ['start','end']){
          const periodField=`${field}Period`;
          const match=/^(0?[1-7]):[0-5]\d$/.exec(String(next[field]||''));
          if(match&&!next[periodField]){next[periodField]='am';changed=true}
        }
        return next;
      });
      if(changed)localStorage.setItem(KEY,JSON.stringify(fixed));
    }
  }
}catch(error){console.warn('Schedule time compatibility fix skipped',error)}
