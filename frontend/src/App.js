import { useState } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setExtractedData(null);
    setErrorMsg("");
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF file.");

    const formData = new FormData();
    formData.append("resume", file);

    setLoading(true);
    setErrorMsg("");
    try {
      const response = await fetch("http://localhost:5000/extract-data", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to extract data");
      }

      const data = await response.json();
      setExtractedData(data.extracted);
    } catch (error) {
      setErrorMsg(error.message);
      setExtractedData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Resume Extractor</h1>
      <input type="file" accept=".pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} style={{ marginLeft: "10px" }}>
        Extract Data
      </button>

      {loading && <p>Extracting...</p>}
      {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

      {extractedData && (
        <div style={{ marginTop: "20px" }}>
          <h2>Extracted Data:</h2>
          <ul>
            <li>
              <strong>Full Name:</strong> {extractedData.full_name || "Not found"}
            </li>
            <li>
              <strong>Email:</strong> {extractedData.email || "Not found"}
            </li>
            <li>
              <strong>Position:</strong> {extractedData.position !== null ? extractedData.position : "Not found"}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
