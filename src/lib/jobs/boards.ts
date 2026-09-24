/**
 * Company job boards pulled directly from their public job-board APIs. These
 * feeds include the full job description. Slugs were checked against the live
 * APIs; boards with no current internships cost one small request and pick up
 * new postings automatically when recruiting season opens.
 */
export type Board = { source: "greenhouse" | "lever" | "ashby"; slug: string; company: string };

const gh = (slug: string, company: string): Board => ({ source: "greenhouse", slug, company });
const lv = (slug: string, company: string): Board => ({ source: "lever", slug, company });
const ab = (slug: string, company: string): Board => ({ source: "ashby", slug, company });

export const BOARDS: Board[] = [
  // Tech
  gh("stripe", "Stripe"), gh("airbnb", "Airbnb"), gh("robinhood", "Robinhood"), gh("databricks", "Databricks"), gh("coinbase", "Coinbase"),
  gh("figma", "Figma"), gh("discord", "Discord"), gh("instacart", "Instacart"), gh("pinterest", "Pinterest"), gh("reddit", "Reddit"),
  gh("dropbox", "Dropbox"), gh("asana", "Asana"), gh("lyft", "Lyft"), gh("cloudflare", "Cloudflare"), gh("datadog", "Datadog"),
  gh("mongodb", "MongoDB"), gh("roblox", "Roblox"), gh("affirm", "Affirm"), gh("brex", "Brex"), gh("gusto", "Gusto"),
  gh("duolingo", "Duolingo"), gh("squarespace", "Squarespace"), gh("twilio", "Twilio"), gh("okta", "Okta"), gh("toast", "Toast"),
  gh("samsara", "Samsara"), gh("scaleai", "Scale AI"), gh("spacex", "SpaceX"), gh("waymo", "Waymo"), gh("nuro", "Nuro"),
  gh("verkada", "Verkada"), gh("vercel", "Vercel"), gh("gitlab", "GitLab"), gh("elastic", "Elastic"), gh("chime", "Chime"),
  gh("sofi", "SoFi"), gh("webflow", "Webflow"), gh("doordashusa", "DoorDash"), gh("block", "Block"), gh("mercury", "Mercury"),
  gh("flexport", "Flexport"), gh("peloton", "Peloton"),
  lv("palantir", "Palantir"), lv("spotify", "Spotify"), lv("zoox", "Zoox"), lv("wealthfront", "Wealthfront"), lv("shieldai", "Shield AI"),
  lv("matchgroup", "Match Group"),
  ab("openai", "OpenAI"), ab("ramp", "Ramp"), ab("notion", "Notion"), ab("linear", "Linear"), ab("cohere", "Cohere"),
  ab("perplexity", "Perplexity"), ab("replit", "Replit"), ab("vanta", "Vanta"), ab("plaid", "Plaid"), ab("harvey", "Harvey"),
  ab("sierra", "Sierra"), ab("modal", "Modal"),
  // Trading & finance
  gh("point72", "Point72"), gh("imc", "IMC Trading"), gh("jumptrading", "Jump Trading"), gh("drweng", "DRW"), gh("janestreet", "Jane Street"),
  gh("akunacapital", "Akuna Capital"), gh("virtu", "Virtu Financial"), gh("towerresearchcapital", "Tower Research Capital"),
];

/**
 * Community-maintained list of open internships (SimplifyJobs on GitHub):
 * title, company, location and application link. Descriptions are fetched on
 * demand from the employer's own posting when someone opens a listing.
 */
export const COMMUNITY_FEEDS = [
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json",
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json",
];
