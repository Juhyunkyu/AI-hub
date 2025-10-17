# Mobile File Upload UI Testing Checklist

**Feature**: Chat file attachment with long filenames
**Bug Fixed**: Send button visibility on mobile
**Test Date**: _________
**Tester**: _________

---

## 🎯 Quick Test (5 minutes)

### Test File Preparation
Create a test file with 151-character name:
```
very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_long_test_file_name.png
```

### Basic Validation
1. Open chat on mobile device
2. Tap attachment button (📎)
3. Select the long-filename test file
4. **VERIFY**: Send button (📤) is visible on screen
5. **VERIFY**: Filename shows with "..." ellipsis
6. **VERIFY**: Remove button (×) is visible

**Result**: ☐ PASS  ☐ FAIL

---

## 📱 Device Testing Matrix

### iPhone Testing
| Device | Screen Width | Status | Notes |
|--------|--------------|--------|-------|
| iPhone SE (2022) | 375px | ☐ | Smallest modern iPhone |
| iPhone 12/13 | 390px | ☐ | Most common size |
| iPhone 14 Pro Max | 430px | ☐ | Largest iPhone |

### Android Testing
| Device | Screen Width | Status | Notes |
|--------|--------------|--------|-------|
| Galaxy S21 | 360px | ☐ | Standard Android |
| Pixel 6 | 412px | ☐ | Common size |
| Large Android | 480px | ☐ | Tablet-like phone |

---

## 🔄 Scenario Testing

### Scenario 1: Single Long Filename
- [ ] Attach 1 file with 151-char name
- [ ] Verify send button visible
- [ ] Verify filename truncated with "..."
- [ ] Verify layout not scrolled horizontally
- [ ] Tap send button successfully

### Scenario 2: Multiple Long Filenames
- [ ] Attach 5 files with long names
- [ ] Verify all file previews shown vertically
- [ ] Verify send button visible below all previews
- [ ] Verify no horizontal scroll
- [ ] Remove one file successfully
- [ ] Send remaining files successfully

### Scenario 3: Mixed Filename Lengths
- [ ] Attach short filename (10 chars)
- [ ] Attach long filename (151 chars)
- [ ] Verify consistent layout
- [ ] Verify both show correctly
- [ ] Send both files successfully

### Scenario 4: Landscape Orientation
- [ ] Rotate device to landscape
- [ ] Attach long filename
- [ ] Verify send button still visible
- [ ] Verify layout adapts correctly
- [ ] Rotate back to portrait
- [ ] Verify still works correctly

---

## 🎨 Visual Testing

### Layout Verification
```
Expected Layout (Portrait):
┌─────────────────────────────────┐
│ 🖼️ Very_long_filename_t... [×] │
│                                 │
│ [📎] [Message...] [😊] [📤]    │
└─────────────────────────────────┘
```

Check:
- [ ] File preview takes full width
- [ ] Icon (🖼️) visible on left
- [ ] Filename truncates in middle
- [ ] Remove button (×) on right edge
- [ ] Form controls in one row
- [ ] Send button (📤) always visible

### Spacing & Alignment
- [ ] Proper padding around file preview
- [ ] Consistent gap between file previews (multiple files)
- [ ] Buttons aligned to bottom of input area
- [ ] No overlapping elements
- [ ] Touch targets ≥ 44×44px (accessibility)

---

## ♿ Accessibility Testing

### Screen Reader
- [ ] Enable VoiceOver (iOS) or TalkBack (Android)
- [ ] Navigate to file preview
- [ ] Verify full filename read aloud (title attribute)
- [ ] Verify "Remove file" button announced
- [ ] Verify send button reachable and announced

### Font Scaling
- [ ] Set device font size to "Large" (Settings → Display)
- [ ] Attach long filename
- [ ] Verify layout still works
- [ ] Verify send button still visible
- [ ] Reset font size to default

### High Contrast Mode
- [ ] Enable high contrast mode
- [ ] Verify all elements visible
- [ ] Verify sufficient color contrast
- [ ] Disable high contrast mode

---

## 🌐 Browser Testing (Mobile)

### iOS Safari
- [ ] Standard mode
- [ ] Private browsing mode
- [ ] With content blockers enabled

### Android Chrome
- [ ] Standard mode
- [ ] Incognito mode
- [ ] Data saver mode

### Other Browsers
- [ ] Firefox Mobile
- [ ] Samsung Internet
- [ ] Opera Mobile

---

## 🔥 Stress Testing

### Edge Cases
- [ ] 255-character filename (maximum allowed)
- [ ] Special characters in filename (emoji, unicode)
- [ ] Very long extension (.tar.gz.backup.old)
- [ ] Filename with spaces vs underscores
- [ ] Multiple consecutive dots (file...name.png)

### Performance
- [ ] Attach 5 large files (8-10MB each)
- [ ] Verify UI remains responsive
- [ ] Remove files quickly
- [ ] Verify smooth animations

### Network Conditions
- [ ] Test on slow 3G
- [ ] Test on WiFi
- [ ] Test offline mode (attachment selection only)
- [ ] Switch between networks mid-upload

---

## 🐛 Regression Testing

### Related Features Still Work
- [ ] Text message sending
- [ ] Image preview before send
- [ ] Emoji picker
- [ ] Message input auto-resize
- [ ] Typing indicator
- [ ] Read receipts
- [ ] File upload progress
- [ ] Error handling (file too large)

---

## 📊 Test Results Summary

### Overall Status
- Total Tests: ____
- Passed: ____
- Failed: ____
- Blocked: ____

### Critical Issues Found
1. _____________________________
2. _____________________________
3. _____________________________

### Minor Issues Found
1. _____________________________
2. _____________________________
3. _____________________________

### Recommendations
- [ ] Ready for production
- [ ] Needs minor fixes
- [ ] Needs major fixes
- [ ] Requires redesign

---

## 📸 Screenshot Checklist

Capture screenshots of:
- [ ] Successful file preview with long filename
- [ ] Multiple file previews
- [ ] Landscape orientation
- [ ] Error state (file too large)
- [ ] Any bugs found

Save to: `/claudedocs/test-screenshots/mobile-file-upload/`

---

## ✅ Sign-Off

**Tester Name**: _____________________________
**Test Date**: _____________________________
**Test Environment**: _____________________________
**Result**: ☐ APPROVED  ☐ NEEDS REVISION

**Notes**:
________________________________________________________________
________________________________________________________________
________________________________________________________________

---

**Next Steps**:
1. Complete all checklist items
2. Document any issues found
3. Report to development team
4. Re-test after fixes (if needed)
5. Final approval for production deployment
