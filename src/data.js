import { getPublishedOpportunities } from "./nonprofit-store.js";
export const choices = {
  interests: [
    "Women’s health",
    "Animals",
    "Children and youth",
    "Open to any cause",
  ],
  womensHealth: [
    "Period Care & Menstrual Equity",
    "Cancer Support",
    "Maternal & Postpartum Health",
    "Mental Health & Emotional Wellness",
  ],
  skills: [
    "Events and hands-on help",
    "Creative and social media",
    "Admin and technology",
    "Outreach and fundraising",
  ],
  availability: ["Weekday daytime", "Weekday evenings", "Weekends", "Flexible"],
  locations: ["Broward", "Miami-Dade", "Either county", "Remote"],
};
const demoOpportunities = [
  {
    id: "demo-1",
    title: "Little moments. Big possibilities.",
    role: "Youth activity day volunteer",
    nonprofit: "Bright Futures Collective",
    cause: "Children and youth",
    location: "Broward",
    city: "Fort Lauderdale",
    date: "2026-12-12",
    time: "10:00 AM – 1:00 PM",
    hours: 3,
    minAge: 16,
    skills: ["Events and hands-on help"],
    availability: "Weekends",
    art: "youth",
    emoji: "✦",
    description:
      "Help set up creative activities, welcome families, and support a joyful day of learning and play.",
    requirements:
      "Ages 16+. A brief orientation is included. Volunteers under 18 require guardian consent.",
  },
  {
    id: "demo-2",
    title: "A little love goes a long way.",
    role: "Animal enrichment helper",
    nonprofit: "Happy Paws Project",
    cause: "Animals",
    location: "Miami-Dade",
    city: "Miami",
    date: "2026-12-13",
    time: "9:00 AM – 12:00 PM",
    hours: 3,
    minAge: 16,
    skills: ["Events and hands-on help"],
    availability: "Weekends",
    art: "animals",
    emoji: "♧",
    description:
      "Prepare enrichment toys and help organize animal care supplies with a staff supervisor.",
    requirements:
      "Ages 16+. Closed-toe shoes required. No previous experience needed.",
  },
  {
    id: "demo-3",
    title: "Use your voice for good.",
    role: "Community campaign creator",
    nonprofit: "Her Tomorrow Initiative",
    cause: "Women’s health",
    womensHealthCategory: "Mental Health & Emotional Wellness",
    location: "Remote",
    city: "From anywhere",
    date: "2026-12-15",
    time: "5:00 PM – 7:00 PM",
    hours: 2,
    minAge: 14,
    skills: ["Creative and social media", "Admin and technology"],
    availability: "Weekday evenings",
    art: "creative",
    emoji: "✺",
    description:
      "Create accessible social posts for a sample women’s health awareness campaign alongside a coordinator.",
    requirements:
      "Ages 14+. Access to a computer and an interest in visual storytelling.",
  },
  {
    id: "demo-4",
    title: "Bring your community together.",
    role: "Community outreach volunteer",
    nonprofit: "Neighborhood Together",
    cause: "Children and youth",
    location: "Broward",
    city: "Hollywood",
    date: "2026-12-16",
    time: "11:00 AM – 2:00 PM",
    hours: 3,
    minAge: 18,
    skills: ["Outreach and fundraising"],
    availability: "Weekday daytime",
    art: "community",
    emoji: "☀",
    description:
      "Welcome visitors and help a sample community resource fair run smoothly.",
    requirements: "Ages 18+. Comfortable talking with community members.",
  },
  ...choices.womensHealth.map((category, index) => ({
    id: `demo-health-${index + 1}`,
    title: "A little care. A stronger community.",
    role: [
      "Period care kit event support",
      "Cancer support campaign creator",
      "Maternal care supply organizer",
      "Mental wellness outreach helper",
    ][index],
    nonprofit: "Community Care Studio (fictional)",
    cause: "Women’s health",
    womensHealthCategory: category,
    location: index === 1 ? "Remote" : index === 2 ? "Miami-Dade" : "Broward",
    city:
      index === 1 ? "From anywhere" : index === 2 ? "Miami" : "Fort Lauderdale",
    date: "2026-12-19",
    time: "10:00 AM – 12:00 PM",
    hours: 2,
    minAge: 13,
    skills: [choices.skills[index]],
    availability: "Weekends",
    art: "community",
    emoji: ["🌸", "🎗️", "🤱", "💛"][index],
    description: `Explore a fictional ${category.toLowerCase()} project with a coordinator. Help with supplies, awareness materials, or welcoming the community; no clinical or counseling work is involved.`,
    requirements:
      "Ages 13+. Coordinator orientation and guardian consent for volunteers under 18. This is a fictional demo, not an available placement.",
  })),
].map((o) => ({ ...o, isDemo: true, website: null, publicContact: null }));
export const opportunities = [
  ...demoOpportunities,
  ...getPublishedOpportunities(),
];
export function refreshOpportunities() {
  opportunities.splice(
    0,
    opportunities.length,
    ...demoOpportunities,
    ...getPublishedOpportunities(),
  );
}
export const emptyStudent = {
  id: crypto.randomUUID(),
  name: "",
  school: "",
  age: "",
  interests: [],
  womensHealth: [],
  schoolConnection: null,
  skills: [],
  availability: [],
  locations: [],
  onboarded: false,
};

// Directory entries are research leads, never opportunity or placement records.
export const potentialOrganizations = [
  {
    id: "period-miami",
    name: "PERIOD. Miami",
    category: choices.womensHealth[0],
    emoji: "🌸",
    website: "https://period.org/chapters",
    description:
      "Period care and menstrual equity. The official PERIOD chapter directory is linked; Miami chapter details and availability need confirmation.",
    websiteLabel: "Official PERIOD chapter directory",
  },
  {
    id: "gildas",
    name: "Gilda’s Club South Florida",
    category: choices.womensHealth[1],
    emoji: "🎗️",
    website: "https://gildasclubsouthflorida.org/",
    description: "Community and support for people affected by cancer.",
    websiteLabel: "Official website",
  },
  {
    id: "hmhb",
    name: "Healthy Mothers, Healthy Babies Coalition of Broward County",
    category: choices.womensHealth[2],
    emoji: "🤱",
    website: "https://www.hmhbbroward.org/",
    description:
      "Support for maternal, infant, and family health in Broward County.",
    websiteLabel: "Official website",
  },
  {
    id: "lotus",
    name: "Lotus House",
    category: choices.womensHealth[3],
    emoji: "💛",
    website: "https://www.lotushouse.org/",
    description:
      "Support for women experiencing homelessness, including mental health and emotional wellness services.",
    websiteLabel: "Official website",
  },
];
