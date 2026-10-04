# Modular Certificate Download Engine Rules & Architecture

## OVERVIEW & CORE ARCHITECTURE
To guarantee 100% download accuracy across all Jharsewa certificate types, the download system uses a **Prefix-Based Modular Engine Routing System**.

---

## MODULAR ENGINE ROUTING SPECIFICATION BY CERTIFICATE PREFIX

### 1. `JHIC` (Income Certificate Engine)
- **Portal Link Target**: Direct `"Income Certificate"` link in Row 4 (Approval - CO) or `"outputcertificateEng"` / `"English Certificate"`.
- **Method**: Executes `displayFeedback(...)` or `showDocument(...)` with Flag 1.
- **Rule**: Does not use `splitRelatedDocument`. Directly clicks the Income Certificate link.

### 2. `JHLRCO` (Local Resident Certificate - CO Level Engine)
- **Portal Link Target**: `"View"` link (`splitRelatedDocument`) in Row 6 (Approval - CO).
- **Sub-Modal Options**:
  - `231928179~Inspection` (Flag 3) — Officer Inspection Report ❌ (MUST BE EXCLUDED)
  - `231928180~output` (Flag 1) — **Main Local Resident Certificate PDF** ✅ (TARGET)
- **Rule**: MUST strictly select item with `"output"` (Flag 1) and IGNORE `"Inspection"` (Flag 3).

### 3. `JHRC` / `JHLRSDO` (Local Resident Certificate - SDO Level Engine)
- **Portal Link Target**: `"View"` link (`splitRelatedDocument`) in Row 5 (Approval - SDO).
- **Sub-Modal Options**:
  - `236599803~LRC Certificate` (Flag 1) — **Main Local Resident Certificate PDF** ✅ (TARGET)
  - `236599804~Approval By SDO` (Flag 3) — SDO Approval Order ❌ (MUST BE EXCLUDED)
- **Rule**: MUST select `"LRC Certificate"` (Flag 1) and IGNORE `"Approval By SDO"`.

### 4. `JHCBC` / `JHCOB` / `JHCSC` / `JHCST` / `JHEWS` (Caste & Category Certificate Engine)
- **Portal Link Target**: `"View"` link (`splitRelatedDocument`) in Row 4 (Circle Officer).
- **Sub-Modal Options**:
  - `outputcertificateEng` — **English Certificate PDF** ✅ (PRIMARY TARGET)
  - `outputcertificateHn` — Hindi Certificate PDF (FALLBACK TARGET)
- **Rule**: MUST prioritize `"outputcertificateEng"` for clean English PDF output.

---

## IMMUTABLE DOWNLOAD ENGINE RULES
1. **Never download Inspection Reports**: Never select Flag 3 (`Inspection` / `Approval Order`) as the certificate output.
2. **Never download Slips or Attachments**: Exclude Flag 0 (User Attachments) and Flag 4 (Acknowledgement Slips).
3. **Popup Auto-Clicker**: When `showDocument` opens an `outputCertificateEngAction.do` or viewer popup, automatically trigger the document download button inside the popup window.
