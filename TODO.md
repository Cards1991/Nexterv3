# FIX ISO 9001 Menu Disappeared
Status: 🔄 In Progress

## Plan Steps:
- ✅ **Step 3**: Edit `js/utils.js` - Add `.iso-access` role toggle logic (uses `hasIsoAccess`)\n- ✅ **Step 4**: Edit `js/admin.js` - Add ISO permission checkbox (`hasIsoAccess`)
- [ ] **Step 5**: Update TODO files (mark ISO menu resolved)
- [ ] **Step 6**: Test - Verify menu visible + ISO sections load
- [ ] ✅ Complete: Use `attempt_completion`

**Root Cause**: Menu hidden by `.mecanico-any` class + `toggleRoleElements()` unless `isMecanico: true`.

**Next**: Complete Step 1.

