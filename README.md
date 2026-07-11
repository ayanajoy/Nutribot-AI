# NutriBot — AI Nutrition Agent
### Powered by IBM Watsonx.ai · Granite-3 · Flask · Bootstrap 5

---

## Features

| Feature | Description |
|---|---|
| **AI Chat** | Real-time nutrition Q&A powered by IBM Granite-3 model |
| **Meal Planner** | 1–7 day AI-generated Indian & international meal plans |
| **BMI Calculator** | BMI + BMR + TDEE + ideal weight range |
| **Nutrition Dashboard** | Visual macro breakdown & calorie distribution |
| **Family Planner** | Personalised plans for each family member |
| **Food Analyzer** | Calorie & macro analysis of any meal description |
| **Dark Mode** | Full light/dark theme toggle |
| **Mobile Responsive** | Works on phone, tablet, and desktop |

---

## Project Structure

```
nutrition-agent/
├── app.py                  # Flask backend + AGENT_INSTRUCTIONS
├── requirements.txt
├── .env.example            # Copy to .env and fill credentials
├── templates/
│   └── index.html          # Full SPA frontend
└── static/
    ├── style.css           # Themes, animations, responsive
    └── app.js              # Chat, BMI, meal plan, family logic
```

---

## Quick Start

### 1. Prerequisites
- Python 3.10+
- IBM Cloud account with Watsonx.ai access
- A Watsonx.ai project (from [cloud.ibm.com](https://cloud.ibm.com))

---

### 2. Get IBM Credentials

1. Go to [cloud.ibm.com → Manage → Access → API Keys](https://cloud.ibm.com/iam/apikeys)
2. Click **Create an IBM Cloud API key** — copy it
3. Go to [dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com)
4. Open your Watsonx project → **Manage** → copy the **Project ID**

---

### 3. Install & Configure

```bash
# Clone / download the project
cd nutrition-agent

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure credentials
cp .env.example .env
# → Edit .env and fill in IBM_API_KEY and IBM_WATSONX_PROJECT_ID
```

`.env` file:
```env
IBM_API_KEY=your_ibm_cloud_api_key
IBM_WATSONX_URL=https://us-south.ml.cloud.ibm.com
IBM_WATSONX_PROJECT_ID=your_project_id
WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct
FLASK_SECRET_KEY=your_random_secret_key
FLASK_DEBUG=False
FLASK_PORT=5000
```

---

### 4. Run Locally

```bash
python app.py
```

Open http://localhost:5000 in your browser.

---

## Customising the Agent

All agent behaviour is controlled by the `AGENT_INSTRUCTIONS` block at the top of **`app.py`**. You can edit it freely without touching any other code:

```python
AGENT_INSTRUCTIONS = """
You are NutriBot, ...

## PERSONALITY & TONE
...

## SPECIALIZATIONS
- Add your preferred cuisine here
- Add region-specific preferences

## SAFETY RULES
...
"""
```

**Common customisations:**

| What to change | Where |
|---|---|
| Agent name | Change `NutriBot` in `AGENT_INSTRUCTIONS` |
| Tone (formal/casual) | Edit `## PERSONALITY & TONE` section |
| Cuisine specialisation | Edit `## SPECIALIZATIONS` section |
| Diet defaults (veg/non-veg) | Edit `## SPECIALIZATIONS` section |
| Safety guardrails | Edit `## SAFETY RULES` section |
| Calorie restriction limits | Edit `## SAFETY RULES` section |
| Response format | Edit `## RESPONSE FORMAT RULES` section |
| Indian festival advice | Add to `## SPECIALIZATIONS` section |
| Model (switch Granite version) | Set `WATSONX_MODEL_ID` in `.env` |

---

## Available Granite Models (Watsonx.ai)

| Model ID | Notes |
|---|---|
| `ibm/granite-3-3-8b-instruct` | Recommended — fast, instruction-tuned |
| `ibm/granite-3-8b-instruct` | Granite 3.0 base |
| `ibm/granite-13b-instruct-v2` | Larger, more detailed responses |
| `ibm/granite-20b-multilingual` | Multi-language support |

Change via `WATSONX_MODEL_ID` in `.env`.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Main web app |
| `POST` | `/api/chat` | AI chat — send `{message, history, profile}` |
| `POST` | `/api/meal-plan` | Generate meal plan — send `{days, profile}` |
| `POST` | `/api/family-plan` | Family plan — send `{members:[...]}` |
| `POST` | `/api/analyze-food` | Analyse food — send `{food: "description"}` |
| `POST` | `/api/bmi` | BMI calc — send `{weight, height}` |
| `POST` | `/api/calories` | Calorie calc — send `{age,weight,height,gender,...}` |
| `GET` | `/api/health` | Health check |

---

## Production Deployment

### Option A — Gunicorn (Linux/Mac)

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

### Option B — IBM Code Engine (Serverless)

```bash
# Build container
docker build -t nutribot .
# Push to IBM Container Registry
ibmcloud cr push us.icr.io/<namespace>/nutribot
# Deploy to Code Engine
ibmcloud ce app create --name nutribot --image us.icr.io/<namespace>/nutribot --port 5000
```

### Option C — Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

### Option D — Railway / Render

1. Push repo to GitHub
2. Connect to Railway or Render
3. Set environment variables in their dashboard (same as `.env`)
4. Deploy — they auto-detect Flask

---

## Security Notes

- **Never commit `.env`** — it's already in `.gitignore`
- Use a strong random `FLASK_SECRET_KEY` (e.g., `python -c "import secrets; print(secrets.token_hex(32))"`)
- Set `FLASK_DEBUG=False` in production
- Use HTTPS in production (Railway/Render provide this automatically)

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `401 Unauthorized` | Check `IBM_API_KEY` in `.env` |
| `404 Project not found` | Verify `IBM_WATSONX_PROJECT_ID` |
| `Model not found` | Check `WATSONX_MODEL_ID` spelling |
| Empty response | Increase `MAX_NEW_TOKENS` in `app.py` |
| Slow responses | Switch to `granite-3-3-8b-instruct` (fastest) |
| CORS error | Ensure `flask-cors` is installed |

---

## License

MIT — free for personal and commercial use.

---

*Built with IBM Watsonx.ai · Granite · Flask · Bootstrap 5*
