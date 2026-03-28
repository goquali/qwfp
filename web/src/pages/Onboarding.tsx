import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { post, get } from "../api/client";

const STEPS = ["Upload", "Map Columns", "Validate", "Preview", "Import"];

const SAMPLE_CSV = `Department,Role Title,Level,Base Salary,Equity,Bonus,Start Date
Infrastructure,Site Reliability Engineer,L4,160000,40000,16000,2026-04-01
Infrastructure,DevOps Engineer,L3,140000,30000,14000,2026-05-01
Growth,Full Stack Engineer,L4,155000,35000,15500,2026-04-15
Growth,Data Analyst,L3,130000,25000,13000,2026-06-01
Core Product,Backend Engineer,L4,150000,35000,15000,2026-05-15`;

const QWFP_FIELDS = [
  { value: "", label: "-- Skip --" },
  { value: "roleTitle", label: "Role Title" },
  { value: "level", label: "Level" },
  { value: "baseSalary", label: "Base Salary" },
  { value: "equityValue", label: "Equity" },
  { value: "bonusTarget", label: "Bonus" },
  { value: "benefitsCost", label: "Benefits" },
  { value: "targetStartDate", label: "Start Date" },
  { value: "workerType", label: "Worker Type" },
  { value: "currencyCode", label: "Currency" },
  { value: "org_unit", label: "Department / Team" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<{ name: string; type: string; content: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function parseCSVHeaders(csv: string): string[] {
    const firstLine = csv.trim().split("\n")[0];
    return firstLine.split(",").map(h => h.trim());
  }

  function handleFile(f: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const ext = f.name.split(".").pop()?.toLowerCase();
      const type = ext === "xlsx" ? "xlsx" : ext === "json" ? "json" : "csv";
      setFile({ name: f.name, type, content });
      if (type === "csv") {
        const headers = parseCSVHeaders(content);
        setColumns(headers);
        // Auto-map common headers
        const autoMap: Record<string, string> = {};
        headers.forEach(h => {
          const low = h.toLowerCase();
          if (low.includes("role") || low.includes("title")) autoMap[h] = "roleTitle";
          else if (low.includes("level")) autoMap[h] = "level";
          else if (low.includes("base") || low === "salary") autoMap[h] = "baseSalary";
          else if (low.includes("equity")) autoMap[h] = "equityValue";
          else if (low.includes("bonus")) autoMap[h] = "bonusTarget";
          else if (low.includes("benefit")) autoMap[h] = "benefitsCost";
          else if (low.includes("start") || low.includes("date")) autoMap[h] = "targetStartDate";
          else if (low.includes("dept") || low.includes("department") || low.includes("team")) autoMap[h] = "org_unit";
        });
        setMapping(autoMap);
      }
      setError(null);
    };
    reader.readAsText(f);
  }

  function useSampleData() {
    setFile({ name: "sample-headcount-plan.csv", type: "csv", content: SAMPLE_CSV });
    const headers = parseCSVHeaders(SAMPLE_CSV);
    setColumns(headers);
    setMapping({
      "Department": "org_unit",
      "Role Title": "roleTitle",
      "Level": "level",
      "Base Salary": "baseSalary",
      "Equity": "equityValue",
      "Bonus": "bonusTarget",
      "Start Date": "targetStartDate",
    });
    setError(null);
  }

  async function createImportJob() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await post("/import/jobs", {
        sourceType: file.type,
        sourceName: file.name,
        targetEntity: "job_slots",
      });
      setJobId(result.id);
      setStep(1);
    } catch (err: any) {
      setError(err.message || "Failed to create import job");
    } finally {
      setLoading(false);
    }
  }

  async function submitMapping() {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      await post(`/import/jobs/${jobId}/map`, { mapping });
      setStep(2);
      // Auto-run validation
      const result = await get(`/import/jobs/${jobId}/validate`);
      setValidation(result);
    } catch (err: any) {
      setError(err.message || "Failed to submit mapping");
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await get(`/import/jobs/${jobId}/preview`);
      setPreview(result);
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }

  async function executeImport() {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await post(`/import/jobs/${jobId}/execute`, {});
      setImportResult(result);
      setStep(4);
    } catch (err: any) {
      setError(err.message || "Failed to execute import");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 0" }}>
      {/* Progress */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 40 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600,
              background: i <= step ? "var(--primary)" : "#f0f1f3",
              color: i <= step ? "#fff" : "var(--text-muted)",
              transition: "all 0.2s",
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 13, color: i <= step ? "var(--text)" : "var(--text-muted)", fontWeight: i === step ? 600 : 400 }}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div style={{ width: 24, height: 1, background: "var(--border)" }} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "var(--danger-light)", color: "var(--danger)", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="step-enter" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Let's get your data in</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
            Upload a CSV, XLSX, or JSON file with your headcount plan, org structure, or open positions.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".csv,.xlsx,.json"; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); }; input.click(); }}
            style={{
              border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
              borderRadius: 12, padding: 48, textAlign: "center", cursor: "pointer",
              background: dragOver ? "var(--primary-light)" : "#fafbfc",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
              {file ? file.name : "Drop your file here or click to browse"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {file ? `${file.type.toUpperCase()} • ${(file.content.length / 1024).toFixed(1)} KB` : "CSV, XLSX, or JSON"}
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "16px 0" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>or </span>
            <a onClick={useSampleData} style={{ fontSize: 13, color: "var(--primary)", cursor: "pointer", textDecoration: "none", fontWeight: 500 }}>
              try with sample data
            </a>
          </div>

          {file && (
            <button className="btn btn-primary" onClick={createImportJob} disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15, marginTop: 8 }}>
              {loading ? "Creating..." : "Continue →"}
            </button>
          )}
        </div>
      )}

      {/* Step 1: Map Columns */}
      {step === 1 && (
        <div className="step-enter" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Map your columns</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
            We auto-detected some mappings. Adjust if needed.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {columns.map((col) => (
              <div key={col} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 500, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid var(--border)" }}>
                  {col}
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>→</span>
                <select
                  value={mapping[col] || ""}
                  onChange={(e) => setMapping({ ...mapping, [col]: e.target.value })}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14, fontFamily: "inherit" }}
                >
                  {QWFP_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
            <button className="btn btn-primary" onClick={submitMapping} disabled={loading} style={{ flex: 1, justifyContent: "center" }}>
              {loading ? "Validating..." : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Validate */}
      {step === 2 && (
        <div className="step-enter" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Validation Results</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
            We checked your data for issues.
          </p>

          {loading && <div className="loading">Validating...</div>}

          {validation && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, background: "var(--success-light)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>✓</div>
                  <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 500 }}>Data looks good</div>
                </div>
              </div>

              {validation.validationErrors && validation.validationErrors.length > 0 && (
                <div style={{ background: "var(--warning-light)", borderRadius: 8, padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                    {validation.validationErrors.length} warnings
                  </div>
                  {validation.validationErrors.slice(0, 5).map((err: any, i: number) => (
                    <div key={i} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                      Row {err.row}: {err.field} — {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" onClick={loadPreview} disabled={loading} style={{ flex: 1, justifyContent: "center" }}>
              {loading ? "Loading preview..." : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="step-enter" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Preview</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
            Here's what we'll create from your data.
          </p>

          {preview?.previewSummary && (
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              {Object.entries(preview.previewSummary).map(([key, val]) => (
                <div key={key} style={{ flex: 1, background: "var(--primary-light)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--primary)" }}>{String(val)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</div>
                </div>
              ))}
            </div>
          )}

          {!preview?.previewSummary && (
            <div style={{ background: "var(--primary-light)", borderRadius: 8, padding: 20, textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--primary)" }}>
                {columns.length > 0 ? `${SAMPLE_CSV.trim().split("\n").length - 1} rows` : "Preview ready"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Ready to import</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-primary" onClick={executeImport} disabled={loading} style={{ flex: 1, justifyContent: "center", padding: "12px 0", fontSize: 15 }}>
              {loading ? "Importing..." : "Import Data →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <div className="step-enter" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Your data is ready!</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 8, fontSize: 15 }}>
            Successfully imported your headcount plan.
          </p>
          {importResult?.importStats && (
            <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
              Created {importResult.importStats.created} items
              {importResult.importStats.errors > 0 && ` • ${importResult.importStats.errors} errors`}
            </p>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => navigate("/dashboard")} style={{ padding: "10px 24px", fontSize: 14 }}>
              Go to Dashboard →
            </button>
            <button className="btn btn-ghost" onClick={() => { setStep(0); setFile(null); setJobId(null); setValidation(null); setPreview(null); setImportResult(null); }}>
              Import More Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
