import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({send:vi.fn(),find:vi.fn(),log:vi.fn()}));
vi.mock('../config/prisma.js',()=>({prisma:{$executeRawUnsafe:vi.fn().mockResolvedValue(1),siteMailerConfig:{findUnique:mocks.find},emailDeliveryLog:{create:mocks.log}}}));
vi.mock('nodemailer',()=>({default:{createTransport:()=>({sendMail:mocks.send})}}));
import {sendSiteEmail} from '../services/siteMailer.service.js';
beforeEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();mocks.find.mockResolvedValue(null);mocks.send.mockResolvedValue({messageId:'test-message'})});
describe('managed form email delivery',()=>{
 it('does not simulate successful delivery when SMTP is missing',async()=>{vi.stubEnv('SMTP_HOST','');await expect(sendSiteEmail('site',{to:'owner@example.com',subject:'Test',requireDelivery:true})).rejects.toMatchObject({code:'SMTP_NOT_CONFIGURED'});expect(mocks.send).not.toHaveBeenCalled()});
 it('passes the configured sender and reply-to to the mail transport',async()=>{vi.stubEnv('SMTP_HOST','smtp.example.com');await sendSiteEmail('site',{to:'owner@example.com',subject:'Test',fromName:'Forms',fromEmail:'forms@example.com',replyTo:'replies@example.com',requireDelivery:true});expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({from:{name:'Forms',address:'forms@example.com'},replyTo:'replies@example.com'}))});
 it('propagates delivery failure to the retry worker',async()=>{vi.stubEnv('SMTP_HOST','smtp.example.com');mocks.send.mockRejectedValue(new Error('SMTP unavailable'));await expect(sendSiteEmail('site',{to:'owner@example.com',subject:'Test',requireDelivery:true})).rejects.toMatchObject({code:'EMAIL_DISPATCH_FAILED'})});
});
