
import { supabase } from '../supabase.js';

export async function getSummaries(){
  const { data, error } = await supabase
    .from('summaries')
    .select('*')
    .order('created_at',{ascending:false});

  if(error) throw error;
  return data || [];
}

export async function addSummary(summary){
  return await supabase.from('summaries').insert(summary);
}
