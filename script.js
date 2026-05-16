const expressionDisplay = document.querySelector("#expressionDisplay");
const resultDisplay = document.querySelector("#resultDisplay");
const keypad = document.querySelector(".keypad");
const copyResultButton = document.querySelector("#copyResult");
const historyToggle = document.querySelector("#historyToggle");
const historyPanel = document.querySelector("#historyPanel");
const historyList = document.querySelector("#historyList");
const clearHistoryButton = document.querySelector("#clearHistory");
const emptyHistory = document.querySelector("#emptyHistory");
const themeToggle = document.querySelector("#themeToggle");

const HISTORY_KEY = "cherryCalculatorHistory";
const THEME_KEY = "cherryCalculatorTheme";
const MAX_HISTORY_ITEMS = 30;

let expression = "";
let lastResult = "0";
let history = readHistory();

// Boot the interface from saved user preferences.
applySavedTheme();
renderDisplay();
renderHistory();

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.value) {
    appendValue(button.dataset.value);
  }

  if (button.dataset.action === "clear") {
    clearExpression();
  }

  if (button.dataset.action === "delete") {
    deleteLastCharacter();
  }

  if (button.dataset.action === "calculate") {
    calculateExpression();
  }
});

copyResultButton.addEventListener("click", copyResult);
clearHistoryButton.addEventListener("click", clearHistory);
themeToggle.addEventListener("click", toggleTheme);

historyToggle.addEventListener("click", () => {
  const isOpen = historyPanel.classList.toggle("is-open");
  historyToggle.setAttribute("aria-expanded", String(isOpen));
});

historyList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-expression]");
  if (!item) return;

  expression = item.dataset.expression;
  lastResult = item.dataset.result;
  renderDisplay();
});

window.addEventListener("keydown", (event) => {
  const key = event.key;

  if (/^[0-9]$/.test(key)) appendValue(key);
  if (["+", "-", "*", "/", "%", "."].includes(key)) appendValue(key);
  if (key === "Enter" || key === "=") calculateExpression();
  if (key === "Backspace") deleteLastCharacter();
  if (key === "Escape") clearExpression();
});

function appendValue(value) {
  const operators = ["+", "-", "*", "/", "%"];
  const lastCharacter = expression.at(-1);

  // Replace repeated operators so the expression stays pleasant to edit.
  if (operators.includes(value) && operators.includes(lastCharacter)) {
    expression = expression.slice(0, -1) + value;
  } else if (value === "." && currentNumberHasDecimal()) {
    return;
  } else {
    expression += value;
  }

  renderDisplay();
}

function clearExpression() {
  expression = "";
  lastResult = "0";
  renderDisplay();
}

function deleteLastCharacter() {
  expression = expression.slice(0, -1);
  renderDisplay();
}

function calculateExpression() {
  if (!expression.trim()) return;

  try {
    const result = evaluateExpression(expression);
    const formatted = formatResult(result);

    if (!Number.isFinite(result)) {
      throw new Error("Invalid result");
    }

    lastResult = formatted;
    addHistoryItem(expression, formatted);
    expression = formatted;
    renderDisplay();
  } catch {
    showError();
  }
}

function evaluateExpression(input) {
  const tokens = tokenize(input);
  const values = [];
  const operators = [];

  for (const token of tokens) {
    if (typeof token === "number") {
      values.push(token);
      continue;
    }

    while (
      operators.length &&
      precedence(operators.at(-1)) >= precedence(token)
    ) {
      reduceTop(values, operators);
    }

    operators.push(token);
  }

  while (operators.length) {
    reduceTop(values, operators);
  }

  if (values.length !== 1) {
    throw new Error("Invalid expression");
  }

  return values[0];
}

function tokenize(input) {
  const tokens = [];
  let numberBuffer = "";

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const previous = input[index - 1];

    if (/\d|\./.test(character)) {
      numberBuffer += character;
      continue;
    }

    if (character === "-" && (index === 0 || "+-*/%".includes(previous))) {
      numberBuffer = "-";
      continue;
    }

    pushNumberToken(tokens, numberBuffer);
    numberBuffer = "";

    if ("+-*/%".includes(character)) {
      tokens.push(character);
    } else {
      throw new Error("Unsupported character");
    }
  }

  pushNumberToken(tokens, numberBuffer);
  return tokens;
}

function pushNumberToken(tokens, value) {
  if (!value) return;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid number");
  }

  tokens.push(parsed);
}

function reduceTop(values, operators) {
  const operator = operators.pop();
  const right = values.pop();
  const left = values.pop();

  if (left === undefined || right === undefined) {
    throw new Error("Missing operand");
  }

  if (operator === "+") values.push(left + right);
  if (operator === "-") values.push(left - right);
  if (operator === "*") values.push(left * right);
  if (operator === "/") {
    if (right === 0) throw new Error("Divide by zero");
    values.push(left / right);
  }
  if (operator === "%") values.push(left % right);
}

function precedence(operator) {
  return operator === "+" || operator === "-" ? 1 : 2;
}

function currentNumberHasDecimal() {
  const currentNumber = expression.split(/[+\-*/%]/).at(-1);
  return currentNumber.includes(".");
}

function formatResult(result) {
  return Number.parseFloat(result.toFixed(10)).toString();
}

function renderDisplay() {
  expressionDisplay.textContent = toReadableExpression(expression) || "0";
  resultDisplay.textContent = lastResult;
}

function showError() {
  resultDisplay.textContent = "Error";
  resultDisplay.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-8px)" },
      { transform: "translateX(8px)" },
      { transform: "translateX(0)" }
    ],
    { duration: 220, easing: "ease-out" }
  );
}

function addHistoryItem(savedExpression, result) {
  history = [
    {
      expression: savedExpression,
      result,
      createdAt: new Date().toISOString()
    },
    ...history
  ].slice(0, MAX_HISTORY_ITEMS);

  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  emptyHistory.hidden = history.length > 0;

  history.forEach((item) => {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    const expressionSpan = document.createElement("span");
    const resultSpan = document.createElement("span");

    button.className = "history-item";
    button.type = "button";
    button.dataset.expression = item.expression;
    button.dataset.result = item.result;
    button.setAttribute("aria-label", `Reuse ${toReadableExpression(item.expression)} equals ${item.result}`);

    expressionSpan.className = "history-expression";
    expressionSpan.textContent = toReadableExpression(item.expression);

    resultSpan.className = "history-result";
    resultSpan.textContent = `= ${item.result}`;

    button.append(expressionSpan, resultSpan);
    listItem.append(button);
    historyList.append(listItem);
  });
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [];
  } catch {
    return [];
  }
}

function clearHistory() {
  history = [];
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(lastResult);
    copyResultButton.textContent = "Copied";
  } catch {
    copyResultButton.textContent = "Copy Failed";
  }

  window.setTimeout(() => {
    copyResultButton.textContent = "Copy Result";
  }, 1200);
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light cherry mode" : "Switch to dark cherry mode");
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.body.classList.add("dark-mode");
    themeToggle.setAttribute("aria-label", "Switch to light cherry mode");
  }
}

function toReadableExpression(value) {
  return value
    .replaceAll("*", "×")
    .replaceAll("/", "÷")
    .replaceAll("-", "−");
}