/**
 * AI interviewer personas. Purely presentational: the same interview engine
 * drives all of them. The persona is chosen deterministically from the role
 * category so the server-side intro and the on-screen interviewer always match.
 * Every surface still labels the interviewer as AI.
 */
export type PersonaScene = "tech" | "finance" | "consulting";

export type Persona = {
  key: string;
  name: string;
  firstName: string;
  title: string;
  gender: "female" | "male";
  scene: PersonaScene;
  look: {
    skin: string;
    skinShadow: string;
    hair: string;
    hairStyle: "bob" | "short" | "long";
    iris: string;
    brow: string;
    lip: string;
    blazer: string;
    blazerShadow: string;
    shirt: string;
    tie?: string;
    glasses?: boolean;
  };
  /** Preferred browser TTS voices, most preferred first (matched by substring). */
  voiceHints: string[];
};

export const PERSONAS: Record<string, Persona> = {
  ava: {
    key: "ava",
    name: "Ava Mitchell",
    firstName: "Ava",
    title: "Senior Technical Recruiter",
    gender: "female",
    scene: "tech",
    look: {
      skin: "#E8B996",
      skinShadow: "#C9936F",
      hair: "#4A2E1F",
      hairStyle: "bob",
      iris: "#5B7A3A",
      brow: "#3B2418",
      lip: "#B8605A",
      blazer: "#2B3A55",
      blazerShadow: "#1E2A40",
      shirt: "#F4F1EA",
    },
    voiceHints: ["Samantha", "Google US English", "Aria", "Jenny", "Zira", "Victoria", "Female"],
  },
  marcus: {
    key: "marcus",
    name: "Marcus Reed",
    firstName: "Marcus",
    title: "Managing Director, Investment Banking",
    gender: "male",
    scene: "finance",
    look: {
      skin: "#8D5A3B",
      skinShadow: "#6E4329",
      hair: "#1B1512",
      hairStyle: "short",
      iris: "#3A2517",
      brow: "#1B1512",
      lip: "#6B3A2A",
      blazer: "#3A3D42",
      blazerShadow: "#26282C",
      shirt: "#E9EEF5",
      tie: "#6E1F2B",
    },
    voiceHints: ["Daniel", "Aaron", "Guy", "Google UK English Male", "David", "Alex", "Fred", "Male"],
  },
  elena: {
    key: "elena",
    name: "Elena Park",
    firstName: "Elena",
    title: "Engagement Manager, Strategy Consulting",
    gender: "female",
    scene: "consulting",
    look: {
      skin: "#F1C9A5",
      skinShadow: "#D6A57F",
      hair: "#141112",
      hairStyle: "long",
      iris: "#2E1D14",
      brow: "#141112",
      lip: "#C0656B",
      blazer: "#C9B79C",
      blazerShadow: "#A8957A",
      shirt: "#FFFFFF",
      glasses: true,
    },
    voiceHints: ["Karen", "Tessa", "Moira", "Google UK English Female", "Sonia", "Victoria", "Samantha", "Female"],
  },
};

export function personaFor(roleCategory: string | null | undefined): Persona {
  if (roleCategory === "investment_banking" || roleCategory === "finance") return PERSONAS.marcus;
  if (roleCategory === "consulting" || roleCategory === "marketing") return PERSONAS.elena;
  return PERSONAS.ava;
}

/** Transcript / report label, e.g. "Marcus (AI)". */
export const aiInterviewerLabel = (roleCategory: string | null | undefined) => `${personaFor(roleCategory).firstName} (AI)`;
