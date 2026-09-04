// Lightweight fallback for browsers that do not expose createImageBitmap for uploaded screenshots.
// HTMLImageElement is accepted by canvas.drawImage, so the generator can keep one code path.
if(typeof window.createImageBitmap!=='function'){
 window.createImageBitmap=async function(file){
  const dataUrl=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result||''));
   reader.onerror=()=>reject(reader.error||new Error('image_read_failed'));
   reader.readAsDataURL(file);
  });
  const image=await new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>resolve(img);
   img.onerror=()=>reject(new Error('image_decode_failed'));
   img.src=dataUrl;
  });
  if(!image.close)image.close=()=>{};
  return image;
 };
}
