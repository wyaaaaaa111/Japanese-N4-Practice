'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const bank=require('../data/questions.js'),core=require('../lib/core.js');
require('../data/unit1.js');
const q=bank.questions[0];
const attempt=(overrides={})=>({id:'a1',sessionId:'s1',questionId:q.id,revision:q.revision,choice:'1',correct:false,at:'2026-11-07T01:00:00.000Z',mode:'daily',...overrides});
test('all 79 questions have unique IDs, valid answers, materials and explicit provenance',()=>{
  assert.equal(bank.questions.length,79);assert.equal(new Set(bank.questions.map(q=>q.id)).size,79);
  assert.equal(bank.questions.filter(q=>q.source.type==='legacy').length,5);
  for(const q of bank.questions){assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(o=>o.id)).size,4);assert.ok(q.options.some(o=>o.id===q.correctOptionId));assert.ok(q.explanation&&q.tags.length&&q.source.title);assert.equal(q.source.official,false);if(q.materialId)assert.ok(bank.materials[q.materialId]);}
});
test('practice → wrong list → correct review preserves history and first accuracy',()=>{
  const data=core.empty();core.record(data,attempt());assert.equal(core.record(data,attempt({id:'duplicate'})),false);
  assert.deepEqual(core.stats(data,bank).wrong,[q.id]);
  core.record(data,attempt({id:'a2',sessionId:'s2',choice:q.correctOptionId,correct:true,mode:'review',at:'2026-11-07T02:00:00Z'}));
  const s=core.stats(data,bank);assert.deepEqual(s.wrong,[]);assert.equal(s.total,2);assert.equal(s.learned,1);assert.equal(s.firstCorrect,0);assert.equal(s.errors.get(q.id),1);
});
test('restore persisted answer and current index after refresh',()=>{
  const data=core.empty();data.attempts.push(attempt());data.session={id:'s1',mode:'daily',ids:[q.id],index:0,answers:{[q.id]:'1'},deadline:null};
  const storage={getItem:()=>JSON.stringify(data)};const r=core.load(storage,bank);assert.equal(r.writable,true);assert.deepEqual(r.data.session,data.session);
});
test('corrupt or future-version storage is preserved with writes disabled',()=>{
  for(const raw of ['{broken',JSON.stringify({schemaVersion:99})]){let wrote=false;const r=core.load({getItem:()=>raw,setItem:()=>wrote=true},bank);assert.equal(r.writable,false);assert.equal(wrote,false);assert.equal(r.data.attempts.length,0);}
});
test('blocked/quota-limited storage degrades without throwing',()=>{
  const storage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}};assert.equal(core.load(storage,bank).writable,false);assert.equal(core.save(storage,core.empty()),false);
});
test('backup validation recomputes correctness and rejects bad choices and duplicates',()=>{
  const data=core.empty();data.attempts=[attempt({correct:true})];assert.equal(core.validate(data,bank).attempts[0].correct,false);
  for(const bad of [attempt({choice:'9'}),attempt({revision:99}),attempt({questionId:'unknown'}),attempt({at:'invalid'})])assert.throws(()=>core.validate({...data,attempts:[bad]},bank));
  assert.throws(()=>core.validate({...data,attempts:[attempt(),attempt({id:'another'})]},bank));
});
test('backup roundtrip and shuffled imported event order preserve chronological stats',()=>{
  const data=core.empty();data.attempts=[attempt({id:'new',sessionId:'s2',at:'2026-11-08T01:00:00Z',choice:q.correctOptionId,correct:true}),attempt()];
  const imported=core.validate(JSON.parse(JSON.stringify(data)),bank);assert.equal(imported.attempts[0].id,'a1');assert.equal(core.stats(imported,bank).firstCorrect,0);assert.deepEqual(core.stats(imported,bank).wrong,[]);
});
test('exam deadline survives refresh; unfinished exam answers are not graded',()=>{
  const data=core.empty();data.session={id:'exam-1',mode:'exam',ids:[q.id],index:0,answers:{[q.id]:q.correctOptionId},deadline:123456789};const r=core.load({getItem:()=>JSON.stringify(data)},bank);assert.equal(r.data.session.deadline,123456789);assert.equal(r.data.attempts.length,0);
});
test('invalid session is discarded while valid history stays',()=>{
  const data=core.empty();data.attempts=[attempt()];data.session={id:'s',mode:'daily',ids:['unknown'],index:0,answers:{}};const r=core.load({getItem:()=>JSON.stringify(data)},bank);assert.equal(r.writable,true);assert.equal(r.data.session,null);assert.equal(r.data.attempts.length,1);
});
test('exam grade agrees with recorded answers, permits unanswered and rejects forged grades',()=>{
  const data=core.empty();data.attempts=[attempt({mode:'exam',sessionId:'e',choice:q.correctOptionId,correct:true})];data.exams=[{id:'e',at:'2026-11-07T02:00:00Z',total:2,score:1,ids:[q.id,bank.questions[1].id]}];assert.equal(core.validate(data,bank).exams[0].score,1);data.exams[0].score=2;assert.throws(()=>core.validate(data,bank));
});
test('today counts use local calendar dates and repeated practice does not inflate coverage',()=>{
  const today=new Date(2026,10,7,12),yesterday=new Date(2026,10,6,12);const data=core.empty();data.attempts=[attempt({at:yesterday.toISOString()}),attempt({id:'a2',sessionId:'s2',at:today.toISOString()})];const s=core.stats(data,bank,today);assert.equal(s.today,1);assert.equal(s.learned,1);
});
test('old backups get default goal; supported goals roundtrip',()=>{
  const old={schemaVersion:2,attempts:[],exams:[],session:null};assert.equal(core.validate(old,bank).dailyGoal,5);
  assert.equal(core.validate({...old,dailyGoal:15},bank).dailyGoal,15);assert.equal(core.validate({...old,dailyGoal:999},bank).dailyGoal,5);
});
test('spaced review is immediately due after error and scheduled after correct answer',()=>{
  const data=core.empty();data.attempts=[attempt()];assert.equal(core.reviewPlan(data,bank,new Date('2026-11-07T02:00:00Z'))[0].due,true);
  data.attempts.push(attempt({id:'b',sessionId:'s2',correct:true,choice:q.correctOptionId,at:'2026-11-07T03:00:00Z'}));
  let plan=core.reviewPlan(data,bank,new Date('2026-11-07T04:00:00Z'))[0];assert.equal(plan.days,1);assert.equal(plan.due,false);
  data.attempts.push(attempt({id:'c',sessionId:'s3',correct:true,choice:q.correctOptionId,at:'2026-11-08T04:00:00Z'}));
  plan=core.reviewPlan(data,bank,new Date('2026-11-08T05:00:00Z'))[0];assert.equal(plan.days,3);
});
test('same-day repetitions do not increase review interval; error resets it',()=>{
  const data=core.empty();data.attempts=[attempt({correct:true,choice:q.correctOptionId}),attempt({id:'b',sessionId:'s2',correct:true,choice:q.correctOptionId,at:'2026-11-07T02:00:00Z'})];
  assert.equal(core.reviewPlan(data,bank)[0].days,1);data.attempts.push(attempt({id:'c',sessionId:'s3',at:'2026-11-08T02:00:00Z'}));assert.equal(core.reviewPlan(data,bank)[0].days,0);
});
test('weekly activity counts distinct questions and keeps yesterday streak before today begins',()=>{
  const now=new Date(2026,10,9,12),at=new Date(2026,10,8,12).toISOString();const data=core.empty();data.attempts=[attempt({at}),attempt({id:'b',sessionId:'s2',at})];const activity=core.activity(data,now);assert.equal(activity.streak,1);assert.equal(activity.todayUnique,0);assert.equal(activity.days[5].count,1);assert.equal(activity.days.length,7);
});
test('daily plan is balanced, unique, preserves original sources and prioritizes due questions',()=>{
  const data=core.empty();data.dailyGoal=15;const ids=core.dailySelection(data,bank,new Date(),()=>.5);assert.equal(ids.length,15);assert.equal(new Set(ids).size,15);
  assert.equal(ids.filter(id=>bank.questions.find(q=>q.id===id).skill==='reading').length,3);assert.ok(ids.every(id=>!id.startsWith('legacy')));
  const target=bank.questions.find(q=>q.id==='g-013');data.attempts=[attempt({questionId:target.id,correct:false,at:'2020-01-01T00:00:00Z'})];data.dailyGoal=5;assert.ok(core.dailySelection(data,bank).includes(target.id));
});
test('malformed backup attempts fail with readable validation instead of property access errors',()=>{
  assert.throws(()=>core.validate({...core.empty(),attempts:[null]},bank),/答题记录无效/);
});

test('received catalogue has 101 contiguous topics, seven units and honest pending fields',()=>{assert.equal(bank.curriculum.topics.length,101);assert.equal(bank.curriculum.units.length,7);bank.curriculum.topics.forEach((t,i)=>{assert.equal(t.number,i+1);assert.equal(t.bookPage,null);assert.ok(['photo-03','photo-04','photo-05','photo-06'].includes(t.sourcePhoto));});assert.equal(bank.curriculum.topics.filter(t=>t.lesson).length,13);});
test('first unit has three new original questions per topic and stable references',()=>{const added=bank.questions.filter(q=>q.id.startsWith('tb-u1-'));assert.equal(added.length,39);for(const t of bank.curriculum.topics.slice(0,13)){assert.equal(added.filter(q=>q.textbookTopicId===t.id).length,3);assert.ok(t.lesson.connection&&t.lesson.meaning&&t.lesson.pitfall);}for(const q of bank.questions.filter(q=>q.textbookTopicId))assert.ok(bank.curriculum.topics.some(t=>t.id===q.textbookTopicId));});
test('backups from the original forty-question version continue to load',()=>{const data=core.empty();data.attempts=[attempt()];const loaded=core.load({getItem:()=>JSON.stringify(data)},bank);assert.equal(loaded.writable,true);assert.equal(loaded.data.attempts[0].questionId,q.id);});
