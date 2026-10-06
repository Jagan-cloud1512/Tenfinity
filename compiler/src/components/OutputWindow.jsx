import React from "react";

const BG = "#ffffff";
const BORDER = "#e0e0e0";
const TEXT = "#1a1a1a";
const TEXT_DIM = "#1a1a1aaa";
const GREEN = "#2cbb5d";
const RED = "#ef4743";

const OutputWindow = ({ testCases, testResults, submitResult, activeTab, activeTestCase, setActiveTestCase, processing }) => {

  // Testcase tab: show visible test cases
  if (activeTab === "testcase") {
    if (testCases.length === 0) {
      return <p style={{ fontSize: 14, color: TEXT_DIM }}>Test cases will load from backend.</p>;
    }
    const tc = testCases[activeTestCase] || testCases[0];
    return (
      <div>
        {/* Test case selector tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {testCases.map((_, i) => (
            <button key={i} onClick={() => setActiveTestCase(i)}
              style={{
                padding: "4px 12px", fontSize: 14, borderRadius: 4, border: "none", cursor: "pointer",
                background: activeTestCase === i ? "#3e3e3e" : "transparent",
                color: activeTestCase === i ? TEXT : TEXT_DIM,
                fontWeight: activeTestCase === i ? 600 : 400,
              }}
            >
              Case {i + 1}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 14, color: TEXT_DIM, marginBottom: 6 }}>Input</div>
        <div style={{ background: BG, borderRadius: 6, padding: "10px 14px", fontFamily: "monospace", fontSize: 14, color: TEXT, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}>
          {tc.input || "—"}
        </div>
        <div style={{ fontSize: 14, color: TEXT_DIM, marginBottom: 6 }}>Expected Output</div>
        <div style={{ background: BG, borderRadius: 6, padding: "10px 14px", fontFamily: "monospace", fontSize: 14, color: TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {tc.expectedOutput || "—"}
        </div>
      </div>
    );
  }

  // Test Result tab
  if (processing) {
    return <p style={{ fontSize: 14, color: TEXT_DIM }}>Running...</p>;
  }

  // Submit result (includes hidden test cases)
  if (submitResult) {
    const isCompileError = submitResult.status === "compile_error";
    if (isCompileError) {
      return (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: RED, marginBottom: 10 }}>Compilation Error</div>
          <pre style={{ background: BG, borderRadius: 6, padding: "10px 14px", fontFamily: "monospace", fontSize: 14, color: RED, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
            {submitResult.error || "Compilation failed."}
          </pre>
        </div>
      );
    }
    const allPassed = submitResult.passed === submitResult.total;
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: allPassed ? GREEN : RED, marginBottom: 10 }}>
          {allPassed ? "Accepted" : `${submitResult.passed}/${submitResult.total} Test Cases Passed`}
        </div>
        {submitResult.total > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {Array.from({ length: submitResult.total }, (_, i) => {
              const r = submitResult.testResults?.[i];
              const passed = r ? r.passed : i < submitResult.passed;
              const isHidden = r ? r.hidden : false;
              return (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600, background: passed ? GREEN + "22" : RED + "22", color: passed ? GREEN : RED,
                  border: `1px solid ${passed ? GREEN + "44" : RED + "44"}`,
                }}>
                  {isHidden ? "H" : i + 1}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 24, fontSize: 14, color: TEXT_DIM }}>
          {submitResult.time && <span>Runtime: <span style={{ color: TEXT, fontWeight: 600 }}>{submitResult.time}</span></span>}
          {submitResult.memory && <span>Memory: <span style={{ color: TEXT, fontWeight: 600 }}>{submitResult.memory}</span></span>}
        </div>
      </div>
    );
  }

  // Run results (visible test cases only)
  if (testResults.length > 0) {
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    const hasError = testResults.some(r => r.error);

    if (hasError && testResults[0]?.status === "compile_error") {
      return (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: RED, marginBottom: 10 }}>Compilation Error</div>
          <pre style={{ background: BG, borderRadius: 6, padding: "10px 14px", fontFamily: "monospace", fontSize: 14, color: RED, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
            {testResults[0].error}
          </pre>
        </div>
      );
    }

    const selected = testResults[activeTestCase] || testResults[0];
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: passed === total ? GREEN : BORDER === 0 ? RED : "#ffc01e", marginBottom: 10 }}>
          {passed === total ? `${passed}/${total} Passed` : `${passed}/${total} Passed`}
        </div>
        {/* Per-case tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {testResults.map((r, i) => (
            <button key={i} onClick={() => setActiveTestCase(i)}
              style={{
                padding: "4px 12px", fontSize: 14, borderRadius: 4, border: "none", cursor: "pointer",
                background: activeTestCase === i ? "#3e3e3e" : "transparent",
                color: r.passed ? GREEN : RED, fontWeight: activeTestCase === i ? 600 : 400,
              }}
            >
              Case {i + 1} {r.passed ? "✓" : "✗"}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 14, color: TEXT_DIM, marginBottom: 6 }}>Input</div>
        <div style={{ background: BG, borderRadius: 6, padding: "10px 14px", fontFamily: "monospace", fontSize: 14, color: TEXT, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}>
          {selected.input || "—"}
        </div>
        <div style={{ fontSize: 14, color: TEXT_DIM, marginBottom: 6 }}>Expected Output</div>
        <div style={{ background: BG, borderRadius: 6, padding: "10px 14px", fontFamily: "monospace", fontSize: 14, color: TEXT, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}>
          {selected.expectedOutput || "—"}
        </div>
        <div style={{ fontSize: 14, color: TEXT_DIM, marginBottom: 6 }}>Your Output</div>
        <div style={{ background: BG, borderRadius: 6, padding: "10px 14px", fontFamily: "monospace", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: selected.passed ? GREEN : RED }}>
          {selected.actualOutput || "—"}
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 14, color: TEXT_DIM }}>
          {selected.time && <span>Runtime: <span style={{ color: TEXT, fontWeight: 600 }}>{selected.time}</span></span>}
          {selected.memory && <span>Memory: <span style={{ color: TEXT, fontWeight: 600 }}>{selected.memory}</span></span>}
        </div>
      </div>
    );
  }

  return <p style={{ fontSize: 14, color: TEXT_DIM }}>Run your code to see results here.</p>;
};

export default OutputWindow;
