import { analyzeDocument } from "../src/lib/ai/analyzeDocument";

/**
 * Smoke test for analyzeDocument function
 * Tests both mock mode and displays any confidence fields if present
 */
(async () => {
  console.log("=== AI Pipeline Smoke Test ===\n");

  // Test 1: Lab Report
  console.log("Test 1: Lab Report (simple reading level)");
  const labResult = await analyzeDocument({
    text: "Glucose: 95 mg/dL. WBC: 6.0 K/uL. Hemoglobin: 14.2 g/dL.",
    documentType: "lab_report",
    readingLevel: "simple",
  });

  console.log("✓ Lab report analysis completed");
  console.log(`  Document type: ${labResult.meta.documentType}`);
  console.log(`  Reading level: ${labResult.meta.readingLevel}`);

  // Check for modelInfo
  if ((labResult.meta as any).modelInfo) {
    const modelInfo = (labResult.meta as any).modelInfo;
    console.log(
      `  Model: ${modelInfo.provider}/${modelInfo.modelName} (temp: ${modelInfo.temperature})`
    );
  }

  // Check for confidence fields
  if ((labResult.patientSummary as any).keyTakeawaysConfidence) {
    console.log(
      `  Confidence fields found: keyTakeawaysConfidence (${(labResult.patientSummary as any).keyTakeawaysConfidence.length} values)`
    );
  }

  console.log(
    `  Key takeaways: ${labResult.patientSummary.keyTakeaways.length} items`
  );
  console.log(`  Labs analyzed: ${labResult.labsSection?.labs.length || 0}`);

  // Test 2: Discharge Instructions
  console.log("\nTest 2: Discharge Instructions (standard reading level)");
  const dischargeResult = await analyzeDocument({
    text: "Rest at home. Take acetaminophen 500mg every 6 hours. Follow up in 2 weeks.",
    documentType: "discharge_instructions",
    readingLevel: "standard",
  });

  console.log("✓ Discharge instructions analysis completed");
  console.log(`  Document type: ${dischargeResult.meta.documentType}`);
  console.log(`  Reading level: ${dischargeResult.meta.readingLevel}`);

  // Check for modelInfo
  if ((dischargeResult.meta as any).modelInfo) {
    const modelInfo = (dischargeResult.meta as any).modelInfo;
    console.log(
      `  Model: ${modelInfo.provider}/${modelInfo.modelName} (temp: ${modelInfo.temperature})`
    );
  }

  // Check for confidence fields in discharge section
  if (
    dischargeResult.dischargeSection &&
    (dischargeResult.dischargeSection as any).medicationsConfidence
  ) {
    console.log(
      `  Confidence fields found: medicationsConfidence (${(dischargeResult.dischargeSection as any).medicationsConfidence.length} values)`
    );
  }

  console.log(
    `  Medications: ${dischargeResult.dischargeSection?.medications.length || 0}`
  );
  console.log(
    `  Home care steps: ${dischargeResult.dischargeSection?.homeCareSteps.length || 0}`
  );

  // Display full results (for manual inspection of confidence fields)
  console.log("\n=== Full Lab Report Result ===");
  console.log(JSON.stringify(labResult, null, 2));

  console.log("\n=== Full Discharge Result ===");
  console.log(JSON.stringify(dischargeResult, null, 2));

  console.log("\n✅ All smoke tests passed");
})();
