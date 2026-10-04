# Jharsewa Status Synchronization Engine Rules

## CERTIFICATE WORKFLOW HIERARCHY (OFFICIAL STAGES)
1. **JHIC (Income Certificate):** `Submitted` ➡️ `RK` ➡️ `CI` ➡️ `CO` (or ➡️ `SDO` for SDO level Income)
2. **JHLRCO (Local Resident Certificate - CO):** `Submitted` ➡️ `RK` ➡️ `CI` ➡️ `CO`
3. **JHRC (Residential Certificate - SDO):** `Submitted` ➡️ `RK` ➡️ `CI` ➡️ `CO` ➡️ `SDO`
4. **JHCBC (Caste Certificate BC):** `Submitted` ➡️ `RK` ➡️ `CI` ➡️ `CO`
5. **JHNBC (Caste Certificate OBC/NBC):** `Submitted` ➡️ `RK` ➡️ `CI` ➡️ `CO`
6. **JHCSC (Caste Certificate SC):** `Submitted` ➡️ `RK` ➡️ `CI` ➡️ `CO`
7. **JHCST (Caste Certificate ST):** `Submitted` ➡️ `RK` ➡️ `CI` ➡️ `CO`
8. **JHCOB (OBC Certificate - Circle Level):** `Submitted` ➡️ `RK` ➡️ `CI` ➡️ `CO`
9. **JHOBCH (OBC Certificate - SDO/DC Level):** `Submitted` ➡️ `SDO` / `DC` (Direct SDO/DC Level verification)

---

## IMMUTABLE RULE 1: STATUS MAPPING ORDER & IDENTIFICATION
When inspecting the Jharsewa tracking modal (`applicationTrackStatus.do`):
1. **Find the Active Row**: Locate the exact row where **Status column (5th column)** contains `"Under Process"` or `"Waiting"`.
2. **Read Task Name**: Read the **Task Name column (2nd column)** of THAT SPECIFIC ROW ONLY.
3. **Evaluation Priority**:
   - **Step A: Check Circle Inspector (CI)**
     - Matches: `CIRCLE INSPECTOR`, `VERIFICATION-CI`, `APPROVAL-CI`, `INSPECTOR`, ` CI`, `CI-`, `-CI`
     - Internal Status: `CI_UNDER_PROCESS`
   - **Step B: Check SDO / DC**
     - Matches: `SDO`, `SUB DIVISIONAL`, `APPROVAL-SDO`, `VERIFICATION-SDO`, `DC`, `DEPUTY COMMISSIONER`
     - Internal Status: `SDO_UNDER_PROCESS`
   - **Step C: Check Circle Officer (CO)**
     - Matches: `CIRCLE OFFICER`, `APPROVAL-CO`, `VERIFICATION-CO`, ` CO`, `CO-`
     - Internal Status: `CO_UNDER_PROCESS`
     - Note: `OFFICER` alone MUST NOT match if `INSPECTOR` or `SUB DIVISIONAL` is present.
   - **Step D: Check Revenue Karmachari (RK)**
     - Matches: `RK`, `REVENUE KARMACHARI`, `KARMACHARI`, `RAJASWA`
     - Internal Status: `CO_UNDER_PROCESS` (or RK level)
   - **Step E: Fallback (Strict Error Return)**
     - If status is `Under Process` / `Waiting` but modal load fails or active officer level (`CI` / `CO` / `SDO` / `RK`) cannot be resolved from the modal, **RETURN AN ERROR (`error: true`) AND DO NOT CHANGE DATABASE STATUS**. Never overwrite or mutate existing database status to a fallback or default value.

## IMMUTABLE RULE 2: DB CORRECTION & NOTIFICATIONS
- When performing DB status corrections/re-syncing existing mis-mapped certificates:
  - DO NOT send WhatsApp notification messages to customers.
  - Silent database update ONLY (Option 1).
