import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({path:'',handles:[] as any[]}));
vi.mock('expo-sqlite',()=>({openDatabaseAsync:async()=>{const db=new DatabaseSync(state.path);state.handles.push(db);return {execAsync:async(sql:string)=>db.exec(sql),runAsync:async(sql:string,...params:any[])=>db.prepare(sql).run(...params),getAllAsync:async(sql:string,...params:any[])=>db.prepare(sql).all(...params),getFirstAsync:async(sql:string,...params:any[])=>db.prepare(sql).get(...params)};}}));
const directory=mkdtempSync(join(tmpdir(),'wildguard-mobile-test-'));state.path=join(directory,'queue.db');
afterAll(()=>{for(const db of state.handles)try{db.close();}catch{}for(const name of readdirSync(directory))unlinkSync(join(directory,name));rmdirSync(directory);});
it('persists complete photo payloads in SQLite across module restart and isolates owners',async()=>{
  const first=await import('../src/storage/database');const item={id:'uuid1',owner:'ranger1',path:'/incidents',method:'POST',payload:{clientId:'uuid1',photos:[{dataUrl:'data:image/jpeg;base64,AAAA'}]},status:'queued' as const,attempts:0,createdAt:1};await first.queueStore.put(item);await first.cachePut('ranger1:/parks',{parks:[{id:'park'}]});
  for(const db of state.handles)db.close();state.handles=[];vi.resetModules();const restarted=await import('../src/storage/database');expect(await restarted.queueStore.list('ranger1')).toEqual([item]);expect(await restarted.queueStore.list('ranger2')).toEqual([]);expect(await restarted.cacheGet('ranger1:/parks')).toEqual({parks:[{id:'park'}]});await restarted.clearCache();expect(await restarted.cacheGet('ranger1:/parks')).toBeNull();expect(await restarted.queueStore.list('ranger1')).toEqual([item]);
});
