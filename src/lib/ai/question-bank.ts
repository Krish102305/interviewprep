import type { Difficulty, RoleCategory } from "@/lib/constants";

/**
 * Curated question bank used by the development engine (when no AI key is set)
 * and as few-shot grounding for the AI engine. Every entry carries the hidden
 * metadata the grader and interviewer guide rely on.
 */
export type BankQuestion = {
  text: string;
  category: "intro" | "behavioral" | "technical" | "role" | "coding" | "case" | "closing" | "candidate_questions";
  whatItTests: string;
  competencies: string[];
  followUps: string[];
  gradingCriteria: string[];
  /** Concepts a strong answer usually mentions (used by the heuristic grader). */
  keywords: string[];
  level: Difficulty | "any";
};

const q = (b: BankQuestion) => b;

export const INTRO_QUESTIONS: BankQuestion[] = [
  q({
    text: "To start, tell me about yourself and what brings you to this {role} role.",
    category: "intro",
    whatItTests: "Concise personal narrative and motivation",
    competencies: ["communication", "self-awareness", "motivation"],
    followUps: ["What's one experience from that story you're most proud of?", "Why now — what made you decide to pursue {role}?"],
    gradingCriteria: ["Under ~2 minutes, structured past → present → future", "Connects experience to the role", "Ends with clear motivation"],
    keywords: ["experience", "currently", "interested", "because", "role", "project", "learned"],
    level: "any",
  }),
];

export const MOTIVATION_QUESTIONS: BankQuestion[] = [
  q({
    text: "Why are you interested in this {role} role{atCompany}?",
    category: "behavioral",
    whatItTests: "Motivation, research and role fit",
    competencies: ["motivation", "role knowledge", "communication"],
    followUps: ["What do you think would be the hardest part of this job for you?", "What specifically about {companyOrTeam} stands out compared with alternatives?"],
    gradingCriteria: ["Specific reasons tied to the role's actual work", "Evidence of research about the company or team", "Links own strengths to the role"],
    keywords: ["because", "impact", "team", "product", "clients", "learn", "mission", "culture", "skills"],
    level: "any",
  }),
];

export const BEHAVIORAL_BANK: BankQuestion[] = [
  q({
    text: "Tell me about a time you had to lead a team through a difficult situation.",
    category: "behavioral",
    whatItTests: "Leadership under pressure",
    competencies: ["leadership", "conflict resolution", "decision making"],
    followUps: ["What specifically did you do, as opposed to the team?", "What was the biggest disagreement within the team, and how did you personally resolve it?"],
    gradingCriteria: ["Clear STAR structure", "Personal actions are specific ('I', not only 'we')", "Quantified or concrete result", "Reflection on what they learned"],
    keywords: ["led", "team", "deadline", "decided", "delegated", "result", "learned", "aligned"],
    level: "any",
  }),
  q({
    text: "Tell me about a time you failed. What happened and what did you do next?",
    category: "behavioral",
    whatItTests: "Accountability, resilience and learning",
    competencies: ["self-awareness", "resilience", "growth mindset"],
    followUps: ["Looking back, what was the earliest signal you missed?", "How have you applied that lesson since?"],
    gradingCriteria: ["Owns the failure without blaming others", "Explains root cause", "Concrete corrective action", "Shows later application of the lesson"],
    keywords: ["mistake", "responsible", "learned", "changed", "since then", "improve", "feedback"],
    level: "any",
  }),
  q({
    text: "Describe a conflict you had with a teammate. How did you handle it?",
    category: "behavioral",
    whatItTests: "Conflict management and collaboration",
    competencies: ["teamwork", "communication", "empathy"],
    followUps: ["How did you make sure the other person felt heard?", "What would you do differently if it happened again?"],
    gradingCriteria: ["Describes both perspectives fairly", "Direct, respectful communication", "Resolution that served the shared goal", "Relationship afterwards"],
    keywords: ["disagreed", "listened", "perspective", "compromise", "talked", "understand", "outcome"],
    level: "any",
  }),
  q({
    text: "Tell me about a time you had to work with someone whose approach was very different from yours.",
    category: "behavioral",
    whatItTests: "Adaptability and collaboration",
    competencies: ["adaptability", "teamwork", "communication"],
    followUps: ["What specifically did you do to bridge that difference?", "What did you learn from their approach?"],
    gradingCriteria: ["Specific difference described", "Adapted own style deliberately", "Positive outcome for the work"],
    keywords: ["different", "adapted", "style", "compromise", "learned", "together", "result"],
    level: "any",
  }),
  q({
    text: "Tell me about a time you had to make a decision without all the information you wanted.",
    category: "behavioral",
    whatItTests: "Judgment under ambiguity",
    competencies: ["decision making", "problem solving", "risk management"],
    followUps: ["How did you weigh the risks?", "How did you know afterwards whether it was the right call?"],
    gradingCriteria: ["Explains the trade-offs considered", "Makes a timely decision", "Mitigates risk", "Evaluates the outcome honestly"],
    keywords: ["decided", "risk", "trade-off", "data", "assumption", "timeline", "outcome"],
    level: "intermediate",
  }),
  q({
    text: "Describe a time you had to communicate something complex to someone without your background.",
    category: "behavioral",
    whatItTests: "Communication clarity",
    competencies: ["communication", "empathy"],
    followUps: ["How did you check that they actually understood?", "What would you simplify further next time?"],
    gradingCriteria: ["Tailors message to audience", "Uses analogy or structure", "Confirms understanding", "Outcome of the communication"],
    keywords: ["explained", "audience", "simplified", "example", "analogy", "understood", "visual"],
    level: "any",
  }),
  q({
    text: "Tell me about a time you took initiative on something that wasn't your responsibility.",
    category: "behavioral",
    whatItTests: "Ownership and proactivity",
    competencies: ["initiative", "ownership", "leadership"],
    followUps: ["How did you get buy-in from others?", "What was the measurable impact?"],
    gradingCriteria: ["Identified a real problem", "Acted without being asked", "Brought others along", "Measurable impact"],
    keywords: ["noticed", "initiative", "proposed", "built", "improved", "impact", "saved"],
    level: "any",
  }),
  q({
    text: "Tell me about a time you had to juggle several competing priorities. How did you decide what to do first?",
    category: "behavioral",
    whatItTests: "Prioritization and time management",
    competencies: ["prioritization", "organization", "problem solving"],
    followUps: ["What did you deliberately decide not to do?", "How did you communicate the trade-offs to stakeholders?"],
    gradingCriteria: ["Explicit prioritization framework or rationale", "Communicated trade-offs", "Delivered on what mattered most"],
    keywords: ["prioritized", "deadline", "urgent", "important", "communicated", "schedule", "delivered"],
    level: "any",
  }),
  q({
    text: "Give me an example of feedback that was hard to hear. How did you respond?",
    category: "behavioral",
    whatItTests: "Coachability",
    competencies: ["growth mindset", "self-awareness"],
    followUps: ["What changed in your work as a result?", "How do you ask for feedback now?"],
    gradingCriteria: ["Non-defensive response", "Specific change made", "Evidence of continued growth"],
    keywords: ["feedback", "manager", "improve", "changed", "defensive", "listened", "since"],
    level: "any",
  }),
  q({
    text: "Tell me about a time you had to persuade someone who initially disagreed with you.",
    category: "behavioral",
    whatItTests: "Influence without authority",
    competencies: ["influence", "communication", "stakeholder management"],
    followUps: ["What evidence changed their mind?", "What if they had still said no?"],
    gradingCriteria: ["Understands the other side's concerns", "Uses evidence and framing", "Outcome and relationship preserved"],
    keywords: ["convinced", "data", "concern", "proposal", "agreed", "evidence", "stakeholder"],
    level: "intermediate",
  }),
  q({
    text: "Describe the most ambitious goal you've set for yourself and how you pursued it.",
    category: "behavioral",
    whatItTests: "Drive and goal setting",
    competencies: ["motivation", "perseverance", "planning"],
    followUps: ["What was the hardest setback along the way?", "How did you measure progress?"],
    gradingCriteria: ["Genuinely ambitious goal", "Concrete plan and milestones", "Handles setbacks", "Clear outcome"],
    keywords: ["goal", "plan", "milestone", "setback", "persisted", "achieved", "measured"],
    level: "any",
  }),
  q({
    text: "Tell me about a time you noticed a problem others had missed. What did you do?",
    category: "behavioral",
    whatItTests: "Analytical attention and problem solving",
    competencies: ["problem solving", "attention to detail", "initiative"],
    followUps: ["How did you validate that it was really a problem?", "What did fixing it change?"],
    gradingCriteria: ["Describes how the issue was detected", "Validated with evidence", "Drove a fix", "Impact quantified"],
    keywords: ["noticed", "analyzed", "root cause", "fixed", "data", "impact", "prevented"],
    level: "intermediate",
  }),
  q({
    text: "Tell me about a situation where you had to adapt quickly to a major change.",
    category: "behavioral",
    whatItTests: "Adaptability",
    competencies: ["adaptability", "resilience"],
    followUps: ["What was the first thing you did when you heard about the change?", "How did you help others adapt?"],
    gradingCriteria: ["Rapid reorientation", "Positive attitude", "Maintained results through the change"],
    keywords: ["changed", "adapted", "quickly", "new", "plan", "adjusted", "result"],
    level: "any",
  }),
  q({
    text: "Walk me through a time you had to deliver results under a very tight deadline.",
    category: "behavioral",
    whatItTests: "Execution under pressure",
    competencies: ["execution", "time management", "composure"],
    followUps: ["What corners did you decide not to cut?", "How did you keep quality high?"],
    gradingCriteria: ["Clear plan under time pressure", "Sensible scope trade-offs", "Delivered result"],
    keywords: ["deadline", "plan", "scope", "hours", "delivered", "quality", "team"],
    level: "any",
  }),
];

const tech = (level: Difficulty | "any", text: string, whatItTests: string, competencies: string[], keywords: string[], followUps: string[], gradingCriteria: string[], category: BankQuestion["category"] = "technical") =>
  q({ text, category, whatItTests, competencies, keywords, followUps, gradingCriteria, level });

export const TECHNICAL_BANK: Record<RoleCategory, BankQuestion[]> = {
  software_engineering: [
    tech("beginner", "What's the difference between an array and a linked list, and when would you choose each?", "Core data structures", ["data structures", "trade-offs"], ["index", "O(1)", "O(n)", "memory", "insert", "contiguous", "pointer", "cache"], ["What is the time complexity of inserting in the middle of each?", "How does cache locality affect this choice in practice?"], ["Correct complexity for access/insert/delete", "Mentions memory layout", "Gives a realistic use case for each"]),
    tech("beginner", "Explain what happens, at a high level, when you type a URL into a browser and press enter.", "Web fundamentals", ["networking", "systems"], ["DNS", "TCP", "TLS", "HTTP", "request", "response", "server", "render", "cache"], ["Where could caching happen along that path?", "What changes with HTTPS?"], ["DNS resolution", "Connection + TLS handshake", "HTTP request/response", "Rendering"]),
    tech("intermediate", "Given an array of integers and a target, how would you find two numbers that add up to the target? Walk me through your approach and its complexity.", "Algorithmic problem solving (two-sum)", ["algorithms", "hashing", "complexity analysis"], ["hash", "map", "O(n)", "complement", "brute force", "O(n^2)", "sort", "two pointers", "edge case"], ["What if the array is already sorted?", "How would you handle duplicates or no valid pair?"], ["Starts with brute force, improves to O(n) hash map", "States time and space complexity", "Considers edge cases"], "coding"),
    tech("intermediate", "How would you detect a cycle in a linked list?", "Pointer techniques", ["algorithms", "data structures"], ["fast", "slow", "pointer", "Floyd", "O(1) space", "visited", "set"], ["How would you find where the cycle begins?", "What's the space complexity of each approach?"], ["Hash-set approach", "Floyd's tortoise and hare", "Complexity analysis"], "coding"),
    tech("intermediate", "Explain the difference between processes and threads, and what can go wrong with shared state.", "Concurrency fundamentals", ["concurrency", "systems"], ["memory", "race condition", "lock", "mutex", "deadlock", "context switch", "isolation"], ["How would you prevent a race condition here?", "What's a deadlock and how do you avoid one?"], ["Memory isolation difference", "Race conditions", "Synchronization primitives"]),
    tech("intermediate", "How would you design the database schema for a simple ride-sharing app?", "Data modeling", ["databases", "system design"], ["table", "primary key", "foreign key", "index", "rider", "driver", "trip", "normalize", "status"], ["Which queries will be most frequent and how would you index for them?", "How do you handle a trip's changing status?"], ["Sensible entities and relations", "Keys and indexes", "Considers access patterns"]),
    tech("advanced", "Design a URL shortener that handles millions of requests per day. Walk me through the architecture.", "System design at scale", ["system design", "scalability", "trade-offs"], ["hash", "base62", "database", "cache", "load balancer", "read-heavy", "collision", "replication", "TTL", "analytics"], ["How would you avoid collisions when generating short codes?", "Where would caching give you the biggest win?"], ["Clarifies requirements and scale", "Key generation strategy", "Storage + caching for read-heavy load", "Discusses bottlenecks and trade-offs"]),
    tech("advanced", "How would you find the k most frequent elements in a very large stream of data?", "Streaming algorithms", ["algorithms", "heaps", "scalability"], ["heap", "hash map", "O(n log k)", "count-min sketch", "approximate", "memory", "bucket"], ["What if it doesn't fit in memory?", "Can you trade exactness for memory?"], ["Hash map + heap approach with complexity", "Addresses memory limits", "Mentions approximate structures"], "coding"),
    tech("advanced", "Tell me how you would debug a production service whose latency suddenly doubled.", "Operational debugging", ["debugging", "systems", "observability"], ["metrics", "logs", "tracing", "deploy", "rollback", "database", "p99", "dependency", "hypothesis"], ["What would you check first and why?", "How would you prevent it from happening again?"], ["Systematic hypothesis-driven approach", "Uses metrics/logs/traces", "Mitigation before root cause", "Prevention"]),
  ],
  product_management: [
    tech("beginner", "What's your favorite product, and how would you improve it?", "Product sense", ["product sense", "user empathy"], ["user", "problem", "pain point", "feature", "metric", "prioritize", "segment"], ["Who exactly is the user you'd be improving it for?", "How would you measure whether your improvement worked?"], ["Identifies a user segment", "Articulates a real pain point", "Proposes a focused solution", "Defines success metrics"]),
    tech("intermediate", "How would you decide what to build next if you had three competing feature requests from sales, engineering and customers?", "Prioritization", ["prioritization", "stakeholder management"], ["impact", "effort", "RICE", "strategy", "data", "customer", "trade-off", "roadmap"], ["What framework would you use and why?", "How would you communicate the 'no' to the teams you didn't pick?"], ["Uses explicit criteria (impact/effort/strategy)", "Grounds in data and user needs", "Communicates trade-offs"]),
    tech("intermediate", "Daily active users for a key feature dropped 15% week over week. How would you investigate?", "Metrics and analytical debugging", ["metrics", "analytics", "problem solving"], ["segment", "platform", "release", "seasonality", "tracking", "funnel", "cohort", "external", "hypothesis"], ["What would you check first to rule out a data issue?", "Which segments would you slice by?"], ["Checks data validity first", "Segments systematically (platform, geo, cohort)", "Internal vs external causes", "Prioritized hypotheses"]),
    tech("intermediate", "What metrics would you use to measure the success of a new onboarding flow?", "Metric definition", ["metrics", "product thinking"], ["activation", "conversion", "retention", "time to value", "drop-off", "north star", "guardrail"], ["Which one is your primary metric and why?", "What guardrail metric would you watch?"], ["Primary metric tied to user value", "Supporting funnel metrics", "Guardrail metric", "How to measure (experiment)"]),
    tech("advanced", "Design a product to help college students find study partners. Walk me through your approach.", "Product design case", ["product sense", "strategy", "user research"], ["user", "segment", "pain point", "MVP", "matching", "trust", "metric", "prioritize", "risk"], ["What's the MVP you'd launch first?", "What's the biggest risk to this product succeeding?"], ["Clarifies goal and users", "Identifies pain points", "Prioritizes solutions into an MVP", "Metrics and risks"], "case"),
    tech("advanced", "Should a food delivery app launch a grocery delivery service? How would you decide?", "Product strategy", ["strategy", "market analysis"], ["market", "customer", "synergy", "operations", "margin", "competition", "cannibalization", "experiment"], ["How would you test this cheaply before committing?", "What would make you say no?"], ["Structures market, customer, capability, economics", "Considers risks", "Proposes validation experiment", "Clear recommendation"], "case"),
  ],
  data_science: [
    tech("beginner", "Explain the difference between correlation and causation with an example.", "Statistical reasoning", ["statistics"], ["confounder", "causal", "experiment", "randomized", "spurious", "variable"], ["How would you establish causation in a product setting?", "What's a confounding variable in your example?"], ["Clear distinction", "Good example", "Mentions confounders", "Experiments establish causality"]),
    tech("intermediate", "How would you design an A/B test for a new checkout button, and how would you know if the result is real?", "Experiment design", ["experimentation", "statistics"], ["hypothesis", "randomize", "sample size", "power", "significance", "p-value", "metric", "novelty"], ["How would you choose the sample size?", "What could make a significant result misleading?"], ["Hypothesis and primary metric", "Randomization + sample size/power", "Significance and practical significance", "Pitfalls (peeking, novelty)"]),
    tech("intermediate", "Write, in words or SQL, a query that finds the top 3 customers by total spend in each region.", "SQL", ["SQL", "data manipulation"], ["GROUP BY", "SUM", "window", "RANK", "ROW_NUMBER", "PARTITION BY", "ORDER BY", "join"], ["How would ties be handled?", "How would you make this efficient on a huge table?"], ["Aggregation per customer", "Window function partitioned by region", "Handles ties"], "coding"),
    tech("advanced", "How would you handle a classification problem where only 1% of examples are positive?", "Imbalanced learning", ["machine learning", "evaluation"], ["precision", "recall", "AUC", "resampling", "class weight", "threshold", "F1", "SMOTE"], ["Why is accuracy a bad metric here?", "How would you pick the decision threshold?"], ["Explains why accuracy misleads", "Right metrics (PR-AUC, recall)", "Resampling / class weights", "Threshold tuning tied to business cost"]),
  ],
  investment_banking: [
    tech("beginner", "Walk me through the three financial statements and how they connect.", "Accounting fundamentals", ["accounting", "financial statements"], ["income statement", "balance sheet", "cash flow", "net income", "retained earnings", "cash", "assets", "liabilities", "equity"], ["If depreciation increases by $10, walk me through the impact on all three statements.", "Which statement would you pick if you could only have one?"], ["Describes each statement", "Net income flows to cash flow and retained earnings", "Ending cash links to balance sheet"]),
    tech("beginner", "What is enterprise value, and why do we use it instead of equity value for some multiples?", "Valuation concepts", ["valuation"], ["equity value", "debt", "cash", "minority interest", "preferred", "capital structure", "EBITDA"], ["Why do we subtract cash?", "Which multiples use EV and which use equity value?"], ["Correct EV bridge", "Capital-structure neutral", "Matches numerator and denominator"]),
    tech("intermediate", "Walk me through a DCF.", "Discounted cash flow", ["valuation", "financial modeling"], ["free cash flow", "projection", "WACC", "terminal value", "discount", "perpetuity", "exit multiple", "present value"], ["How do you calculate WACC?", "Which assumptions is a DCF most sensitive to?"], ["Projects unlevered FCF", "Terminal value (two methods)", "Discounts at WACC", "Arrives at EV → equity value"]),
    tech("intermediate", "If a company raises $100 of debt and uses it to buy equipment, how do the three statements change?", "Accounting mechanics", ["accounting"], ["PP&E", "debt", "cash", "no change", "balance sheet", "depreciation", "interest"], ["What happens a year later with depreciation and interest?", "What if the equipment were leased instead?"], ["Initially no IS impact", "Cash flow: +100 financing, -100 investing", "Balance sheet: +100 PP&E, +100 debt"]),
    tech("advanced", "Walk me through an accretion/dilution analysis for an all-stock acquisition.", "M&A mechanics", ["M&A", "financial modeling"], ["EPS", "pro forma", "shares issued", "P/E", "synergies", "accretive", "dilutive", "net income"], ["Quick rule of thumb: when is an all-stock deal accretive?", "How do synergies change the answer?"], ["Combined net income and share count", "Pro forma EPS vs standalone", "P/E rule of thumb", "Synergies and adjustments"]),
    tech("advanced", "Why might two companies with the same EBITDA have very different valuations?", "Valuation judgment", ["valuation", "business understanding"], ["growth", "margins", "risk", "capex", "working capital", "industry", "quality of earnings", "cash conversion"], ["Which of those factors matters most for a DCF?", "Give me an industry example."], ["Growth and risk", "Capital intensity and cash conversion", "Market/sector context"]),
  ],
  finance: [
    tech("beginner", "What's the difference between revenue, profit, and cash flow?", "Financial fundamentals", ["accounting"], ["revenue", "expenses", "net income", "accrual", "cash", "working capital", "non-cash"], ["Can a profitable company run out of cash? How?", "What's an example of a non-cash expense?"], ["Correct definitions", "Accrual vs cash timing", "Example of divergence"]),
    tech("intermediate", "How would you evaluate whether a company is a good investment?", "Investment analysis", ["valuation", "business analysis"], ["moat", "growth", "margins", "valuation", "management", "risk", "cash flow", "multiples"], ["Which single metric would you look at first and why?", "What would make you walk away?"], ["Business quality", "Financial performance", "Valuation relative to peers", "Risks"]),
    tech("intermediate", "Explain the time value of money and how you'd calculate the present value of a future cash flow.", "Finance math", ["finance fundamentals"], ["discount rate", "present value", "compounding", "(1+r)^n", "opportunity cost", "inflation"], ["How does raising the discount rate change the value?", "How would you choose the rate?"], ["Correct intuition", "Formula", "Discount rate reasoning"]),
    tech("advanced", "Interest rates rise by 2%. Walk me through the effects on bond prices, equity valuations, and corporate borrowing.", "Markets", ["markets", "macro"], ["bond prices fall", "duration", "discount rate", "valuation", "cost of capital", "growth stocks", "refinancing"], ["Which kinds of stocks would be hit hardest?", "How does duration matter?"], ["Inverse bond price relationship", "Higher discount rates compress valuations", "Cost of capital impact"]),
  ],
  consulting: [
    tech("beginner", "Estimate the number of coffee cups sold in the United States each day.", "Market sizing", ["market sizing", "quantitative reasoning"], ["population", "assume", "segment", "per day", "percentage", "sanity check", "million"], ["What's the assumption you're least confident in?", "How would you sanity-check that number?"], ["Clear structure before math", "Reasonable, stated assumptions", "Clean arithmetic", "Sanity check"], "case"),
    tech("intermediate", "A regional coffee chain's profits have fallen 20% over two years. How would you figure out why?", "Profitability case", ["case structuring", "business strategy"], ["revenue", "costs", "price", "volume", "fixed", "variable", "competition", "framework", "customers"], ["Revenue is flat — where do you go next?", "What data would you ask the client for?"], ["Profit = revenue − costs tree", "Hypothesis driven", "Asks for data", "Synthesizes a recommendation"], "case"),
    tech("intermediate", "Your client is considering entering the electric scooter rental market in a new city. What would you look at?", "Market entry", ["strategy", "case structuring"], ["market size", "competition", "customers", "regulation", "economics", "capabilities", "entry mode", "risk"], ["What would the unit economics of one scooter look like?", "What would make you recommend against entering?"], ["Market attractiveness", "Competitive landscape", "Client capabilities", "Economics and a clear recommendation"], "case"),
    tech("advanced", "A hospital wants to cut patient wait times in its emergency department by 30% without adding staff. How would you approach it?", "Operations case", ["operations", "problem solving"], ["bottleneck", "triage", "process", "capacity", "demand", "data", "scheduling", "flow"], ["Where do you expect the bottleneck to be?", "How would you measure the improvement?"], ["Maps patient flow", "Identifies bottlenecks with data", "Creative levers without staff", "Implementation risks"], "case"),
  ],
  marketing: [
    tech("beginner", "Pick a brand you admire. Who is its target customer and how does its marketing reach them?", "Brand and consumer understanding", ["consumer behavior", "brand strategy"], ["target", "segment", "positioning", "channel", "message", "customer", "value proposition"], ["How would you describe their positioning in one sentence?", "What would you change?"], ["Specific target segment", "Positioning", "Channels and messaging", "Critical evaluation"]),
    tech("intermediate", "How would you launch a new energy drink aimed at college students with a limited budget?", "Campaign strategy", ["campaign strategy", "go-to-market"], ["target", "insight", "channel", "campus", "ambassador", "social", "budget", "KPI", "positioning"], ["Which channel would you spend the first dollar on?", "How would you measure success in the first month?"], ["Clear target insight", "Channel mix fits budget", "Creative idea", "KPIs"]),
    tech("intermediate", "A campaign has a high click-through rate but low conversions. What could be happening?", "Marketing analytics", ["analytics", "funnel"], ["landing page", "audience", "mismatch", "funnel", "tracking", "offer", "friction", "attribution"], ["How would you test your top hypothesis?", "What metric would you watch after fixing it?"], ["Funnel thinking", "Message/landing mismatch", "Tracking issues", "Test plan"]),
    tech("advanced", "How would you decide how to split a $1M marketing budget across channels?", "Budget allocation", ["analytics", "strategy"], ["CAC", "LTV", "ROAS", "attribution", "incrementality", "test", "diminishing returns", "channel"], ["How would you measure incrementality?", "When would you reallocate?"], ["Goal-based allocation", "Unit economics (CAC/LTV)", "Test-and-learn", "Attribution caveats"]),
  ],
  general: [
    tech("beginner", "What are the most important skills for succeeding in a {role} role, and how have you built them?", "Role understanding", ["role knowledge", "self-awareness"], ["skill", "example", "developed", "practice", "project", "feedback"], ["Which of those skills is your weakest today?", "How would you continue developing it?"], ["Identifies realistic skills", "Backs each with evidence", "Growth plan"]),
    tech("intermediate", "Walk me through how you would approach your first 30 days as a {role}.", "Planning and role understanding", ["planning", "role knowledge"], ["learn", "stakeholders", "goals", "quick win", "listen", "plan", "measure"], ["Who would you meet first and why?", "What would a quick win look like?"], ["Learning phase", "Stakeholders", "Early wins", "Measures of success"]),
    tech("intermediate", "Describe a complex problem you solved recently. How did you break it down?", "Structured problem solving", ["problem solving", "analysis"], ["broke down", "root cause", "data", "options", "trade-off", "tested", "result"], ["What alternative approaches did you consider?", "How did you validate your solution?"], ["Decomposes problem", "Considers alternatives", "Validates solution"]),
    tech("advanced", "What's a major trend affecting the {role} field, and how should an organization respond?", "Industry awareness", ["industry knowledge", "strategy"], ["trend", "impact", "risk", "opportunity", "customers", "technology", "respond"], ["What's the risk of ignoring it?", "How would you personally prepare for it?"], ["Relevant trend", "Clear impact", "Actionable response"]),
  ],
};

export const CANDIDATE_QUESTIONS: BankQuestion = q({
  text: "We're near the end. What questions do you have for me about the role or the team?",
  category: "candidate_questions",
  whatItTests: "Curiosity and preparation",
  competencies: ["curiosity", "preparation"],
  followUps: [],
  gradingCriteria: ["Asks thoughtful, specific questions", "Questions show research into the role/company"],
  keywords: ["team", "success", "challenge", "culture", "growth", "day-to-day"],
  level: "any",
});

/** Recognisable skills pulled from job descriptions to personalise questions. */
export const SKILL_LEXICON = [
  "python", "java", "javascript", "typescript", "react", "sql", "aws", "kubernetes", "machine learning", "excel",
  "financial modeling", "valuation", "dcf", "m&a", "accounting", "powerpoint", "tableau", "data analysis",
  "a/b testing", "product roadmap", "stakeholder management", "agile", "seo", "content strategy", "brand",
  "market research", "customer research", "communication", "leadership", "project management", "system design",
  "distributed systems", "statistics", "forecasting", "due diligence", "client management", "negotiation",
  "social media", "analytics", "google analytics", "figma", "user research", "go", "c++", "api", "cloud",
];
