---
name: ai-dost-deploy
description: >-
  Use this skill when the user asks to build, package, or deploy the AI-Dost 2.0 application for production.
---

# Deploying AI-Dost 2.0

Follow these steps to safely build and verify the production bundle of the application.

## 1. Build the Frontend
Navigate to the frontend directory and build the Next.js application.

```powershell
cd "c:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npm run build
```

## 2. Check Build Outputs
Ensure that the `.next` directory was successfully built without ESLint or TypeScript build errors. 
Look for the static page generation outputs in the console logs.

## 3. Verify Backend Connectivity
Ensure all routes in `c:\Users\vikash kumar\Pictures\ai dost 3.0\backend\routes\` are exporting their router correctly.
Run the backend tests to ensure the production codebase won't fail upon startup.

```powershell
cd "c:\Users\vikash kumar\Pictures\ai dost 3.0\backend"
npm run test:unit
```

## 4. Run Production Server (Locally)
If the user wants to test the production build locally instead of using `npm run dev`, you can start Next.js in production mode:
```powershell
cd "c:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npm run start
```
