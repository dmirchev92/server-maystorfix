# Service Categories Update Summary

## Changes Made

### 1. Updated Service Categories List
Reduced from 20 categories to 14 categories with updated Bulgarian names:

**New Categories:**
1. Електроуслуги (electrician)
2. ВиК Услуги (plumber)
3. Отопление и климатизация (hvac)
4. Дърводелски услуги (carpenter)
5. Боядисване (painter) ✅ **Requires sq.m**
6. Ключар (locksmith)
7. Почистване (cleaner)
8. Озеленяване (gardener) ✅ **Requires sq.m**
9. Цялостни ремонти (handyman)
10. Ремонти на покрив (roofer) ✅ **Requires sq.m**
11. Хамалски Услуги (moving)
12. Плочки и теракот (tiler) ✅ **Requires sq.m**
13. Железарски услуги (welder)
14. Дизайн (design)

**Removed Categories:**
- appliance_repair (Ремонт на уреди)
- mason (Зидар)
- flooring (Подови настилки)
- glazier (Стъклар)
- plasterer (Мазач)
- furniture_assembly (Сглобяване на мебели)
- pest_control (Дезинфекция)

### 2. Square Meters Requirements
Updated to require square meters for only 4 categories:
- ✅ **painter** (Боядисване)
- ✅ **gardener** (Озеленяване)
- ✅ **roofer** (Ремонти на покрив)
- ✅ **tiler** (Плочки и теракот)

All other categories will NOT show the square meters field during case creation.

## Files Modified

### Marketplace (Web App)
1. `/Marketplace/src/constants/serviceCategories.ts` - Updated category list
2. `/Marketplace/src/constants/serviceMetrics.ts` - Updated sq.m requirements
3. `/Marketplace/src/components/UnifiedCaseModal.tsx` - Now uses dynamic categories

### Mobile App
1. `/mobile-app/src/constants/serviceCategories.ts` - Updated category list
2. `/mobile-app/src/constants/serviceMetrics.ts` - Updated sq.m requirements
3. `/mobile-app/src/components/UnifiedCaseModal.tsx` - Now uses dynamic categories
4. `/mobile-app/src/screens/AuthScreen.tsx` - Updated fallback categories
5. `/mobile-app/src/screens/EditProfileScreen.tsx` - Now uses dynamic categories

## Database Impact

### ⚠️ IMPORTANT: Existing Data
The changes are **SAFE** because:
- We only changed the **labels** (display names), not the **values** (IDs)
- Existing database records with old category values will still work
- Example: `electrician` value remains the same, only label changed from "Електротехник" to "Електроуслуги"

### Removed Categories in Database
Existing SP profiles or cases with removed categories (like `appliance_repair`, `mason`, etc.) will:
- ✅ Still exist in the database
- ⚠️ Not appear in dropdown selections for new entries
- ⚠️ May need manual migration if you want to reassign them

**Recommendation:** Run a query to check if any active profiles use removed categories:
```sql
SELECT user_id, service_category 
FROM service_provider_profiles 
WHERE service_category IN ('appliance_repair', 'mason', 'flooring', 'glazier', 'plasterer', 'furniture_assembly', 'pest_control');

SELECT provider_id, category_id 
FROM provider_service_categories 
WHERE category_id IN ('appliance_repair', 'mason', 'flooring', 'glazier', 'plasterer', 'furniture_assembly', 'pest_control');
```

## Testing Checklist

### Marketplace (Web)
- [ ] Case creation shows correct 14 categories
- [ ] Square meters field appears only for: painter, gardener, roofer, tiler
- [ ] Square meters field hidden for all other categories
- [ ] SP profile creation/edit shows correct categories
- [ ] Existing SP profiles display correctly

### Mobile App
- [ ] Case creation shows correct 14 categories
- [ ] Square meters field appears only for: painter, gardener, roofer, tiler
- [ ] Square meters field hidden for all other categories
- [ ] SP registration shows correct categories
- [ ] SP profile edit shows correct categories
- [ ] Existing SP profiles display correctly

### Backend
- [ ] Cases are created successfully with new category names
- [ ] SP profiles are updated successfully
- [ ] Search/filter by category works correctly
- [ ] Existing data with old categories still accessible

## Next Steps

1. **Test the changes** on your local/staging environment
2. **Check for any SPs** using removed categories and decide how to handle them
3. **Verify** case creation flow works end-to-end
4. **Confirm** with user before pushing to production

## Rollback Plan

If issues occur, you can revert by:
1. Restoring the old `serviceCategories.ts` files (both Marketplace and Mobile)
2. Restoring the old `serviceMetrics.ts` files (both Marketplace and Mobile)
3. No database changes needed as values remain the same
