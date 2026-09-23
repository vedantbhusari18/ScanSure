# HEXABYTE — Packaged Commodity Compliance Scanner
**Smart India Hackathon 2026 — Problem Statement SIH26034**

An automated, full-stack compliance inspection system for pre-packaged commodities in accordance with the **Legal Metrology (Packaged Commodities) Rules, 2011** and amended guidelines.

---

## 🚀 Quick Start & Terminal Commands

### 1. Prerequisites
- Node.js (v18+ or v20+)
- npm (v9+)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Full-Stack Application
```bash
npm run dev
```

### 4. Open in Browser
Visit the application at:
```text
http://localhost:3000
```

### 5. Production Build & Start
```bash
npm run build
npm run start
```

---

## 📋 1-Click Demo Walkthrough (Pitch Deck Verification)

### Pitch Deck Demo Input:
- **Commodity**: ABC Crunchy Bites
- **MRP**: ₹50.00
- **Net Qty**: 100g
- **Manufacturer**: ABC Foods Ltd.
- **Date Info**: Packed: Aug 2026
- **Consumer Care**: degraded/unclear text
- **Unit Sale Price**: missing

### Expected Verification Results:
| Mandatory Field | Extracted Status | Statutory Reference | Explanation |
| :--- | :--- | :--- | :--- |
| **MRP** | **FOUND** | PCR Rule 6(1)(e) | Declared as ₹50.00 incl. of all taxes |
| **Net Quantity** | **FOUND** | PCR Rule 6(1)(b) | Standard metric unit (100g) verified |
| **Manufacturer** | **FOUND** | PCR Rule 6(1)(a) | ABC Foods Ltd. verifiable address |
| **Generic Name** | **FOUND** | PCR Rule 6(1)(c) | Declared on principal display panel |
| **Date Information**| **FOUND** | PCR Rule 6(1)(d) | Month/Year (Aug 2026) verified |
| **Consumer Care** | **REVIEW** | PCR Rule 6(1)(g) | **Core Trust Rule**: Unreadable contact mapped to "Unable to verify" (not automatic penalty) |
| **Unit Sale Price** | **MISSING**| PCR Rule 6(1)(h) | Mandatory unit sale price absent from label (Violation) |

### Demo Steps in UI:
1. Click the golden **"Load Demo Package"** or **"Run Pitch Deck Demo"** button on the Dashboard or top navigation bar.
2. The system executes image quality checks, loads the high-resolution package canvas, and highlights bounding-box evidence coordinates for each field.
3. Observe the **Found / Review / Missing** badges and the **Trust Rule Notice**.
4. Click **"Officer Review"** to simulate human-in-the-loop validation, manual transcription overrides, and officer sign-off.
5. Click **"Generate PDF"** or **"Download PDF Certificate"** to export an official Legal Metrology Compliance Inspection Notice.
6. Check the **Inspection History** screen to verify persistent JSON audit logging.

---

## 🏛️ Architecture & Modules

```
├── data/
│   └── inspections.json          # Local persistent JSON storage for audit history
├── src/
│   ├── components/
│   │   ├── Navbar.tsx            # Global navigation and 1-click demo loader
│   │   ├── StatusBadge.tsx       # Status pills (Found, Review, Missing, Compliant)
│   │   ├── EvidenceImageViewer.tsx # Interactive bounding-box overlays & zoom
│   │   ├── DashboardView.tsx     # Executive analytics and recent scan logs
│   │   ├── ScannerUploadView.tsx # Camera capture, upload & Image Quality meter
│   │   ├── AnalysisEvidenceView.tsx # 7-field breakdown with rule citations
│   │   ├── ComplianceReviewView.tsx # Officer human review, edit & accept workflow
│   │   ├── ReportPdfView.tsx     # Printable formal notice & jsPDF export
│   │   └── InspectionHistoryView.tsx # Searchable, filterable historical database
│   ├── data/
│   │   └── demoPackages.ts       # Preset high-fidelity SVG packages & mock OCR
│   ├── rules/
│   │   ├── rulesConfig.ts        # Configuration-driven Legal Metrology rules
│   │   └── ruleEngine.ts         # Deterministic rule evaluator with Trust Rule
│   ├── services/
│   │   ├── declarationParser.ts  # OCR extraction & field mapping
│   │   ├── imageQuality.ts       # Blur, glare, resolution & readability check
│   │   ├── pdfGenerator.ts       # Formal statutory notice generator via jsPDF
│   │   └── storageService.ts     # Client/Server persistent audit synchronization
│   ├── types/
│   │   └── inspection.ts         # Strict TypeScript definitions
│   ├── App.tsx                   # Main state orchestrator
│   ├── index.css                 # Tailwind CSS entry
│   └── main.tsx                  # React DOM entry
├── server.ts                     # Express backend with Vite middleware & REST APIs
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🛡️ Trust Rule & Proportionality
Under Legal Metrology enforcement criteria, illegible or smudged markings (such as degraded consumer helpline details) are systematically designated as **"Unable to verify" (REVIEW)** rather than automatically penalizing manufacturers with statutory non-compliance fines.
