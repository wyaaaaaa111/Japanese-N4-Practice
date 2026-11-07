(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.N4Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const KEY = 'kotoba-n4-v2';
  const empty = () => ({ schemaVersion:2, attempts:[], exams:[], session:null, dailyGoal:5 });
  const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  function validate(data, bank) {
    if (!data || data.schemaVersion !== 2 || !Array.isArray(data.attempts) || !Array.isArray(data.exams) || data.attempts.length > 50000 || data.exams.length > 5000) throw Error('备份格式或版本不支持。');
    const seen = new Set(), sessionQuestions = new Set();
    const attempts = data.attempts.map(a => {
      const q = bank.questions.find(q=>a&&q.id===a.questionId);
      if (!a || typeof a.id !== 'string' || !a.id || a.id.length>160 || seen.has(a.id) || !q || a.revision!==q.revision || !['daily','grammar','vocabulary','reading','listening','legacy','review','exam'].includes(a.mode) || typeof a.sessionId!=='string' || !iso(a.at) || !q.options.some(o=>o.id===a.choice)) throw Error('答题记录无效或题目版本不兼容。');
      const pair = JSON.stringify([a.sessionId,a.questionId]);
      if (sessionQuestions.has(pair)) throw Error('同一练习存在重复作答记录。');
      seen.add(a.id); sessionQuestions.add(pair);
      return {id:a.id, questionId:q.id, revision:q.revision, choice:a.choice, correct:a.choice===q.correctOptionId, at:a.at, mode:a.mode, sessionId:a.sessionId};
    }).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const examSeen = new Set();
    const exams = data.exams.map(e=>{
      if (!e || typeof e.id!=='string' || examSeen.has(e.id) || !iso(e.at) || !Number.isInteger(e.total) || e.total<1 || e.total>bank.questions.length || !Number.isInteger(e.score) || e.score<0 || e.score>e.total || !Array.isArray(e.ids) || e.ids.length!==e.total || new Set(e.ids).size!==e.total || e.ids.some(id=>!bank.questions.some(q=>q.id===id))) throw Error('自测记录无效。');
      const result = attempts.filter(a=>a.mode==='exam' && a.sessionId===e.id);
      if (new Set(result.map(a=>a.questionId)).size!==result.length || result.some(a=>!e.ids.includes(a.questionId)) || result.filter(a=>a.correct).length!==e.score) throw Error('自测分数与答题记录不一致。');
      examSeen.add(e.id); return {id:e.id, at:e.at, total:e.total, score:e.score, ids:[...e.ids]};
    });
    return {schemaVersion:2, attempts, exams, session:null, dailyGoal:[5,10,15].includes(data.dailyGoal)?data.dailyGoal:5};
  }
  function restoreSession(s, bank, attempts) {
    if (!s) return null;
    if (typeof s.id!=='string' || !['daily','grammar','vocabulary','reading','listening','legacy','review','exam'].includes(s.mode) || !Array.isArray(s.ids) || !s.ids.length || s.ids.length>bank.questions.length || new Set(s.ids).size!==s.ids.length || s.ids.some(id=>!bank.questions.some(q=>q.id===id)) || !Number.isInteger(s.index) || s.index<0 || s.index>=s.ids.length || !s.answers || typeof s.answers!=='object' || Array.isArray(s.answers)) return null;
    if (s.mode==='exam' && (!Number.isFinite(s.deadline) || s.deadline<=0)) return null;
    const answers={};
    for (const [id,choice] of Object.entries(s.answers)) {
      const q=bank.questions.find(q=>q.id===id);
      if (!s.ids.includes(id) || !q.options.some(o=>o.id===choice)) return null;
      answers[id]=choice;
    }
    if (s.mode!=='exam' && Object.keys(answers).some(id=>!attempts.some(a=>a.sessionId===s.id && a.questionId===id && a.choice===answers[id]))) return null;
    return {id:s.id, mode:s.mode, ids:[...s.ids], index:s.index, answers, deadline:s.mode==='exam'?s.deadline:null};
  }
  function load(storage, bank) {
    try {
      const raw=storage.getItem(KEY); if (!raw) return {data:empty(), writable:true};
      const parsed=JSON.parse(raw), data=validate(parsed,bank);
      data.session=restoreSession(parsed.session,bank,data.attempts);
      return {data,writable:true,warning:parsed.session&&!data.session?'未完成练习无法恢复，已保留答题历史。':''};
    } catch (_) { return {data:empty(),writable:false,warning:'原记录无法读取。本次先在当前页面练习，不覆盖原记录；可先导出原始记录备份。'}; }
  }
  function save(storage, data) { try {storage.setItem(KEY,JSON.stringify(data));return true;} catch(_){return false;} }
  function record(data, attempt) {
    if (data.attempts.some(a=>a.id===attempt.id || (a.sessionId===attempt.sessionId && a.questionId===attempt.questionId))) return false;
    data.attempts.push(attempt);return true;
  }
  function stats(data, bank, now=new Date()) {
    const localDate = d=>`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    const today=localDate(now), first=new Map(), latest=new Map(), errors=new Map();
    for (const a of [...data.attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))) {
      if (!first.has(a.questionId)) first.set(a.questionId,a);
      latest.set(a.questionId,a);
      if (!a.correct) errors.set(a.questionId,(errors.get(a.questionId)||0)+1);
    }
    return {today:data.attempts.filter(a=>localDate(new Date(a.at))===today).length,
      total:data.attempts.length, learned:first.size, firstCorrect:[...first.values()].filter(a=>a.correct).length,
      wrong:[...latest.values()].filter(a=>!a.correct).map(a=>a.questionId), errors,
      skills:Object.keys(bank.labels).map(skill=>{const all=bank.questions.filter(q=>q.skill===skill), entries=[...first.values()].filter(a=>all.some(q=>q.id===a.questionId));return {skill,total:all.length,done:entries.length,correct:entries.filter(a=>a.correct).length};})};
  }
  function reviewPlan(data, bank, now=new Date()) {
    const groups=new Map();
    for(const a of [...data.attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){if(!groups.has(a.questionId))groups.set(a.questionId,[]);groups.get(a.questionId).push(a);}
    return [...groups].map(([id,entries])=>{
      const last=entries[entries.length-1];let successes=0,previousDay='';
      for(let i=entries.length-1;i>=0;i--){const a=entries[i];if(!a.correct)break;const d=new Date(a.at),day=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;if(day!==previousDay){successes++;previousDay=day;}}
      const days=last.correct?[1,3,7,14,30][Math.min(Math.max(successes-1,0),4)]:0;
      const dueAt=new Date(last.at);dueAt.setDate(dueAt.getDate()+days);
      return {id,lastAt:last.at,correct:last.correct,successes,days,dueAt:dueAt.toISOString(),due:dueAt<=now};
    }).filter(item=>bank.questions.some(q=>q.id===item.id)).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
  }
  function activity(data,now=new Date()) {
    const key=d=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const map=new Map();for(const a of data.attempts){const day=key(new Date(a.at));if(!map.has(day))map.set(day,new Set());map.get(day).add(a.questionId);}
    const days=[];for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);days.push({date:key(d),label:`${d.getMonth()+1}/${d.getDate()}`,count:map.get(key(d))?.size||0});}
    let streak=0,cursor=new Date(now);if(!map.has(key(cursor)))cursor.setDate(cursor.getDate()-1);
    while(map.has(key(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
    return {days,streak,todayUnique:map.get(key(now))?.size||0};
  }
  function dailySelection(data,bank,now=new Date(),random=Math.random) {
    const plan=new Map(reviewPlan(data,bank,now).map(r=>[r.id,r]));
    const goal=[5,10,15].includes(data.dailyGoal)?data.dailyGoal:5;
    const result=[];
    for(const [skill,base] of [['grammar',2],['vocabulary',2],['reading',1]]){
      const ranked=bank.questions.filter(q=>q.skill===skill&&q.source.type!=='legacy').map(q=>{const r=plan.get(q.id);return {q,tie:random(),priority:r?.due?0:!r?1:2,time:r?Date.parse(r.lastAt):0};});
      ranked.sort((a,b)=>a.priority-b.priority || (a.priority===2?a.time-b.time:0) || a.tie-b.tie);
      result.push(...ranked.slice(0,base*goal/5).map(x=>x.q.id));
    }
    return result;
  }
  return {KEY,empty,validate,restoreSession,load,save,record,stats,reviewPlan,activity,dailySelection};
});
