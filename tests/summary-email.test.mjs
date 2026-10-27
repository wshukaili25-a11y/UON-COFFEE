import test from 'node:test';
import assert from 'node:assert/strict';
import {emailTemplate,attachmentUrl,validEmail} from '../supabase/functions/summary-email/email.mjs';
const base='https://irkhvydgxpseflggbeqq.supabase.co';
test('only hosted approved storage paths can be attached; no arbitrary URL or folder',()=>{
 assert.equal(attachmentUrl({url:base+'/storage/v1/object/public/summaries/test.pdf'},base),base+'/storage/v1/object/public/summaries/test.pdf');
 for(const url of ['https://evil.test/x.pdf',base+'/private/x.pdf','https://drive.google.com/drive/folders/abc',base+'/storage/v1/object/public/summaries/../../../x.pdf','http://169.254.169.254/a.pdf'])assert.equal(attachmentUrl({url},base),null);
});
test('email templates escape recipient and title while retaining OTP and signature',()=>{
 const t=emailTemplate({name:'<img src=x>',title:'A & B',otp:'012345'});
 assert.ok(t.html.includes('&lt;img'));assert.ok(t.html.includes('012345'));assert.ok(t.html.includes('فريق UON Hub'));assert.ok(!t.html.includes('<img src=x>'));
 const d=emailTemplate({name:'طالب',title:'ملخص',id:'123'});assert.ok(d.html.includes('summary-viewer.html?id=123'));assert.ok(!d.html.includes('رمز تأكيد'));
});
test('recipient validation rejects header injection and malformed emails',()=>{
 assert.ok(validEmail('student@example.edu'));for(const x of ['x\r\nBcc:all@example.com','a@b','a b@c.com','<a>@b.com'])assert.ok(!validEmail(x));
});
