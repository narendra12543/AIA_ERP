# EXCEL-TO-POSTGRESQL MIGRATION & RECONCILIATION REPORT (DRY-RUN)

- **Workbook:** `Quotation_System.xlsm`
- **Mode:** `--dry-run` (Read-only inspection; **0 database writes**)
- **Live Neon Checked:** Yes
- **Live PostgreSQL Counts (Before Import):** `quotes=0`, `clients=0`, `erp_store.app_data.quotations=26`, `erp_store.app_data.spec_profiles=17`
- **Excel Parsed Counts:** `Database` quotations = **36** (`35` genuine, `1` flagged incomplete, `0` duplicate, `0` conflicting) | Unique Clients = **29** | `Spec Profiles` = **17**
- **Future Quotation Numbering Continuity:** Highest Excel serial is `26-27/AIA/149` → next generated quotation will safely continue at `26-27/AIA/150`.

## Complete 36-Row Quotation Reconciliation Table

| Row | Quotation No | Date | Client Name | Total (INR) | In `erp_store`? | Status | Notes |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
| 2 | 26-27/AIA/114 | 2026-09-05 | Flowzen Technology | 302080.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 3 | 26-27/AIA/115 | 2026-09-05 | Rich Crop Chemicals | 76216.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 4 | 26-27/AIA/116 | 2026-09-06 | Royal International School | 147592.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 5 | 26-27/AIA/117 | 2026-09-15 | Atoz gumming work India Pvt Ltd | 151003.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 6 | 26-27/AIA/118 | 2026-09-16 | Eisen Traders | 285383.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 7 | 26-27/AIA/119 | 2026-09-17 | Vision Enterprices | 1614122.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 8 | 26-27/AIA/120 | 2026-09-17 | Vision Enterprices | 593493.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 9 | 26-27/AIA/121 | 2026-09-21 | Fabricationwala | 382922.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 10 | 26-27/AIA/122 | 2026-09-21 | Fabricationwala | 442134.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 11 | 26-27/AIA/123 | 2026-10-28 | Success PEB & Infra Consultants | 587251.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 12 | 26-27/AIA/124 | 2026-09-26 | Yakshit Enterprises | 160987.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 13 | 26-27/AIA/125 | 2026-10-02 | City One Group | 364540.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 14 | 26-27/AIA/126 | 2026-10-01 | Recove Ventures Private Limited | 647546.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 15 | 26-27/AIA/127 | 2026-10-02 | Recove Ventures Private Limited | 473475.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 16 | 26-27/AIA/128 | 2026-10-04 | Saga Construction, Akurdi, PCMC, Pune | 599086.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 17 | 26-27/AIA/129 | 2026-11-19 | Marwah Towers | 3857378.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 18 | 26-27/AIA/130 | 2026-10-06 | Sai Krupa Co operative housing society | 102246.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 19 | 26-27/AIA/131 | 2026-10-07 | Marelli Talbros chasis systems pvt Ltd | 269488.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 20 | 26-27/AIA/132 | 2026-10-09 | Steammax engineerng services | 795780.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 21 | 26-27/AIA/133 | 2026-10-09 | Steammax engineerng services | 1101969.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 22 | 26-27/AIA/134 | 2026-10-11 | Meat 24 agro and food | 379936.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 23 | 26-27/AIA/135 | 2026-10-14 | Motherson Automative Techonologies & Engineering                                                                                                                                                                                                              (A division of Samvardhana Motherson International Limited) | 70021.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 24 | 26-27/AIA/136 | 2026-10-16 | Pamm engineering | 57820.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 25 | 26-27/AIA/137 | 2026-10-18 | Astonn Enterprices | 613600.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 26 | 26-27/AIA/138 | 2026-10-27 | - | 142707.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 27 | 26-27/AIA/139 | 2026-10-29 | Shitole properties. | 972886.00 | Yes | Genuine (Ready) | Will import into quotes & clients |
| 28 | 26-27/AIA/140 | 2026-11-05 | Aezis Global Pvt Ltd | 877638.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |
| 29 | 26-27/AIA/141 | 2026-11-13 | M/s starways Engineering pvt ltd | 197072.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |
| 30 | 26-27/AIA/142 | 14-11-2026 | Astonn Enterprices | 51790.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |
| 31 | 26-27/AIA/143 | 2026-11-16 | VANDE BHARAT FABRICATION | 67107.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |
| 32 | 26-27/AIA/144 | 2026-11-20 | Om Industries | 569852.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |
| 33 | 26-27/AIA/145 | 2026-11-21 | AGM Engineering Metalmind Engineering | 479576.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |
| 34 | 26-27/AIA/146 | 2026-11-24 | HK ENTERPRISES | 0.00 | New from Excel | Flagged (Review) | Incomplete record (₹0 / empty line items) — flagged for Admin review |
| 35 | 26-27/AIA/147 | 2026-11-25 | AltSF Process Private Limited. | 1085187.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |
| 36 | 26-27/AIA/148 | 2026-11-25 | PEB360 Solutions (INDIA) LLP | 467811.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |
| 37 | 26-27/AIA/149 | 2026-11-25 | Commander Watertech Pvt Ltd | 62646.00 | New from Excel | Genuine (Ready) | Will import into quotes & clients |