
const $ = (id) => document.getElementById(id);

const homeScreen = $("homeScreen"), gameScreen = $("gameScreen"), resultScreen = $("resultScreen");
const bubbleLayer = $("bubbleLayer"), magnetPanel = $("magnetPanel"), gameMessage = $("gameMessage");
const feedback = $("feedback"), difficultySelect = $("difficulty");

const settings = {
  easy:   {duration:60, bubbleSpeed:35, bubbleCount:5, missLimit:6, targetCount:15, keySet:["A","S","D","F","J","K","L"]},
  medium: {duration:45, bubbleSpeed:55, bubbleCount:6, missLimit:5, targetCount:20, keySet:["Q","W","E","R","U","I","O","P","A","S","D","F","J","K","L"]},
  hard:   {duration:30, bubbleSpeed:80, bubbleCount:8, missLimit:4, targetCount:25, keySet:["Z","X","C","V","B","N","M","Q","W","E","R","T","Y","U","I","O","P"]}
};

const practiceKeys = ["A","S","D","F","J","K","L"];

let mode = "bubbles", difficulty = "easy", score = 0, correct = 0, incorrect = 0, misses = 0;
let remaining = 60, elapsedResponse = 0, responseSamples = 0, targetStartedAt = 0, targetsCompleted = 0;
let bubbles = [], running = false, timerId = null, rafId = null, lastFrame = 0, spawnElapsed = 0, feedbackTimeout = null;

function showScreen(screen) {
  [homeScreen, gameScreen, resultScreen].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function chooseMode(nextMode) {
  mode = nextMode;
  $("gameTitle").textContent = mode === "bubbles" ? "Bubbles" : "KeyMagnet";
  $("modeLabel").textContent = mode === "bubbles" ? "MODE A · LETTER RECOGNITION" : "MODE B · KEYBOARD PRECISION";
  $("stat3Label").textContent = mode === "bubbles" ? "MISSES" : "INCORRECT";
  $("stat4Label").textContent = mode === "bubbles" ? "DIFFICULTY" : "CORRECT";

  bubbleLayer.classList.toggle("hidden", mode !== "bubbles");
  magnetPanel.classList.toggle("hidden", mode !== "magnet");

  difficulty = difficultySelect.value;
  resetGame();
  showScreen(gameScreen);
}

document.querySelectorAll(".start-mode").forEach(btn => {
  btn.addEventListener("click", () => chooseMode(btn.dataset.mode));
});

$("homeBtn").addEventListener("click", () => {
  stopLoops();
  showScreen(homeScreen);
});

$("startBtn").addEventListener("click", startGame);

$("restartBtn").addEventListener("click", () => {
  resetGame();
  startGame();
});

$("resetBtn").addEventListener("click", resetGame);

$("resultHomeBtn").addEventListener("click", () => {
  resetGame();
  showScreen(homeScreen);
});

// PLAY AGAIN BUTTON FIX
$("playAgainBtn").addEventListener("click", () => {
  stopLoops();
  resetGame();
  showScreen(gameScreen);
  startGame();
});

difficultySelect.addEventListener("change", () => {
  difficulty = difficultySelect.value;
  resetGame();
});

function resetGame() {
  stopLoops();

  score = correct = incorrect = misses = targetsCompleted = responseSamples = elapsedResponse = 0;
  difficulty = difficultySelect.value;
  remaining = settings[difficulty].duration;

  bubbles = [];
  spawnElapsed = 0;
  lastFrame = 0;

  bubbleLayer.innerHTML = "";

  feedback.textContent = "";
  feedback.className = "feedback";

  gameMessage.classList.remove("hidden");
  gameMessage.innerHTML = "<h3>Ready?</h3><p>Press Start to begin your session.</p>";

  $("startBtn").disabled = false;
  $("startBtn").textContent = "▶ Start";

  $("score").textContent = "0";
  $("time").textContent = remaining + "s";

  $("stat3").textContent = mode === "bubbles" ? `0 / ${settings[difficulty].missLimit}` : "0";
  $("stat4").textContent = mode === "bubbles" ? difficulty[0].toUpperCase()+difficulty.slice(1) : "0";

  $("sessionNote").textContent = mode === "bubbles"
    ? "Press the matching letter to pop a bubble. Miss limit ends the session."
    : "Practice keys: A, S, D, F, J, K, L. Complete the target set.";

  if (mode === "magnet") buildKeyboard();
}

function startGame() {
  if (running) return;

  resetGameStateForStart();
  running = true;

  gameMessage.classList.add("hidden");

  $("startBtn").disabled = true;
  $("startBtn").textContent = "● Playing";

  targetStartedAt = performance.now();

  if (mode === "bubbles") {
    for (let i = 0; i < settings[difficulty].bubbleCount; i++) {
      spawnBubble(true);
    }

    lastFrame = performance.now();
    rafId = requestAnimationFrame(animateBubbles);
  } else {
    showNextTarget();
  }

  timerId = setInterval(() => {
    if (!running) return;

    remaining--;
    $("time").textContent = remaining + "s";

    if (remaining <= 0) endGame("timeout");
  }, 1000);
}

function resetGameStateForStart() {
  stopLoops();

  score = correct = incorrect = misses = targetsCompleted = responseSamples = elapsedResponse = 0;
  remaining = settings[difficulty].duration;

  bubbles = [];
  spawnElapsed = 0;

  $("score").textContent = "0";
  $("time").textContent = remaining + "s";

  $("stat3").textContent = mode === "bubbles" ? `0 / ${settings[difficulty].missLimit}` : "0";
  $("stat4").textContent = mode === "bubbles" ? difficulty[0].toUpperCase()+difficulty.slice(1) : "0";

  bubbleLayer.innerHTML = "";

  feedback.textContent = "";
  feedback.className = "feedback";
}

function stopLoops() {
  running = false;

  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (feedbackTimeout !== null) {
    clearTimeout(feedbackTimeout);
    feedbackTimeout = null;
  }
}

function showFeedback(text, good) {
  feedback.textContent = text;
  feedback.className = "feedback " + (good ? "good" : "bad");

  if (feedbackTimeout) clearTimeout(feedbackTimeout);

  feedbackTimeout = setTimeout(() => {
    feedback.textContent = "";
    feedbackTimeout = null;
  }, 650);
}

function updateStats() {
  $("score").textContent = score;

  $("stat3").textContent = mode === "bubbles"
    ? `${misses} / ${settings[difficulty].missLimit}`
    : incorrect;

  $("stat4").textContent = mode === "bubbles"
    ? difficulty[0].toUpperCase()+difficulty.slice(1)
    : correct;
}

function spawnBubble(initial = false) {
  if (!running && !initial) return;

  const field = $("playfield");
  const size = 48 + Math.random() * 12;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letter = letters[Math.floor(Math.random() * letters.length)];

  const el = document.createElement("div");
  el.className = "bubble";
  el.textContent = letter;

  el.style.width = size + "px";
  el.style.height = size + "px";

  const maxX = Math.max(0, field.clientWidth - size - 10);
  const x = Math.random() * maxX;
  const y = initial ? Math.random() * (field.clientHeight - 80) + 25 : field.clientHeight + size;

  el.style.left = x + "px";
  el.style.top = y + "px";

  bubbleLayer.appendChild(el);

  bubbles.push({
    letter,
    x,
    y,
    size,
    el,
    speed: settings[difficulty].bubbleSpeed * (0.75 + Math.random() * 0.5)
  });
}

function animateBubbles(timestamp) {
  if (!running || mode !== "bubbles") return;

  const dt = Math.min((timestamp - lastFrame) / 1000, .05);
  lastFrame = timestamp;

  spawnElapsed += dt;

  const spawnInterval = difficulty === "easy" ? 2.2 : difficulty === "medium" ? 1.65 : 1.2;

  if (spawnElapsed >= spawnInterval && bubbles.length < settings[difficulty].bubbleCount + (score >= 50 ? 2 : 0)) {
    spawnElapsed = 0;
    spawnBubble();
  }

  const height = $("playfield").clientHeight;

  bubbles.forEach(b => {
    b.y -= b.speed * dt;
    b.el.style.top = b.y + "px";
  });

  const escaped = bubbles.filter(b => b.y + b.size < 0);

  escaped.forEach(b => {
    b.el.remove();
    misses++;
  });

  bubbles = bubbles.filter(b => b.y + b.size >= 0);

  updateStats();

  if (misses >= settings[difficulty].missLimit) {
    endGame("misses");
    return;
  }

  rafId = requestAnimationFrame(animateBubbles);
}

function buildKeyboard() {
  const keyboard = $("keyboard");
  keyboard.innerHTML = "";

  const rows = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["Z","X","C","V","B","N","M"]
  ];

  rows.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";

    row.forEach(key => {
      const keyEl = document.createElement("div");
      keyEl.className = "keycap";
      keyEl.dataset.key = key;
      keyEl.textContent = key;
      rowEl.appendChild(keyEl);
    });

    keyboard.appendChild(rowEl);
  });
}

function showNextTarget() {
  const set = settings[difficulty].keySet;
  const key = set[Math.floor(Math.random() * set.length)];

  $("targetKey").textContent = key;

  document.querySelectorAll(".keycap").forEach(k => {
    k.classList.toggle("active", k.dataset.key === key);
  });

  targetStartedAt = performance.now();
}

document.addEventListener("keydown", (event) => {
  if (!running || event.repeat) return;

  const key = event.key.toUpperCase();

  if (!/^[A-Z]$/.test(key)) return;

  if (mode === "bubbles") handleBubbleKey(key);
  else handleMagnetKey(key);
});

function handleBubbleKey(key) {
  const match = bubbles.find(b => b.letter === key);

  if (match) {
    match.el.classList.add("hit");
    match.el.remove();

    bubbles = bubbles.filter(b => b !== match);

    score += 10;
    correct++;

    showFeedback("✓ POP! +10", true);
  } else {
    score = Math.max(0, score - 2);
    incorrect++;

    showFeedback("✕ Wrong key −2", false);
  }

  updateStats();
}

function handleMagnetKey(key) {
  const target = $("targetKey").textContent;
  const response = performance.now() - targetStartedAt;

  if (key === target) {
    score += 10;
    correct++;

    elapsedResponse += response;
    responseSamples++;
    targetsCompleted++;

    showFeedback("✓ Correct! +10", true);
    updateStats();

    if (targetsCompleted >= settings[difficulty].targetCount) {
      endGame("complete");
      return;
    }

    showNextTarget();
  } else {
    incorrect++;
    score = Math.max(0, score - 2);

    showFeedback("✕ Incorrect −2", false);
    updateStats();
  }
}

function endGame(reason) {
  if (!running) return;

  stopLoops();

  $("startBtn").disabled = false;
  $("startBtn").textContent = "▶ Start";

  let title = reason === "complete"
    ? "Challenge Completed!"
    : reason === "timeout"
    ? "Time's Up!"
    : "Game Over!";

  $("resultTitle").textContent = title;

  $("resultSubtitle").textContent = mode === "bubbles"
    ? (reason === "misses" ? "Too many bubbles escaped. Try again!" : "Your bubble session has ended.")
    : (reason === "complete" ? "You completed the target practice set." : "Your keyboard precision session has ended.");

  $("resultIcon").textContent = reason === "complete"
    ? "🏆"
    : reason === "misses"
    ? "🫧"
    : "⌛";

  $("finalScore").textContent = score;
  $("resultCorrect").textContent = correct;
  $("resultWrong").textContent = incorrect;

  const attempts = correct + incorrect;

  $("resultAccuracy").textContent = attempts
    ? Math.round(correct / attempts * 100) + "%"
    : "0%";

  $("resultTime").textContent = responseSamples
    ? Math.round(elapsedResponse / responseSamples) + " ms"
    : "—";

  showScreen(resultScreen);
}