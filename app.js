'use strict';
(() => {
  const bank = N4Bank, core = N4Core, $ = s => document.querySelector(s);
  const storage = {getItem:k=>localStorage.getItem(k), setItem:(k,v)=>localStorage.setItem(k,v)};
  const loaded = core.load(storage, bank);
  let data = loaded.data, writable = loaded.writable, view = 'practice', lastResult = null, importCandidate = null;
  let voices = [], utterance = null;
  const workspace = $('#workspace');
  const byId = id => bank.questions.find(q=>q.id===id);
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function el(tag, text, cls) {const e=document.createElement(tag); if(text!==undefined)e.textContent=text; if(cls)e.className=cls; return e;}
  function button(text, fn, secondary=false) {const b=el('button',text,`button ${secondary?'button-secondary':'button-primary'}`);b.type='button';b.addEventListener('click',fn);return b;}
  function notice(text) {$('#storage-notice').textContent=text;$('#storage-notice').hidden=!text;}
  if(loaded.warning) notice(loaded.warning);
  function persist() {if(writable && !core.save(storage,data)){writable=false;notice('本次记录暂时无法保存。请在离开前导出备份；刷新可能丢失本次进度。');}}
  window.addEventListener('storage',event=>{if(event.key===core.KEY){writable=false;notice('另一个页面更新了学习记录。本页已暂停写入以避免相互覆盖；请先导出本页备份，再刷新读取最新记录。');}});
  function heading(title, sub='YOUR LEARNING JOURNEY') {workspace.append(el('p',sub,'topic-eyebrow'));const h=el('h2',title,'panel-title');h.tabIndex=-1;workspace.append(h);return h;}
  function stopAudio(){if('speechSynthesis' in window) speechSynthesis.cancel();utterance=null;}
  function stats(){return core.stats(data,bank);}
  function refreshAside(){const original=bank.questions.filter(q=>q.source.type==='original').length;$('#bank-summary').textContent=bank.questions.length+' 道练习 · 保留原有 5 题 · '+original+' 道原创题 · 非官方试题';const s=stats();$('#today-stat').textContent=s.today;$('#wrong-badge').textContent=s.wrong.length;}
  function render(focus=false){
    stopAudio();workspace.replaceChildren();refreshAside();
    document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    if(view==='stats')renderStats();else if(view==='review')renderReview();else if(view==='exam')renderExamHome();else if(view==='curriculum')renderCurriculum();else if(lastResult)renderResult(lastResult);else if(data.session)renderQuestion();else renderHome();
    const focusTarget=workspace.querySelector('h2,h3');if(focusTarget)focusTarget.tabIndex=-1;
    if(focus)focusTarget?.focus();
  }
  function showView(next){view=next;lastResult=null;render(true);}
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  function shuffle(arr){const result=[...arr];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
  function dailyIds(){return shuffle(core.dailySelection(data,bank));}
  function start(mode,ids){
    if(data.session){notice('你还有一组未完成练习。请先继续完成；学习记录会自动保存。');view='practice';render(true);return;}
    if(!ids.length)return;
    lastResult=null;data.session={id:uid(),mode,ids,index:0,answers:{},deadline:mode==='exam'?Date.now()+12*60*1000:null};persist();view='practice';render(true);
  }
  function sectionCopy(text){workspace.append(el('p',text,'panel-copy'));}
  function renderHome(){
    heading('今天，从五分钟开始。');sectionCopy('先复习到期的表达，再认识新的知识点。每一组都从你的学习记录出发。');
    const activity=core.activity(data),plan=core.reviewPlan(data,bank),goal=data.dailyGoal||5;
    const planBox=el('section',undefined,'daily-plan');const planTop=el('div',undefined,'plan-top');planTop.append(el('span','今天的小目标','aside-label'));
    const goalLabel=el('label','每日题数 '),goalSelect=el('select');goalSelect.setAttribute('aria-label','每日学习目标');for(const n of [5,10,15]){const option=el('option',n+' 题');option.value=n;option.selected=n===goal;goalSelect.append(option);}goalSelect.addEventListener('change',()=>{data.dailyGoal=Number(goalSelect.value);persist();render();});goalLabel.append(goalSelect);planTop.append(goalLabel);planBox.append(planTop);
    planBox.append(el('p',activity.todayUnique+' / '+goal+' 道不同题目 · 连续学习 '+activity.streak+' 天','goal-copy'));
    const meter=el('div',undefined,'goal-meter');meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','今日目标进度');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',goal);meter.setAttribute('aria-valuenow',Math.min(activity.todayUnique,goal));const bar=el('span');bar.style.width=Math.min(activity.todayUnique/goal*100,100)+'%';meter.append(bar);planBox.append(meter);
    planBox.append(el('p',activity.todayUnique>=goal?'今日目标已完成。可以复习解析，也可以继续保持节奏。':'今日练习优先选择到期复习与未练过的题目。重复作答不会重复计入每日题目目标。','muted'));
    const due=plan.filter(r=>r.due);if(due.length)planBox.append(button('复习到期的 '+due.length+' 题',()=>start('review',due.map(r=>r.id)),true));workspace.append(planBox);
    const hero=el('div',undefined,'daily-box');hero.append(el('span','本组 '+(data.dailyGoal||5)+' 题 · 词汇 / 语法 / 阅读','muted'));hero.append(button('开始今日练习 ↗',()=>start('daily',dailyIds())));workspace.append(hero);
    const grid=el('div',undefined,'module-grid');
    for(const [skill,label] of Object.entries(bank.labels)){
      const qs=bank.questions.filter(q=>q.skill===skill && q.source.type!=='legacy');const card=el('div',undefined,'module-card');
      card.append(el('h3',label),el('p',`${qs.length} 道原创练习${skill==='listening'?' · 合成语音':''}`));
      const controls=el('div',undefined,'module-controls');const tags=el('select');tags.setAttribute('aria-label',label+'知识点');const all=el('option','全部知识点');all.value='';tags.append(all);for(const tag of new Set(qs.flatMap(q=>q.tags))){const option=el('option',tag);option.value=tag;tags.append(option);}const amount=el('select');amount.setAttribute('aria-label',label+'练习题数');for(const [value,text] of [['5','每组 5 题'],['10','每组 10 题'],['all','本专项全部']]){const option=el('option',text);option.value=value;amount.append(option);}controls.append(tags,amount);card.append(controls);const available=el('p','', 'selection-count');available.setAttribute('role','status');const updateCount=()=>{const n=qs.filter(q=>!tags.value||q.tags.includes(tags.value)).length;available.textContent='本组 '+Math.min(n,amount.value==='all'?n:Number(amount.value))+' 题';};tags.addEventListener('change',updateCount);amount.addEventListener('change',updateCount);updateCount();card.append(available);
      card.append(button('开始练习 →',()=>{const selected=shuffle(qs.filter(q=>!tags.value||q.tags.includes(tags.value)));start(skill,selected.slice(0,amount.value==='all'?selected.length:Number(amount.value)).map(q=>q.id));},true));grid.append(card);
    }workspace.append(grid);
    const route=el('div',undefined,'route-callout');route.append(el('h3','跟着自己的教材学'),el('p','已整理收到的七单元、101 项 N4 目录。查看已有学习卡、练习与待补充项目。'),button('打开教材路线 →',()=>showView('curriculum'),true));workspace.append(route);
    const legacy=el('div',undefined,'legacy-row');legacy.append(el('p','原有五题完整保留 · 按中文译意作答 · 来源待核实'));legacy.append(button('重温原版五题',()=>start('legacy',bank.questions.filter(q=>q.source.type==='legacy').map(q=>q.id)),true));workspace.append(legacy);
  }
  function renderCurriculum(){
    const c=bank.curriculum;heading('把教材，变成自己的学习路线。','MY TEXTBOOK ROADMAP');sectionCopy('根据你提供的目录照片整理。已收到七单元、101 项 N4 目录；不能据此确认全书目录完整。学习卡与题目为原创整理，目录项目有题也不代表已覆盖该项目全部用法。');
    const coverage=c.topics.filter(t=>bank.questions.some(q=>q.textbookTopicId===t.id)).length;
    const summary=el('div',undefined,'review-overview');summary.append(el('span','已收录 '+c.topics.length+' 项'),el('span','有相关练习 '+coverage+' 项'),el('span','有学习卡 '+c.topics.filter(t=>t.lesson).length+' 项'));workspace.append(summary);
    const filters=el('div',undefined,'curriculum-filters'),unit=el('select'),search=el('input');unit.setAttribute('aria-label','教材单元');const all=el('option','全部单元');all.value='';unit.append(all);for(const u of c.units){const o=el('option','第 '+u.id+' 单元 · '+u.title);o.value=u.id;unit.append(o);}search.type='search';search.placeholder='搜索语法，例如：被动、ながら';search.setAttribute('aria-label','搜索教材知识点');filters.append(unit,search);workspace.append(filters);
    const results=el('div');workspace.append(results);
    function draw(){results.replaceChildren();let matches=0;for(const u of c.units){if(unit.value&&u.id!==Number(unit.value))continue;const needle=search.value.trim().toLowerCase();const topics=c.topics.filter(t=>t.unit===u.id&&(!needle||(t.number+' '+t.title+' '+(t.lesson?.meaning||'')).toLowerCase().includes(needle)));if(!topics.length)continue;matches+=topics.length;
      const section=el('section',undefined,'curriculum-unit');section.append(el('h3','第 '+u.id+' 单元 · '+u.title,'subheading'));
      const ids=bank.questions.filter(q=>topics.some(t=>q.textbookTopicId===t.id)).map(q=>q.id);if(ids.length)section.append(button('练习本单元（'+ids.length+' 题）',()=>start('grammar',ids),true));
      for(const t of topics){const qs=bank.questions.filter(q=>q.textbookTopicId===t.id),done=new Set(data.attempts.filter(a=>qs.some(q=>q.id===a.questionId)).map(a=>a.questionId)).size;
        const d=el('details',undefined,'topic-card');d.append(el('summary',String(t.number).padStart(3,'0')+' · '+t.title+' · '+(qs.length?qs.length+' 题 / 已练 '+done+' 题':'练习待补充')));
        d.append(el('p','目录来源：用户提供照片 '+t.sourcePhoto.replace('photo-','')+' · 书名版次与正文页码待核对','muted'));if(t.note)d.append(el('p',t.note,'topic-caution'));
        if(t.lesson){const l=t.lesson;d.append(el('p','接续：'+l.connection),el('p','用法：'+l.meaning),el('p',l.example,'lesson-example'),el('p',l.translation,'muted'),el('p','易混提醒：'+l.pitfall),el('p',l.source,'muted'));}else d.append(el('p','完整学习卡待补充。当前只有目录标题，不能当作已经讲解完该知识点。','muted'));
        if(qs.length)d.append(button('练习此知识点（'+qs.length+' 题）',()=>start('grammar',qs.map(q=>q.id))));else d.append(el('p','尚无题目，不会用其他知识点的题目替代。','muted'));section.append(d);
      }results.append(section);
    }if(!matches)results.append(el('p','没有找到匹配项目，可以换个关键词或单元。','empty-state'));}
    unit.addEventListener('change',draw);search.addEventListener('input',draw);draw();
  }
  function renderQuestion(){
    const s=data.session,q=byId(s.ids[s.index]), exam=s.mode==='exam',answered=Object.hasOwn(s.answers,q.id),chosen=s.answers[q.id];
    const head=el('div',undefined,'quiz-heading');const copy=el('div',undefined,'topic-copy');copy.append(el('p',exam?'MINI PRACTICE TEST':'TODAY’S PRACTICE','topic-eyebrow'),el('h2',`${s.mode==='review'?'错题复习 · ':''}${bank.labels[q.skill]}`));head.append(el('div',q.skill==='reading'?'読':q.skill==='listening'?'聴':'文','topic-mark'),copy,el('span',`${s.index+1} / ${s.ids.length}`,'question-number'));workspace.append(head);
    if(exam){const timer=el('p','', 'exam-timer');timer.id='timer';workspace.append(timer);updateClock();}
    const wrap=el('div',undefined,'progress-wrap'), meta=el('div',undefined,'progress-meta');meta.append(el('span',exam?'已作答':'练习进度'),el('span',`${Object.keys(s.answers).length} / ${s.ids.length}`));
    const track=el('div',undefined,'progress-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label','作答进度');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',s.ids.length);track.setAttribute('aria-valuenow',Object.keys(s.answers).length);const fill=el('span');fill.style.width=`${Object.keys(s.answers).length/s.ids.length*100}%`;track.append(fill);wrap.append(meta,track);workspace.append(wrap);
    workspace.append(el('p',`${q.tags.join(' / ')} · ${q.source.type==='legacy'?'原有练习，来源待核实':'原创练习，非官方试题'}`,'source-label'));
    if(q.textbookTopicId&&!exam){const topic=bank.curriculum.topics.find(t=>t.id===q.textbookTopicId);const info=el('details',undefined,'translation-detail');info.append(el('summary','对应教材目录 '+topic.number+' · '+topic.title));if(topic.lesson){info.append(el('p','接续：'+topic.lesson.connection),el('p',topic.lesson.meaning),el('p','易混提醒：'+topic.lesson.pitfall));}else info.append(el('p','这道题与该目录项目相关，完整学习卡待补充。'));workspace.append(info);}
    if(q.materialId){const m=bank.materials[q.materialId];if(m.type==='reading'){const block=el('section',undefined,'passage');block.append(el('h3',m.title),el('p',m.text));workspace.append(block);}else renderAudio(m);}
    const title=el('h3',q.prompt,'question-title');title.tabIndex=-1;title.lang='ja';workspace.append(title);
    if(!exam && (q.source.type==='legacy'||answered))workspace.append(el('p',q.translation,'translation-line'));
    else if(!exam){const d=el('details',undefined,'translation-detail');d.append(el('summary','查看中文提示'),el('p',q.translation));workspace.append(d);}
    const form=el('form');form.id='answer-form';const choices=el('fieldset',undefined,'choices');choices.append(el('legend','答案选项','visually-hidden'));
    q.options.forEach((opt,i)=>{const label=el('label',undefined,'choice');const input=el('input');input.type='radio';input.name='answer';input.value=opt.id;input.checked=chosen===opt.id;input.disabled=answered&&!exam;
      if(answered&&!exam){if(opt.id===q.correctOptionId)label.classList.add('correct');if(opt.id===chosen && chosen!==q.correctOptionId)label.classList.add('incorrect');}
      input.addEventListener('change',()=>{if(exam){s.answers[q.id]=opt.id;persist();refreshExamProgress();}});label.append(input,el('span',String.fromCharCode(65+i),'choice-letter'),el('span',opt.text,'choice-text'));choices.append(label);});form.append(choices);
    const feedback=el('p','', 'feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.hidden=true;form.append(feedback);
    if(answered&&!exam){feedback.hidden=false;feedback.classList.toggle('wrong',chosen!==q.correctOptionId);feedback.textContent=`${chosen===q.correctOptionId?'答对了，いいですね！':'正确答案是「'+q.options.find(o=>o.id===q.correctOptionId).text+'」。'} ${q.explanation}`;if(q.materialId)materialTranslation(q);}
    const actions=el('div',undefined,'quiz-actions');
    if(exam){
      if(s.index>0)actions.append(button('上一题',()=>{s.index--;persist();render(true);},true));
      if(s.index<s.ids.length-1)actions.append(button('下一题 →',()=>{s.index++;persist();render(true);}));
      actions.append(button('交卷',()=>{
        const unanswered=s.ids.length-Object.keys(s.answers).length;
        if(unanswered){feedback.hidden=false;feedback.textContent=`还有 ${unanswered} 题未答，未答按错误计。`;const confirm=button('仍然交卷',()=>finishExam());feedback.replaceChildren(el('span',feedback.textContent),confirm);return;}finishExam();
      },true));
    }else if(answered)actions.append(button(s.index===s.ids.length-1?'查看练习结果 →':'继续练习 →',()=>{if(s.index<s.ids.length-1){s.index++;persist();render(true);}else finishPractice();}));
    else {const submit=el('button','确认答案 ↗','button button-primary');submit.type='submit';actions.append(el('span','选择一个答案继续','action-hint'),submit);}
    form.append(actions);form.addEventListener('submit',e=>{e.preventDefault();if(exam||Object.hasOwn(s.answers,q.id))return;const selected=form.querySelector('input:checked');if(!selected){feedback.hidden=false;feedback.textContent='先选一个答案，再继续练习吧。';return;}s.answers[q.id]=selected.value;core.record(data,{id:`${s.id}:${q.id}`,sessionId:s.id,questionId:q.id,revision:q.revision,choice:selected.value,correct:selected.value===q.correctOptionId,at:new Date().toISOString(),mode:s.mode});persist();render();workspace.querySelector('.feedback')?.scrollIntoView({block:'nearest'});});workspace.append(form);
    if(q.skill==='listening')updateVoiceUI();
    const tail=el('p','可切换到学习足迹查看统计；返回每日练习可继续。','session-note');workspace.append(tail);
    if(!exam){const ending=el('div',undefined,'end-session');ending.append(button('结束本组',()=>{ending.replaceChildren(el('p','结束本组后，已提交的答案与错题仍会保留。'),button('确认结束本组',()=>{const ids=s.ids.filter(id=>Object.hasOwn(s.answers,id));lastResult=ids.length?{...s,ids,score:ids.filter(id=>s.answers[id]===byId(id).correctOptionId).length,exam:false}:null;data.session=null;persist();render(true);},true),button('继续作答',()=>render(),true));},true));workspace.append(ending);}
  }
  function refreshExamProgress(){const s=data.session;if(!s)return;const track=workspace.querySelector('[role="progressbar"]'),n=Object.keys(s.answers).length;if(track){track.setAttribute('aria-valuenow',n);track.firstChild.style.width=`${n/s.ids.length*100}%`;workspace.querySelector('.progress-meta').lastChild.textContent=`${n} / ${s.ids.length}`;}}
  function materialTranslation(q){const m=bank.materials[q.materialId],d=el('details',undefined,'translation-detail');d.append(el('summary',m.type==='listening'?'查看听力文稿与翻译':'查看文章翻译'));if(m.type==='listening')d.append(el('p',m.text,'transcript'));d.append(el('p',m.translation));workspace.append(d);}
  function renderAudio(m){
    const box=el('div',undefined,'audio-box');box.append(el('p',`听力练习 · ${m.title} · 日语合成语音`));
    const p=el('p','', 'muted');p.id='voice-status';box.append(p);
    const play=button('播放日语 ▶',()=>{stopAudio();const voice=voices.find(v=>/^ja(?:-|_)/i.test(v.lang));if(!voice){p.textContent='当前浏览器无可用日语语音。正式音频待补充；可换支持日语语音的浏览器。';return;}utterance=new SpeechSynthesisUtterance(m.text);utterance.lang='ja-JP';utterance.voice=voice;utterance.rate=.85;utterance.onstart=()=>p.textContent='正在播放…';utterance.onend=()=>p.textContent='播放结束，可以再听一次。';utterance.onerror=()=>p.textContent='播放失败，请重试。正式音频待补充。';speechSynthesis.speak(utterance);});play.id='play-audio';
    box.append(play,button('停止',()=>{stopAudio();p.textContent='已停止。';},true));workspace.append(box);updateVoiceUI();
  }
  function updateVoices(){voices='speechSynthesis' in window?speechSynthesis.getVoices():[];updateVoiceUI();}
  function updateVoiceUI(){const p=$('#voice-status'),b=$('#play-audio');if(!p)return;const available=voices.some(v=>/^ja(?:-|_)/i.test(v.lang));p.textContent=available?'由浏览器合成，建议听完再作答。':'当前未检测到日语语音，音频资料待补充。本组暂无法提交，可结束本组后练习其他专项。';if(b)b.disabled=!available;const submit=$('#answer-form button[type="submit"]');if(submit)submit.disabled=!available;}
  function finishPractice(){const s=data.session;if(!s)return;lastResult={...s,score:s.ids.filter(id=>s.answers[id]===byId(id).correctOptionId).length,exam:false};data.session=null;persist();render(true);}
  function finishExam(){const s=data.session;if(!s||s.mode!=='exam')return;const at=new Date().toISOString();
    for(const id of s.ids){const q=byId(id),choice=s.answers[id];if(choice!==undefined)core.record(data,{id:`${s.id}:${id}`,sessionId:s.id,questionId:id,revision:q.revision,choice,correct:choice===q.correctOptionId,at,mode:'exam'});}
    const result={id:s.id,at,total:s.ids.length,score:s.ids.filter(id=>s.answers[id]===byId(id).correctOptionId).length,ids:[...s.ids]};if(!data.exams.some(e=>e.id===s.id))data.exams.push(result);lastResult={...s,score:result.score,exam:true};data.session=null;persist();view='practice';render(true);
  }
  function renderResult(r){heading(r.exam?'阶段自测，完成了。':'今天的练习，完成了。','PRACTICE COMPLETE');const score=el('div',undefined,'result-score');score.append(el('strong',r.score),el('span',` / ${r.ids.length} 答对`));workspace.append(score);sectionCopy(r.exam?'这是原创小型自测的原始成绩，不是 JLPT 官方分数。未答题按错误计。':'看看解析，让今天的表达留下来。');workspace.append(button('回到练习首页',()=>{lastResult=null;render(true);}),button('查看错题',()=>showView('review'),true));
    const missed=r.ids.filter(id=>r.answers[id]!==byId(id).correctOptionId);if(missed.length)workspace.append(button('重练错题与未答题',()=>start('review',missed),true));
    workspace.append(el('h3','逐题回顾','subheading'));r.ids.forEach(id=>{const q=byId(id),d=el('details',undefined,'answer-review');d.append(el('summary',`${r.answers[id]===q.correctOptionId?'✓':'○'} ${q.prompt}`),el('p',`你的选择：${q.options.find(o=>o.id===r.answers[id])?.text||'未作答'}；正确答案：${q.options.find(o=>o.id===q.correctOptionId).text}`),el('p',q.explanation),el('p',q.translation,'muted'));if(q.materialId){const m=bank.materials[q.materialId];d.append(el('p',m.text,'transcript'),el('p',m.translation));}workspace.append(d);});
  }
  function renderReview(){
    heading('让记住的，留得更久。','YOUR REVIEW PLAN');const s=stats(),plan=core.reviewPlan(data,bank),due=plan.filter(r=>r.due&&r.correct),upcoming=plan.filter(r=>!r.due);
    sectionCopy('答错的题立即复习；答对后按 1、3、7、14、30 天安排再次巩固。同一天重复答对不会升级间隔。这是轻量复习安排，不是掌握程度评定。');
    const overview=el('div',undefined,'review-overview');overview.append(el('span','待纠正 '+s.wrong.length+' 题'),el('span','到期巩固 '+due.length+' 题'),el('span','以后复习 '+upcoming.length+' 题'));workspace.append(overview);
    if(!s.wrong.length&&!due.length)workspace.append(el('div','今天没有到期的复习题。可以去练习首页认识新的表达。','empty-state'));
    if(s.wrong.length)workspace.append(button('开始错题复习 ↗',()=>start('review',s.wrong)));
    if(due.length)workspace.append(button('开始到期巩固',()=>start('review',due.map(r=>r.id)),true));
    if(s.wrong.length)workspace.append(el('h3','待纠正','subheading'));
    s.wrong.forEach(id=>{const q=byId(id),card=el('div',undefined,'review-item');card.append(el('span',bank.labels[q.skill]+' · '+q.tags[0]+' · 累计错 '+s.errors.get(id)+' 次','muted'),el('p',q.prompt));workspace.append(card);});
    const scheduled=[...due,...upcoming];if(scheduled.length)workspace.append(el('h3','巩固日程','subheading'));
    scheduled.slice(0,12).forEach(r=>{const q=byId(r.id),card=el('div',undefined,'review-item');card.append(el('span',bank.labels[q.skill]+' · '+q.tags[0]+' · '+(r.due?'已到期':new Date(r.dueAt).toLocaleDateString('zh-CN')),'muted'),el('p',q.prompt));workspace.append(card);});
  }
  function renderStats(){heading('每一点积累，都有痕迹。','YOUR LEARNING FOOTPRINT');const s=stats(),grid=el('div',undefined,'stats-grid');for(const [n,label] of [[s.today,'今日作答次数'],[s.learned,'已练不同题目'],[s.learned?Math.round(s.firstCorrect/s.learned*100)+'%':'—','首次作答正确率'],[s.total,'累计作答次数']]){const c=el('div',undefined,'stat-card');c.append(el('strong',n),el('span',label));grid.append(c);}workspace.append(grid);sectionCopy('首次正确率按每道题最早一次已提交答案计算；重复复习会增加作答次数，不增加已练题数。自测未答题仅计入自测成绩。');
    const activity=core.activity(data);workspace.append(el('h3','近七天 · 连续学习 '+activity.streak+' 天','subheading'));const week=el('div',undefined,'week-grid');for(const day of activity.days){const cell=el('div',undefined,'week-day'+(day.count?' is-active':''));cell.append(el('span',day.label),el('strong',day.count),el('small','道不同题'));week.append(cell);}workspace.append(week);
    for(const item of s.skills){const row=el('div',undefined,'skill-row');row.append(el('strong',bank.labels[item.skill]),el('span',`${item.done} / ${item.total} 题 · 首答 ${item.done?Math.round(item.correct/item.done*100)+'%':'—'}`));workspace.append(row);}
    const dates=new Map();data.attempts.forEach(a=>{const d=new Date(a.at),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;dates.set(key,(dates.get(key)||0)+1);});
    workspace.append(el('h3','最近学习','subheading'));if(!dates.size)sectionCopy('完成第一道题后，这里会显示你的学习记录。');else for(const [date,n] of [...dates].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7)){const row=el('div',undefined,'skill-row');row.append(el('span',date),el('span',`${n} 次作答`));workspace.append(row);}
    workspace.append(el('h3','阶段自测记录','subheading'));if(!data.exams.length)sectionCopy('还没有自测记录。');data.exams.slice(-5).reverse().forEach(e=>{const row=el('div',undefined,'exam-history');row.append(el('p',`${new Date(e.at).toLocaleString('zh-CN')} · ${e.score} / ${e.total}`),button('查看解析',()=>{const answers=Object.fromEntries(data.attempts.filter(a=>a.sessionId===e.id).map(a=>[a.questionId,a.choice]));lastResult={...e,answers,exam:true};view='practice';render(true);},true));workspace.append(row);});
    workspace.append(el('h3','记录备份','subheading'));sectionCopy('记录仅保存在当前浏览器。导入会合并历史记录，保留当前未完成练习；导出文件由你自行保管。');
    const tools=el('div',undefined,'backup-actions');tools.append(button('导出学习备份',()=>download(JSON.stringify(data,null,2),'kotoba-n4-backup.json')),button('导出原始记录',()=>{try{download(storage.getItem(core.KEY)||JSON.stringify(data),'kotoba-n4-raw.json');}catch(_){notice('浏览器禁止读取原始记录，可使用学习备份导出当前会话。');}},true));
    const label=el('label','选择备份文件','button button-secondary'),input=el('input');input.type='file';input.accept='.json,application/json';input.className='visually-hidden';label.append(input);tools.append(label);workspace.append(tools);
    const status=el('p','', 'import-status');status.setAttribute('role','status');workspace.append(status);
    input.addEventListener('change',async()=>{const file=input.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('文件超过 8 MB。');const imported=core.validate(JSON.parse(await file.text()),bank);const all=core.validate(data,bank);const merge=(oldRows,newRows)=>{const map=new Map(oldRows.map(x=>[x.id,x]));for(const row of newRows){if(map.has(row.id)&&JSON.stringify(map.get(row.id))!==JSON.stringify(row))throw Error('备份与本机存在冲突记录，已取消导入。');map.set(row.id,row);}return [...map.values()];};const candidate=core.validate({schemaVersion:2,attempts:merge(all.attempts,imported.attempts),exams:merge(all.exams,imported.exams)},bank);candidate.session=data.session;candidate.dailyGoal=data.dailyGoal||5;importCandidate=candidate;status.replaceChildren(el('span',`可合并 ${candidate.attempts.length-data.attempts.length} 条新作答、${candidate.exams.length-data.exams.length} 条自测。`),button('确认合并',()=>{if(!writable){notice('当前存储受限，为保护原记录，本次无法写入导入数据。');return;}data=importCandidate;importCandidate=null;persist();render(true);if(writable)notice('备份已合并，当前练习保留。');}));}catch(e){importCandidate=null;status.textContent=e instanceof SyntaxError ? '无法导入：文件内容无法识别，请选择导出的学习备份。' : `无法导入：${e.message}`;}input.value='';});
  }
  function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function renderExamHome(){heading('给这一阶段，一个小检查。','MINI PRACTICE TEST');sectionCopy('12 题 · 12 分钟 · 原创词汇、语法和阅读小型自测。交卷后统一展示解析，可以返回修改答案；刷新会继续计时。');sectionCopy('本卷不含听力，不是完整 JLPT 模拟卷。授权音频、完整试卷和官方分数换算均待补充。');
    if(data.session){workspace.append(button('继续未完成练习',()=>{view='practice';render(true);}));return;}
    workspace.append(button('开始阶段自测 ↗',()=>{const ids=[];for(const [skill,n] of [['grammar',5],['vocabulary',4],['reading',3]])ids.push(...shuffle(bank.questions.filter(q=>q.skill===skill&&q.source.type!=='legacy')).slice(0,n).map(q=>q.id));start('exam',shuffle(ids));}));
  }
  function updateClock(){const s=data.session;if(s?.mode!=='exam')return;const seconds=Math.max(0,Math.ceil((s.deadline-Date.now())/1000)),p=$('#timer');if(p)p.textContent=`剩余 ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} · 到时自动交卷`;}
  updateVoices();if('speechSynthesis'in window)speechSynthesis.addEventListener('voiceschanged',updateVoices);
  render();setInterval(()=>{if(data.session?.mode==='exam'){if(Date.now()>=data.session.deadline)finishExam();else updateClock();}},1000);
})();
