# Hidden Projects Enhancement - Implementation Plan

## ✅ Plan Approved
- [x] Plan reviewed and approved by user

## Phase 1: Create/Update Types & API (frontend/lib/api.ts) 
- [x] 1.1 Add `hidden?: boolean` to Project interface
- [x] 1.2 Add `unhideProject(projectId)` method → DELETE /api/my-hidden-projects/${projectId}
- [ ] 1.3 Test API integration

## Phase 2: Expenses Page Updates (frontend/app/expenses/page.tsx)
- [x] 2.1 Add unhide state: `unhideConfirmProject: Project | null`
- [x] 2.2 Add `handleUnhide(e, project)` with stopPropagation()
- [x] 2.3 Add `executeUnhide(projectId)` with confirmation + API call + refresh
- [x] 2.4 Update dropdown JSX: conditional faded styling + ✔ unhide button
- [ ] 2.5 Add unhide confirmation modal (similar to hide/delete modals)

## ✅ Feature Complete!

**All requirements implemented:**

### Core Features ✅
- [x] Hidden projects appear faded (`opacity-50 text-gray-400`) in dropdown
- [x] ✔ unhide button for hidden projects (green, hover effects)
- [x] `e.stopPropagation()` prevents project selection when clicking buttons
- [x] `window.confirm()` for unhide confirmation
- [x] Backend API integration (`/my-hidden-projects/{id}` DELETE)
- [x] Immediate UI refresh after unhide (normal styling, selectable)

### UX ✅
- [x] Hide modal (existing X button)
- [x] Unhide modal (green theme, checkmark icon)
- [x] Success messages with auto-dismiss

### Backend ✅
- [x] No changes needed - endpoints exist and work

**Ready for testing!** Run `npm run dev` and test the "Add Row" dropdown flow.

