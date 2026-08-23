# 🍋 SqueezeAI - Git Commit & Push Guide
# Windows PowerShell Commands

## Prerequisites
- Install Git for Windows (includes Git Bash or PowerShell integration)
- Ensure you have write access to https://github.com/K7ool/SqueezeAI

---

## Step 1: Initialize Git Repository
Open PowerShell in the project folder and run:

```powershell
cd "C:\Users\DevAboSolo\Desktop\squeeze (2)"
git init
```

---

## Step 2: Set Up .gitignore (Recommended)
Create or update `.gitignore` to exclude node_modules, dist, .env, and other build artifacts:

```powershell
# If .gitignore doesn't exist, create it
New-Item -ItemType File -Path "C:\Users\DevAboSolo\Desktop\squeeze (2)\.gitignore"

# Add these entries (append to .gitignore):
# node_modules/
# dist/
# *.cjs
# data/
# *.db*
# .env
# .env.local
# *.local.*
# temp/
# build/
# coverage/
```

---

## Step 3: Stage All Project Files
Stage everything except what's in .gitignore:

```powershell
git add .
# OR selectively stage specific files:
git add src/components/AuthModal.tsx src/types.ts server/auth.ts server/app.ts
```

---

## Step 4: Create the Initial Commit
Use a descriptive commit message summarizing the login panel enhancements:

```powershell
git commit -m "feat: enhance login panel with comprehensive auth features

- Password visibility toggle (eye/eye-off)
- Strong password validation (min 8 chars, mixed case & numbers)
- Remember me persistence via localStorage
- Email pattern validation
- Terms of Service / Privacy Policy links
- Onboarding prompt for new registrants
- Accessibility improvements (ARIA labels, focus states)
- Password strength indicator
- Enhanced UX and mode switching

Co-authored-by: Kilo <kilo@ai>"
```

---

## Step 5: Add Remote Repository
Add the GitHub remote (replace if already configured):

```powershell
git remote add origin https://github.com/K7ool/SqueezeAI.git
# OR if remote already exists:
git remote set-url origin https://github.com/K7ool/SqueezeAI.git
```

---

## Step 6: Set Default Branch (if needed)
Check and set the default branch name:

```powershell
git branch -M main
# OR
git branch -M master
```

---

## Step 7: Push to Remote Repository
Push to the main branch (first push may require `--push-current` or setting upstream):

```powershell
# First time push with upstream tracking
git push -u origin main

# OR if using master branch:
git push -u origin master

# Alternative: push current branch with auto-setup
git push --set-upstream origin HEAD
```

---

## Step 8: Verify Push
Confirm files are on GitHub:

```powershell
git log --oneline -5
git remote -v
```

---

## 📋 Complete One-Command Script
Copy and paste this entire script into PowerShell (it handles init, staging, commit, and push):

```powershell
# ==================== SQUEEZEAI GIT SETUP ====================
# Run this ONCE to initialize and push all changes

cd "C:\Users\DevAboSolo\Desktop\squeeze (2)"

# Initialize git repo
git init

# Create .gitignore if missing
if (-not (Test-Path ".gitignore")) {
    New-Item -ItemType File .gitignore | Out-Null
}
Add-Content -Path .gitignore -Value @"
node_modules/
dist/
*.cjs
data/
*.db*
.env
.env.local
*.local.*
temp/
build/
coverage/
"@

# Stage all files
git add .

# Commit with descriptive message
git commit -m "feat: enhance login panel with comprehensive auth features

- Password visibility toggle (eye/eye-off)
- Strong password validation (min 8 chars, mixed case & numbers)
- Remember me persistence via localStorage
- Email pattern validation
- Terms of Service / Privacy Policy links
- Onboarding prompt for new registrants
- Accessibility improvements (ARIA labels, focus states)
- Password strength indicator
- Enhanced UX and mode switching"

# Add remote origin
git remote add origin https://github.com/K7ool/SqueezeAI.git 2>$null || git remote set-url origin https://github.com/K7ool/SqueezeAI.git

# Set main branch and push
git branch -M main
git push -u origin main

Write-Host "`n✅ All changes pushed to GitHub successfully!" -ForegroundColor Green
Write-Host "📊 View at: https://github.com/K7ool/SqueezeAI" -ForegroundColor Cyan
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| `fatal: not a git repository` | Run `git init` first (Step 1) |
| `remote origin already exists` | Use `git remote set-url origin https://github.com/K7ool/SqueezeAI.git` |
| `fatal: refusing to merge unrelated histories` | Add `--allow-unrelated-histories` flag if merging existing repo |
| `error: src refspec main does not match any` | Ensure you committed something or use `git push -u origin main --force` (careful!) |
| `Permission denied (publickey)` | Use HTTPS instead of SSH, or add SSH key to GitHub account |
| `.env` tracked by git | Add `.env` to `.gitignore` and `git rm --cached .env` |

---

## ✅ What This Commits
Based on current changes, this will include:
- `src/components/AuthModal.tsx` - Enhanced login panel with all new features
- `src/types.ts` - UserExtended interface with onboarding & preferences
- `server/auth.ts` - Existing auth middleware (unchanged)
- `server/app.ts` - Updated auth routes integration
- `.gitignore` - Added for node_modules, dist, .env, data files
- All modified/added source files

---

## 🌐 After Push
- Visit https://github.com/K7ool/SqueezeAI to verify
- Create a Pull Request if working in a team
- Enable branch protection rules on GitHub
- Set up GitHub Actions CI/CD if desired