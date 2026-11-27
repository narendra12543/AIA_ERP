# FINANCE EXCEL & VBA RESEARCH AND MAPPING (`AIA_ERP.xlsm`)

## 1. Workbook Overview
- **Source Workbook:** `media_1795773460135_87b31ae8.xlsm` (`AIA_ERP.xlsm`)
- **Workbook SHA-256:** `9a20ea8437926ff668dc2a028015dffd9cef0f7cf78deb3b258fe00b550e8548`
- **Worksheets Inspected:**
  1. `01_Client_Form`
  2. `02_Dashboard`
  3. `CLIENT_DATABASE` (62 columns `A:Client ID` through `BJ:Remarks`, 5 historical orders)
  4. `MASTER_LISTS`
  5. `03_Accounts` (60 dated expense rows; 8 non-partner categories)
  6. `04_Partner_Accounts` (**Strictly excluded** per scope)

## 2. Sheet-to-ERP Table Mapping

| Excel Source | ERP PostgreSQL Table(s) | Migration Behavior |
|---|---|---|
| `CLIENT_DATABASE` (Order Header) | `finance_orders` | 5 historical orders (`2627-AIA-001`..`2627-AIA-005`), GST-exclusive `basic_value`, `gst_amount`, `total_order_value`, `fy_code = '2026-27'` |
| `CLIENT_DATABASE` (Line Items & Costs) | `finance_order_items` | Per-order product sales & direct costs (`product_cost` total `₹622,990.00`, `gross_profit` `₹337,830.00`) |
| `CLIENT_DATABASE` (Customer Receipts) | `finance_customer_payments` | Posted customer receipts totaling `₹1,052,667.60`; undated legacy payments flagged `date_missing_flag = true` with `fy_code = '2026-27'` |
| `CLIENT_DATABASE` (Maintenance) | `finance_maintenance_records` | Mapped for order maintenance tracking (`₹0.00` in historical rows) |
| `03_Accounts` (Expense Rows) | `expense_claims`, `finance_transactions` | 60 expense rows (`₹48,828.00` total; 4 zero-amount rows flagged `zero_amount_flag = true`) |
| `MASTER_LISTS` (Expense Categories) | `expense_categories` | 18 seeded categories including all 8 Excel categories (`Electricity`, `Food`, `Labour`, `Marketing`, `Material`, `Other`, `Petrol / Diesel`, `Transport`) |
| `04_Partner_Accounts` | **EXCLUDED** | Zero partner capital, drawing, distribution, or partner tables/endpoints created |

## 3. Excel Discrepancy Identified & Corrected
- **Discrepancy:** `03_Accounts!C5` cached `911,158.9830508474` (GST-stripped receipt total).
- **Correction in ERP:** `finance_customer_payments` stores actual customer receipts (`₹1,052,667.60`), leaving exact outstanding `₹58,600.00` on order `2627-AIA-005` (Astonn Enterprices).
