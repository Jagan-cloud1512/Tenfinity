import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";

const CodeEditorWindow = ({ onChange, language, code, theme }) => {
  const [value, setValue] = useState(code || "");

  useEffect(() => {
    setValue(code || "");
  }, [code]);

  const handleEditorChange = (value) => {
    setValue(value);
    onChange("code", value);
  };

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Editor
        height="100%"
        width="100%"
        language={language || "java"}
        value={value}
        theme={theme || "vs-dark"}
        defaultValue="// some comment"
        onChange={handleEditorChange}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 12 },
        }}
      />
    </div>
  );
};

export default CodeEditorWindow;
