import {expect,it} from 'vitest';
import {validateFields} from '../src/utils/forms';
it('rejects missing required reasons, invalid numeric values and overlong narratives',()=>{
  expect(()=>validateFields([{key:'reason',label:'Reason',required:true,min:5}],{reason:'   '})).toThrow('required');
  expect(()=>validateFields([{key:'area',label:'Area',number:true,min:0}],{area:'NaN'})).toThrow('valid');
  expect(()=>validateFields([{key:'notes',label:'Notes',max:5}],{notes:'Too long'})).toThrow('characters');
});
it('preserves password whitespace and boolean false, while normalizing ordinary text',()=>{
  expect(validateFields([{key:'name',label:'Name'},{key:'password',label:'Password',password:true},{key:'override',label:'Override'}],{name:' Test ',password:' password ',override:false})).toEqual({name:'Test',password:' password ',override:false});
});
