/* ============================================================
   NutriBot — AI Nutrition Agent
   Frontend JavaScript  |  Chat · Dashboard · Meal · BMI · Family · Analyze
   ============================================================ */

"use strict";

// ── State ────────────────────────────────────────────────────
let chatHistory  = [];
let userProfile  = {};
let familyMembers = [];
let memberCounter = 0;

// ── Daily Nutrition Tips ─────────────────────────────────────
const DAILY_TIPS = [
  "Start your day with a glass of warm water and lemon — it kickstarts digestion.",
  "Include a rainbow of vegetables every day. Different colours = different nutrients.",
  "Homemade buttermilk (chaas) is a probiotic powerhouse — great after lunch.",
  "Millets like bajra, jowar, and ragi are ancient Indian superfoods rich in iron and fibre.",
  "Eating slowly and chewing well can reduce overeating by up to 20%.",
  "A small handful of mixed nuts makes for a perfect, nutritious mid-morning snack.",
  "Moong dal is one of the most digestible proteins in Indian cuisine.",
  "Turmeric (haldi) has powerful anti-inflammatory properties — add it to your meals daily.",
  "Drink at least 8 glasses of water. Set hourly reminders if needed.",
  "Replacing white bread with whole wheat roti significantly increases your fibre intake.",
  "Curd (dahi) is a natural probiotic that supports gut health — have it with lunch.",
  "Amla (Indian gooseberry) has 20× more Vitamin C than an orange.",
  "Pre-soaking legumes and lentils reduces cooking time and improves digestibility.",
  "A 10-minute walk after meals helps regulate blood sugar levels.",
  "Seasonal fruits and vegetables are more nutritious and more affordable.",
  "Green tea or tulsi tea in the evening can be a healthier alternative to masala chai.",
  "Sprouted moong or chana is a protein-dense snack you can prepare at home easily.",
  "Don't skip breakfast — even a simple fruit and nuts combo keeps energy levels stable.",
  "Fiber-rich foods like sabja seeds, flaxseeds, and oats keep you full longer.",
  "Cooking in cast iron increases the iron content of your food naturally.",
];

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  showTab("chat");
  showRandomTip();
  addDefaultFamilyMember();
});

function showRandomTip() {
  const tip = DAILY_TIPS[Math.floor(Math.random() * DAILY_TIPS.length)];
  const el = document.getElementById("tipText");
  if (el) el.textContent = tip;
}

// ── Tab Navigation ───────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll(".tab-panel").forEach(el => el.classList.add("d-none"));
  const panel = document.getElementById(`tab-${tab}`);
  if (panel) {
    panel.classList.remove("d-none");
    // Hide hero on non-chat tabs
    const hero = document.getElementById("heroBanner");
    if (hero) hero.style.display = tab === "chat" ? "block" : "none";
  }
  // Update active nav link
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => {
    if (l.getAttribute("onclick") && l.getAttribute("onclick").includes(`'${tab}'`)) {
      l.classList.add("active");
    }
  });
}

// ── Theme Toggle ─────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  const icon = document.getElementById("themeIcon");
  if (icon) icon.className = isDark ? "bi bi-moon-fill" : "bi bi-sun-fill";
}

// ── Profile ──────────────────────────────────────────────────
function saveProfile() {
  const get = id => document.getElementById(id)?.value?.trim() || "";
  userProfile = {
    name: get("pName"),
    age: get("pAge"),
    weight: get("pWeight"),
    height: get("pHeight"),
    gender: get("pGender"),
    goal: get("pGoal"),
    diet_type: get("pDiet"),
    health_conditions: get("pConditions"),
  };
  showToast("Profile saved! NutriBot will personalise advice for you.");

  if (userProfile.weight && userProfile.height) {
    updateQuickStats();
    updateDashboard();
  }
}

function getProfileContext() {
  return Object.keys(userProfile).length > 0 ? userProfile : {};
}

// ── Quick Stats (Sidebar) ─────────────────────────────────────
async function updateQuickStats() {
  const panel = document.getElementById("quickStatsPanel");
  if (!panel) return;
  if (!userProfile.weight || !userProfile.height) return;

  try {
    const bmiRes = await apiFetch("/api/bmi", { weight: parseFloat(userProfile.weight), height: parseFloat(userProfile.height) });
    const calRes = await apiFetch("/api/calories", {
      age: parseInt(userProfile.age) || 30,
      weight: parseFloat(userProfile.weight),
      height: parseFloat(userProfile.height),
      gender: userProfile.gender || "female",
      activity_level: "moderate",
      goal: userProfile.goal || "maintain",
    });

    const colorMap = { success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", info: "#06b6d4" };
    const bmiColor = colorMap[bmiRes.color] || "#3b82f6";

    panel.innerHTML = `
      <div class="d-flex flex-column gap-3">
        <div class="d-flex align-items-center justify-content-between">
          <span class="small fw-600">BMI</span>
          <span class="fw-700" style="color:${bmiColor}">${bmiRes.bmi} <small class="text-muted fw-normal">${bmiRes.category}</small></span>
        </div>
        <div class="d-flex align-items-center justify-content-between">
          <span class="small fw-600">Calorie Target</span>
          <span class="fw-700 text-primary">${calRes.target_calories} kcal</span>
        </div>
        <div class="d-flex align-items-center justify-content-between">
          <span class="small fw-600">Protein Goal</span>
          <span class="fw-700 text-info">${Math.round(parseFloat(userProfile.weight) * 1.2)}g</span>
        </div>
        <div class="d-flex align-items-center justify-content-between">
          <span class="small fw-600">Water (daily)</span>
          <span class="fw-700">${(parseFloat(userProfile.weight) * 0.033).toFixed(1)} L</span>
        </div>
        <div class="small text-muted">Ideal weight: ${bmiRes.ideal_weight_range}</div>
      </div>`;
  } catch (e) {
    panel.innerHTML = `<p class="text-danger small">${e.message}</p>`;
  }
}

// ── Dashboard ─────────────────────────────────────────────────
async function updateDashboard() {
  if (!userProfile.weight || !userProfile.height) return;

  try {
    const bmiRes = await apiFetch("/api/bmi", { weight: parseFloat(userProfile.weight), height: parseFloat(userProfile.height) });
    const calRes = await apiFetch("/api/calories", {
      age: parseInt(userProfile.age) || 30,
      weight: parseFloat(userProfile.weight),
      height: parseFloat(userProfile.height),
      gender: userProfile.gender || "female",
      activity_level: "moderate",
      goal: userProfile.goal || "maintain",
    });

    const target = calRes.target_calories;
    const protein = Math.round(parseFloat(userProfile.weight) * 1.2);
    const water = (parseFloat(userProfile.weight) * 0.033).toFixed(1);

    setText("dTDEE", `${target} kcal`);
    setText("dBMI", `${bmiRes.bmi} (${bmiRes.category})`);
    setText("dProtein", `${protein}g`);
    setText("dWater", `${water}L`);

    // Macro breakdown
    const carbs  = Math.round((target * 0.50) / 4);
    const protG  = Math.round((target * 0.25) / 4);
    const fatG   = Math.round((target * 0.25) / 9);
    const fiberG = 25;
    const maxMacro = Math.max(carbs, protG * 2, fatG * 2);

    document.getElementById("macroChartContainer").innerHTML = `
      <div class="macro-bar">
        <div class="macro-label"><span>Carbohydrates</span><span>${carbs}g · ${Math.round(target * 0.50)} kcal</span></div>
        <div class="macro-progress"><div class="macro-fill carbs" style="width:${(carbs/maxMacro*100).toFixed(0)}%"></div></div>
      </div>
      <div class="macro-bar">
        <div class="macro-label"><span>Protein</span><span>${protG}g · ${Math.round(target * 0.25)} kcal</span></div>
        <div class="macro-progress"><div class="macro-fill protein" style="width:${(protG/maxMacro*100*2).toFixed(0)}%"></div></div>
      </div>
      <div class="macro-bar">
        <div class="macro-label"><span>Fat</span><span>${fatG}g · ${Math.round(target * 0.25)} kcal</span></div>
        <div class="macro-progress"><div class="macro-fill fat" style="width:${(fatG/maxMacro*100*2).toFixed(0)}%"></div></div>
      </div>
      <div class="macro-bar">
        <div class="macro-label"><span>Fibre (target)</span><span>${fiberG}g</span></div>
        <div class="macro-progress"><div class="macro-fill fiber" style="width:50%"></div></div>
      </div>
    `;

    // Meal distribution
    const meals = [
      { name: "Breakfast",         pct: 25, color: "#3b82f6" },
      { name: "Mid-Morning Snack", pct: 10, color: "#22c55e" },
      { name: "Lunch",             pct: 35, color: "#f59e0b" },
      { name: "Evening Snack",     pct: 10, color: "#8b5cf6" },
      { name: "Dinner",            pct: 20, color: "#ef4444" },
    ];

    document.getElementById("mealDistContainer").innerHTML = meals.map(m => {
      const kcal = Math.round(target * m.pct / 100);
      return `
        <div class="meal-dist-item">
          <div class="meal-dist-label">${m.name}</div>
          <div class="meal-dist-bar">
            <div class="meal-dist-fill" style="width:${m.pct}%;background:${m.color}">${kcal} kcal</div>
          </div>
        </div>`;
    }).join("");

  } catch (e) {
    console.error("Dashboard error:", e);
  }
}

// ── Chat ──────────────────────────────────────────────────────
function handleChatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
}

async function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;

  appendMessage("user", msg);
  input.value = "";
  autoResizeTextarea(input);
  chatHistory.push({ role: "user", content: msg });

  const typingId = showTyping();
  disableSend(true);

  try {
    const data = await apiFetch("/api/chat", {
      message: msg,
      history: chatHistory.slice(-10),
      profile: getProfileContext(),
    });
    removeTyping(typingId);
    appendMessage("bot", data.reply);
    chatHistory.push({ role: "assistant", content: data.reply });
  } catch (err) {
    removeTyping(typingId);
    appendMessage("bot", `Sorry, I encountered an error: ${err.message}. Please check your API credentials in the .env file.`);
  } finally {
    disableSend(false);
    document.getElementById("chatInput").focus();
  }
}

function quickPrompt(text) {
  document.getElementById("chatInput").value = text;
  showTab("chat");
  sendChat();
}

function clearChat() {
  chatHistory = [];
  const win = document.getElementById("chatWindow");
  win.innerHTML = `
    <div class="chat-msg bot">
      <div class="avatar"><i class="bi bi-robot"></i></div>
      <div class="bubble"><p>Chat cleared! How can I help you with your nutrition today?</p></div>
    </div>`;
}

function appendMessage(role, text) {
  const win = document.getElementById("chatWindow");
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="avatar"><i class="bi bi-${role === "bot" ? "robot" : "person-fill"}"></i></div>
    <div class="bubble">${formatMarkdown(text)}</div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function showTyping() {
  const win = document.getElementById("chatWindow");
  const id = `typing-${Date.now()}`;
  const div = document.createElement("div");
  div.className = "chat-msg bot";
  div.id = id;
  div.innerHTML = `
    <div class="avatar"><i class="bi bi-robot"></i></div>
    <div class="bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

function disableSend(state) {
  const btn = document.getElementById("sendBtn");
  if (btn) btn.disabled = state;
}

// ── Meal Plan ─────────────────────────────────────────────────
async function generateMealPlan() {
  const days     = document.getElementById("mealDays").value;
  const cuisine  = document.getElementById("mealCuisine").value;
  const special  = document.getElementById("mealSpecial").value.trim();

  const profile = { ...getProfileContext(), cuisine_preference: cuisine };
  if (special) profile.special_requirements = special;

  showLoading("Generating your personalised meal plan...");

  try {
    const data = await apiFetch("/api/meal-plan", { days: parseInt(days), profile });
    hideLoading();
    const output = document.getElementById("mealPlanOutput");
    output.innerHTML = `<div class="ai-output">${formatMarkdown(data.meal_plan)}</div>`;
    document.getElementById("copyMealBtn").style.display = "inline-flex";
  } catch (e) {
    hideLoading();
    document.getElementById("mealPlanOutput").innerHTML = `<p class="text-danger">Error: ${e.message}</p>`;
  }
}

function copyMealPlan() {
  const text = document.querySelector("#mealPlanOutput .ai-output")?.innerText || "";
  navigator.clipboard.writeText(text).then(() => showToast("Meal plan copied to clipboard!"));
}

// ── BMI Calculator ────────────────────────────────────────────
async function calculateBMI() {
  const weight   = parseFloat(document.getElementById("bmiWeight").value);
  const height   = parseFloat(document.getElementById("bmiHeight").value);
  const age      = parseInt(document.getElementById("bmiAge").value) || 30;
  const gender   = document.getElementById("bmiGender").value;
  const activity = document.getElementById("bmiActivity").value;
  const goal     = document.getElementById("bmiGoal").value;

  if (!weight || !height) { showToast("Please enter weight and height."); return; }

  showLoading("Calculating...");
  try {
    const [bmiRes, calRes] = await Promise.all([
      apiFetch("/api/bmi",     { weight, height }),
      apiFetch("/api/calories",{ age, weight, height, gender, activity_level: activity, goal }),
    ]);
    hideLoading();

    const colorMap = { success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", info: "#06b6d4" };
    const bmiColor = colorMap[bmiRes.color] || "#3b82f6";

    const resultCard = document.getElementById("bmiResultCard");
    resultCard.querySelector(".card-body").innerHTML = `
      <div class="bmi-circle" style="border-color:${bmiColor};color:${bmiColor}">
        <div class="bmi-num">${bmiRes.bmi}</div>
        <div class="bmi-label">${bmiRes.category}</div>
      </div>
      <div class="bmi-scale">
        <div style="background:#06b6d4;flex:1.85" title="Underweight < 18.5"></div>
        <div style="background:#22c55e;flex:6.5"  title="Normal 18.5–24.9"></div>
        <div style="background:#f59e0b;flex:5"    title="Overweight 25–29.9"></div>
        <div style="background:#ef4444;flex:5"    title="Obese ≥ 30"></div>
      </div>
      <div class="bmi-range-labels"><span>Underweight</span><span>Normal</span><span>Overweight</span><span>Obese</span></div>
      <hr class="my-3" style="border-color:var(--border)">
      <div class="row g-2 text-center mt-2">
        <div class="col-6">
          <div class="small text-muted">Ideal Weight Range</div>
          <div class="fw-700">${bmiRes.ideal_weight_range}</div>
        </div>
        <div class="col-6">
          <div class="small text-muted">Calorie Target</div>
          <div class="fw-700 text-primary">${calRes.target_calories} kcal</div>
        </div>
        <div class="col-6">
          <div class="small text-muted">BMR</div>
          <div class="fw-700">${calRes.bmr} kcal</div>
        </div>
        <div class="col-6">
          <div class="small text-muted">TDEE</div>
          <div class="fw-700">${calRes.tdee} kcal</div>
        </div>
      </div>
      <div class="mt-3 p-2 rounded small" style="background:var(--surface-2);color:var(--text-muted)">
        Tip: BMI is a screening tool, not a complete health measure. 
        Consult a healthcare professional for a full assessment.
      </div>`;
  } catch (e) {
    hideLoading();
    showToast(`Error: ${e.message}`);
  }
}

// ── Family Plan ───────────────────────────────────────────────
function addDefaultFamilyMember() {
  addFamilyMember("You", 28, "female", "maintain");
}

function addFamilyMember(name = "", age = "", gender = "female", goal = "maintain") {
  memberCounter++;
  const id = `member-${memberCounter}`;
  const container = document.getElementById("familyMembersContainer");

  const card = document.createElement("div");
  card.className = "family-member-card";
  card.id = id;
  card.innerHTML = `
    <div class="family-member-header">
      <span><i class="bi bi-person-circle me-2" style="color:var(--primary)"></i>Member ${memberCounter}</span>
      <button class="btn-danger-outline" onclick="removeMember('${id}')"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="row g-2">
      <div class="col-12 col-sm-6">
        <input type="text" class="form-control form-control-sm" placeholder="Name" value="${name}" data-field="name" />
      </div>
      <div class="col-6 col-sm-3">
        <input type="number" class="form-control form-control-sm" placeholder="Age" value="${age}" min="1" max="100" data-field="age" />
      </div>
      <div class="col-6 col-sm-3">
        <select class="form-select form-select-sm" data-field="gender">
          <option value="female" ${gender==="female"?"selected":""}>Female</option>
          <option value="male"   ${gender==="male"?"selected":""}>Male</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="col-12">
        <select class="form-select form-select-sm" data-field="goal">
          <option value="maintain"    ${goal==="maintain"?"selected":""}>Maintain Weight</option>
          <option value="lose_weight" ${goal==="lose_weight"?"selected":""}>Lose Weight</option>
          <option value="gain_muscle" ${goal==="gain_muscle"?"selected":""}>Gain Muscle</option>
          <option value="gain_weight" ${goal==="gain_weight"?"selected":""}>Gain Weight</option>
          <option value="healthy_eating">Healthy Eating</option>
          <option value="child_nutrition">Child Nutrition</option>
        </select>
      </div>
    </div>`;
  container.appendChild(card);
}

function removeMember(id) {
  document.getElementById(id)?.remove();
}

function collectFamilyMembers() {
  const cards = document.querySelectorAll(".family-member-card");
  return Array.from(cards).map(card => ({
    name:   card.querySelector('[data-field="name"]')?.value   || "Member",
    age:    card.querySelector('[data-field="age"]')?.value    || "?",
    gender: card.querySelector('[data-field="gender"]')?.value || "female",
    goal:   card.querySelector('[data-field="goal"]')?.value   || "maintain",
  }));
}

async function generateFamilyPlan() {
  const members = collectFamilyMembers();
  if (members.length === 0) { showToast("Add at least one family member."); return; }

  showLoading("Creating your family nutrition plan...");
  try {
    const data = await apiFetch("/api/family-plan", { members });
    hideLoading();
    document.getElementById("familyPlanOutput").innerHTML =
      `<div class="ai-output">${formatMarkdown(data.family_plan)}</div>`;
  } catch (e) {
    hideLoading();
    document.getElementById("familyPlanOutput").innerHTML =
      `<p class="text-danger">Error: ${e.message}</p>`;
  }
}

// ── Food Analyzer ─────────────────────────────────────────────
function setFood(text) {
  document.getElementById("foodInput").value = text;
}

async function analyzeFood() {
  const food = document.getElementById("foodInput").value.trim();
  if (!food) { showToast("Please describe the food or meal."); return; }

  showLoading("Analysing nutrition...");
  try {
    const data = await apiFetch("/api/analyze-food", { food });
    hideLoading();
    document.getElementById("foodAnalysisOutput").innerHTML =
      `<div class="ai-output">${formatMarkdown(data.analysis)}</div>`;
  } catch (e) {
    hideLoading();
    document.getElementById("foodAnalysisOutput").innerHTML =
      `<p class="text-danger">Error: ${e.message}</p>`;
  }
}

// ── Utilities ─────────────────────────────────────────────────
async function apiFetch(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

function showLoading(text = "Please wait...") {
  const overlay = document.getElementById("loadingOverlay");
  const msg     = document.getElementById("loadingText");
  if (overlay) { overlay.classList.remove("d-none"); overlay.style.display = "flex"; }
  if (msg) msg.textContent = text;
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) { overlay.classList.add("d-none"); overlay.style.display = ""; }
}

function showToast(message) {
  const el  = document.getElementById("appToast");
  const msg = document.getElementById("toastMsg");
  if (!el || !msg) return;
  msg.textContent = message;
  const toast = bootstrap.Toast.getOrCreateInstance(el, { delay: 3000 });
  toast.show();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

document.getElementById("chatInput")?.addEventListener("input", function () {
  autoResizeTextarea(this);
});

/** Very lightweight markdown → HTML converter for AI output */
function formatMarkdown(text) {
  if (!text) return "";
  return text
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,  "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,   "<h2>$1</h2>")
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/__(.+?)__/g,     "<strong>$1</strong>")
    // Unordered list items
    .replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>")
    // Ordered list items
    .replace(/^\s*\d+\.\s(.+)$/gm, "<li>$1</li>")
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
    // Line breaks to paragraphs
    .split(/\n{2,}/)
    .map(block => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith("<h") || block.startsWith("<ul>") || block.startsWith("<li>")) return block;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}
