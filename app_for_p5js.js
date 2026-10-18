// Paste this file into the p5.js Web Editor as sketch.js.
// Add words.json and free_sound1055.mp3, free_sound1056.mp3, free_sound1057.mp3
// to the editor project. The sketch uses p5.js global mode.

const STORAGE = {
  mastered: "dopanglish.mastered-words.v1",
  mistakes: "dopanglish.mistake-counts.v1",
  history: "dopanglish.answer-history.v1",
  progress: "dopanglish.game-progress.v1",
  best: "dopanglish.best-score.v1",
};
const SOUND_FILES = ["free_sound1055.mp3", "free_sound1056.mp3", "free_sound1057.mp3"];
const FX_WORDS = [
  "ABUNDANT", "BRILLIANT", "RAPID", "CURIOUS", "FRAGILE", "VIVID",
  "PATIENT", "ANCIENT", "LIVELY", "CHAOS", "SKILLFUL", "SERENE",
  "PERFECT", "OVERDRIVE", "COMBO", "BURST", "POWER", "DOPA",
];
const COLORS = ["#ffe66d", "#69f0ae", "#69d9ff", "#ff4ecf", "#b95dff"];

let wordBank = [];
let game;
let bestScore = 0;
let particles = [];
let rings = [];
let shards = [];
let confetti = [];
let wordStreams = [];
let lightnings = [];
let beam = null;
let callout = null;
let flash = 0;
let screenShake = 0;
let reveal = null;
let advanceAt = 0;
let lastAskedWord = null;
let backgroundParticles = [];
let soundFiles = [];

function preload() {
  wordBank = loadJSON("words.json");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  textFont("sans-serif");
  textAlign(CENTER, CENTER);
  soundFiles = SOUND_FILES.map((path) => new Audio(path));
  backgroundParticles = Array.from({ length: 120 }, () => ({
    x: random(width),
    y: random(height),
    vx: random(-0.3, 0.3),
    vy: random(-0.2, 0.4),
    size: random(1, 2.5),
    color: random(COLORS.slice(1)),
  }));

  bestScore = readBestScore();
  game = {
    score: 0,
    combo: 0,
    round: 1,
    active: false,
    current: null,
    options: [],
    lastAnswer: null,
    remaining: new Set(),
    retryAfter: new Map(),
    mastered: readStringSet(STORAGE.mastered),
    mistakes: readCountMap(STORAGE.mistakes),
    history: readHistory(),
  };

  const saved = readProgress();
  if (saved && restoreProgress(saved)) return;
  game.current = null;
}

function draw() {
  drawBackground();
  drawGameUi();
  drawParticlesAndEffects();
  drawWordStreams();
  drawAnswerReveal();

  if (game.active && game.lastAnswer && advanceAt > 0 && millis() >= advanceAt) {
    advanceQuestion();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  backgroundParticles = Array.from({ length: 120 }, () => ({
    x: random(width),
    y: random(height),
    vx: random(-0.3, 0.3),
    vy: random(-0.2, 0.4),
    size: random(1, 2.5),
    color: random(COLORS.slice(1)),
  }));
}

function mousePressed() {
  if (!game.active) {
    if (inside(startButtonRect(), mouseX, mouseY)) startGame();
    return false;
  }
  if (game.lastAnswer) return false;
  const boxes = answerRects();
  const index = boxes.findIndex((box) => inside(box, mouseX, mouseY));
  if (index >= 0) answerQuestion(index);
  return false;
}

function drawBackground() {
  background(255, 215, 0);
  noStroke();
  for (let radius = max(width, height) * 0.95; radius > 0; radius -= 34) {
    const alpha = map(radius, 0, max(width, height) * 0.95, 15, 0.1);
    fill(65, 31, 105, alpha);
    ellipse(width * 0.5, height * 0.43, radius * 1.35, radius);
  }
  backgroundParticles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.x < 0) particle.x = width;
    if (particle.x > width) particle.x = 0;
    if (particle.y < 0) particle.y = height;
    if (particle.y > height) particle.y = 0;
    fill(particle.color);
    drawingContext.globalAlpha = 0.42;
    circle(particle.x, particle.y, particle.size);
    drawingContext.globalAlpha = 1;
  });
}

function drawGameUi() {
  const layout = uiLayout();
  drawHud();
  drawPanel(layout);
  drawChoices(layout);
  drawStartButton(layout);
  if (callout && millis() < callout.endsAt) {
    const progress = (millis() - callout.startedAt) / (callout.endsAt - callout.startedAt);
    const alpha = 255 * min(1, (1 - progress) * 3);
    drawingContext.save();
    drawingContext.shadowColor = callout.color;
    drawingContext.shadowBlur = 25;
    fill(color(callout.color));
    drawingContext.globalAlpha = alpha / 255;
    textStyle(BOLD);
    textSize(constrain(width * 0.055, 25, 50));
    text(callout.title, width / 2, max(76, height * 0.16));
    textStyle(NORMAL);
    textSize(constrain(width * 0.02, 13, 19));
    text(callout.subtitle, width / 2, max(109, height * 0.16 + 40));
    drawingContext.restore();
  } else {
    callout = null;
  }
}

function drawHud() {
  const compact = width < 540;
  const margin = compact ? 10 : 24;
  const top = 14;
  noStroke();
  fill("#69f0ae");
  textStyle(BOLD);
  textAlign(LEFT, CENTER);
  textSize(compact ? 12 : 17);
  text(compact ? "DOPA" : "DOPANGLISH", margin, top + 14);

  const items = [
    ["SCORE", game.score],
    ["BEST", bestScore],
    ["COMBO", `x${game.combo}`],
    ["Q", game.round],
  ];
  const boxW = compact ? min(68, (width - 2 * margin - 95) / 4) : 94;
  const gap = compact ? 5 : 10;
  const totalWidth = boxW * items.length + gap * (items.length - 1);
  let x = width - margin - totalWidth;
  items.forEach(([label, value]) => {
    fill(15, 24, 38, 225);
    stroke(105, 217, 255, 150);
    strokeWeight(1);
    rect(x, top, boxW, compact ? 43 : 52, 10);
    noStroke();
    fill(180, 220, 235);
    textAlign(CENTER, CENTER);
    textSize(compact ? 8 : 9);
    text(label, x + boxW / 2, top + 10);
    fill("#ebf8ff");
    textStyle(BOLD);
    textSize(compact ? 12 : 16);
    text(String(value), x + boxW / 2, top + 31);
    textStyle(NORMAL);
    x += boxW + gap;
  });
}

function drawPanel(layout) {
  noStroke();
  fill(14, 20, 33, 235);
  stroke(105, 217, 255, 125);
  strokeWeight(1);
  rect(layout.x, layout.questionY, layout.panelW, layout.questionH, 22);
  noStroke();

  const statusColor = game.lastAnswer
    ? (game.lastAnswer.isCorrect ? "#69f0ae" : "#ff5b7a")
    : game.active ? "#69d9ff" : "#b8c6d8";
  fill(statusColor);
  textStyle(BOLD);
  textAlign(LEFT, CENTER);
  textSize(12);
  const status = !game.active
    ? (game.remaining.size === 0 ? "STAGE CLEAR" : "READY")
    : game.lastAnswer
      ? (game.lastAnswer.isCorrect ? "CORRECT" : "MISS")
      : "LIVE";
  text(status, layout.x + 18, layout.questionY + 22);

  if (!game.current || !game.active && game.remaining.size === 0) {
    fill("#ebf8ff");
    textAlign(CENTER, CENTER);
    textSize(constrain(width * 0.04, 20, 36));
    text(game.remaining.size === 0 && game.round > 1 ? "CLEAR" : "DOPA", width / 2, layout.questionY + 82);
    fill(195, 220, 235);
    textSize(14);
    text(
      game.remaining.size === 0 && game.round > 1
        ? `全${wordBank.length}語正解！ SCORE ${game.score}`
        : "英語を解け。画面をブチ上げろ。",
      width / 2,
      layout.questionY + layout.questionH - 22,
    );
    return;
  }

  const card = game.current;
  fill("#ffe66d");
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(12);
  text(`難易度 ${"★".repeat(card.difficulty)}${"☆".repeat(5 - card.difficulty)}`, width / 2, layout.questionY + 44);
  fill("#f3fbff");
  drawingContext.save();
  drawingContext.shadowColor = "#69d9ff";
  drawingContext.shadowBlur = game.lastAnswer && game.lastAnswer.isCorrect ? 32 : 17;
  textFont("sans-serif");
  textSize(constrain(layout.panelW * 0.09, 25, 54));
  text(card.word.toUpperCase(), width / 2, layout.questionY + 91);
  drawingContext.restore();
  fill(221, 240, 248);
  textStyle(NORMAL);
  textSize(14);
  const prompt = game.lastAnswer
    ? game.lastAnswer.isCorrect
      ? `${card.word} = ${card.meaning}`
      : `正解は ${card.meaning} だよ`
    : "意味として正しいものは？";
  text(prompt, width / 2, layout.questionY + layout.questionH - 20);
}

function drawChoices() {
  if (!game.active || !game.current) return;
  const boxes = answerRects();
  boxes.forEach((box, index) => {
    const correct = game.lastAnswer && game.options[index] === game.current.meaning;
    const wrong = game.lastAnswer && index === game.lastAnswer.selectedIndex && !game.lastAnswer.isCorrect;
    if (correct) fill(28, 79, 53, 245);
    else if (wrong) fill(83, 26, 42, 245);
    else fill(17, 25, 39, 235);
    stroke(correct ? "#ffe66d" : wrong ? "#ff5b7a" : color(105, 217, 255, 135));
    strokeWeight(correct ? 2 : 1);
    rect(box.x, box.y, box.w, box.h, 14);
    noStroke();
    fill("#ebf8ff");
    textStyle(BOLD);
    textSize(constrain(box.w * 0.055, 13, 18));
    text(`${index + 1}. ${game.options[index]}`, box.x + box.w / 2, box.y + box.h / 2, box.w - 12, box.h - 8);
    textStyle(NORMAL);
  });
}

function drawStartButton() {
  const box = startButtonRect();
  const label = game.active ? "RUNNING" : game.remaining.size === 0 && game.round > 1 ? "RESTART" : "START";
  noStroke();
  fill(105, 240, 174, game.active ? 120 : 235);
  rect(box.x, box.y, box.w, box.h, box.h / 2);
  fill("#07131c");
  textStyle(BOLD);
  textSize(14);
  text(label, box.x + box.w / 2, box.y + box.h / 2);
  textStyle(NORMAL);
}

function drawParticlesAndEffects() {
  const now = millis();
  if (beam) {
    const progress = (now - beam.startedAt) / beam.duration;
    if (progress >= 1) {
      beam = null;
    } else {
      const alpha = 255 * (1 - progress);
      drawingContext.save();
      blendMode(ADD);
      for (let i = 0; i < 18; i += 1) {
        const angle = TWO_PI * i / 18 + progress * 0.8;
        const length = max(width, height) * (0.42 + (i % 4) * 0.09);
        stroke(i % 2 ? color(105, 217, 255, alpha) : color(255, 78, 207, alpha));
        strokeWeight(i % 3 + 1);
        line(beam.x, beam.y, beam.x + cos(angle) * length, beam.y + sin(angle) * length);
      }
      noFill();
      stroke(255, 240, 150, alpha);
      strokeWeight(5 * (1 - progress) + 1);
      circle(beam.x, beam.y, 48 + progress * max(width, height) * 1.1);
      blendMode(BLEND);
      drawingContext.restore();
    }
  }

  rings = rings.filter((ring) => ring.life > 0);
  rings.forEach((ring) => {
    ring.radius += ring.speed;
    ring.life -= 1;
    noFill();
    const ringColor = color(ring.color);
    stroke(red(ringColor), green(ringColor), blue(ringColor), map(ring.life, 0, ring.maxLife, 0, 230));
    strokeWeight(3);
    circle(ring.x, ring.y, ring.radius * 2);
  });

  lightnings = lightnings.filter((bolt) => bolt.life > 0);
  lightnings.forEach((bolt) => {
    bolt.life -= 1;
    const endX = bolt.x + cos(bolt.angle) * bolt.length;
    const endY = bolt.y + sin(bolt.angle) * bolt.length;
    const dx = endX - bolt.x;
    const dy = endY - bolt.y;
    const distance = max(1, sqrt(dx * dx + dy * dy));
    const segments = max(5, ceil(distance / 22));
    const points = [{ x: bolt.x, y: bolt.y }];
    for (let i = 1; i < segments; i += 1) {
      const t = i / segments;
      const offset = random(-18, 18);
      points.push({
        x: bolt.x + dx * t - dy / distance * offset,
        y: bolt.y + dy * t + dx / distance * offset,
      });
    }
    points.push({ x: endX, y: endY });
    const alpha = map(bolt.life, 0, bolt.maxLife, 0, 220);
    drawingContext.save();
    drawingContext.shadowColor = bolt.color;
    drawingContext.shadowBlur = 20;
    noFill();
    stroke(bolt.color);
    drawingContext.globalAlpha = alpha / 255;
    strokeWeight(bolt.width);
    beginShape();
    points.forEach((point) => vertex(point.x, point.y));
    endShape();
    stroke("#ffffff");
    strokeWeight(max(1, bolt.width * 0.28));
    beginShape();
    points.forEach((point) => vertex(point.x, point.y));
    endShape();
    for (let i = 2; i < points.length - 1; i += 3) {
      line(points[i].x, points[i].y, points[i].x + random(-24, 24), points[i].y + random(-24, 24));
    }
    drawingContext.globalAlpha = 1;
    drawingContext.restore();
  });

  shards = shards.filter((piece) => piece.life > 0);
  shards.forEach((piece) => {
    piece.x += piece.vx;
    piece.y += piece.vy;
    piece.vy += 0.18;
    piece.rotation += piece.spin;
    piece.life -= 1;
    push();
    translate(piece.x, piece.y);
    rotate(piece.rotation);
    drawingContext.globalAlpha = max(0, piece.life / piece.maxLife);
    fill(105, 217, 255, 80);
    stroke(225, 250, 255, 235);
    strokeWeight(1.3);
    beginShape();
    piece.points.forEach((point) => vertex(point.x, point.y));
    endShape(CLOSE);
    drawingContext.globalAlpha = 1;
    pop();
  });

  confetti = confetti.filter((piece) => piece.life > 0 && piece.y < height + 25);
  confetti.forEach((piece) => {
    piece.x += piece.vx + sin(piece.phase) * piece.sway;
    piece.y += piece.vy;
    piece.phase += 0.06;
    piece.rotation += piece.spin;
    piece.life -= 1;
    push();
    translate(piece.x, piece.y);
    rotate(piece.rotation);
    drawingContext.globalAlpha = min(1, piece.life / 30);
    noStroke();
    fill(piece.color);
    rect(-piece.w / 2, -piece.h / 2, piece.w, piece.h, 2);
    drawingContext.globalAlpha = 1;
    pop();
  });

  particles = particles.filter((particle) => particle.life > 0);
  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += particle.gravity || 0;
    particle.life -= 1;
    noStroke();
    drawingContext.globalAlpha = max(0, particle.life / particle.maxLife);
    fill(particle.color);
    circle(particle.x, particle.y, particle.size);
    drawingContext.globalAlpha = 1;
  });

  if (flash > 0) {
    noStroke();
    fill(255, 230, 109, flash * 150);
    rect(0, 0, width, height);
    flash = max(0, flash - 0.035);
  }
  screenShake = max(0, screenShake - 0.5);
}

function drawWordStreams() {
  const now = millis();
  wordStreams = wordStreams.filter((stream) => now < stream.bornAt + stream.duration);
  wordStreams.forEach((stream) => {
    if (now < stream.bornAt) return;
    const progress = (now - stream.bornAt) / stream.duration;
    const alpha = sin(progress * PI) * 0.88;
    const distance = progress * (stream.axis === "x" ? width + 440 : height + 240);
    const x = stream.axis === "x"
      ? (stream.direction > 0 ? -220 + distance : width + 220 - distance)
      : stream.lane;
    const y = stream.axis === "y"
      ? (stream.direction > 0 ? -120 + distance : height + 120 - distance)
      : stream.lane;
    push();
    translate(x, y);
    if (stream.axis === "y") rotate(HALF_PI);
    drawingContext.globalAlpha = alpha;
    textStyle(BOLD);
    textSize(stream.size);
    drawingContext.shadowColor = stream.color;
    drawingContext.shadowBlur = 22;
    stroke(7, 11, 18, 245);
    strokeWeight(5);
    fill(stream.color);
    text(stream.word, 0, 0);
    drawingContext.shadowBlur = 0;
    drawingContext.globalAlpha = 1;
    pop();
  });
}

function drawAnswerReveal() {
  if (!reveal || millis() >= reveal.endsAt) {
    reveal = null;
    return;
  }
  const progress = (millis() - reveal.startedAt) / (reveal.endsAt - reveal.startedAt);
  const alpha = 255 * min(1, (1 - progress) * 4);
  const revealScale = progress < 0.18 ? lerp(0.75, 1.08, progress / 0.18) : 1;
  push();
  translate(width / 2, height * 0.52);
  scale(revealScale);
  drawingContext.globalAlpha = alpha / 255;
  noStroke();
  fill(7, 11, 18, 225);
  rect(-min(width * 0.46, 530), -52, min(width * 0.92, 1060), 104, 52);
  noFill();
  stroke("#ffe66d");
  strokeWeight(2);
  rect(-min(width * 0.46, 530), -52, min(width * 0.92, 1060), 104, 52);
  noStroke();
  drawingContext.shadowColor = "#ffe66d";
  drawingContext.shadowBlur = 25;
  fill("#fff7cc");
  textStyle(BOLD);
  textSize(constrain(width * 0.055, 23, 50));
  text(`${reveal.word.toLowerCase()} : ${reveal.meaning}`, 0, 0, min(width * 0.86, 990), 90);
  drawingContext.shadowBlur = 0;
  drawingContext.globalAlpha = 1;
  pop();
}

function uiLayout() {
  const panelW = min(760, width - 32);
  const questionH = height < 650 ? 174 : 194;
  const questionY = max(82, min(height * 0.23, (height - 430) / 2));
  return {
    x: (width - panelW) / 2,
    panelW,
    questionY,
    questionH,
    choicesY: questionY + questionH + 16,
  };
}

function answerRects() {
  const panelW = min(760, width - 32);
  const x = (width - panelW) / 2;
  const gap = 12;
  const boxW = (panelW - gap) / 2;
  const boxH = height < 650 ? 62 : 70;
  const y = uiLayout().choicesY;
  return [
    { x, y, w: boxW, h: boxH },
    { x: x + boxW + gap, y, w: boxW, h: boxH },
    { x, y: y + boxH + gap, w: boxW, h: boxH },
    { x: x + boxW + gap, y: y + boxH + gap, w: boxW, h: boxH },
  ];
}

function startButtonRect() {
  const y = answerRects()[2].y + answerRects()[2].h + 17;
  return { x: width / 2 - 78, y, w: 156, h: 43 };
}

function inside(box, x, y) {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

function startGame() {
  if (!Array.isArray(wordBank) || wordBank.length === 0) {
    console.error("words.json did not load or contains no words.");
    return;
  }
  game.score = 0;
  game.combo = 0;
  game.round = 1;
  game.active = true;
  game.current = null;
  game.options = [];
  game.lastAnswer = null;
  game.remaining = new Set(wordBank.map((card) => card.word));
  game.retryAfter.clear();
  lastAskedWord = null;
  advanceAt = 0;
  reveal = null;
  nextQuestion();
}

function nextQuestion() {
  if (game.remaining.size === 0) {
    finishGame();
    return;
  }
  game.current = chooseWord();
  const meanings = [...new Set(wordBank
    .filter((card) => card.meaning !== game.current.meaning)
    .map((card) => card.meaning))];
  game.options = shuffle([game.current.meaning, ...shuffle(meanings).slice(0, 3)]);
  game.lastAnswer = null;
  advanceAt = 0;
  saveProgress();
}

function chooseWord() {
  const pending = wordBank.filter((card) => game.remaining.has(card.word));
  const missed = pending.filter((card) => (game.mistakes.get(card.word) || 0) > 0);
  const unseen = pending.filter((card) => (game.mistakes.get(card.word) || 0) === 0);
  const dueMissed = missed.filter((card) => (game.retryAfter.get(card.word) || 1) <= game.round);
  const completed = wordBank.filter((card) => !game.remaining.has(card.word));
  let candidates;

  if (missed.length <= 10 && game.round % 4 === 0) {
    const review = wordBank.filter((card) => (
      (game.mistakes.get(card.word) || 0) >= 2 || game.mastered.has(card.word)
    ));
    if (review.length) candidates = review;
  }
  if (!candidates && dueMissed.length) candidates = dueMissed;
  if (!candidates && unseen.length) candidates = unseen;
  if (!candidates && missed.length) candidates = missed;
  if (!candidates && completed.length) candidates = completed;
  if (!candidates) candidates = pending;
  const withoutRepeat = candidates.filter((card) => card.word !== lastAskedWord);
  const pool = withoutRepeat.length ? withoutRepeat : candidates;
  const card = random(pool);
  lastAskedWord = card.word;
  return card;
}

function answerQuestion(index) {
  if (!game.active || !game.current || game.lastAnswer) return;
  const correctIndex = game.options.indexOf(game.current.meaning);
  const isCorrect = index === correctIndex;
  const accuracy = recordAnswer(game.current.word, isCorrect);
  game.lastAnswer = { isCorrect, selectedIndex: index, correctIndex };
  reveal = {
    word: game.current.word,
    meaning: game.current.meaning,
    startedAt: millis(),
    endsAt: millis() + (isCorrect ? 1100 : 2800),
  };

  if (isCorrect) {
    game.remaining.delete(game.current.word);
    game.retryAfter.delete(game.current.word);
    const mistakes = game.mistakes.get(game.current.word) || 0;
    const difficultyBonus = game.current.difficulty >= 4 ? (game.current.difficulty - 3) * 100 : 0;
    const recoveryBonus = mistakes > 0 ? min(mistakes, 3) * 75 : 0;
    const bonus = difficultyBonus + recoveryBonus;
    const hardClear = game.current.difficulty >= 4
      || (accuracy.total >= 3 && (accuracy.recentAccuracy + accuracy.overallAccuracy) / 2 <= 0.5);
    game.combo += 1;
    game.score += 100 + game.combo * 25 + bonus;
    if (game.score > bestScore) {
      bestScore = game.score;
      safeStore(STORAGE.best, String(bestScore));
    }
    game.mastered.add(game.current.word);
    safeStore(STORAGE.mastered, JSON.stringify([...game.mastered]));
    successEffects(hardClear, bonus);
    playPachinkoSound();
    advanceAt = millis() + 900;
  } else {
    game.combo = 0;
    const count = (game.mistakes.get(game.current.word) || 0) + 1;
    game.mistakes.set(game.current.word, count);
    game.retryAfter.set(game.current.word, game.round + 2);
    safeStore(STORAGE.mistakes, JSON.stringify([...game.mistakes]));
    particles.push(...makeParticles(width / 2, height / 2, "#ff5b7a", 28, 1, false));
    rings.push(makeRing(width / 2, height / 2, "#ff5b7a", 180));
    flash = 0.13;
    advanceAt = millis() + 2800;
  }
  saveProgress();
}

function advanceQuestion() {
  advanceAt = 0;
  game.round += 1;
  game.lastAnswer = null;
  reveal = null;
  if (game.remaining.size === 0) finishGame();
  else nextQuestion();
}

function finishGame() {
  game.active = false;
  game.lastAnswer = null;
  game.current = null;
  advanceAt = 0;
  safeRemove(STORAGE.progress);
}

function successEffects(hardClear, bonus) {
  const boxes = answerRects();
  const box = boxes[game.lastAnswer.selectedIndex];
  const x = box.x + box.w / 2;
  const y = box.y + box.h / 2;
  const scale = hardClear ? 1.65 : 1;
  const accuracy = game.history.get(game.current.word);
  const recent = accuracy.recent.slice(-3).filter(Boolean).length;
  callout = {
    title: hardClear ? "激ムズ正解！" : game.combo >= 3 ? "OVERDRIVE!" : "正解！",
    subtitle: `直近 ${accuracy.recent.length ? Math.round(recent / accuracy.recent.slice(-3).length * 100) : 0}% · 累計 ${Math.round(accuracy.correct / accuracy.total * 100)}% · +${bonus} pt`,
    color: hardClear ? "#ffe66d" : "#69f0ae",
    startedAt: millis(),
    endsAt: millis() + (hardClear ? 1500 : 1000),
  };
  beam = { x: width / 2, y: uiLayout().questionY + 91, startedAt: millis(), duration: 900 };
  flash = hardClear ? 0.42 : 0.3;
  screenShake = hardClear ? 7 : 4;
  rings.push(makeRing(x, y, "#ffe66d", 240 * scale), makeRing(x, y, "#69f0ae", 190 * scale));
  for (let i = 0; i < 6; i += 1) {
    lightnings.push({
      x: x + random(-35, 35),
      y: y + random(-35, 35),
      length: random(180, max(width, height) * 0.62),
      angle: TWO_PI * i / 6 + random(-0.18, 0.18),
      life: 24,
      maxLife: 24,
      width: random(4, 7) * scale,
      color: random(["#ffe66d", "#69d9ff", "#ff4ecf"]),
    });
  }
  particles.push(
    ...makeParticles(x, y, "#69f0ae", 42, scale, false),
    ...makeParticles(x, y, "#ffe66d", 30, scale, false),
    ...makeParticles(x, y, "#b95dff", 20, scale, false),
  );
  for (let i = 0; i < 150; i += 1) {
    confetti.push({
      x: random(width),
      y: random(-height * 0.4, 0),
      vx: random(-2.5, 2.5),
      vy: random(2, 7),
      sway: random(0.5, 3),
      phase: random(TWO_PI),
      rotation: random(TWO_PI),
      spin: random(-0.14, 0.14),
      life: random(65, 115),
      w: random(5, 11),
      h: random(7, 15),
      color: random(COLORS),
    });
  }
  spawnGlassShards(box);
  spawnWordStreams(hardClear ? 72 : 24);
}

function spawnGlassShards(box) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cols = 5;
  const rows = 3;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = box.x + box.w * col / cols;
      const right = box.x + box.w * (col + 1) / cols;
      const top = box.y + box.h * row / rows;
      const bottom = box.y + box.h * (row + 1) / rows;
      const corners = [
        { x: left, y: top }, { x: right, y: top },
        { x: right, y: bottom }, { x: left, y: bottom },
      ];
      const triangles = random() > 0.5 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
      triangles.forEach((indices) => {
        const points = indices.map((i) => ({ x: corners[i].x - cx, y: corners[i].y - cy }));
        const angle = atan2(points.reduce((sum, p) => sum + p.y, 0) / 3, points.reduce((sum, p) => sum + p.x, 0) / 3);
        const speed = random(2.2, 7.2);
        shards.push({
          x: cx, y: cy,
          vx: cos(angle) * speed + random(-1.6, 1.6),
          vy: sin(angle) * speed - random(1, 4),
          rotation: random(TWO_PI), spin: random(-0.16, 0.16),
          life: random(34, 58), maxLife: 58, points,
        });
      });
    }
  }
}

function spawnWordStreams(count) {
  const verticalCount = ceil(count / 3);
  for (let i = 0; i < count; i += 1) {
    const vertical = i % 3 === 0;
    const laneIndex = vertical ? floor(i / 3) : i - ceil(i / 3);
    const laneCount = vertical ? verticalCount : count - verticalCount;
    wordStreams.push({
      word: random(FX_WORDS),
      axis: vertical ? "y" : "x",
      direction: random() > 0.5 ? 1 : -1,
      lane: (laneIndex + 0.5) / laneCount * (vertical ? width : height) + random(-18, 18),
      size: random(30, 58),
      bornAt: millis() + i * 8,
      duration: count > 24 ? random(1200, 1600) : random(1000, 1400),
      color: random(COLORS.slice(0, 4)),
    });
  }
}

function makeParticles(x, y, particleColor, count, scale, gravity) {
  return Array.from({ length: count }, () => ({
    x, y,
    vx: random(-3.8, 3.8) * scale * 1.5,
    vy: random(-3.8, 3.8) * scale * 1.5,
    gravity: gravity ? 0.12 : 0,
    life: random(20, 48),
    maxLife: 48,
    size: random(3, 8) * scale,
    color: particleColor,
  }));
}

function makeRing(x, y, ringColor, maxRadius) {
  return { x, y, radius: 4, speed: maxRadius / 30, life: 30, maxLife: 30, color: ringColor };
}

function playPachinkoSound() {
  if (!soundFiles.length) return;
  const first = floor(random(soundFiles.length));
  const attempt = (offset, previousError) => {
    if (offset >= soundFiles.length) {
      console.warn("Could not play a pachinko sound. Upload the three MP3 files to the p5.js project.", previousError);
      return;
    }
    const audio = soundFiles[(first + offset) % soundFiles.length];
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.72;
    const result = audio.play();
    if (result && result.catch) result.catch((error) => attempt(offset + 1, error));
  };
  attempt(0, null);
}

function recordAnswer(word, isCorrect) {
  const old = game.history.get(word) || { total: 0, correct: 0, recent: [] };
  const history = {
    total: old.total + 1,
    correct: old.correct + (isCorrect ? 1 : 0),
    recent: [...old.recent, isCorrect].slice(-3),
  };
  game.history.set(word, history);
  safeStore(STORAGE.history, JSON.stringify([...game.history]));
  return {
    total: history.total,
    recentAccuracy: history.recent.filter(Boolean).length / history.recent.length,
    overallAccuracy: history.correct / history.total,
  };
}

function restoreProgress(saved) {
  if (!Array.isArray(wordBank) || !wordBank.length || saved.version !== 2 || !saved.active) return false;
  if (!Number.isSafeInteger(saved.score) || !Number.isSafeInteger(saved.round)) return false;
  const current = wordBank.find((card) => card.word === saved.currentWord);
  if (!current || !Array.isArray(saved.currentOptions) || saved.currentOptions.length !== 4) return false;
  const validWords = new Set(wordBank.map((card) => card.word));
  if (!Array.isArray(saved.remainingWords) || !saved.remainingWords.every((word) => validWords.has(word))) return false;

  game.score = saved.score;
  game.combo = Number.isSafeInteger(saved.combo) ? saved.combo : 0;
  game.round = saved.round;
  game.active = true;
  game.current = current;
  game.options = saved.currentOptions;
  game.remaining = new Set(saved.remainingWords);
  game.retryAfter = new Map(Array.isArray(saved.retryAfterRound) ? saved.retryAfterRound : []);
  game.lastAnswer = saved.lastAnswer || null;
  lastAskedWord = saved.lastAskedWord || current.word;
  if (game.lastAnswer) {
    const delay = max(0, game.lastAnswer.nextAt - Date.now());
    advanceAt = millis() + delay;
    reveal = {
      word: current.word,
      meaning: current.meaning,
      startedAt: millis(),
      endsAt: millis() + delay,
    };
  }
  return true;
}

function saveProgress() {
  if (!game.active || !game.current) {
    safeRemove(STORAGE.progress);
    return;
  }
  const lastAnswer = game.lastAnswer
    ? { ...game.lastAnswer, nextAt: Date.now() + max(0, advanceAt - millis()) }
    : null;
  safeStore(STORAGE.progress, JSON.stringify({
    version: 2,
    active: true,
    score: game.score,
    combo: game.combo,
    bestCombo: game.combo,
    round: game.round,
    currentWord: game.current.word,
    currentOptions: game.options,
    remainingWords: [...game.remaining],
    retryAfterRound: [...game.retryAfter],
    lastAskedWord,
    lastAnswer,
  }));
}

function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE.progress) || "null");
    return value && value.version === 2 && value.active ? value : null;
  } catch (error) {
    console.warn("Could not read saved game progress.", error);
    return null;
  }
}

function readStringSet(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
  } catch (error) {
    console.warn(`Could not read ${key}.`, error);
    return new Set();
  }
}

function readCountMap(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Map(Array.isArray(value) ? value.filter((entry) => (
      Array.isArray(entry) && typeof entry[0] === "string" && Number.isInteger(entry[1]) && entry[1] > 0
    )) : []);
  } catch (error) {
    console.warn(`Could not read ${key}.`, error);
    return new Map();
  }
}

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE.history) || "[]");
    return new Map(Array.isArray(value) ? value.filter((entry) => (
      Array.isArray(entry)
      && typeof entry[0] === "string"
      && entry[1]
      && Number.isInteger(entry[1].total)
      && Number.isInteger(entry[1].correct)
      && Array.isArray(entry[1].recent)
    )) : []);
  } catch (error) {
    console.warn("Could not read answer history.", error);
    return new Map();
  }
}

function readBestScore() {
  try {
    const score = Number(localStorage.getItem(STORAGE.best) || 0);
    return Number.isSafeInteger(score) && score >= 0 ? score : 0;
  } catch (error) {
    console.warn("Could not read best score.", error);
    return 0;
  }
}

function safeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not save ${key}.`, error);
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Could not remove ${key}.`, error);
  }
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = floor(random(i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
