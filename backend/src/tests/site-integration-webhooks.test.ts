import { describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn(),release:vi.fn()}));
vi.mock('../config/prisma.js',()=>({pgPool:{connect:async()=>({query:mocks.query,release:mocks.release})}}));
vi.mock('../modules/data-platform/common/project-access.js',()=>({verifyProjectAccess:vi.fn()}));
import {acceptSubmission} from '../services/leads/leadIntake.service.js';
describe('multiple site webhook destinations',()=>{
 it('commits distinct durable notifications for the same submitted lead',async()=>{
  mocks.query.mockImplementation(async(sql:string)=>{
   if(sql.includes('INSERT INTO form_submissions'))return{rows:[{id:'submission',createdAt:new Date()}]};
   if(sql.includes('INSERT INTO forge_leads'))return{rows:[{id:'lead'}]};
   return{rows:[]};
  });
  const receipt=await acceptSubmission({websiteId:'c0de0000-0000-4000-8000-000000000001',formId:'contact',data:{email:'test@example.com'},metadata:{},notifications:[{type:'WEBHOOK_RETRY',key:'destination-a',payload:{url:'https://example.com/a'}},{type:'WEBHOOK_RETRY',key:'destination-b',payload:{url:'https://example.com/b'}}]});
  expect(receipt.leadId).toBe('lead');
  const inserts=mocks.query.mock.calls.filter(([sql])=>sql.includes('INSERT INTO background_jobs'));
  expect(inserts).toHaveLength(2);expect(inserts[0][1][2]).toBe('lead:lead:WEBHOOK_RETRY:destination-a');expect(inserts[1][1][2]).toBe('lead:lead:WEBHOOK_RETRY:destination-b');
  expect(mocks.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');expect(mocks.release).toHaveBeenCalled();
 });
});
