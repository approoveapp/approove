import { describe, it, expect } from 'vitest';
import { importDateTimeToIso, repeatedMediaNames, duplicatePostKeys } from './review';
import { importStageFor } from './proposal';
describe('import review',()=>{
  it('only skips design when the reviewer explicitly marks text-only',()=>{
    expect(importStageFor(true,false)).toBe('waiting_design');
    expect(importStageFor(true,false,true)).toBe('internal_review');
    expect(importStageFor(false,false,true)).toBe('draft_copy');
  });
  it('uses the selected agency zone, not the machine timezone',()=>{
    expect(importDateTimeToIso('2026-11-01T09:30','America/Sao_Paulo')).toBe('2026-11-01T12:30:00.000Z');
    expect(importDateTimeToIso('2026-11-01T09:30','UTC')).toBe('2026-11-01T09:30:00.000Z');
  });
  it('refuses impossible days and daylight-saving gaps/overlaps',()=>{
    expect(importDateTimeToIso('2026-02-30T10:00','UTC')).toBeNull();
    expect(importDateTimeToIso('2026-03-29T01:30','Europe/Lisbon')).toBeNull();
    expect(importDateTimeToIso('2026-10-25T01:30','Europe/Lisbon')).toBeNull();
  });
  it('flags name collisions before upload',()=>expect(repeatedMediaNames(['a.png','b.png','a.png'])).toEqual(['a.png']));
  it('flags identical posts without deleting intentional cross-posting',()=>{
    const p={key:'1',scheduledLocal:'2026-11-01T09:30',channel:'Instagram',title:'A',copyText:'Original'};
    expect([...duplicatePostKeys([p,{...p,key:'2'},{...p,key:'3',channel:'Facebook'},{...p,key:'4',scheduledLocal:'2026-11-02T09:30'}])]).toEqual(['1','2']);
  });
});
