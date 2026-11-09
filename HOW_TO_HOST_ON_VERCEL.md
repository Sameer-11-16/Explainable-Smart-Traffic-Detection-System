# HOW TO DEPLOY TO VERCEL (Complete Step-by-Step Guide)

## 📌 Important Technical Context
- **Frontend (React + Vite + Tailwind CSS)**: Vercel is the world's best platform for this (100% Free, Global Edge CDN, custom domain).
- **Backend (Python + YOLOv8 + PyTorch + OpenCV + SHAP)**:
  - PyTorch is ~1 GB in size.
  - Vercel's Serverless Function has a hard limit of **250 MB** and a **10-15s timeout**.
  - Therefore, the **industry-standard architecture** used by all companies is:
    - **Frontend** deployed on **Vercel** (Free)
    - **AI Backend** deployed on **Render.com** (Free)
    - Both connected together seamlessly via `VITE_API_URL`!

---

## 🚀 STEP-BY-STEP DEPLOYMENT GUIDE (5 Minutes, 100% FREE)

### Step 1: Push Code to GitHub
1. Create a new repository on [github.com](https://github.com/new) (e.g. `smart-traffic-detection`).
2. Run these commands in your project terminal:
```bash
git init
git add .
git commit -m "Explainable Smart Traffic Detection System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-traffic-detection.git
git push -u origin main
```

---

### Step 2: Deploy Backend on Render.com (Free)
1. Go to [render.com](https://render.com) and sign up with GitHub (100% Free).
2. Click **"New +"** -> **"Web Service"**.
3. Select your GitHub repository (`smart-traffic-detection`).
4. Fill in these settings:
   - **Name**: `smart-traffic-backend`
   - **Root Directory**: leave blank (or `backend`)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && gunicorn app:create_app() --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120`
   - **Plan**: `Free`
5. Click **"Deploy Web Service"**.
6. Once deployed, copy your backend URL (e.g. `https://smart-traffic-backend.onrender.com`).

---

### Step 3: Deploy Frontend on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **"Add New..."** -> **"Project"**.
3. Select your GitHub repository (`smart-traffic-detection`).
4. Configure Project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (Click Edit and select the `frontend` folder)
   - **Build Command**: `pnpm run build` (or `npm run build`)
   - **Output Directory**: `dist`
5. **Add Environment Variable** (Crucial step!):
   - Key: `VITE_API_URL`
   - Value: `https://smart-traffic-backend.onrender.com/api` (your backend URL from Step 2 with `/api` at the end)
6. Click **"Deploy"**!

Within 60 seconds, your site will be live at:
👉 **`https://smart-traffic-detection.vercel.app`** 🎉

---

## 💡 Alternative: Host 100% of Everything in One Place (Render)
If you don't want two different platforms and want **Frontend + Backend together on 1 single URL for free**:
1. Go to [render.com](https://render.com)
2. Click **"New +"** -> **"Blueprint"**
3. Select your repository
4. It will automatically read our `render.yaml` file and host both the React UI and Python YOLO Backend together!

