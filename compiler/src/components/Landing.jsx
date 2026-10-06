import React, { useEffect, useState } from "react";
import CodeEditorWindow from "./CodeEditorWindow";
import { languageOptions } from "../constants/languageOptions";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { defineTheme } from "../lib/defineTheme";
import useKeyPress from "../hooks/useKeyPress";
import OutputWindow from "./OutputWindow";
import LanguagesDropdown from "./LanguagesDropdown";
import { submitCode } from "../lib/judge0";

const BG = "#ffffff";
const PANEL = "#f5f5f5";
const BORDER = "#e0e0e0";
const TEXT = "#1a1a1a";
const TEXT_DIM = "#1a1a1aaa";
const GREEN = "#2cbb5d";
const RED = "#ef4743";
const YELLOW = "#e6a700";

const DIFFICULTY_COLORS = { easy: GREEN, medium: YELLOW, hard: RED };

const languageDefaults = {
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java!");\n    }\n}`,
  python: `print("Hello, Python!")`,
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, C!\\n");\n    return 0;\n}`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, C++!" << endl;\n    return 0;\n}`,
};

const Landing = () => {
  const [code, setCode] = useState(languageDefaults.java);
  const [processing, setProcessing] = useState(false);
  const [theme, setTheme] = useState("vs-dark");
  const [language, setLanguage] = useState(languageOptions.find((l) => l.value === "java"));
  const [splitX, setSplitX] = useState(40);
  const [splitY, setSplitY] = useState(65);
  const [activeTab, setActiveTab] = useState("description");
  const [resultTab, setResultTab] = useState("testcase");
  const dragX = React.useRef(false);
  const dragY = React.useRef(false);
  const rightRef = React.useRef(null);

  // --- Backend data state ---

  // Problem fetched from backend
  // Shape: { id, title, difficulty, description, examples: [{ input, output, explanation }], constraints: [] }
  const [problem, setProblem] = useState(null);

  // Visible test cases from backend (shown to user)
  // Shape: [{ id, input, expectedOutput }]
  const [testCases, setTestCases] = useState([]);

  // Which visible test case tab is selected
  const [activeTestCase, setActiveTestCase] = useState(0);

  // Results after Run (visible test cases only)
  // Shape: [{ id, input, expectedOutput, actualOutput, passed, time, memory, error, status }]
  const [testResults, setTestResults] = useState([]);

  // Results after Submit (all test cases including hidden)
  // Shape: { passed, total, time, memory, status, error, testResults: [same shape as above] }
  const [submitResult, setSubmitResult] = useState(null);

  // Submissions history
  // Shape: [{ id, timestamp, status, language, runtime, memory }]
  const [submissions, setSubmissions] = useState([]);

  // --- Slogans ---
  const slogans = [
    "It worked on my machine. Deploying my machine.",
    "99 bugs in the code... fix one... 127 bugs in the code.",
    "My code doesn't have bugs. It has surprise features.",
    "Semicolons: the difference between lunch and launching missiles.",
    "If at first you don't succeed, call it version 1.0.",
    "Works on my machine. That counts, right?",
    "There are only 10 types of people: those who get binary, and those who don't.",
    "I don't always test my code, but when I do, I do it in production.",
    "The best thing about a boolean is even if you're wrong, you're only off by a bit.",
    "A SQL query walks into a bar, sees two tables, and asks... may I JOIN you?",
    "Why do Java devs wear glasses? Because they can't C#.",
    "It compiles. Ship it.",
    "Deleted 200 lines. Code works better now. Suspicious.",
    "That moment when your code works and you have no idea why.",
    "Copy-paste from Stack Overflow? No, I call it collaborative coding.",
    "The code is documented. The documentation is wrong.",
    "Debugging: being the detective in a crime movie where you're also the murderer.",
    "Programming is 10% writing code and 90% figuring out why it doesn't work.",
    "In theory, theory and practice are the same. In practice, they're not.",
    "Give a man a program, frustrate him for a day. Teach him to program, frustrate him for a lifetime.",
    "I have a joke about recursion. I have a joke about recursion.",
    "Real programmers count from zero.",
    "My code's so clean, even the linter gave me a standing ovation.",
    "undefined is not a function. But it is a lifestyle.",
    "Tabs vs spaces? I use both just to watch the world burn.",
    "My code works. I just don't know which line is doing it.",
    "Fixing one bug is easy. Fixing one bug without creating three more is art.",
    "Trust me, I'm an engineer. *code catches fire*",
    "The Wi-Fi went down for 5 minutes, so I had to talk to my family. They seem nice.",
    "Roses are red, violets are blue, unexpected '{' on line 32.",
    "I would tell you a UDP joke, but you might not get it.",
    "There's no place like 127.0.0.1.",
    "Life is short. Use Python. Unless you need speed. Then cry in C++.",
    "To understand recursion, you must first understand recursion.",
    "The only thing worse than a wrong answer is a wrong answer that passes all test cases.",
    "Brute force: because O(n!) is a personality trait.",
    "Arrays start at 0. Friendships start at 'can you review my PR?'",
    "Sleep is just a timeout function humans haven't optimized.",
    "Coffee.drink() returns Energy, but only for 2 hours.",
    "My biggest flex? My code compiled on the first try. Once. In 2019.",
    "I speak fluent Python, broken Java, and angry C++.",
    "When the interviewer says 'solve this optimally'... *sweats in O(n log n)*",
    "That feeling when you realize the bug was a typo all along.",
    "The glass is twice as large as it needs to be. — every programmer",
    "Code review: where friendships go to be tested.",
    "If debugging is removing bugs, then programming is adding them.",
    "A clean codebase is just a codebase no one is working on yet.",
    "Merge conflict? More like merge therapy session.",
    "I put the 'fun' in 'function' and the 'pro' in 'procrastination'.",
    "The fastest algorithm is the one you don't need to write.",
    "My rubber duck is my most senior team member.",
    "Keep calm and git commit.",
    "Relationship status: in a committed branch.",
    "Life's too short for O(n²) solutions.",
    "Segfault: the computer's way of saying 'we need to talk'.",
    "Behind every successful coder is a mass of googled error messages.",
    "i++ because i is never enough.",
    "Some people dream of success. Coders close their IDE and reopen it.",
    "The first rule of programming: if it works, don't touch it.",
    "Why did the developer go broke? Because they used up all their cache.",
    "Pointers: because who doesn't love a little existential crisis in C?",
    "404: Motivation not found. Coding anyway.",
    "Git blame is just accountability with extra steps.",
    "Think DP is hard? Wait till you explain it in an interview.",
    "I came, I saw, I allocated memory and forgot to free it.",
    "LinkedList fans: 'But insertion is O(1)!' ...after you find the node. In O(n).",
    "HashMap: the answer to every interview question, apparently.",
    "Thread safety is just trust issues in code form.",
    "If Java had a dating profile: 'I'm verbose but reliable. Love boilerplate.'",
    "Python: where indentation is not a style choice, it's the law.",
    "C programmers never die. They just get cast into void.",
    "After 8 hours of coding, my code works. After 1 more hour of 'cleanup,' it doesn't.",
    "My code ran perfectly. Then I showed it to someone.",
    "Two hard problems in CS: cache invalidation, naming things, and off-by-one errors.",
    "Pushed to main on a Friday. Pray for me.",
    "The console.log() is my best friend and therapist.",
    "Me at 3am: 'What if I refactor everything?'",
    "Recursion limit exceeded. Also, my patience limit.",
    "if (tired) { coffee++ } else { code() }",
    "The project deadline is like a horizon. You walk toward it, but it keeps moving.",
    "I told my code to be more efficient. It started deleting my features.",
    "Whiteboard interviews: where your handwriting fails you before your logic does.",
    "Write 10 lines: 47 errors. Delete 1 line: 63 errors.",
    "If your code is too clever for you to debug, it's too clever.",
    "The only design pattern I consistently use is 'hope-driven development'.",
    "TDD: write the test, watch it fail, question your career, fix the code.",
    "Stack Overflow: the university that raised an entire generation of devs.",
    "How do trees access the internet? They log in.",
    "Some call it technical debt. I call it job security.",
    "My code is 100% organic, locally sourced, and artisanally buggy.",
    "Exception handling: where optimism meets reality.",
    "Commit message: 'fixed stuff' — future me will totally understand.",
    "Pair programming: one person types, the other says 'wait, go back.'",
    "The variable is named temp. It has been in production for 4 years.",
    "Legacy code: code written by someone who left. Or by you, last month.",
    "I'm not stuck in an infinite loop. I'm in a very committed while(true).",
    "Your code may be garbage, but at least the garbage collector has a job.",
    "Don't worry about the bugs. They're just undocumented features.",
    "Remember: even Google was once someone's side project.",
    "My code is self-documenting. Unfortunately, it documents confusion.",
    "The computer does exactly what you tell it. That's the problem.",
    "I'd explain this algorithm but I don't understand it myself.",
    "One does not simply mass a code without googling at least once.",
    "The best error message is the one you never see.",
    "You had me at 'Hello, World!'",
    "Ctrl+Z: the only time travel that actually works.",
    "My code has zero bugs. I just haven't found them yet.",
    "The cloud is just someone else's computer having a bad day.",
    "Coding interviews: where you forget everything you've ever learned.",
    "I love deadlines. I love the whooshing sound they make as they go by.",
    "Sometimes the most productive thing you can do is close your laptop.",
    "Code never lies. Comments sometimes do.",
    "I didn't choose the dev life. The dev life segfaulted into me.",
    "Compiled successfully. Time to introduce new bugs.",
    "That one friend who says 'I'll fix it in production.'",
    "Java: write once, debug everywhere.",
    "The best part about coding at night is no one's awake to push to your branch.",
    "Documentation is like a love letter to your future self.",
    "NullPointerException: Java's way of keeping you humble.",
    "Every great developer you know got there by solving problems they thought they couldn't.",
    "My code has more comments than a YouTube video.",
    "My algorithm's time complexity? O(my god).",
    "'It should be a quick fix' — famous last words.",
    "The only constant in programming is change. Also, Math.PI.",
    "The machine is always right. You're the variable.",
    "Just one more feature... said every dev who missed the deadline.",
    "Why fix it today when you can deprecate it tomorrow?",
    "Binary: it's as easy as 01, 10, 11.",
    "The stack is not the only thing that overflows around here.",
    "Mondays are for merging. Fridays are for reverting.",
    "Software and cathedrals — first we build them, then we pray.",
    "In a world full of bugs, be the patch.",
    "The three virtues of a programmer: laziness, impatience, and hubris.",
    "Rename it. Half the bugs are just bad variable names.",
    "Git stash: where my half-finished ideas go to retire.",
    "My try-catch block caught feelings instead of errors.",
    "I started with 'Hello, World!' and it's been downhill since.",
    "The API returned 200 OK. My faith in humanity is restored.",
    "Docker: because 'it works on my machine' wasn't convincing enough.",
    "Can't have merge conflicts if you never pull. *taps forehead*",
    "They said learn one language well. I chose all of them, poorly.",
    "An empty catch block is just a developer in denial.",
    "Type safety is just the compiler being overprotective.",
    "You don't truly know a language until you've cursed at it.",
    "Agile: moving fast and breaking things, but with a process.",
    "Feature complete means 'most of the features are complete.'",
    "There are two ways to write error-free programs. Only the third works.",
    "One day I'll write clean code. Today is not that day.",
    "The best code I ever wrote was the code I deleted.",
    "My code compiles. My confidence doesn't.",
    "Every exit() is an entrance() somewhere else.",
    "This bug is not a bug, it's an undocumented feature from the future.",
    "My internet connection has more uptime than my motivation.",
    "I solve problems you didn't know you had in ways you don't understand.",
    "That awkward moment when the intern finds the bug you missed.",
    "Garbage in, garbage out — unless your garbage collector is on break.",
    "I'll automate that task. *spends 10x longer automating it*",
    "Memory leak? I prefer 'generous memory allocation.'",
    "I don't have mass or energy. Just potential — specifically, undefined potential.",
    "One cannot simply mass a regex correctly on the first try.",
    "My code is like my room. I know where everything is. Don't touch it.",
    "The last mass before a deadline is always 'add logging.'",
    "I don't debug. I add features until the bug becomes irrelevant.",
    "Some bugs are so old they deserve a retirement party.",
    "Coding late at night: 50% genius ideas, 50% tomorrow's regrets.",
    "My git log reads like a diary of bad decisions.",
    "Syntax error on line 1. There are 2000 lines.",
    "This meeting could have been a Slack message. This Slack message could have been nothing.",
    "I write code so my future self has something to be confused about.",
    "Behind every 'Hello, World!' is someone who almost quit five minutes ago.",
    "'Works perfectly' and 'I haven't tested edge cases' are the same sentence.",
    "I'm not a hoarder. I just don't delete commented-out code.",
    "You know you're a dev when you can't enjoy a website without inspecting the source.",
    "Algorithms are just opinions with math backing them up.",
    "The real treasure was the bugs we fixed along the way.",
    "AI will replace programmers. Also AI: *can't center a div*",
    "Asking a dev to estimate time is like asking a cat to fetch. It's possible, but unlikely.",
    "I have trust issues — and by trust I mean I don't trust any input.",
    "Everything is a trade-off. Except sleep. Sleep is just gone.",
    "The fastest code is the code that never runs.",
    "Senior dev advice: 'Have you tried restarting it?' Works 60% of the time, every time.",
    "My pull request description: 'Please just trust me on this one.'",
    "I spent 4 hours on this bug. It was a missing comma.",
    "The sprint is over. The bugs are not.",
    "localhost: where dreams come true and production bugs don't exist.",
    "One day I'll read the documentation before coding. But not today.",
    "My code doesn't need tests. It needs prayers.",
    "The real MVP is whoever wrote that helpful comment in the codebase.",
    "I optimize for readability because future me can't even read my own handwriting.",
    "The only thing I deploy on Fridays is my escape plan.",
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "I've mass more mass messages than actual code commits this week.",
    "sudo make me a sandwich — the only valid use of authority.",
    "Blockchain: because sometimes your database isn't complicated enough.",
    "My keyboard has a favorite key. It's Backspace.",
    "The problem with troubleshooting is that trouble shoots back.",
    "I'll refactor this later. *Narrator: they never refactored it.*",
    "Nothing is permanent except a temporary workaround.",
    "We don't make mistakes. We have happy little runtime errors.",
    "The real syntax error was the friends we lost debugging along the way.",
    "Version control: because 'final_final_v2_REAL.py' wasn't cutting it.",
    "I have 99 problems and mass allocations are all of them.",
    "Coding is like cooking. Sometimes you follow the recipe. Sometimes you set fire to the kitchen.",
    "The best variable name is the one you don't have to hover over to understand.",
    "My code review feedback: 'LGTM' *didn't actually read it*",
  ];
  const [sloganIdx, setSloganIdx] = useState(() => Math.floor(Math.random() * slogans.length));
  useEffect(() => {
    const id = setInterval(() => setSloganIdx((i) => (i + 1) % slogans.length), 10000);
    return () => clearInterval(id);
  }, []);

  const nudges = [
    "Yes, you can solve it!", "Think a different approach.", "You will ace this test!",
    "Break it into smaller steps.", "You're closer than you think.", "Trust your logic.",
    "Read the problem once more.", "Try a brute force first.", "What's the pattern here?",
    "Draw it out on paper.", "You've solved harder ones.", "Check the constraints again.",
    "Think about edge cases.", "Simplify your approach.", "One step at a time.",
    "What data structure fits?", "You're on the right track.", "Don't overthink it.",
    "Re-read the example.", "Trace through your code.", "Almost there, keep going!",
    "What if you sort it first?", "Try working backwards.", "Think about the base case.",
    "Focus on what changes.", "Keep calm and debug.", "Your approach is solid.",
    "Look for a simpler pattern.", "Test with a small input.", "You've got this!",
    "What would the output look like?", "Sleep on it. Or solve it now.", "Map it. Then code it.",
    "Think greedy. Think simple.", "Two pointers might help here.", "HashMap could be the key.",
    "Can you reduce the search space?", "What's the time complexity?", "Try dry-running it.",
    "Visualize the recursion tree.", "Binary search this problem.", "Think about what you'd skip.",
    "Start from the expected output.", "Your brain is the compiler.", "Just start typing. Refine later.",
    "What's the invariant here?", "Sliding window, maybe?", "Does sorting help?",
    "Think about overlapping subproblems.", "You're smarter than this bug.",
    "Breathe. Think. Code.", "The answer is in the constraints.", "What if you flip the problem?",
    "One more read. One more try.", "Think input-output. That's it.", "Stack or queue? Pick one.",
    "Your persistence is your power.", "The solution is simple. Find it.",
  ];
  const [nudgeIdx, setNudgeIdx] = useState(() => Math.floor(Math.random() * nudges.length));
  useEffect(() => {
    const id = setInterval(() => setNudgeIdx((i) => (i + 1) % nudges.length), 8000);
    return () => clearInterval(id);
  }, []);

  // --- End backend data state ---

  const enterPress = useKeyPress("Enter");
  const ctrlPress = useKeyPress("Control");

  useEffect(() => {
    if (enterPress && ctrlPress) handleRun();
  }, [ctrlPress, enterPress]);

  useEffect(() => {
    const onMove = (e) => {
      if (dragX.current) {
        setSplitX(Math.min(70, Math.max(20, (e.clientX / window.innerWidth) * 100)));
      }
      if (dragY.current && rightRef.current) {
        const rect = rightRef.current.getBoundingClientRect();
        setSplitY(Math.min(85, Math.max(30, ((e.clientY - rect.top) / rect.height) * 100)));
      }
    };
    const onUp = () => { dragX.current = false; dragY.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    defineTheme("night-owl").then(() => setTheme("vs-dark"));
  }, []);

  // Eye tracking cursor
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const eyeRef = React.useRef(null);
  useEffect(() => {
    const onMouseMove = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  // TODO: fetch problem from backend
  // useEffect(() => { fetchProblem(problemId).then(data => { setProblem(data); setTestCases(data.testCases); setCode(data.starterCode?.[language.value] || ""); }); }, [problemId]);

  const onSelectChange = (sl) => {
    setLanguage(sl);
    const starter = problem?.starterCode?.[sl?.value];
    setCode(starter || languageDefaults[sl?.value] || `// ${sl?.label || "Selected language"} code`);
  };

  const onChange = (action, data) => {
    if (action === "code") setCode(data);
  };

  const handleRun = async () => {
    setProcessing(true);
    setTestResults([]);
    setResultTab("testresult");

    try {
      const stdin = testCases.length > 0
        ? testCases.map(tc => tc.input).join("\n---\n")
        : "";
      const data = await submitCode(code, language.id, stdin);

      if (data.status?.id === 6) {
        setTestResults([{ error: data.compile_output || "Compilation failed.", status: "compile_error" }]);
      } else if (data.status?.id >= 7) {
        setTestResults([{ error: data.stderr || data.message || "Runtime error.", status: "runtime_error" }]);
      } else {
        const output = data.stdout || "";
        if (testCases.length > 0) {
          const outputs = output.trim().split("\n---\n");
          setTestResults(testCases.map((tc, i) => {
            const actual = (outputs[i] || "").trim();
            const expected = (tc.expectedOutput || "").trim();
            return { input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: actual, passed: actual === expected, time: data.time, memory: data.memory };
          }));
        } else {
          setTestResults([{ input: "", expectedOutput: "", actualOutput: output.trim(), passed: true, time: data.time, memory: data.memory }]);
        }
        toast.success(`Finished in ${data.time || "?"}s`, { position: "top-center", autoClose: 2000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Judge0 request failed.", { position: "top-center", autoClose: 3000 });
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async () => {
    setProcessing(true);
    setSubmitResult(null);
    setResultTab("testresult");

    try {
      const stdin = testCases.length > 0
        ? testCases.map(tc => tc.input).join("\n---\n")
        : "";
      const data = await submitCode(code, language.id, stdin);

      if (data.status?.id === 6) {
        setSubmitResult({ status: "compile_error", error: data.compile_output || "Compilation failed.", passed: 0, total: testCases.length || 1, testResults: [] });
      } else if (data.status?.id >= 7) {
        setSubmitResult({ status: "runtime_error", error: data.stderr || data.message || "Runtime error.", passed: 0, total: testCases.length || 1, testResults: [] });
      } else {
        const output = data.stdout || "";
        if (testCases.length > 0) {
          const outputs = output.trim().split("\n---\n");
          const results = testCases.map((tc, i) => {
            const actual = (outputs[i] || "").trim();
            const expected = (tc.expectedOutput || "").trim();
            return { input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: actual, passed: actual === expected, time: data.time, memory: data.memory };
          });
          const passed = results.filter(r => r.passed).length;
          setSubmitResult({ passed, total: results.length, time: data.time, memory: data.memory, testResults: results });
          setTestResults(results);
        } else {
          setSubmitResult({ passed: 1, total: 1, time: data.time, memory: data.memory, testResults: [{ actualOutput: output.trim(), passed: true }] });
        }
        toast.success(`Submitted — ${data.time || "?"}s`, { position: "top-center", autoClose: 2000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Judge0 request failed.", { position: "top-center", autoClose: 3000 });
    } finally {
      setProcessing(false);
    }
  };

  const getVerdict = () => {
    if (submitResult) {
      if (submitResult.status === "compile_error") return { text: "Compilation Error", color: RED };
      if (submitResult.passed === submitResult.total) return { text: "Accepted", color: GREEN };
      return { text: `${submitResult.passed}/${submitResult.total} Passed`, color: YELLOW };
    }
    if (testResults.length > 0) {
      const hasError = testResults.some(r => r.error);
      if (hasError) return { text: "Compilation Error", color: RED };
      const passed = testResults.filter(r => r.passed).length;
      const total = testResults.length;
      if (passed === total) return { text: `${passed}/${total} Passed`, color: GREEN };
      return { text: `${passed}/${total} Passed`, color: YELLOW };
    }
    return null;
  };

  const verdict = getVerdict();

  const panelStyle = { background: PANEL, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" };
  const tabStyle = (active) => ({
    padding: "8px 16px", fontSize: 15, fontWeight: active ? 600 : 400,
    color: active ? TEXT : TEXT_DIM, background: "transparent", border: "none",
    borderBottom: active ? "2px solid white" : "2px solid transparent", cursor: "pointer",
  });

  const diffColor = problem?.difficulty ? DIFFICULTY_COLORS[problem.difficulty] || TEXT_DIM : TEXT_DIM;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: BG, color: TEXT, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <ToastContainer position="top-center" autoClose={2000} hideProgressBar newestOnTop closeOnClick draggable pauseOnHover theme="dark" />

      {/* Navbar */}
      <div style={{ height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: PANEL, borderBottom: `1px solid ${BORDER}`, position: "relative" }}>
        <div style={{ fontSize: 15, color: TEXT_DIM, whiteSpace: "nowrap", fontStyle: "italic" }}>Developed by St.Joseph's Hope Elite</div>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 15, color: TEXT_DIM, fontStyle: "italic", whiteSpace: "nowrap", transition: "opacity 0.4s", opacity: 0.8 }}>
          {slogans[sloganIdx]}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {verdict && (
            <span style={{ fontSize: 15, fontWeight: 600, color: verdict.color, padding: "4px 10px", borderRadius: 4, background: verdict.color + "18" }}>
              {verdict.text}
            </span>
          )}
          <button onClick={handleRun} disabled={!code || processing}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 14px", borderRadius: 5, background: "rgba(44,187,93,0.12)", color: GREEN, fontSize: 15, fontWeight: 600, cursor: code ? "pointer" : "not-allowed", opacity: code ? 1 : 0.5, border: `1px solid rgba(44,187,93,0.3)` }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(44,187,93,0.22)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(44,187,93,0.12)"; }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 12, height: 12 }}><path d="M8 5v14l11-7z"/></svg>
            {processing ? "Running..." : "Run"}
          </button>
          <button onClick={handleSubmit} disabled={!code || processing}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 14px", borderRadius: 5, border: "none", background: GREEN, color: "#fff", fontSize: 15, fontWeight: 600, cursor: code ? "pointer" : "not-allowed", opacity: code ? 1 : 0.5 }}
            onMouseEnter={(e) => code && (e.currentTarget.style.background = "#26a94f")}
            onMouseLeave={(e) => code && (e.currentTarget.style.background = GREEN)}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, padding: 8, gap: 0 }}>

        {/* Left panel: Question */}
        <div style={{ width: splitX + "%", minWidth: 0, display: "flex", flexDirection: "column", position: "relative", ...panelStyle, marginRight: 0 }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}` }}>
            {["Description", "Submissions"].map((t) => (
              <button key={t} onClick={() => setActiveTab(t.toLowerCase())} style={tabStyle(activeTab === t.toLowerCase())}>{t}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

            {activeTab === "description" && (
              <div>
                {/* Difficulty */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  {problem?.difficulty && (
                    <span style={{ fontSize: 15, fontWeight: 600, padding: "2px 8px", borderRadius: 10, color: diffColor, background: diffColor + "18" }}>
                      {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px", minHeight: 28, color: problem?.title ? TEXT : TEXT_DIM }}>
                  {problem?.title || "—"}
                </h1>

                {/* Description */}
                <div style={{ fontSize: 15, color: TEXT_DIM, lineHeight: 1.8, marginBottom: 20, minHeight: 60 }}>
                  {problem?.description || "Problem description will appear here."}
                </div>

                {/* Examples */}
                {(problem?.examples || []).map((ex, i) => (
                  <div key={i} style={{ marginTop: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Example {i + 1}:</h3>
                    <div style={{ background: BG, borderRadius: 6, padding: "12px 16px", fontSize: 15, fontFamily: "monospace", lineHeight: 1.8, color: TEXT_DIM }}>
                      <div><strong style={{ color: TEXT }}>Input:</strong> {ex.input}</div>
                      <div><strong style={{ color: TEXT }}>Output:</strong> {ex.output}</div>
                      {ex.explanation && <div><strong style={{ color: TEXT }}>Explanation:</strong> {ex.explanation}</div>}
                    </div>
                  </div>
                ))}

                {/* Constraints */}
                {problem?.constraints?.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Constraints:</h3>
                    <ul style={{ fontSize: 15, color: TEXT_DIM, lineHeight: 2, paddingLeft: 20 }}>
                      {problem.constraints.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === "submissions" && (
              <div>
                {submissions.length === 0 ? (
                  <p style={{ fontSize: 15, color: TEXT_DIM }}>No submissions yet.</p>
                ) : (
                  <table style={{ width: "100%", fontSize: 15, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: TEXT_DIM, textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>
                        <th style={{ padding: "8px 0" }}>Status</th>
                        <th style={{ padding: "8px 0" }}>Language</th>
                        <th style={{ padding: "8px 0" }}>Runtime</th>
                        <th style={{ padding: "8px 0" }}>Memory</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => (
                        <tr key={s.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: "8px 0", color: s.status === "Accepted" ? GREEN : RED, fontWeight: 600 }}>{s.status}</td>
                          <td style={{ padding: "8px 0", color: TEXT_DIM }}>{s.language}</td>
                          <td style={{ padding: "8px 0", color: TEXT_DIM }}>{s.runtime}</td>
                          <td style={{ padding: "8px 0", color: TEXT_DIM }}>{s.memory}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          {/* Human eyes + motivational nudge — fixed at bottom left */}
          <div ref={eyeRef} style={{ position: "absolute", bottom: 10, left: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="110" height="42" viewBox="0 0 80 30">
              {/* Left eye */}
              <path d="M3 15 C10 4, 28 4, 35 15" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M3 15 C10 26, 28 26, 35 15" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="19" y1="3" x2="19" y2="0" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="11" y1="5.5" x2="8" y2="2.5" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="27" y1="5.5" x2="30" y2="2.5" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="19" cy="15" r="6" fill="white" stroke="#1a1a1a" strokeWidth="1"/>
              <circle
                cx={19 + (() => {
                  if (!eyeRef.current) return 0;
                  const rect = eyeRef.current.getBoundingClientRect();
                  const dx = mouse.x - (rect.left + 19);
                  const dy = mouse.y - (rect.top + 15);
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  return dist === 0 ? 0 : (dx / dist) * Math.min(3, dist * 0.018);
                })()}
                cy={15 + (() => {
                  if (!eyeRef.current) return 0;
                  const rect = eyeRef.current.getBoundingClientRect();
                  const dx = mouse.x - (rect.left + 19);
                  const dy = mouse.y - (rect.top + 15);
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  return dist === 0 ? 0 : (dy / dist) * Math.min(3, dist * 0.018);
                })()}
                r="3" fill="#1a1a1a"
              />

              {/* Right eye */}
              <path d="M45 15 C52 4, 70 4, 77 15" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M45 15 C52 26, 70 26, 77 15" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="61" y1="3" x2="61" y2="0" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="53" y1="5.5" x2="50" y2="2.5" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="69" y1="5.5" x2="72" y2="2.5" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="61" cy="15" r="6" fill="white" stroke="#1a1a1a" strokeWidth="1"/>
              <circle
                cx={61 + (() => {
                  if (!eyeRef.current) return 0;
                  const rect = eyeRef.current.getBoundingClientRect();
                  const dx = mouse.x - (rect.left + 61);
                  const dy = mouse.y - (rect.top + 15);
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  return dist === 0 ? 0 : (dx / dist) * Math.min(3, dist * 0.018);
                })()}
                cy={15 + (() => {
                  if (!eyeRef.current) return 0;
                  const rect = eyeRef.current.getBoundingClientRect();
                  const dx = mouse.x - (rect.left + 61);
                  const dy = mouse.y - (rect.top + 15);
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  return dist === 0 ? 0 : (dy / dist) * Math.min(3, dist * 0.018);
                })()}
                r="3" fill="#1a1a1a"
              />
            </svg>
            <span style={{
              fontSize: 15,
              fontWeight: 900,
              fontStyle: "italic",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              background: "linear-gradient(90deg, #ff4500, #ff8c00, #ffd700, #ff4500)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "fireGlow 2s linear infinite",
              textShadow: "none",
            }}>
              {nudges[nudgeIdx]}
            </span>
          </div>
        </div>

        {/* Vertical drag handle */}
        <div onMouseDown={() => { dragX.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
          style={{ width: 8, cursor: "col-resize", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 3, height: 40, borderRadius: 2, background: BORDER, transition: "background 0.15s" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#bbb"}
            onMouseLeave={(e) => e.currentTarget.style.background = BORDER} />
        </div>

        {/* Right panel: Editor + Output */}
        <div ref={rightRef} style={{ width: (100 - splitX) + "%", minWidth: 0, display: "flex", flexDirection: "column" }}>

          {/* Editor panel */}
          <div style={{ height: splitY + "%", minHeight: 0, display: "flex", flexDirection: "column", ...panelStyle }}>
            <div style={{ display: "flex", alignItems: "center", padding: "0 4px 0 0", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <div style={{ width: 180 }}>
                <LanguagesDropdown onSelectChange={onSelectChange} language={language} />
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <CodeEditorWindow code={code} onChange={onChange} language={language?.value} theme="light" />
            </div>
          </div>

          {/* Horizontal drag handle */}
          <div onMouseDown={() => { dragY.current = true; document.body.style.cursor = "row-resize"; document.body.style.userSelect = "none"; }}
            style={{ height: 8, cursor: "row-resize", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ height: 3, width: 40, borderRadius: 2, background: BORDER, transition: "background 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#bbb"}
              onMouseLeave={(e) => e.currentTarget.style.background = BORDER} />
          </div>

          {/* Output panel */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", ...panelStyle }}>
            <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              {["Testcase", "Test Result"].map((t) => (
                <button key={t} onClick={() => setResultTab(t.toLowerCase().replace(" ", ""))} style={tabStyle(resultTab === t.toLowerCase().replace(" ", ""))}>{t}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <OutputWindow
                testCases={testCases}
                testResults={testResults}
                submitResult={submitResult}
                activeTab={resultTab}
                activeTestCase={activeTestCase}
                setActiveTestCase={setActiveTestCase}
                processing={processing}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Landing;
