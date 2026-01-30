# Git Workflow for Demo Mode 🎯

## Your Current Setup

- **`main` branch**: Your development work (has demo mode feature now)
- **`feature/demo-mode` branch**: For client demos (Vercel deployment)
- Both branches are now **synchronized** and have the same code!

---

## Daily Workflow

### 🔨 When Working on New Features

```bash
# 1. Make sure you're on main
git checkout main

# 2. Code your feature
# ... make changes to files ...

# 3. Commit your changes
git add .
git commit -m "feat: Your feature description"

# 4. Push to GitHub
git push origin main
```

### 🎭 When You Want to Update Client Demo

```bash
# 1. Switch to demo branch
git checkout feature/demo-mode

# 2. Get latest changes from main
git merge main

# 3. Push to GitHub (Vercel auto-deploys!)
git push origin feature/demo-mode
```

---

## Quick Commands

| What | Command |
|------|---------|
| Check current branch | `git branch` |
| Switch to main | `git checkout main` |
| Switch to demo | `git checkout feature/demo-mode` |
| Update demo from main | `git checkout feature/demo-mode` → `git merge main` |
| Push changes | `git push origin <branch-name>` |

---

## Vercel Setup (One-Time)

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. **Branch to deploy**: `feature/demo-mode`
4. **Root Directory**: `web`
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. **Environment Variables**:
   - `VITE_DEMO_MODE` = `true`
   - `VITE_SUPABASE_URL` = `your-supabase-url`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`

---

## Toggling Demo Mode Locally

### For Client Demo (Hide Incomplete Features)
Edit `web/.env`:
```bash
VITE_DEMO_MODE=true
```
Restart: `npm run dev`

### For Development (Show All Features)
Edit `web/.env`:
```bash
VITE_DEMO_MODE=false
```
Restart: `npm run dev`

---

## What's Hidden in Demo Mode?

- ❌ Donations page
- ❌ Announcements page
- ❌ Users/Admin management

✅ Everything else is visible!

---

## Troubleshooting

**Problem**: Can't switch branches (uncommitted changes)
```bash
git stash          # Save changes temporarily
git checkout main  # Switch branches
git stash pop      # Restore changes (optional)
```

**Problem**: Merge conflicts
```bash
# Accept all changes from main
git checkout --theirs .
git add .
git commit
```

**Problem**: Forgot which branch you're on
```bash
git status
```

---

## 🎓 Summary

**Your Flow:**
1. Work on `main` → commit → push
2. When ready for client → switch to `feature/demo-mode` → merge main → push
3. Vercel automatically deploys!

That's it! 🚀
