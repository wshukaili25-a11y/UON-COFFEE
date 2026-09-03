function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}

export default function handler(req,res){
  if(req.method==='OPTIONS'){
    res.statusCode=204;
    res.setHeader('Cache-Control','no-store');
    return res.end();
  }
  return json(res,410,{
    error:'AI_ROUTE_RETIRED',
    message:'This legacy AI endpoint has been retired.'
  });
}
