# Fix: Experiência Faltas/Advertências not updating on Vercel

## Status: 🔄 In Progress

## Steps:

### 1. ✅ `vercel.json` created with no-cache headers
### 2. ✅ `js/avaliacao-experiencia.js` - no-cache + logs
### 3. ✅ `js/custom-fixes.js` & `js/dashboard-faltas.js` - no-cache queries + force refresh
### 4. Test locally + Deploy
### 5. Verify Vercel totals update post-deploy
### 5. Test locally + Deploy: `git add . && git commit -m "fix: cache busting faltas experience totals" && git push`
### 6. Verify on Vercel: Totals update immediately post-deploy, match localhost

## Current Step: 2/6

