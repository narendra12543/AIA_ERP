import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { generateNextEmployeeId } from "@/lib/employee-id";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const tbl = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_profiles'`,
      []
    );
    if (!tbl || tbl.rows.length === 0) {
      return NextResponse.json({ items: [], selfProfile: null, tableMissing: true });
    }

    const canManage = auth.user.permissions.includes("employees.manage") || auth.user.role === "Admin";
    if (!canManage) {
      // Strictly return only own employee profile
      const selfRes = await query(
        `SELECT ep.id, ep.user_id, ep.employee_id, ep.full_name, ep.email, ep.mobile,
                ep.designation, ep.department, ep.role, ep.joining_date, ep.employment_status,
                ep.work_location, ep.reporting_manager, ep.created_at, u.status AS account_status, u.approval_status
         FROM employee_profiles ep
         JOIN users u ON u.id = ep.user_id
         WHERE ep.user_id = $1`,
        [auth.user.userId]
      );
      return NextResponse.json({
        items: selfRes?.rows || [],
        selfProfile: selfRes?.rows[0] || null,
        tableMissing: false,
      });
    }

    const res = await query(
      `SELECT ep.id, ep.user_id, ep.employee_id, ep.full_name, ep.email, ep.mobile,
              ep.designation, ep.department, ep.role, ep.joining_date, ep.employment_status,
              ep.work_location, ep.reporting_manager, ep.created_at,
              u.status AS account_status, u.approval_status,
              COALESCE(exp.total_claims, 0)::int AS total_claims,
              COALESCE(exp.pending_reimbursement, 0)::numeric AS pending_reimbursement
       FROM employee_profiles ep
       JOIN users u ON u.id = ep.user_id
       LEFT JOIN (
         SELECT user_id,
                COUNT(*) AS total_claims,
                SUM(CASE WHEN status = 'Approved' AND paid_by = 'Self' AND reimbursement_status IN ('Pending','Partially Reimbursed')
                    THEN GREATEST(0, COALESCE(approved_amount, amount) - reimbursed_amount) ELSE 0 END) AS pending_reimbursement
         FROM expense_claims
         GROUP BY user_id
       ) exp ON exp.user_id = ep.user_id
       ORDER BY ep.employee_id ASC`,
      []
    );
    const selfProfile = (res?.rows || []).find((r: any) => r.user_id === auth.user.userId) || null;
    return NextResponse.json({ items: res?.rows || [], selfProfile, tableMissing: false });
  } catch (err: any) {
    console.error("Failed to fetch employees:", err);
    return NextResponse.json({ error: "Failed to fetch employees." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "employees.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const body = await req.json();
    const userId = String(body.user_id || "").trim();
    if (!userId) {
      return NextResponse.json({ error: "Linked user_id is required." }, { status: 400 });
    }

    const uRes = await query(`SELECT id, email, name, role FROM users WHERE id = $1`, [userId]);
    const u = uRes?.rows[0];
    if (!u) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const existing = await query(`SELECT id, employee_id FROM employee_profiles WHERE user_id = $1`, [userId]);
    if (existing && existing.rows.length > 0) {
      return NextResponse.json({ error: "Employee profile already exists for this user.", employee_id: existing.rows[0].employee_id }, { status: 409 });
    }

    const { employeeId, joiningDate } = await generateNextEmployeeId(body.joining_date);
    const id = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const reimbEnc = body.reimbursement_details ? encryptSecret(String(body.reimbursement_details)) : null;

    await query(
      `INSERT INTO employee_profiles (
        id, user_id, employee_id, full_name, email, mobile, designation, department, role,
        joining_date, employment_status, work_location, reporting_manager, reimbursement_details_enc, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        userId,
        employeeId,
        String(body.full_name || u.name).trim(),
        String(body.email || u.email).trim(),
        body.mobile ? String(body.mobile).trim() : null,
        body.designation ? String(body.designation).trim() : null,
        body.department ? String(body.department).trim() : null,
        normalizeRole(body.role || u.role).toUpperCase(),
        joiningDate,
        String(body.employment_status || "Active"),
        body.work_location ? String(body.work_location).trim() : null,
        body.reporting_manager ? String(body.reporting_manager).trim() : null,
        reimbEnc,
        auth.user.email,
      ]
    );

    await logAudit(auth.user.userId, "EMPLOYEE_CREATED", { employeeId, userId, email: u.email }, { actorName: auth.user.name, module: "employees", recordRef: employeeId, outcome: "SUCCESS" });
    return NextResponse.json({ success: true, employee_id: employeeId, id });
  } catch (err: any) {
    console.error("Failed to create employee profile:", err);
    return NextResponse.json({ error: "Failed to create employee profile." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "employees.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Employee profile id required." }, { status: 400 });

    const fields: string[] = ["updated_at = CURRENT_TIMESTAMP"];
    const params: any[] = [];
    const addField = (col: string, val: any) => {
      params.push(val);
      fields.push(`${col} = $${params.length}`);
    };

    if (body.full_name !== undefined) addField("full_name", String(body.full_name).trim());
    if (body.mobile !== undefined) addField("mobile", String(body.mobile).trim());
    if (body.designation !== undefined) addField("designation", String(body.designation).trim());
    if (body.department !== undefined) addField("department", String(body.department).trim());
    if (body.employment_status !== undefined) addField("employment_status", String(body.employment_status));
    if (body.work_location !== undefined) addField("work_location", String(body.work_location).trim());
    if (body.reporting_manager !== undefined) addField("reporting_manager", String(body.reporting_manager).trim());
    if (body.reimbursement_details) addField("reimbursement_details_enc", encryptSecret(String(body.reimbursement_details)));

    params.push(id);
    await query(`UPDATE employee_profiles SET ${fields.join(", ")} WHERE id = $${params.length}`, params);

    if (body.employment_status === "Resigned" || body.employment_status === "Inactive") {
      const ep = await query(`SELECT user_id FROM employee_profiles WHERE id = $1`, [id]);
      const uid = ep?.rows[0]?.user_id;
      if (uid && uid !== auth.user.userId) {
        await query(`UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = $1`, [uid]);
        await query(`DELETE FROM sessions WHERE user_id = $1`, [uid]);
      }
    }

    await logAudit(auth.user.userId, "EMPLOYEE_UPDATED", { id, status: body.employment_status }, { actorName: auth.user.name, module: "employees", recordRef: id, outcome: "SUCCESS" });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to update employee:", err);
    return NextResponse.json({ error: "Failed to update employee." }, { status: 500 });
  }
}
