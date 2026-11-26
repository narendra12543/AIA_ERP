# EXCEL QUOTATION MIGRATION & RECONCILIATION PLAN (DRY-RUN)

- **Source Workbook:** `media_1795688609339_5d08d3ad.xlsm` (`Database` sheet)
- **Execution Mode:** `--dry-run` (Read-only inspection; **0 live database writes**)
- **Live PostgreSQL Checked:** No (offline dry-run)
- **Total Excel Quotation Rows Parsed:** 36
- **Active Header Columns Detected:** 71

## Classification Summary

| Category | Count | Action Recommendation |
| --- | ---: | --- |
| Genuine New Quotations | 35 | Safe to import on approved migration window |
| Duplicate (Excel / Live DB Match) | 0 | Skip (preserve existing live record) |
| Conflicting Data | 0 | Manual Admin review before import |
| Suspected Dummy / Incomplete | 1 | Exclude from production import |

## Complete 36-Row Reconciliation Table

| Excel Row | Quotation No | Date | Client Name | Total (INR) | Classification | Conflict / Review Notes |
| ---: | --- | --- | --- | ---: | --- | --- |
| 2 | 26-27/AIA/114 | 2026-09-05 | Flowzen Technology | 302080.00 | Genuine | Ready to import (no conflict) |
| 3 | 26-27/AIA/115 | 2026-09-05 | Rich Crop Chemicals | 76216.20 | Genuine | Ready to import (no conflict) |
| 4 | 26-27/AIA/116 | 2026-09-06 | Royal International School | 147592.04 | Genuine | Ready to import (no conflict) |
| 5 | 26-27/AIA/117 | 2026-09-15 | Atoz gumming work India Pvt Ltd | 151003.42 | Genuine | Ready to import (no conflict) |
| 6 | 26-27/AIA/118 | 2026-09-16 | Eisen Traders | 285383.00 | Genuine | Ready to import (no conflict) |
| 7 | 26-27/AIA/119 | 2026-09-17 | Vision Enterprices | 1614122.00 | Genuine | Ready to import (no conflict) |
| 8 | 26-27/AIA/120 | 2026-09-17 | Vision Enterprices | 593492.80 | Genuine | Ready to import (no conflict) |
| 9 | 26-27/AIA/121 | 2026-09-21 | Fabricationwala | 382921.80 | Genuine | Ready to import (no conflict) |
| 10 | 26-27/AIA/122 | 2026-09-21 | Fabricationwala | 442134.20 | Genuine | Ready to import (no conflict) |
| 11 | 26-27/AIA/123 | 2026-10-28 | Success PEB & Infra Consultants | 587250.60 | Genuine | Ready to import (no conflict) |
| 12 | 26-27/AIA/124 | 2026-09-26 | Yakshit Enterprises | 160987.40 | Genuine | Ready to import (no conflict) |
| 13 | 26-27/AIA/125 | 2026-10-02 | City One Group | 364539.76 | Genuine | Ready to import (no conflict) |
| 14 | 26-27/AIA/126 | 2026-10-01 | Recove Ventures Private Limited | 647546.24 | Genuine | Ready to import (no conflict) |
| 15 | 26-27/AIA/127 | 2026-10-02 | Recove Ventures Private Limited | 473475.00 | Genuine | Ready to import (no conflict) |
| 16 | 26-27/AIA/128 | 2026-10-04 | Saga Construction, Akurdi, PCMC, Pune | 599086.00 | Genuine | Ready to import (no conflict) |
| 17 | 26-27/AIA/129 | 2026-11-19 | Marwah Towers | 3857377.52 | Genuine | Ready to import (no conflict) |
| 18 | 26-27/AIA/130 | 2026-10-06 | Sai Krupa Co operative housing society | 102245.82 | Genuine | Ready to import (no conflict) |
| 19 | 26-27/AIA/131 | 2026-10-07 | Marelli Talbros chasis systems pvt Ltd | 269488.40 | Genuine | Ready to import (no conflict) |
| 20 | 26-27/AIA/132 | 2026-10-09 | Steammax engineerng services | 795780.20 | Genuine | Ready to import (no conflict) |
| 21 | 26-27/AIA/133 | 2026-10-09 | Steammax engineerng services | 1101968.96 | Genuine | Ready to import (no conflict) |
| 22 | 26-27/AIA/134 | 2026-10-11 | Meat 24 agro and food | 379936.40 | Genuine | Ready to import (no conflict) |
| 23 | 26-27/AIA/135 | 2026-10-14 | Motherson Automative Techonologies & Engineering                                                                                                                                                                                                              (A division of Samvardhana Motherson International Limited) | 70021.20 | Genuine | Ready to import (no conflict) |
| 24 | 26-27/AIA/136 | 2026-10-16 | Pamm engineering | 57820.00 | Genuine | Ready to import (no conflict) |
| 25 | 26-27/AIA/137 | 2026-10-18 | Astonn Enterprices | 613600.00 | Genuine | Ready to import (no conflict) |
| 26 | 26-27/AIA/138 | 2026-10-27 | - | 142706.84 | Genuine | Ready to import (no conflict) |
| 27 | 26-27/AIA/139 | 2026-10-29 | Shitole properties. | 972886.40 | Genuine | Ready to import (no conflict) |
| 28 | 26-27/AIA/140 | 2026-11-05 | Aezis Global Pvt Ltd | 877637.98 | Genuine | Ready to import (no conflict) |
| 29 | 26-27/AIA/141 | 2026-11-13 | M/s starways Engineering pvt ltd | 197071.80 | Genuine | Ready to import (no conflict) |
| 30 | 26-27/AIA/142 | 14-11-2026 | Astonn Enterprices | 51790.20 | Genuine | Ready to import (no conflict) |
| 31 | 26-27/AIA/143 | 2026-11-16 | VANDE BHARAT FABRICATION | 67106.60 | Genuine | Ready to import (no conflict) |
| 32 | 26-27/AIA/144 | 2026-11-20 | Om Industries | 569851.50 | Genuine | Ready to import (no conflict) |
| 33 | 26-27/AIA/145 | 2026-11-21 | AGM Engineering Metalmind Engineering | 479575.60 | Genuine | Ready to import (no conflict) |
| 34 | 26-27/AIA/146 | 2026-11-24 | HK ENTERPRISES | 0.00 | Incomplete / Review | Real client name present but ₹0 / empty line items — requires Admin confirmation before import/exclusion |
| 35 | 26-27/AIA/147 | 2026-11-25 | AltSF Process Private Limited. | 1085187.00 | Genuine | Ready to import (no conflict) |
| 36 | 26-27/AIA/148 | 2026-11-25 | PEB360 Solutions (INDIA) LLP | 467811.00 | Genuine | Ready to import (no conflict) |
| 37 | 26-27/AIA/149 | 2026-11-25 | Commander Watertech Pvt Ltd | 62646.20 | Genuine | Ready to import (no conflict) |

## Non-Destructive Rollback & Safety Rules
1. Existing live quotations in Neon PostgreSQL are **never deleted or overwritten**.
2. Take a full `pg_dump` backup prior to any future `--apply` import.
3. Only `Genuine` rows should be inserted using `ON CONFLICT (quotation_no) DO NOTHING`.
