import { analyzeDocument } from "../src/lib/ai/analyzeDocument";

(async () => {
  const r = await analyzeDocument({
    text: "Glucose: 95 mg/dL. WBC: 6.0 K/uL.",
    documentType: "lab_report",
    readingLevel: "simple",
  });
  console.log(JSON.stringify(r, null, 2));
})();
