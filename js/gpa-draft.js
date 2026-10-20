const KEY='uon_gpa_draft_v1';
const gradeNames=new Set(['A','A-','B+','B','B-','C+','C','C-','D+','D','F']);
const numberText=(value,max=Infinity)=>typeof value==='string'&&(value===''||(Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=max));
function valid(draft){
 return draft?.version===1&&numberText(draft.currentGpa,4)&&numberText(draft.previousHours)&&Array.isArray(draft.courses)&&draft.courses.length<=500&&draft.courses.every(course=>
  typeof course.code==='string'&&course.code.length<=200&&numberText(course.hours)&&gradeNames.has(course.grade)&&gradeNames.has(course.previousGrade)&&typeof course.repeated==='boolean');
}
export function readGpaDraft(storage){
 try{const draft=JSON.parse(storage.getItem(KEY));return valid(draft)?draft:null}catch{return null}
}
export function writeGpaDraft(storage,draft){
 try{if(!valid(draft))return false;storage.setItem(KEY,JSON.stringify(draft));return true}catch{return false}
}
