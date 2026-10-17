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
const progressTrack = document.querySelector('#progress-track');
const progressLabel = document.querySelector('#progress-label');
const title = document.querySelector('#question-title');
const translation = document.querySelector('#question-translation');
const choices = document.querySelector('#choices');
const feedback = document.querySelector('#feedback');
const form = document.querySelector('#answer-form');
const submitButton = document.querySelector('#submit-button');
const nextButton = document.querySelector('#next-button');
const actionHint = document.querySelector('#action-hint');
const questionArea = document.querySelector('#question-area');
const resultPanel = document.querySelector('#result-panel');
const resultCopy = document.querySelector('#result-copy');
const scoreNumber = document.querySelector('#score-number');
const completedStat = document.querySelector('#completed-stat');
const miniDots = [...document.querySelectorAll('#mini-dots i')];

let current = 0;
let score = 0;
let answered = false;

function updateProgress(completed) {
  const percent = (completed / questions.length) * 100;
  fill.style.width = `${percent}%`;
  progressTrack.setAttribute('aria-valuenow', String(completed));
  progressLabel.textContent = `${completed} / ${questions.length} 已完成`;
  completedStat.textContent = String(completed);
  miniDots.forEach((dot, index) => dot.classList.toggle('is-done', index < completed));
}

function renderQuestion() {
  const question = questions[current];
  count.innerHTML = `<strong>${String(current + 1).padStart(2, '0')}</strong><span> / ${String(questions.length).padStart(2, '0')}</span>`;
  title.textContent = question.prompt;
  translation.textContent = question.translation;
  feedback.hidden = true;
  feedback.classList.remove('wrong');
  feedback.textContent = '';
  actionHint.textContent = '选择一个答案继续';
  answered = false;
  submitButton.hidden = false;
  nextButton.hidden = true;
  choices.querySelectorAll('.choice').forEach(choice => choice.remove());

  question.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'answer';
    input.value = String(index);
    const letter = document.createElement('span');
    letter.className = 'choice-letter';
    letter.textContent = String.fromCharCode(65 + index);
    const text = document.createElement('span');
    text.className = 'choice-text';
    text.textContent = option;
    label.append(input, letter, text);
    choices.append(label);
  });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (answered) return;

  const selected = form.querySelector('input[name="answer"]:checked');
  if (!selected) {
    feedback.textContent = '先选一个答案，再继续练习吧。';
    feedback.classList.add('wrong');
    feedback.hidden = false;
    return;
  }

  answered = true;
  const question = questions[current];
  const chosen = Number(selected.value);
  const isCorrect = chosen === question.answer;
  if (isCorrect) score += 1;

  choices.querySelectorAll('.choice').forEach((label, index) => {
    const input = label.querySelector('input');
    input.disabled = true;
    if (index === question.answer) label.classList.add('correct');
    if (index === chosen && !isCorrect) label.classList.add('incorrect');
  });

  updateProgress(current + 1);
  feedback.textContent = `${isCorrect ? '答对了，いいですね！' : `正确答案是「${question.options[question.answer]}」。`}${question.note}`;
  feedback.classList.toggle('wrong', !isCorrect);
  feedback.hidden = false;
  actionHint.textContent = isCorrect ? '理解比速度更重要' : '记住这个小知识点';
  submitButton.hidden = true;
  nextButton.hidden = false;
  nextButton.innerHTML = current === questions.length - 1 ? '查看练习结果 <span aria-hidden="true">→</span>' : '继续练习 <span aria-hidden="true">→</span>';
});

nextButton.addEventListener('click', () => {
  current += 1;
  if (current < questions.length) {
    renderQuestion();
    title.focus();
    return;
  }

  questionArea.hidden = true;
  resultPanel.hidden = false;
  scoreNumber.textContent = String(score);
  const message = score === questions.length
    ? '全部答对，今天的积累很棒。继续保持自己的节奏。'
    : score >= 3
      ? '基础掌握得不错。看看解析，再练一次会更牢。'
      : '每一次练习都在进步。复习解析，再来一轮吧。';
  resultCopy.textContent = message;
  document.querySelector('#result-title').focus?.();
});

document.querySelector('#restart-button').addEventListener('click', () => {
  current = 0;
  score = 0;
  updateProgress(0);
  resultPanel.hidden = true;
  questionArea.hidden = false;
  renderQuestion();
  title.focus();
});

renderQuestion();
