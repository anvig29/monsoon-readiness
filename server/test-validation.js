// Validation test script for Monsoon Copilot deterministic risk engine
const assert = require('assert');

// The exact risk engine logic duplicated from server.js for validation
function calculateDeterministicRisk(weatherData) {
  const condText = (weatherData.conditionText || "").toLowerCase();
  const alerts = weatherData.alerts || [];
  
  const hasActiveAlert = Array.isArray(alerts) && alerts.length > 0;
  const highRiskTerms = ["heavy rain", "torrential", "thunderstorm", "thundery", "thunder", "squall"];
  const isHighRiskCondition = highRiskTerms.some(term => condText.includes(term));
  
  if (hasActiveAlert || isHighRiskCondition) {
    return "HIGH";
  }
  
  const mediumRiskTerms = ["light rain", "patchy rain", "drizzle", "moderate rain", "shower", "rain", "mist"];
  const isMediumRiskCondition = mediumRiskTerms.some(term => condText.includes(term));
  
  if (isMediumRiskCondition) {
    return "MEDIUM";
  }
  
  return "LOW";
}

// Mock test scenarios
const testScenarios = [
  {
    name: "Clear/Sunny Weather Scenario",
    data: {
      conditionText: "Sunny",
      alerts: []
    },
    expected: "LOW"
  },
  {
    name: "Partly Cloudy Scenario",
    data: {
      conditionText: "Partly cloudy",
      alerts: []
    },
    expected: "LOW"
  },
  {
    name: "Light Drizzle Scenario",
    data: {
      conditionText: "Patchy light drizzle",
      alerts: []
    },
    expected: "MEDIUM"
  },
  {
    name: "Moderate Rain Scenario",
    data: {
      conditionText: "Moderate rain",
      alerts: []
    },
    expected: "MEDIUM"
  },
  {
    name: "Heavy Rain Condition Scenario",
    data: {
      conditionText: "Heavy rain at times",
      alerts: []
    },
    expected: "HIGH"
  },
  {
    name: "Thunderstorm Condition Scenario",
    data: {
      conditionText: "Thundery outbreaks in nearby areas",
      alerts: []
    },
    expected: "HIGH"
  },
  {
    name: "Clear Weather with Active Warning Alert",
    data: {
      conditionText: "Clear",
      alerts: [
        { event: "Flood Warning", headline: "High risk of coastal flooding" }
      ]
    },
    expected: "HIGH"
  }
];

console.log("=========================================");
console.log("RUNNING DETERMINISTIC RISK ENGINE VALIDATION");
console.log("=========================================");

let passed = 0;
testScenarios.forEach((scenario, index) => {
  const result = calculateDeterministicRisk(scenario.data);
  try {
    assert.strictEqual(result, scenario.expected);
    console.log(`✅ [Test ${index + 1}] Passed: "${scenario.name}" -> Expected ${scenario.expected}, got ${result}`);
    passed++;
  } catch (error) {
    console.error(`❌ [Test ${index + 1}] Failed: "${scenario.name}" -> Expected ${scenario.expected}, got ${result}`);
  }
});

console.log("=========================================");
console.log(`RESULTS: ${passed}/${testScenarios.length} tests passed successfully.`);
console.log("=========================================");

if (passed === testScenarios.length) {
  process.exit(0);
} else {
  process.exit(1);
}
