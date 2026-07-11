"""
╔══════════════════════════════════════════════════════════════╗
║          IBM Watsonx.ai — AI Nutrition Agent                 ║
║          Flask Backend  |  Granite-3 Model                   ║
╚══════════════════════════════════════════════════════════════╝
"""

import os
import json
import re
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─────────────────────────────────────────────────────────────
#  AGENT INSTRUCTIONS  ← Customize everything here
# ─────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = """
You are NutriBot, a warm, knowledgeable, and motivating AI Nutrition Coach powered by IBM Watsonx.ai.

## PERSONALITY & TONE
- Friendly, encouraging, and empathetic — never judgmental about food choices or body weight.
- Use simple, plain language. Avoid heavy medical jargon unless the user asks for detail.
- Celebrate small wins ("Great choice!", "That's a step in the right direction!").
- Keep responses concise: use bullet points and short paragraphs for readability.

## SPECIALIZATIONS
- Indian cuisine expertise: recommend dals, sabzis, rotis, rice dishes, idli, dosa, poha, upma,
  chaas, lassi, kadhi, etc. Always suggest healthy Indian alternatives first.
- Understand regional Indian diets: North Indian, South Indian, Bengali, Gujarati, Maharashtrian.
- International cuisine awareness for users who prefer it.
- Vegetarian and vegan diet support as a default preference.
- Diabetes-friendly, heart-healthy, weight-loss, muscle-gain, and PCOD/PCOS diet plans.

## CORE CAPABILITIES
1. Personalized meal plans (daily / weekly) based on age, weight, height, goal, and health conditions.
2. Calorie and macro breakdowns (protein, carbs, fat, fiber) for meals.
3. Family nutrition planning — different plans for kids (2–12), teens (13–18), adults, seniors (60+).
4. BMI interpretation and healthy weight-range guidance.
5. Healthy food swaps (e.g., "Replace white rice with brown rice or millet for better fiber.").
6. Hydration reminders and tips.
7. Festive / seasonal food advice for Indian festivals (Diwali sweets in moderation, Navratri fasting, etc.).

## RESPONSE FORMAT RULES
- When giving a meal plan, structure it as: Breakfast | Mid-Morning Snack | Lunch | Evening Snack | Dinner.
- Always include approximate calories for each meal when asked.
- When doing calorie analysis, present a clear table or bullet list.
- End every response with one short motivational tip or emoji-free encouragement line.

## SAFETY RULES
- NEVER diagnose medical conditions or replace a doctor's advice.
- Always advise consulting a registered dietitian or doctor for serious health conditions.
- Do not recommend extreme calorie restriction (< 1200 kcal/day for women, < 1500 kcal/day for men).
- Do not recommend supplements or medications.
- If a user shows signs of an eating disorder, gently suggest professional help.
- Decline requests for advice on extreme fasting, crash diets, or unsafe weight-loss practices.

## CONTEXT AWARENESS
- Remember user profile data (name, age, weight, height, goal, family members) provided in the conversation.
- Adapt recommendations if health conditions are mentioned (diabetes, hypertension, thyroid, pregnancy).
- Prioritize locally available, affordable, and seasonal ingredients in India.
"""

# ─────────────────────────────────────────────────────────────
#  App Setup
# ─────────────────────────────────────────────────────────────
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutribot-secret-2025")
CORS(app)

# ─────────────────────────────────────────────────────────────
#  Watsonx.ai Client
# ─────────────────────────────────────────────────────────────
# Valid IBM Watsonx.ai region base URLs
WATSONX_REGION_URLS = {
    "us-south": "https://us-south.ml.cloud.ibm.com",
    "eu-de":    "https://eu-de.ml.cloud.ibm.com",
    "eu-gb":    "https://eu-gb.ml.cloud.ibm.com",
    "jp-tok":   "https://jp-tok.ml.cloud.ibm.com",
    "au-syd":   "https://au-syd.ml.cloud.ibm.com",
}


def _resolve_watsonx_url() -> str:
    """
    Return the Watsonx.ai URL to use, with validation.
    Accepts either a full URL (https://...) or a short region key (e.g. 'us-south').
    Always falls back to us-south if nothing is configured.
    """
    raw = os.getenv("IBM_WATSONX_URL", "us-south").strip().rstrip("/")
    if raw.startswith("https://"):
        return raw          # caller supplied a full URL — use as-is
    # treat it as a short region key
    resolved = WATSONX_REGION_URLS.get(raw)
    if resolved:
        return resolved
    # unrecognised value — warn and fall back to us-south
    app.logger.warning(
        "IBM_WATSONX_URL '%s' is not a recognised region key or valid URL. "
        "Falling back to us-south. Valid region keys: %s",
        raw, list(WATSONX_REGION_URLS.keys()),
    )
    return WATSONX_REGION_URLS["us-south"]


def get_watsonx_model():
    """Initialise and return a Watsonx.ai ModelInference instance."""
    api_key    = os.getenv("IBM_API_KEY", "").strip()
    project_id = os.getenv("IBM_WATSONX_PROJECT_ID", "").strip()
    url        = _resolve_watsonx_url()

    # Fail fast with a clear message rather than a cryptic SDK error
    if not api_key or api_key == "your_ibm_cloud_api_key_here":
        raise RuntimeError(
            "IBM_API_KEY is not set. "
            "Copy .env.example to .env and add your IBM Cloud API key."
        )
    if not project_id or project_id == "your_watsonx_project_id_here":
        raise RuntimeError(
            "IBM_WATSONX_PROJECT_ID is not set. "
            "Copy .env.example to .env and add your Watsonx project ID."
        )

    credentials = Credentials(api_key=api_key, url=url)
    model_id = os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")

    parameters = {
        GenParams.MAX_NEW_TOKENS: 1024,
        GenParams.MIN_NEW_TOKENS: 30,
        GenParams.TEMPERATURE: 0.7,
        GenParams.TOP_P: 0.9,
        GenParams.TOP_K: 50,
        GenParams.REPETITION_PENALTY: 1.1,
    }

    return ModelInference(
        model_id=model_id,
        credentials=credentials,
        project_id=project_id,
        params=parameters,
    )


# Lazy-init — created once on first request, reset on config error so a
# restart after fixing .env picks up the new credentials automatically.
_watsonx_model = None

def _model():
    global _watsonx_model
    if _watsonx_model is None:
        _watsonx_model = get_watsonx_model()
    return _watsonx_model

def _reset_model():
    """Call this to force re-initialisation (e.g. after .env is updated)."""
    global _watsonx_model
    _watsonx_model = None


# ─────────────────────────────────────────────────────────────
#  Prompt Builder
# ─────────────────────────────────────────────────────────────
def build_prompt(user_message: str, history: list, user_profile: dict) -> str:
    """Construct a full prompt string for the Granite model."""
    profile_block = ""
    if user_profile:
        profile_block = "## User Profile\n"
        for k, v in user_profile.items():
            if v:
                profile_block += f"- {k.replace('_', ' ').title()}: {v}\n"
        profile_block += "\n"

    history_block = ""
    for turn in history[-6:]:          # keep last 6 turns to stay within context
        role = "User" if turn["role"] == "user" else "NutriBot"
        history_block += f"{role}: {turn['content']}\n"

    prompt = (
        f"<|system|>\n{AGENT_INSTRUCTIONS}\n\n{profile_block}<|end|>\n"
        f"<|user|>\n{history_block}User: {user_message}\n<|end|>\n"
        f"<|assistant|>\nNutriBot:"
    )
    return prompt


# ─────────────────────────────────────────────────────────────
#  Helper: BMI Calculation
# ─────────────────────────────────────────────────────────────
def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    height_m = height_cm / 100.0
    bmi = round(weight_kg / (height_m ** 2), 1)
    if bmi < 18.5:
        category, color = "Underweight", "info"
    elif bmi < 25.0:
        category, color = "Normal weight", "success"
    elif bmi < 30.0:
        category, color = "Overweight", "warning"
    else:
        category, color = "Obese", "danger"
    ideal_low = round(18.5 * (height_m ** 2), 1)
    ideal_high = round(24.9 * (height_m ** 2), 1)
    return {
        "bmi": bmi,
        "category": category,
        "color": color,
        "ideal_weight_range": f"{ideal_low} – {ideal_high} kg",
    }


# ─────────────────────────────────────────────────────────────
#  Helper: Daily Calorie Estimate (Mifflin-St Jeor)
# ─────────────────────────────────────────────────────────────
def estimate_daily_calories(age, weight_kg, height_cm, gender, activity_level, goal):
    if gender.lower() == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

    activity_map = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }
    multiplier = activity_map.get(activity_level, 1.375)
    tdee = round(bmr * multiplier)

    goal_map = {
        "lose_weight": tdee - 500,
        "maintain": tdee,
        "gain_muscle": tdee + 300,
        "gain_weight": tdee + 500,
    }
    target = goal_map.get(goal, tdee)
    return {"bmr": round(bmr), "tdee": tdee, "target_calories": target}


# ─────────────────────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint — calls Watsonx.ai Granite model."""
    data = request.get_json(force=True)
    user_message = (data.get("message") or "").strip()
    history      = data.get("history", [])
    user_profile = data.get("profile", {})

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    prompt = build_prompt(user_message, history, user_profile)

    try:
        response = _model().generate_text(prompt=prompt)
        # Strip the leading "NutriBot:" prefix if echoed back
        reply = re.sub(r"^NutriBot:\s*", "", response, flags=re.IGNORECASE).strip()
    except RuntimeError as exc:
        # Configuration errors (missing API key / project ID)
        app.logger.error("Config error: %s", exc)
        return jsonify({"error": f"Configuration error: {str(exc)}"}), 500
    except Exception as exc:
        _reset_model()   # force re-init next call in case of transient auth error
        app.logger.error("Watsonx.ai error: %s", exc)
        return jsonify({"error": f"AI model error: {str(exc)}"}), 500

    return jsonify({
        "reply": reply,
        "timestamp": datetime.utcnow().isoformat(),
    })


@app.route("/api/bmi", methods=["POST"])
def bmi_api():
    """Calculate BMI and return structured result."""
    data = request.get_json(force=True)
    try:
        weight = float(data["weight"])
        height = float(data["height"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "Provide valid weight (kg) and height (cm)"}), 400

    result = calculate_bmi(weight, height)
    return jsonify(result)


@app.route("/api/calories", methods=["POST"])
def calories_api():
    """Return BMR, TDEE, and target calories."""
    data = request.get_json(force=True)
    try:
        result = estimate_daily_calories(
            age=int(data["age"]),
            weight_kg=float(data["weight"]),
            height_cm=float(data["height"]),
            gender=data.get("gender", "female"),
            activity_level=data.get("activity_level", "moderate"),
            goal=data.get("goal", "maintain"),
        )
    except (KeyError, ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(result)


@app.route("/api/meal-plan", methods=["POST"])
def meal_plan_api():
    """Generate an AI meal plan via Watsonx.ai based on profile."""
    data = request.get_json(force=True)
    profile = data.get("profile", {})
    days = int(data.get("days", 1))
    days = min(days, 7)   # cap at 7 days

    plan_request = (
        f"Generate a {days}-day meal plan for me. "
        f"Include breakfast, mid-morning snack, lunch, evening snack, and dinner. "
        f"Provide approximate calories per meal. "
        f"Prefer Indian vegetarian food unless I specified otherwise. "
        f"Format clearly day by day."
    )

    prompt = build_prompt(plan_request, [], profile)
    try:
        response = _model().generate_text(prompt=prompt)
        reply = re.sub(r"^NutriBot:\s*", "", response, flags=re.IGNORECASE).strip()
    except RuntimeError as exc:
        return jsonify({"error": f"Configuration error: {str(exc)}"}), 500
    except Exception as exc:
        _reset_model()
        return jsonify({"error": str(exc)}), 500

    return jsonify({"meal_plan": reply, "days": days})


@app.route("/api/family-plan", methods=["POST"])
def family_plan_api():
    """Generate nutrition advice for each family member."""
    data = request.get_json(force=True)
    members = data.get("members", [])

    if not members:
        return jsonify({"error": "Provide at least one family member."}), 400

    members_text = "\n".join(
        f"- {m.get('name', 'Member')}, Age {m.get('age', '?')}, "
        f"Gender: {m.get('gender', '?')}, Goal: {m.get('goal', 'healthy eating')}"
        for m in members
    )

    family_request = (
        f"Create a combined family nutrition plan for the following members:\n"
        f"{members_text}\n\n"
        f"Give a brief daily meal suggestion for each member separately, "
        f"keeping Indian vegetarian food as the base. "
        f"Highlight any special dietary considerations."
    )

    prompt = build_prompt(family_request, [], {})
    try:
        response = _model().generate_text(prompt=prompt)
        reply = re.sub(r"^NutriBot:\s*", "", response, flags=re.IGNORECASE).strip()
    except RuntimeError as exc:
        return jsonify({"error": f"Configuration error: {str(exc)}"}), 500
    except Exception as exc:
        _reset_model()
        return jsonify({"error": str(exc)}), 500

    return jsonify({"family_plan": reply})


@app.route("/api/analyze-food", methods=["POST"])
def analyze_food():
    """Analyze nutritional content of a described meal."""
    data = request.get_json(force=True)
    food_description = (data.get("food") or "").strip()

    if not food_description:
        return jsonify({"error": "Provide a food description."}), 400

    analysis_request = (
        f"Analyze the nutritional content of the following meal or food item: "
        f"'{food_description}'. "
        f"Provide: approximate calories, protein (g), carbohydrates (g), fat (g), fiber (g), "
        f"key vitamins/minerals, and a health rating out of 10. "
        f"Also suggest one healthier swap or improvement."
    )

    prompt = build_prompt(analysis_request, [], {})
    try:
        response = _model().generate_text(prompt=prompt)
        reply = re.sub(r"^NutriBot:\s*", "", response, flags=re.IGNORECASE).strip()
    except RuntimeError as exc:
        return jsonify({"error": f"Configuration error: {str(exc)}"}), 500
    except Exception as exc:
        _reset_model()
        return jsonify({"error": str(exc)}), 500

    return jsonify({"analysis": reply})


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "model": os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct"),
        "watsonx_url": _resolve_watsonx_url(),
        "project_id_set": bool(os.getenv("IBM_WATSONX_PROJECT_ID", "").strip()),
        "api_key_set": bool(os.getenv("IBM_API_KEY", "").strip()),
        "timestamp": datetime.utcnow().isoformat(),
    })


# ─────────────────────────────────────────────────────────────
#  Entry Point
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    print(f"\n  NutriBot is running at http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
