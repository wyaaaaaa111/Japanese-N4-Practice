'use strict';
const questions = [
  { prompt: '日本へ行く＿＿、パスポートを準備してください。', translation: '去日本之前，请准备好护照。', options: ['まえに', 'あとで', 'ながら', 'まで'], answer: 0, note: '「动词辞书形＋まえに」表示“做某事之前”。' },
  { prompt: '雨が降っている＿＿、出かけました。', translation: '虽然正在下雨，还是出门了。', options: ['から', 'のに', 'ので', 'ために'], answer: 1, note: '「のに」表示“虽然……却……”，常用来表达意外或不满。' },
  { prompt: 'この漢字の読み方を先生に＿＿ました。', translation: '我向老师请教了这个汉字的读法。', options: ['教えて', '習って', '聞いて', '言って'], answer: 2, note: '「人に聞く」可以表示“向某人询问”。' },
  { prompt: '毎日練習すれば、上手に＿＿と思います。', translation: '如果每天练习，我想就会变得擅长。', options: ['なる', 'する', 'いる', 'ある'], answer: 0, note: '「上手になる」表示“变得擅长”；「ば」表达假设条件。' },
  { prompt: '私はコーヒー＿＿紅茶のほうが好きです。', translation: '比起咖啡，我更喜欢红茶。', options: ['まで', 'より', 'しか', 'ほど'], answer: 1, note: '比较时使用「AよりBのほうが好き」表示“比起 A，更喜欢 B”。' }
];
const count = document.querySelector('#question-count');
const fill = document.querySelector('#progress-fill');
const progress = document.querySelector('#progress-track');
const title = document.querySelector('#question-title');
const translation = document.querySelector('#question-translation');
const choices = document.querySelector('#choices');
const feedback = document.querySelector('#feedback');
const form = document.querySelector('#answer-form');
const submitButton = document.querySelector('#submit-button');
const nextButton = document.querySelector('#next-button');
const questionArea = document.querySelector('#question-area');
const resultPanel = document.querySelector('#result-panel');
const resultCopy = document.querySelector('#result-copy');
let current = 0;
let score = 0;
let answered = false;
function renderQuestion() {
  const q = questions[current];
  count.innerHTML = `第 ${current + 1} 题 <span>/ ${questions.length}</span>`;
  fill.style.width = `${(current / questions.length) * 100}%`;
  progress.setAttribute('aria-valuenow', String(current));
  title.textContent = q.prompt;
  translation.textContent = q.translation;
  feedback.hidden = true;
  feedback.classList.remove('wrong');
  feedback.textContent = '';
  answered = false;
  submitButton.hidden = false;
  nextButton.hidden = true;
  choices.querySelectorAll('.choice').forEach(node => node.remove());
  q.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'choice';
    label.innerHTML = `<input type="radio" name="answer" value="${index}"><span class="choice-letter">${String.fromCharCode(65 + index)}</span><span class="choice-text"></span>`;
    label.querySelector('.choice-text').textContent = option;
    choices.append(label);
  });
}
form.addEventListener('submit', event => {
  event.preventDefault();
  if (answered) return;
  const selected = form.querySelector('input[name="answer"]:checked');
  if (!selected) {
    feedback.textContent = '请先选择一个答案，再提交哦。';
    feedback.classList.add('wrong');
    feedback.hidden = false;
    return;
  }
  answered = true;
  const q = questions[current];
  const chosen = Number(selected.value);
  if (chosen === q.answer) score += 1;
  choices.querySelectorAll('.choice').forEach((label, index) => {
    label.querySelector('input').disabled = true;
    if (index === q.answer) label.classList.add('correct');
    if (index === chosen && chosen !== q.answer) label.classList.add('incorrect');
  });
  feedback.textContent = `${chosen === q.answer ? '回答正确！' : `正确答案是「${q.options[q.answer]}」。`}${q.note}`;
  feedback.classList.toggle('wrong', chosen !== q.answer);
  feedback.hidden = false;
  submitButton.hidden = true;
  nextButton.hidden = false;
  nextButton.innerHTML = current === questions.length - 1 ? '查看成绩 <span aria-hidden="true">→</span>' : '下一题 <span aria-hidden="true">→</span>';
});
nextButton.addEventListener('click', () => {
  current += 1;
  if (current < questions.length) {
    renderQuestion();
    title.focus?.();
  } else {
    fill.style.width = '100%';
    progress.setAttribute('aria-valuenow', String(questions.length));
    questionArea.hidden = true;
    resultPanel.hidden = false;
    resultCopy.textContent = `你答对了 ${score} / ${questions.length} 题。${score === questions.length ? '太棒了，全部答对！' : '复习一下解析，再练一次会更熟练。'}`;
  }
});
document.querySelector('#restart-button').addEventListener('click', () => {
  current = 0;
  score = 0;
  resultPanel.hidden = true;
  questionArea.hidden = false;
  renderQuestion();
});
renderQuestion();
