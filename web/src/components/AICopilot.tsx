import { useState, useRef, useEffect } from "react";
import { get } from "../api/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function renderContent(content: string) {
  return content.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    return (
      <div key={i} style={{ minHeight: line ? "auto" : "8px" }}>
        {parts}
      </div>
    );
  });
}

async function processQuestion(question: string): Promise<string> {
  const q = question.toLowerCase();

  if (
    q.includes("hire") ||
    q.includes("room") ||
    q.includes("headcount") ||
    q.includes("budget") ||
    q.includes("can we")
  ) {
    const cycles = await get("/finance/planning-cycles");
    const active = cycles.find((c: any) => c.status === "active") || cycles[0];
    if (!active) return "No active planning cycle found.";

    const envelopes = await get(
      `/finance/planning-cycles/${active.id}/envelopes`
    );
    const utilizations = await Promise.all(
      envelopes.map((e: any) =>
        get(`/finance/envelopes/${e.id}/utilization`).catch(() => null)
      )
    );

    const orgUnits = await get("/org-units");
    const orgMap: Record<string, string> = {};
    orgUnits.forEach((u: any) => {
      orgMap[u.id] = u.name;
    });

    let totalCap = 0,
      totalUsed = 0,
      totalBudget = 0,
      totalCommitted = 0;
    const teamSummaries: string[] = [];

    envelopes.forEach((e: any, i: number) => {
      const util = utilizations[i];
      if (!util) return;
      const name = orgMap[e.orgUnitId] || "Unknown";
      const hcUsed = util.headcountUsed || 0;
      const hcCap = util.headcountCap || e.headcountCap;
      const remaining = hcCap - hcUsed;
      totalCap += hcCap;
      totalUsed += hcUsed;
      totalBudget += parseFloat(
        String(
          util.totalCompBudget || util.totalBudget || e.totalCompBudget || 0
        )
      );
      totalCommitted += parseFloat(String(util.budgetCommitted || 0));

      if (remaining > 0) {
        teamSummaries.push(
          `\u2022 ${name}: ${remaining} open (${hcUsed}/${hcCap} filled)`
        );
      }
    });

    const totalRemaining = totalCap - totalUsed;
    const budgetPct =
      totalBudget > 0
        ? ((totalCommitted / totalBudget) * 100).toFixed(0)
        : "0";

    return `**Headcount Summary**\n\nTotal plan: ${totalCap} positions\nFilled: ${totalUsed}\nRemaining: ${totalRemaining}\nBudget: ${budgetPct}% committed ($${(totalCommitted / 1000000).toFixed(1)}M of $${(totalBudget / 1000000).toFixed(1)}M)\n\n**Teams with open headcount:**\n${teamSummaries.join("\n") || "All teams are fully allocated."}`;
  }

  if (
    q.includes("burn") ||
    q.includes("spent") ||
    q.includes("budget status")
  ) {
    const cycles = await get("/finance/planning-cycles");
    const active = cycles.find((c: any) => c.status === "active") || cycles[0];
    if (!active) return "No active planning cycle found.";

    const envelopes = await get(
      `/finance/planning-cycles/${active.id}/envelopes`
    );
    const utilizations = await Promise.all(
      envelopes.map((e: any) =>
        get(`/finance/envelopes/${e.id}/utilization`).catch(() => null)
      )
    );

    let totalBudget = 0,
      totalCommitted = 0,
      totalConsumed = 0;
    utilizations.forEach((util: any) => {
      if (!util) return;
      totalBudget += parseFloat(
        String(util.totalCompBudget || util.totalBudget || 0)
      );
      totalCommitted += parseFloat(String(util.budgetCommitted || 0));
      totalConsumed += parseFloat(String(util.budgetConsumed || 0));
    });

    const commitPct =
      totalBudget > 0
        ? ((totalCommitted / totalBudget) * 100).toFixed(0)
        : "0";
    const consumePct =
      totalBudget > 0
        ? ((totalConsumed / totalBudget) * 100).toFixed(0)
        : "0";

    return `**Budget Status**\n\nTotal allocated: $${(totalBudget / 1000000).toFixed(1)}M\nCommitted (open + filled): $${(totalCommitted / 1000000).toFixed(1)}M (${commitPct}%)\nConsumed (filled only): $${(totalConsumed / 1000000).toFixed(1)}M (${consumePct}%)\nRemaining: $${((totalBudget - totalCommitted) / 1000000).toFixed(1)}M`;
  }

  if (
    q.includes("alert") ||
    q.includes("urgent") ||
    q.includes("attention") ||
    q.includes("problem")
  ) {
    const alerts = await get("/reconciliation/alerts");
    if (!alerts || alerts.length === 0)
      return "No active alerts. Everything is on track!";

    const critical = alerts.filter(
      (a: any) => a.severity === "critical"
    ).length;
    const warnings = alerts.filter(
      (a: any) => a.severity === "warning"
    ).length;

    let summary = `**Active Alerts: ${alerts.length}**\n`;
    if (critical > 0) summary += `\n\uD83D\uDD34 ${critical} critical`;
    if (warnings > 0) summary += `\n\uD83D\uDFE1 ${warnings} warnings`;
    summary += "\n\n**Recent:**";
    alerts.slice(0, 3).forEach((a: any) => {
      summary += `\n\u2022 ${a.message}`;
    });

    return summary;
  }

  if (
    q.includes("open") ||
    q.includes("pipeline") ||
    q.includes("position") ||
    q.includes("slot")
  ) {
    const cycles = await get("/finance/planning-cycles");
    const active = cycles.find((c: any) => c.status === "active") || cycles[0];
    if (!active) return "No active planning cycle found.";

    const envelopes = await get(
      `/finance/planning-cycles/${active.id}/envelopes`
    );
    const allSlots: any[] = [];
    for (const e of envelopes) {
      const slots = await get(`/hr/envelopes/${e.id}/slots`).catch(() => []);
      allSlots.push(...slots);
    }

    const byStatus: Record<string, number> = {};
    allSlots.forEach((s: any) => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    });

    let summary = `**Pipeline Status: ${allSlots.length} total positions**\n`;
    if (byStatus.filled) summary += `\n\u2705 ${byStatus.filled} filled`;
    if (byStatus.offer) summary += `\n\uD83D\uDFE3 ${byStatus.offer} in offer`;
    if (byStatus.sourcing)
      summary += `\n\uD83D\uDD35 ${byStatus.sourcing} sourcing`;
    if (byStatus.open) summary += `\n\uD83D\uDFE2 ${byStatus.open} open`;
    if (byStatus.draft) summary += `\n\u26AA ${byStatus.draft} draft`;
    if (byStatus.cancelled)
      summary += `\n\uD83D\uDD34 ${byStatus.cancelled} cancelled`;

    return summary;
  }

  if (
    q.includes("recruiter") ||
    q.includes("capacity") ||
    q.includes("workload") ||
    q.includes("ta ")
  ) {
    const capacity = await get("/ta/capacity").catch(() => null);
    if (!capacity) return "No recruiting capacity data available.";

    const gap = capacity.capacityGap || 0;
    const util = capacity.utilizationPct || 0;

    let summary = `**Recruiting Capacity**\n\nRecruiters: ${capacity.totalRecruiters}\nActive reqs: ${capacity.activeReqs}\nCapacity: ${capacity.availableCapacity} total slots\nUtilization: ${util.toFixed(0)}%\n`;

    if (gap > 0)
      summary += `\n\u26A0\uFE0F Overloaded by ${gap} reqs — consider adding recruiters.`;
    else
      summary += `\n\u2705 ${Math.abs(gap)} slots of surplus capacity.`;

    return summary;
  }

  return "I can help with questions about:\n\n\u2022 **Headcount** — \"Can we hire more engineers?\"\n\u2022 **Budgets** — \"What's our burn rate?\"\n\u2022 **Pipeline** — \"How many positions are open?\"\n\u2022 **Alerts** — \"Any problems I should know about?\"\n\u2022 **Recruiting** — \"Do we have enough recruiters?\"\n\nTry asking one of these!";
}

export default function AICopilot({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your hiring copilot. Ask me anything about headcount, budgets, pipeline status, or recruiter capacity.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  async function handleSend() {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg, timestamp: new Date() },
    ]);
    setThinking(true);

    try {
      const response = await processQuestion(userMsg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response, timestamp: new Date() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble fetching that data. Try again?",
          timestamp: new Date(),
        },
      ]);
    }
    setThinking(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="copilot-panel">
      <div className="copilot-header">
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{"\u2728"}</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>AI Copilot</span>
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "#6b7280",
            padding: 4,
            lineHeight: 1,
          }}
        >
          {"\u2715"}
        </button>
      </div>

      <div className="copilot-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent:
                msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.5,
                ...(msg.role === "user"
                  ? {
                      background: "#6366f1",
                      color: "white",
                      borderBottomRightRadius: 4,
                    }
                  : {
                      background: "#f4f5f7",
                      color: "#1a1d23",
                      borderBottomLeftRadius: 4,
                    }),
              }}
            >
              {renderContent(msg.content)}
            </div>
          </div>
        ))}
        {thinking && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: "#f4f5f7",
                color: "#6b7280",
                fontSize: 14,
                borderBottomLeftRadius: 4,
              }}
            >
              <span className="copilot-thinking">Thinking</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="copilot-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about hiring, budgets, pipeline..."
          disabled={thinking}
          style={{
            flex: 1,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={thinking || !input.trim()}
          style={{
            background: input.trim() && !thinking ? "#6366f1" : "#d1d5db",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 500,
            cursor: input.trim() && !thinking ? "pointer" : "default",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
