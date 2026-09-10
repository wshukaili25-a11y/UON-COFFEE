const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store'
};

Deno.serve(()=>new Response(
  JSON.stringify({ok:false,error:'release_tool_disabled'}),
  {status:410,headers}
));
