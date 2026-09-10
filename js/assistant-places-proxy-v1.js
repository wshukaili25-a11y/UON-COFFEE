(function(){
  const baseFetch=window.fetch.bind(window);
  const legacyPlaces='/functions/v1/uon-ai-google-v64';
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(url.includes(legacyPlaces)){
      try{
        let query='';
        if(init&&typeof init.body==='string'){
          const body=JSON.parse(init.body);
          query=String(body?.query||body?.question||'').trim();
        }
        const headers=new Headers(init?.headers||{});
        if(!headers.get('x-connector-secret')){
          return baseFetch(`/api/nearby-places?q=${encodeURIComponent(query)}`,{method:'GET',cache:'no-store'});
        }
      }catch{}
    }
    return baseFetch(input,init);
  };
})();
