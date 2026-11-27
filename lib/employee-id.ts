import { query } from "@/lib/db";
import { getCurrentBusinessDate, getCurrentFY, getFYFromDate } from "@/lib/financial-year";

export async function generateNextEmployeeId(joiningDateInput?: string | null): Promise<{
  employeeId: string;
  joiningDate: string;
  financialYear: string;
}> {
  const joiningDate =
    joiningDateInput && /^\d{4}-\d{2}-\d{2}$/.test(joiningDateInput.trim())
      ? joiningDateInput.trim()
      : getCurrentBusinessDate();
  const financialYear = getFYFromDate(joiningDate) || getCurrentFY();

  await query(`CREATE SEQUENCE IF NOT EXISTS employee_id_seq START WITH 1 INCREMENT BY 1`, []);
  const seqRes = await query(`SELECT nextval('employee_id_seq')::bigint AS seq`, []);
  const seqNum = Number(seqRes.rows[0]?.seq || 1);
  const padded = String(seqNum).padStart(4, "0");
  return {
    employeeId: `${financialYear}-AIA_${padded}`,
    joiningDate,
    financialYear,
  };
}
