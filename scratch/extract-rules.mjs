import fs from 'fs';

const fileContent = fs.readFileSync('src/detectors/technology-stack-detector.ts', 'utf-8');

const regex = /tech:\s*'([^']+)',[\s\S]*?evidenceType:\s*'([^']+)',/g;
const rules = [];

let match;
while ((match = regex.exec(fileContent)) !== null) {
  rules.push({
    tech: match[1],
    evidenceType: match[2]
  });
}

const evidenceWeights = {
  dependency: 0.60,
  devDependency: 0.60,
  peerDependency: 0.60,
  config: 0.25,
  file: 0.15,
  directory: 0.15,
  script: 0.15,
  manifest: 0.60,
};

const grouped = {};
for (const rule of rules) {
  if (!grouped[rule.tech]) {
    grouped[rule.tech] = [];
  }
  grouped[rule.tech].push({
    type: rule.evidenceType,
    weight: evidenceWeights[rule.evidenceType]
  });
}

// Generate markdown
let md = `| Technology | Required Evidence (≥0.60) | Optional Evidence (<0.60) | Max Confidence | False-Positive Risk |
|---|---|---|---|---|
`;

for (const tech of Object.keys(grouped).sort()) {
  const evidences = grouped[tech];
  
  const required = Array.from(new Set(evidences.filter(e => e.weight >= 0.6).map(e => e.type)));
  const optional = Array.from(new Set(evidences.filter(e => e.weight < 0.6).map(e => e.type)));
  
  // Max confidence = sum of all evidence weights, capped at 1.0
  const totalWeight = evidences.reduce((sum, e) => sum + e.weight, 0);
  const maxConf = Math.min(1.0, totalWeight);
  
  // Calculate false positive risk. 
  // Very low: requires dependency/manifest
  // Medium: only relies on files/configs
  let fpRisk = "Low";
  if (required.length === 0) {
    if (optional.length > 0) fpRisk = "Medium/High"; // Without required evidence, might trigger falsely if multiple optional sum to >= 0.6. Wait, if sum of optional >= 0.6, it could trigger without strong evidence.
  }

  // Some rules have directory without strong evidence?
  
  md += `| ${tech} | ${required.length > 0 ? required.join(', ') : 'None'} | ${optional.length > 0 ? optional.join(', ') : 'None'} | ${maxConf.toFixed(2)} | ${fpRisk} |\n`;
}

fs.writeFileSync('scratch/tech-audit.md', md);
console.log("Done");
