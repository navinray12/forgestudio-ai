import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({access:vi.fn(),find:vi.fn(),write:vi.fn()}));
vi.mock('../config/prisma.js',()=>({prisma:{website:{findUnique:mocks.find},$executeRaw:mocks.write}}));
vi.mock('../modules/data-platform/common/project-access.js',()=>({verifyProjectAccess:mocks.access}));
import { defaultIntegrationSettings, parseIntegrationSettings, publicIntegrationSettings, siteIntegrationSettings, verifyIntegrationChallenges } from '../services/integrations/site-integrations.service.js';
const id='c0de0000-0000-4000-8000-000000000001';
beforeEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();mocks.access.mockResolvedValue({canAdminister:true});mocks.find.mockResolvedValue({editorData:{integrations:defaultIntegrationSettings}})});
describe('site integration settings',()=>{
 it('loads without modifying the site',async()=>{expect((await siteIntegrationSettings(id,'actor')).settings).toEqual(defaultIntegrationSettings);expect(mocks.write).not.toHaveBeenCalled()});
 it('updates only the integrations JSON path with bound parameters',async()=>{await siteIntegrationSettings(id,'actor',defaultIntegrationSettings);expect(mocks.write.mock.calls[0][0].join('')).toContain("'{integrations}'");expect(mocks.write.mock.calls[0].slice(1)).toEqual([JSON.stringify(defaultIntegrationSettings),id])});
 it('rejects non-admin reads and writes',async()=>{mocks.access.mockResolvedValue({canAdminister:false});await expect(siteIntegrationSettings(id,'actor',defaultIntegrationSettings)).rejects.toMatchObject({statusCode:403});await expect(siteIntegrationSettings(id,'actor')).rejects.toMatchObject({statusCode:403});expect(mocks.write).not.toHaveBeenCalled();expect(mocks.find).not.toHaveBeenCalled()});
 it('denies other tenants',async()=>{mocks.access.mockRejectedValue(new Error('Not found'));await expect(siteIntegrationSettings(id,'stranger')).rejects.toThrow('Not found');expect(mocks.find).not.toHaveBeenCalled()});
 it.each([{googleTags:[{name:'bad',id:'<script>'}]},{metaPixelId:'abc'},{googleMapsApiKey:'" onload="x'},{recaptchaSiteKey:'<script>'},{webhooks:[{id,url:'http://127.0.0.1/x',event:'form.submitted'}]},{webhooks:[{id,url:'https://127.0.0.1/x',event:'form.submitted'}]},{secret:'private'}])('rejects unsafe input %j',patch=>{expect(()=>parseIntegrationSettings({...defaultIntegrationSettings,...patch})).toThrow()});
 it('accepts supported tag prefixes and HTTPS webhooks',()=>{expect(parseIntegrationSettings({...defaultIntegrationSettings,googleTags:['G-ABC123','GT-ABC123','AW-12345','GTM-12345'].map(id=>({name:'Tag',id})),webhooks:[{id,url:'https://example.com/hook',event:'form.submitted'}]}).googleTags).toHaveLength(4)});
 it('requires configured providers to enable protection',()=>{vi.stubEnv('TURNSTILE_SECRET_KEY','');vi.stubEnv('RECAPTCHA_SECRET_KEY','');expect(()=>parseIntegrationSettings({...defaultIntegrationSettings,blockBots:true})).toThrow('Configure TURNSTILE');expect(()=>parseIntegrationSettings({...defaultIntegrationSettings,recaptchaEnabled:true})).toThrow('Provide a reCAPTCHA')});
 it('excludes private webhook configuration from published settings',()=>{expect(publicIntegrationSettings({...defaultIntegrationSettings,webhooks:[{url:'https://example.com/private'}],secret:'private'})).not.toHaveProperty('webhooks')});
});
describe('form protection',()=>{
 it('skips unconfigured protection when disabled',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await verifyIntegrationChallenges(defaultIntegrationSettings,{});expect(fetch).not.toHaveBeenCalled()});
 it('rejects absent tokens',async()=>{vi.stubEnv('TURNSTILE_SECRET_KEY','test-secret');await expect(verifyIntegrationChallenges({blockBots:true},{})).rejects.toMatchObject({code:'CHALLENGE_REQUIRED'})});
 it('rejects failed verification',async()=>{vi.stubEnv('RECAPTCHA_SECRET_KEY','test-secret');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({success:false})}));await expect(verifyIntegrationChallenges({recaptchaEnabled:true},{recaptcha:'test-token'})).rejects.toMatchObject({code:'CHALLENGE_FAILED'})});
 it('verifies tokens using server credentials',async()=>{vi.stubEnv('TURNSTILE_SECRET_KEY','test-secret');const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({success:true})});vi.stubGlobal('fetch',fetch);await verifyIntegrationChallenges({blockBots:true},{turnstile:'test-token'});expect(fetch.mock.calls[0][0]).toContain('challenges.cloudflare.com');expect(fetch.mock.calls[0][1].body.get('secret')).toBe('test-secret')});
});
import {preservePublishingAuthority} from '../services/websites/document-policy.js';
describe('integration settings survive document editing',()=>{
 it('preserves settings omitted by the visual editor',()=>{expect(preservePublishingAuthority({integrations:{metaPixelId:'123456789'},elements:[]},{elements:[]})).toHaveProperty('integrations.metaPixelId','123456789')});
 it('rejects changes through generic document writes',()=>{expect(()=>preservePublishingAuthority({integrations:{metaPixelId:'123456789'}},{integrations:{metaPixelId:'other'}})).toThrow()});
});
