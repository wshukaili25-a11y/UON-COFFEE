// Parse UTF-8 SSE across arbitrary network and character boundaries.
export async function readSSE(body, onEvent) {
  const reader=body.getReader(), decoder=new TextDecoder();let buffer='';
  const dispatch=block=>{const data=block.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(data&&data!=='[DONE]')onEvent(JSON.parse(data));};
  try { for(;;){const {done,value}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});buffer=buffer.replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){dispatch(buffer.slice(0,end));buffer=buffer.slice(end+2);}if(done){if(buffer.trim())dispatch(buffer);break;}} }
  finally {reader.releaseLock();}
}
