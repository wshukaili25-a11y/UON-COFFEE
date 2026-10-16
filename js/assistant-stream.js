(()=>{
// Parse UTF-8 SSE across arbitrary network and character boundaries.
async function readSSE(body, onEvent) {
  const reader=body.getReader(), decoder=new TextDecoder();let buffer='';
  const dispatch=block=>{const data=block.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(data&&data!=='[DONE]')onEvent(JSON.parse(data));};
  try { for(;;){const {done,value}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});buffer=buffer.replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){dispatch(buffer.slice(0,end));buffer=buffer.slice(end+2);}if(done){if(buffer.trim())dispatch(buffer);break;}} }
  finally {reader.releaseLock();}
}

window.readUonAIResponse=async function(response,onText){
 if(!(response.headers.get('content-type')||'').includes('text/event-stream'))return response.json();
 let result=null;
 await readSSE(response.body,event=>{
  if(event.type==='text')onText?.(String(event.text||''));
  if(event.type==='done'){
   if(event.status>=400){const error=new Error(event.data?.error||'assistant_unavailable');error.status=event.status;throw error;}
   result=event.data;
  }
 });
 if(!result?.answer)throw new Error('incomplete_stream');
 return result;
};
})();
