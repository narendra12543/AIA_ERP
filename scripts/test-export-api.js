const fs = require("fs");

async function testExportApi() {
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "sales@avenautomation.in", password: "admin123" }),
  });
  console.log("Login status:", loginRes.status);
  const loginData = await loginRes.json();
  console.log("Login data:", loginData.success, "Token:", loginData.session?.token?.slice(0, 10));

  const token = loginData.session?.token;
  const cookie = loginRes.headers.get("set-cookie");

  const exportRes = await fetch("http://localhost:3000/api/export-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tab-session": token,
      Cookie: cookie || "",
    },
    body: JSON.stringify({
      html: "<!DOCTYPE html><html><body><h1 style='color:blue'>Native Chromium Vector Test</h1><p>Selectable text test 123</p></body></html>",
      fileName: "test_vector.pdf",
    }),
  });

  console.log("Export status:", exportRes.status);
  if (exportRes.ok) {
    const buf = Buffer.from(await exportRes.arrayBuffer());
    console.log("PDF generated successfully! Size:", buf.length, "bytes");
    fs.writeFileSync("C:/Users/user/.gemini/antigravity/brain/1e04822f-1daf-42d2-a597-54b342b78751/scratch/test_vector.pdf", buf);
  } else {
    console.log("Export error:", await exportRes.text());
  }
}

testExportApi().catch(console.error);
