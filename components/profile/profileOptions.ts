import type { Category, Skill } from "@/store/profileSetupStore";

type TaxonomyOption<T extends string> = {
  id: T;
  label: string;
};

type SkillCategoryEntry = {
  category: string;
  skill: string;
};

function canonicalizeTaxonomyValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function createGeneratedOptionId(label: string) {
  return canonicalizeTaxonomyValue(label);
}

function dedupeOptions<T extends string>(options: TaxonomyOption<T>[]) {
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  return options.filter((option) => {
    const normalizedId = canonicalizeTaxonomyValue(option.id);
    const normalizedLabel = canonicalizeTaxonomyValue(option.label);

    if (seenIds.has(normalizedId) || seenLabels.has(normalizedLabel)) {
      return false;
    }

    seenIds.add(normalizedId);
    seenLabels.add(normalizedLabel);
    return true;
  });
}

function buildGeneratedOptions<T extends string = string>(
  labels: string[],
): TaxonomyOption<T>[] {
  return dedupeOptions(
    labels.map((label) => ({
      id: createGeneratedOptionId(label) as T,
      label,
    })),
  );
}

const SKILL_CATEGORY_ENTRIES: SkillCategoryEntry[] = [
  { skill: "HTML", category: "Frontend Development" },
  { skill: "CSS", category: "Frontend Development" },
  { skill: "JavaScript", category: "Frontend Development" },
  { skill: "TypeScript", category: "Frontend Development" },
  { skill: "React.js", category: "Frontend Development" },
  { skill: "Next.js", category: "Frontend Development" },
  { skill: "Vue.js", category: "Frontend Development" },
  { skill: "Nuxt.js", category: "Frontend Development" },
  { skill: "Angular", category: "Frontend Development" },
  { skill: "Svelte", category: "Frontend Development" },
  { skill: "Tailwind CSS", category: "Frontend Development" },
  { skill: "Bootstrap", category: "Frontend Development" },
  { skill: "Material UI", category: "Frontend Development" },
  { skill: "Chakra UI", category: "Frontend Development" },
  { skill: "Framer Motion", category: "Frontend Development" },
  { skill: "Redux", category: "Frontend Development" },
  { skill: "Zustand", category: "Frontend Development" },
  {
    skill: "React Query / TanStack Query",
    category: "Frontend Development",
  },
  { skill: "Web Accessibility", category: "Frontend Development" },
  { skill: "Responsive Web Design", category: "Frontend Development" },
  { skill: "Node.js", category: "Backend Development" },
  { skill: "Express.js", category: "Backend Development" },
  { skill: "NestJS", category: "Backend Development" },
  { skill: "Django", category: "Backend Development" },
  { skill: "Flask", category: "Backend Development" },
  { skill: "FastAPI", category: "Backend Development" },
  { skill: "Ruby on Rails", category: "Backend Development" },
  { skill: "Laravel", category: "Backend Development" },
  { skill: "Spring Boot", category: "Backend Development" },
  { skill: "ASP.NET Core", category: "Backend Development" },
  { skill: "REST API Development", category: "Backend Development" },
  { skill: "GraphQL API Development", category: "Backend Development" },
  { skill: "gRPC", category: "Backend Development" },
  { skill: "WebSockets", category: "Backend Development" },
  { skill: "Authentication Systems", category: "Backend Development" },
  { skill: "Authorization Systems", category: "Backend Development" },
  { skill: "API Rate Limiting", category: "Backend Development" },
  { skill: "Background Jobs", category: "Backend Development" },
  { skill: "Server-side Rendering", category: "Backend Development" },
  { skill: "Microservices", category: "Backend Development" },
  { skill: "React Native", category: "Mobile Development" },
  { skill: "Flutter", category: "Mobile Development" },
  { skill: "Kotlin", category: "Mobile Development" },
  { skill: "Swift", category: "Mobile Development" },
  { skill: "Java for Android", category: "Mobile Development" },
  { skill: "Objective-C", category: "Mobile Development" },
  { skill: "Jetpack Compose", category: "Mobile Development" },
  { skill: "SwiftUI", category: "Mobile Development" },
  { skill: "Expo", category: "Mobile Development" },
  { skill: "Native Android Development", category: "Mobile Development" },
  { skill: "Native iOS Development", category: "Mobile Development" },
  { skill: "Mobile App Testing", category: "Mobile Development" },
  { skill: "Push Notifications", category: "Mobile Development" },
  { skill: "App Store Deployment", category: "Mobile Development" },
  { skill: "Play Store Deployment", category: "Mobile Development" },
  { skill: "Python", category: "Programming Languages" },
  { skill: "JavaScript", category: "Programming Languages" },
  { skill: "TypeScript", category: "Programming Languages" },
  { skill: "Java", category: "Programming Languages" },
  { skill: "C#", category: "Programming Languages" },
  { skill: "C++", category: "Programming Languages" },
  { skill: "C", category: "Programming Languages" },
  { skill: "Go", category: "Programming Languages" },
  { skill: "Rust", category: "Programming Languages" },
  { skill: "PHP", category: "Programming Languages" },
  { skill: "Ruby", category: "Programming Languages" },
  { skill: "Swift", category: "Programming Languages" },
  { skill: "Kotlin", category: "Programming Languages" },
  { skill: "Dart", category: "Programming Languages" },
  { skill: "Scala", category: "Programming Languages" },
  { skill: "R", category: "Programming Languages" },
  { skill: "SQL", category: "Programming Languages" },
  { skill: "Bash", category: "Programming Languages" },
  { skill: "PowerShell", category: "Programming Languages" },
  { skill: "MATLAB", category: "Programming Languages" },
  { skill: "PostgreSQL", category: "Database Management" },
  { skill: "MySQL", category: "Database Management" },
  { skill: "MongoDB", category: "Database Management" },
  { skill: "SQLite", category: "Database Management" },
  { skill: "Redis", category: "Database Management" },
  { skill: "Firebase Firestore", category: "Database Management" },
  { skill: "Supabase", category: "Database Management" },
  { skill: "DynamoDB", category: "Database Management" },
  { skill: "Cassandra", category: "Database Management" },
  { skill: "Elasticsearch", category: "Database Management" },
  { skill: "MariaDB", category: "Database Management" },
  { skill: "Oracle Database", category: "Database Management" },
  { skill: "Microsoft SQL Server", category: "Database Management" },
  { skill: "Database Indexing", category: "Database Management" },
  { skill: "Database Replication", category: "Database Management" },
  { skill: "Database Sharding", category: "Database Management" },
  { skill: "Database Backup & Recovery", category: "Database Management" },
  { skill: "Query Optimization", category: "Database Management" },
  { skill: "Data Modeling", category: "Database Management" },
  { skill: "ORM Tools", category: "Database Management" },
  { skill: "Git", category: "Version Control" },
  { skill: "GitHub", category: "Version Control" },
  { skill: "GitLab", category: "Version Control" },
  { skill: "Bitbucket", category: "Version Control" },
  { skill: "Git Branching", category: "Version Control" },
  { skill: "Pull Requests", category: "Version Control" },
  { skill: "Code Review", category: "Version Control" },
  { skill: "Merge Conflict Resolution", category: "Version Control" },
  { skill: "Docker", category: "DevOps" },
  { skill: "Kubernetes", category: "DevOps" },
  { skill: "Jenkins", category: "DevOps" },
  { skill: "GitHub Actions", category: "DevOps" },
  { skill: "GitLab CI/CD", category: "DevOps" },
  { skill: "CircleCI", category: "DevOps" },
  { skill: "Travis CI", category: "DevOps" },
  { skill: "Terraform", category: "DevOps" },
  { skill: "Ansible", category: "DevOps" },
  { skill: "Helm", category: "DevOps" },
  { skill: "Nginx", category: "DevOps" },
  { skill: "Apache Server", category: "DevOps" },
  { skill: "Linux Server Administration", category: "DevOps" },
  { skill: "CI/CD Pipelines", category: "DevOps" },
  { skill: "Infrastructure as Code", category: "DevOps" },
  { skill: "Monitoring & Logging", category: "DevOps" },
  { skill: "AWS", category: "Cloud Computing" },
  { skill: "Microsoft Azure", category: "Cloud Computing" },
  { skill: "Google Cloud Platform", category: "Cloud Computing" },
  { skill: "DigitalOcean", category: "Cloud Computing" },
  { skill: "Vercel", category: "Cloud Computing" },
  { skill: "Netlify", category: "Cloud Computing" },
  { skill: "Heroku", category: "Cloud Computing" },
  { skill: "Cloudflare", category: "Cloud Computing" },
  { skill: "AWS Lambda", category: "Cloud Computing" },
  { skill: "Azure Functions", category: "Cloud Computing" },
  { skill: "Google Cloud Functions", category: "Cloud Computing" },
  { skill: "Cloud Storage", category: "Cloud Computing" },
  { skill: "Serverless Architecture", category: "Cloud Computing" },
  { skill: "Load Balancing", category: "Cloud Computing" },
  { skill: "Cloud Security", category: "Cloud Computing" },
  { skill: "Virtual Machines", category: "Cloud Computing" },
  { skill: "Penetration Testing", category: "Cybersecurity" },
  { skill: "Ethical Hacking", category: "Cybersecurity" },
  { skill: "Network Security", category: "Cybersecurity" },
  { skill: "Web Application Security", category: "Cybersecurity" },
  { skill: "OWASP Top 10", category: "Cybersecurity" },
  { skill: "Vulnerability Assessment", category: "Cybersecurity" },
  { skill: "Threat Modeling", category: "Cybersecurity" },
  { skill: "SIEM Tools", category: "Cybersecurity" },
  { skill: "Incident Response", category: "Cybersecurity" },
  { skill: "Malware Analysis", category: "Cybersecurity" },
  { skill: "Cryptography", category: "Cybersecurity" },
  {
    skill: "Identity and Access Management",
    category: "Cybersecurity",
  },
  { skill: "Security Auditing", category: "Cybersecurity" },
  { skill: "Secure Coding", category: "Cybersecurity" },
  { skill: "Firewall Configuration", category: "Cybersecurity" },
  { skill: "Machine Learning", category: "Artificial Intelligence" },
  { skill: "Deep Learning", category: "Artificial Intelligence" },
  {
    skill: "Natural Language Processing",
    category: "Artificial Intelligence",
  },
  { skill: "Computer Vision", category: "Artificial Intelligence" },
  { skill: "Generative AI", category: "Artificial Intelligence" },
  { skill: "Prompt Engineering", category: "Artificial Intelligence" },
  { skill: "LangChain", category: "Artificial Intelligence" },
  { skill: "LlamaIndex", category: "Artificial Intelligence" },
  {
    skill: "OpenAI API Integration",
    category: "Artificial Intelligence",
  },
  {
    skill: "Hugging Face Transformers",
    category: "Artificial Intelligence",
  },
  { skill: "TensorFlow", category: "Artificial Intelligence" },
  { skill: "PyTorch", category: "Artificial Intelligence" },
  { skill: "Scikit-learn", category: "Artificial Intelligence" },
  { skill: "Model Evaluation", category: "Artificial Intelligence" },
  { skill: "MLOps", category: "Artificial Intelligence" },
  { skill: "Data Analysis", category: "Data & Analytics" },
  { skill: "Data Visualization", category: "Data & Analytics" },
  { skill: "Power BI", category: "Data & Analytics" },
  { skill: "Tableau", category: "Data & Analytics" },
  { skill: "Microsoft Excel", category: "Data & Analytics" },
  { skill: "Pandas", category: "Data & Analytics" },
  { skill: "NumPy", category: "Data & Analytics" },
  { skill: "Apache Spark", category: "Data & Analytics" },
  { skill: "Data Warehousing", category: "Data & Analytics" },
  { skill: "ETL Pipelines", category: "Data & Analytics" },
  { skill: "Smart Contract Development", category: "Blockchain" },
  { skill: "Solidity", category: "Blockchain" },
  { skill: "Web3.js", category: "Blockchain" },
  { skill: "Ethers.js", category: "Blockchain" },
  { skill: "Hardhat", category: "Blockchain" },
  { skill: "Foundry", category: "Blockchain" },
  { skill: "Truffle", category: "Blockchain" },
  { skill: "Remix IDE", category: "Blockchain" },
  { skill: "Wagmi", category: "Blockchain" },
  { skill: "Viem", category: "Blockchain" },
  { skill: "The Graph", category: "Blockchain" },
  { skill: "IPFS", category: "Blockchain" },
  { skill: "Filecoin", category: "Blockchain" },
  { skill: "Chainlink Oracles", category: "Blockchain" },
  { skill: "WalletConnect", category: "Blockchain" },
  { skill: "MetaMask Integration", category: "Blockchain" },
  { skill: "Tokenomics Design", category: "Blockchain" },
  { skill: "DeFi Protocol Development", category: "Blockchain" },
  { skill: "NFT Smart Contracts", category: "Blockchain" },
  { skill: "DAO Governance Systems", category: "Blockchain" },
  { skill: "Layer 2 Scaling", category: "Blockchain" },
  { skill: "Zero-Knowledge Proofs", category: "Blockchain" },
  { skill: "zk-SNARKs", category: "Blockchain" },
  { skill: "zk-STARKs", category: "Blockchain" },
  { skill: "Rust Smart Contracts", category: "Blockchain" },
  {
    skill: "Solidity Security Auditing",
    category: "Blockchain Security",
  },
  { skill: "Smart Contract Testing", category: "Blockchain Security" },
  { skill: "Reentrancy Protection", category: "Blockchain Security" },
  {
    skill: "Integer Overflow Prevention",
    category: "Blockchain Security",
  },
  {
    skill: "Flash Loan Attack Prevention",
    category: "Blockchain Security",
  },
  {
    skill: "Multisig Wallet Management",
    category: "Blockchain Security",
  },
  { skill: "Formal Verification", category: "Blockchain Security" },
  { skill: "Slither", category: "Blockchain Security" },
  { skill: "Mythril", category: "Blockchain Security" },
  { skill: "Echidna", category: "Blockchain Security" },
  { skill: "Fuzz Testing", category: "Blockchain Security" },
  { skill: "Audit Report Writing", category: "Blockchain Security" },
  { skill: "Figma", category: "UI/UX Design" },
  { skill: "Adobe XD", category: "UI/UX Design" },
  { skill: "Sketch", category: "UI/UX Design" },
  { skill: "Wireframing", category: "UI/UX Design" },
  { skill: "Prototyping", category: "UI/UX Design" },
  { skill: "User Research", category: "UI/UX Design" },
  { skill: "Usability Testing", category: "UI/UX Design" },
  { skill: "Design Systems", category: "UI/UX Design" },
  { skill: "Interaction Design", category: "UI/UX Design" },
  { skill: "Information Architecture", category: "UI/UX Design" },
  { skill: "User Journey Mapping", category: "UI/UX Design" },
  { skill: "Accessibility Design", category: "UI/UX Design" },
  { skill: "Visual Design", category: "UI/UX Design" },
  { skill: "Product Design", category: "UI/UX Design" },
  { skill: "UI Animation", category: "UI/UX Design" },
  { skill: "Jest", category: "Testing & QA" },
  { skill: "Vitest", category: "Testing & QA" },
  { skill: "Mocha", category: "Testing & QA" },
  { skill: "Chai", category: "Testing & QA" },
  { skill: "Cypress", category: "Testing & QA" },
  { skill: "Playwright", category: "Testing & QA" },
  { skill: "Selenium", category: "Testing & QA" },
  { skill: "Puppeteer", category: "Testing & QA" },
  { skill: "React Testing Library", category: "Testing & QA" },
  { skill: "Unit Testing", category: "Testing & QA" },
  { skill: "Integration Testing", category: "Testing & QA" },
  { skill: "End-to-End Testing", category: "Testing & QA" },
  { skill: "Regression Testing", category: "Testing & QA" },
  { skill: "Performance Testing", category: "Testing & QA" },
  { skill: "Load Testing", category: "Testing & QA" },
  { skill: "Test Automation", category: "Testing & QA" },
  { skill: "Manual Testing", category: "Testing & QA" },
  { skill: "QA Documentation", category: "Testing & QA" },
  { skill: "Postman", category: "API Development" },
  { skill: "Insomnia", category: "API Development" },
  { skill: "Swagger / OpenAPI", category: "API Development" },
  { skill: "API Documentation", category: "API Development" },
  { skill: "API Testing", category: "API Development" },
  { skill: "API Versioning", category: "API Development" },
  { skill: "API Gateway Management", category: "API Development" },
  { skill: "Webhook Integration", category: "API Development" },
  { skill: "OAuth 2.0", category: "API Development" },
  { skill: "JWT Authentication", category: "API Development" },
  { skill: "SAML", category: "API Development" },
  { skill: "OpenID Connect", category: "API Development" },
  {
    skill: "Payment Gateway Integration",
    category: "API Development",
  },
  { skill: "Stripe API", category: "API Development" },
  { skill: "PayPal API", category: "API Development" },
  { skill: "FlutterFlow", category: "No-Code / Low-Code" },
  { skill: "Bubble", category: "No-Code / Low-Code" },
  { skill: "Webflow", category: "No-Code / Low-Code" },
  { skill: "Framer", category: "No-Code / Low-Code" },
  { skill: "WordPress", category: "No-Code / Low-Code" },
  { skill: "Shopify", category: "No-Code / Low-Code" },
  { skill: "Wix", category: "No-Code / Low-Code" },
  { skill: "Squarespace", category: "No-Code / Low-Code" },
  { skill: "Airtable", category: "No-Code / Low-Code" },
  { skill: "Zapier", category: "No-Code / Low-Code" },
  { skill: "Make.com", category: "No-Code / Low-Code" },
  { skill: "Notion Automation", category: "No-Code / Low-Code" },
  { skill: "Retool", category: "No-Code / Low-Code" },
  { skill: "Appsmith", category: "No-Code / Low-Code" },
  { skill: "Microsoft Power Apps", category: "No-Code / Low-Code" },
  { skill: "Technical Writing", category: "Technical Documentation" },
  {
    skill: "API Documentation Writing",
    category: "Technical Documentation",
  },
  {
    skill: "Software Requirement Specification",
    category: "Technical Documentation",
  },
  {
    skill: "System Design Documentation",
    category: "Technical Documentation",
  },
  { skill: "README Writing", category: "Technical Documentation" },
  {
    skill: "Developer Documentation",
    category: "Technical Documentation",
  },
  {
    skill: "Architecture Decision Records",
    category: "Technical Documentation",
  },
  {
    skill: "Knowledge Base Management",
    category: "Technical Documentation",
  },
  { skill: "GitBook", category: "Technical Documentation" },
  { skill: "Docusaurus", category: "Technical Documentation" },
  { skill: "MkDocs", category: "Technical Documentation" },
  { skill: "Storybook", category: "Technical Documentation" },
  { skill: "JSDoc", category: "Technical Documentation" },
  { skill: "TypeDoc", category: "Technical Documentation" },
  {
    skill: "Sphinx Documentation",
    category: "Technical Documentation",
  },
  {
    skill: "Agile Methodology",
    category: "Product & Project Management",
  },
  { skill: "Scrum", category: "Product & Project Management" },
  { skill: "Kanban", category: "Product & Project Management" },
  { skill: "Jira", category: "Product & Project Management" },
  { skill: "Trello", category: "Product & Project Management" },
  { skill: "Linear", category: "Product & Project Management" },
  { skill: "Asana", category: "Product & Project Management" },
  { skill: "ClickUp", category: "Product & Project Management" },
  {
    skill: "Product Roadmapping",
    category: "Product & Project Management",
  },
  {
    skill: "Sprint Planning",
    category: "Product & Project Management",
  },
] as const;

const PROVIDED_CATEGORY_LABELS = Array.from(
  new Set(SKILL_CATEGORY_ENTRIES.map((entry) => entry.category)),
);

const PROVIDED_SKILL_LABELS = SKILL_CATEGORY_ENTRIES.map((entry) => entry.skill);

export const CATEGORY_OPTIONS: TaxonomyOption<Category>[] =
  buildGeneratedOptions<Category>(PROVIDED_CATEGORY_LABELS);

export const SKILL_OPTIONS: TaxonomyOption<Skill>[] =
  buildGeneratedOptions<Skill>(PROVIDED_SKILL_LABELS);

function createLookup<T extends string>(
  options: TaxonomyOption<T>[],
  aliases: Record<string, T>,
) {
  const lookup = new Map<string, T>();

  for (const option of options) {
    lookup.set(canonicalizeTaxonomyValue(option.id), option.id);
    lookup.set(canonicalizeTaxonomyValue(option.label), option.id);
  }

  for (const [alias, id] of Object.entries(aliases)) {
    lookup.set(canonicalizeTaxonomyValue(alias), id);
  }

  return lookup;
}

const CATEGORY_LOOKUP = createLookup(CATEGORY_OPTIONS, {
  frontend: "frontenddevelopment",
  backend: "backenddevelopment",
  mobile: "mobiledevelopment",
  programming: "programminglanguages",
  languages: "programminglanguages",
  database: "databasemanagement",
  versioncontrol: "versioncontrol",
  cloud: "cloudcomputing",
  ai: "artificialintelligence",
  artificialintelligence: "artificialintelligence",
  dataanalytics: "dataanalytics",
  blockchainsecurity: "blockchainsecurity",
  uiux: "uiuxdesign",
  testingqa: "testingqa",
  nocode: "nocodelowcode",
  lowcode: "nocodelowcode",
  technicaldocs: "technicaldocumentation",
  productprojectmanagement: "productprojectmanagement",
});

const SKILL_LOOKUP = createLookup(SKILL_OPTIONS, {
  react: "reactjs",
  next: "nextjs",
  vue: "vuejs",
  nuxt: "nuxtjs",
  express: "expressjs",
  dotnet: "aspnetcore",
  dotnetcore: "aspnetcore",
  aspnet: "aspnetcore",
  rails: "rubyonrails",
  postgres: "postgresql",
  firestore: "firebasefirestore",
  mssql: "microsoftsqlserver",
  githubactions: "githubactions",
  gcp: "googlecloudplatform",
  azure: "microsoftazure",
  powerapps: "microsoftpowerapps",
  openai: "openaiapiintegration",
  huggingface: "huggingfacetransformers",
  scikitlearn: "scikitlearn",
  web3: "web3js",
  ethers: "ethersjs",
  chakra: "chakraui",
});

export function getCategoryLabel(category: Category) {
  const normalizedCategory = normalizeCategory(category) ?? category;

  return (
    CATEGORY_OPTIONS.find((option) => option.id === normalizedCategory)?.label ??
    category
  );
}

export function getSkillLabel(skill: Skill) {
  const normalizedSkill = normalizeSkill(skill) ?? skill;

  return SKILL_OPTIONS.find((option) => option.id === normalizedSkill)?.label ?? skill;
}

export function normalizeCategory(value: string) {
  return CATEGORY_LOOKUP.get(canonicalizeTaxonomyValue(value)) ?? null;
}

export function normalizeSkill(value: string) {
  return SKILL_LOOKUP.get(canonicalizeTaxonomyValue(value)) ?? null;
}
