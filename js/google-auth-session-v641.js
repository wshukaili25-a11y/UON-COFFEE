import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false,flowType:'pkce'}});

export async function optionalGoogleAuthHeaders(){
  try{
    const{data,error}=await supabase.auth.getSession();
    if(error||!data?.session?.access_token)return{};
    return{Authorization:`Bearer ${data.session.access_token}`};
  }catch{return{}}
}

export async function hasGoogleAuthSession(){
  try{
    const{data}=await supabase.auth.getSession();
    return Boolean(data?.session?.access_token);
  }catch{return false}
}
