# Production Deployment Guide

## 🚀 Recommended Production Stack

### **Frontend**: Vercel (Free tier available)
### **Backend**: Railway (Free tier available) 
### **Database**: Supabase (Free tier available)

---

## 📋 Step-by-Step Production Deployment

### **1. Database Setup (Supabase)**

1. **Create Supabase Project**: https://supabase.com
2. **Run SQL Schema**:
   - Copy contents of `session-storage-schema.sql`
   - Paste in Supabase SQL Editor
   - Execute the commands
3. **Get Connection Details**:
   - Project URL: `https://your-project.supabase.co`
   - Service Role Key: From Project Settings → API

### **2. Backend Deployment (Railway)**

1. **Create Railway Account**: https://railway.app
2. **Deploy from GitHub**:
   ```bash
   # Connect your GitHub repo to Railway
   # Railway will auto-detect Node.js and deploy
   ```

3. **Set Environment Variables** in Railway Dashboard:
   ```bash
   NODE_ENV=production
   PORT=3001
   OPENAI_API_KEY=your_openai_api_key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   FRONTEND_URL=https://your-frontend.vercel.app
   
   # Optional: Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=https://your-backend.railway.app/auth/google/callback
   ```

4. **Get Backend URL**: `https://your-app.railway.app`

### **3. Frontend Deployment (Vercel)**

1. **Create Vercel Account**: https://vercel.com
2. **Deploy from GitHub**:
   ```bash
   # Connect your GitHub repo to Vercel
   # Vercel will auto-detect Vue.js and deploy
   ```

3. **Set Environment Variables** in Vercel Dashboard:
   ```bash
   VUE_APP_API_URL=https://your-backend.railway.app
   VUE_APP_ENVIRONMENT=production
   ```

4. **Build Settings**:
   - Framework Preset: **Vue.js**
   - Build Command: `cd frontend && npm run build`
   - Output Directory: `frontend/dist`

---

## 🔧 Alternative Deployment Options

### **Budget Option (All Free Tiers)**
- **Frontend**: Netlify
- **Backend**: Railway/Render
- **Database**: Supabase

### **Enterprise Option**
- **Frontend**: AWS S3 + CloudFront
- **Backend**: AWS ECS/EKS
- **Database**: AWS RDS PostgreSQL

### **Self-Hosted Option**
- **Server**: DigitalOcean Droplet ($5/month)
- **Setup**: Docker + Nginx + PM2
- **Database**: Self-hosted PostgreSQL

---

## 🛡️ Production Security Checklist

### **Environment Variables**
- ✅ Never commit `.env` files
- ✅ Use production-grade API keys
- ✅ Enable rate limiting (already configured)
- ✅ Use HTTPS everywhere

### **Database Security**
- ✅ Row Level Security enabled (already configured)
- ✅ Service role key kept secret
- ✅ Regular backups enabled

### **API Security**
- ✅ CORS properly configured
- ✅ Input validation on all endpoints
- ✅ Rate limiting enabled
- ✅ Authentication middleware active

---

## 📊 Monitoring & Analytics

### **Recommended Tools**
- **Error Tracking**: Sentry
- **Analytics**: Google Analytics 4
- **Uptime Monitoring**: UptimeRobot
- **Performance**: Vercel Analytics

### **Setup Instructions**
```bash
# Add to frontend package.json
npm install @sentry/vue @sentry/tracing

# Add to main.js
import * as Sentry from "@sentry/vue"
```

---

## 🔄 CI/CD Pipeline

### **GitHub Actions** (Recommended)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      # Railway auto-deploys on push
```

---

## 💰 Cost Estimation

### **Free Tier (Perfect for MVP)**
- Vercel: Free (100GB bandwidth)
- Railway: Free (512MB RAM, $5/month after)
- Supabase: Free (500MB database, 2GB bandwidth)
- **Total**: $0-5/month

### **Production Scale**
- Vercel Pro: $20/month
- Railway: $10-50/month (based on usage)
- Supabase Pro: $25/month
- **Total**: $55-95/month

---

## 🚀 Quick Deploy Commands

```bash
# 1. Build frontend for production
cd frontend
npm run build

# 2. Test production build locally
npm install -g serve
serve -s dist

# 3. Deploy backend (if using PM2)
cd backend
pm2 start server.js --name "personal-assistant"

# 4. Setup SSL (if using custom server)
sudo certbot --nginx -d your-domain.com
```

---

## 🔍 Production Testing

### **Pre-deployment Checklist**
- [ ] PWA installs correctly on mobile
- [ ] HTTPS works on all endpoints
- [ ] Microphone permissions work on mobile
- [ ] WebRTC connects successfully
- [ ] Session storage functions properly
- [ ] Error handling works correctly

### **Performance Targets**
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 3s
- [ ] WebRTC connection < 5s
- [ ] PWA install prompt appears

---

## 📱 Mobile PWA Testing

### **iOS Safari**
1. Visit your production URL
2. Tap Share → "Add to Home Screen"
3. Test microphone permissions
4. Test offline functionality

### **Android Chrome**
1. Visit your production URL
2. Tap menu → "Add to Home screen"
3. Test installation and permissions
4. Verify push notifications work

---

**Need help with deployment? The configuration is already production-ready - just update the URLs in the environment files!** 🎯

