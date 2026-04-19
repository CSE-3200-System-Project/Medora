# Medora Project Documentation

## Overview

This directory contains comprehensive documentation for **Medora: An AI-Native Healthcare Platform for Bangladesh**, a CSE-3200 System Project developed at KUET.

---

## 📋 Document Index

### Core Documentation

| Document | Description | Location |
|----------|-------------|----------|
| **Final Report** | Complete academic report with all sections | [`FINAL_REPORT.md`](./FINAL_REPORT.md) |
| **Project Overview** | System architecture, technology stack, features | [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) |
| **Team Contributions** | Detailed work distribution from git history | [`TEAM_CONTRIBUTIONS.md`](./TEAM_CONTRIBUTIONS.md) |
| **Deployment Guide** | Live URLs, CI/CD, Azure infrastructure | [`DEPLOYMENT.md`](./DEPLOYMENT.md) |
| **Features Inventory** | Complete feature list (implemented + planned) | [`FEATURES_INVENTORY.md`](./FEATURES_INVENTORY.md) |
| **Testing Report** | Test coverage, benchmarks, performance metrics | [`TESTING_REPORT.md`](./TESTING_REPORT.md) |
| **Diagrams Guide** | Architecture diagrams and specifications | [`DIAGRAMS_DOCUMENTATION.md`](./DIAGRAMS_DOCUMENTATION.md) |

### Implementation PRDs

| Document | Description | Location |
|----------|-------------|----------|
| Backend PRD | Backend implementation requirements | [`backend-implementation-prd.md`](./backend-implementation-prd.md) |
| Frontend PRD | Frontend implementation requirements | [`frontend-implementation-prd.md`](./frontend-implementation-prd.md) |

### AI & Advanced Features

| Document | Description | Location |
|----------|-------------|----------|
| Chorui AI Pipeline | AI assistant architecture and capabilities | [`chorui-ai-pipeline.md`](./chorui-ai-pipeline.md) |
| Vapi Voice Integration | Voice control implementation | [`vapi-voice-integration.md`](./vapi-voice-integration.md) |
| Vapi AI Audit Guide | Voice integration audit checklist | [`vapi-ai-audit-guide.md`](./vapi-ai-audit-guide.md) |
| AI Navigation Plan | Chorui navigation engine implementation | [`AI_NAVIGATION_IMPLEMENTATION_PLAN.md`](./AI_NAVIGATION_IMPLEMENTATION_PLAN.md) |
| AI Navigation Audit | AI route readiness assessment | [`MEDORA_AI_NAVIGATION_AUDIT.md`](./MEDORA_AI_NAVIGATION_AUDIT.md) |

### Infrastructure & Operations

| Document | Description | Location |
|----------|-------------|----------|
| PWA Documentation | Progressive Web App implementation | [`pwa-doc.md`](./pwa-doc.md) |
| Testing & Benchmarking Guide | Test execution instructions | [`testing-benchmarking.md`](./testing-benchmarking.md) |

### Architecture Diagrams

| Diagram | Location | Status |
|---------|----------|--------|
| AI Microservices 1 | [`diagrams/AI_Micoservices1.png`](./diagrams/AI_Micoservices1.png) | ✅ Exists |
| AI Microservices 2 | [`diagrams/AI_Microservice_Diagram.png`](./diagrams/AI_Microservice_Diagram.png) | ✅ Exists |
| AI Microservices 3 | [`diagrams/AI_Microservices2.png`](./diagrams/AI_Microservices2.png) | ✅ Exists |
| Azure Cloud Diagram | [`diagrams/Azure_Cloud_Diagram.png`](./diagrams/Azure_Cloud_Diagram.png) | ✅ Exists |
| System Architecture | `architecture.png` | 🔲 To be created |
| Class Diagram | `class-diagram.png` | 🔲 To be created |
| Data Flow Diagram | `dfd.png` | 🔲 To be created |
| Use Case Diagram | `use-case-diagram.png` | 🔲 To be created |
| Activity Diagram | `activity-diagram.png` | 🔲 To be created |

### Screenshots

| Screenshot | Location | Status |
|-----------|----------|--------|
| Landing Page | `screens/screen1.png` | 🔲 To be added |
| Dashboard | `screens/screen2.png` | 🔲 To be added |
| Key Features | `screens/screen3.png` | 🔲 To be added |

---

## 📖 How to Use This Documentation

### For Academic Report Submission

1. **Start Here**: Read [`FINAL_REPORT.md`](./FINAL_REPORT.md) - this is your complete academic report
2. **Add Screenshots**: Follow the guide in Appendix E of the final report to add screenshots
3. **Create Diagrams**: Use [`DIAGRAMS_DOCUMENTATION.md`](./DIAGRAMS_DOCUMENTATION.md) specifications to create required diagrams
4. **Verify Deployment**: Update placeholder URLs in [`DEPLOYMENT.md`](./DEPLOYMENT.md) with actual live URLs

### For Technical Understanding

1. **System Architecture**: Read [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) for complete architecture
2. **API Details**: See Appendix B of the final report for endpoint inventory
3. **Database Schema**: See Appendix C of the final report for model summary
4. **Features**: See [`FEATURES_INVENTORY.md`](./FEATURES_INVENTORY.md) for complete feature list

### For Team Contribution Verification

1. **Work Distribution**: Read [`TEAM_CONTRIBUTIONS.md`](./TEAM_CONTRIBUTIONS.md) for detailed breakdown
2. **Git History**: Verify with `git shortlog -sn --all` and `git log --author="<name>"`

### For Deployment & Operations

1. **Setup Instructions**: See [`../README.md`](../README.md) for local setup
2. **Deployment Guide**: Read [`DEPLOYMENT.md`](./DEPLOYMENT.md) for production deployment
3. **Testing Guide**: Read [`TESTING_REPORT.md`](./TESTING_REPORT.md) for test execution
4. **Benchmarking**: See [`testing-benchmarking.md`](./testing-benchmarking.md) for execution instructions

---

## 🎯 Quick Reference

### Project Statistics

| Metric | Count |
|--------|-------|
| Backend route modules | 26 |
| API endpoints | 194 |
| Database models | 41 |
| Alembic migrations | 47 |
| Frontend server actions | 20 |
| UI components | 45 |
| Git commits | 185+ |
| Implemented features | 198 |
| Planned features | 64 |
| Test files | 15+ |
| Grafana dashboards | 4 |

### Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Serwist PWA
- **Backend**: FastAPI, Python 3.11, SQLAlchemy 2.x, Pydantic v2, Alembic
- **Database**: PostgreSQL (Supabase)
- **AI/ML**: Groq, Gemini, Cerebras, Azure OCR, YOLO, Vapi
- **Cloud**: Azure Container Apps, Azure Container Registry
- **CI/CD**: GitHub Actions (4 workflows)
- **Monitoring**: Prometheus, Grafana (4 dashboards)

### Team

| Name | ID | Role | Commits |
|------|-----|------|---------|
| Sarwad Hasan Siddiqui | 2107006 | Backend, DevOps, AI/ML | 100+ (54%) |
| Adiba Tahsin | 2107031 | Frontend, UI/UX, AI | 85+ (46%) |

---

## 🗺️ Documentation Structure

```
docs/
├── FINAL_REPORT.md                    ← Main academic report (START HERE)
├── PROJECT_OVERVIEW.md                ← System architecture & features
├── TEAM_CONTRIBUTIONS.md              ← Work distribution analysis
├── DEPLOYMENT.md                      ← Production deployment guide
├── FEATURES_INVENTORY.md              ← Complete feature list
├── TESTING_REPORT.md                  ← Test coverage & benchmarks
├── DIAGRAMS_DOCUMENTATION.md          ← Diagram specifications
│
├── backend-implementation-prd.md      ← Backend PRD
├── frontend-implementation-prd.md     ← Frontend PRD
├── chorui-ai-pipeline.md              ← AI assistant docs
├── vapi-voice-integration.md          ← Voice integration
├── vapi-ai-audit-guide.md             ← Voice audit checklist
├── AI_NAVIGATION_IMPLEMENTATION_PLAN.md  ← Navigation engine
├── MEDORA_AI_NAVIGATION_AUDIT.md      ← Navigation audit
├── pwa-doc.md                         ← PWA implementation
├── testing-benchmarking.md            ← Testing guide
│
├── diagrams/                          ← Architecture diagrams
│   ├── AI_Micoservices1.png
│   ├── AI_Microservice_Diagram.png
│   ├── AI_Microservices2.png
│   └── Azure_Cloud_Diagram.png
│
├── reports/                           ← Report templates
│   ├── Final_CSE-3200_report_template.docx
│   ├── Final_CSE-3200_report_template.pdf
│   └── Chapter V_v2.pdf
│
└── INDEX.md                           ← This file
```

---

## ✅ Action Items for Report Completion

### Required Actions

1. **Add Screenshots** (Appendix E of Final Report):
   - Capture 12 screenshots from deployed application
   - Place in `docs/screens/` directory
   - Name according to convention (screen1.png, screen2.png, etc.)

2. **Create Missing Diagrams** (Specifications in DIAGRAMS_DOCUMENTATION.md):
   - System Architecture Diagram → `docs/architecture.png`
   - Class Diagram → `docs/class-diagram.png`
   - Data Flow Diagram → `docs/dfd.png`
   - Use Case Diagram → `docs/use-case-diagram.png`
   - Activity Diagram → `docs/activity-diagram.png`

3. **Update Deployment URLs** (DEPLOYMENT.md):
   - Replace `https://medora-app.azurewebsites.net` with actual frontend URL
   - Replace `https://medora-backend.azurecontainerapps.io` with actual backend URL
   - Replace `https://medora-ai-ocr.azurecontainerapps.io` with actual AI OCR URL

4. **Convert to DOCX/PDF** (Optional):
   - Use Pandoc to convert FINAL_REPORT.md to DOCX:
     ```bash
     pandoc FINAL_REPORT.md -o FINAL_REPORT.docx --toc --pdf-engine=xelatex
     ```
   - Or manually copy content to the provided template:
     - `reports/Final_CSE-3200_report_template.docx`

---

## 📝 Report Structure Mapping

The FINAL_REPORT.md follows standard CSE-3200 academic report format:

| Report Section | Location in FINAL_REPORT.md |
|---------------|----------------------------|
| Title Page | Beginning of document |
| Abstract | After title page |
| Table of Contents | After abstract |
| 1. Introduction | Section 1 |
| 2. Literature Review | Section 2 |
| 3. System Requirements | Section 3 |
| 4. Methodology & Design | Section 4 |
| 5. System Architecture | Section 5 |
| 6. Implementation | Section 6 |
| 7. Core Workflows | Section 7 |
| 8. AI Integration | Section 8 |
| 9. Testing & QA | Section 9 |
| 10. Deployment & DevOps | Section 10 |
| 11. Results & Analysis | Section 11 |
| 12. Discussion & Future Work | Section 12 |
| 13. Team Contributions | Section 13 |
| 14. Conclusion | Section 14 |
| 15. References | Section 15 |
| Appendices | A-E |
| Declaration | End of document |

---

## 🔗 Additional Resources

### Code Repository
- **GitHub**: https://github.com/CSE-3200-System-Project/Medora
- **Branch**: `main` (stable)

### Live Deployment (URLs to be updated)
- **Frontend**: https://medora-app.azurewebsites.net
- **Backend API**: https://medora-backend.azurecontainerapps.io
- **AI OCR Service**: https://medora-ai-ocr.azurecontainerapps.io

### Local Development
See [`../README.md`](../README.md) for setup instructions.

### Task History
See [`../tasks/`](../tasks/) for development task logs and plans.

---

## 📞 Contact

For questions about this documentation:
- **Sarwad Hasan Siddiqui**: 2107006
- **Adiba Tahsin**: 2107031

**Course**: CSE-3200 (System Project)  
**Instructor**: Kazi Saeed Alam  
**Institution**: KUET, Department of CSE  
**Level**: 3-2 (Spring 2026)

---

*Documentation created: April 2026*  
*Last updated: April 2026*
