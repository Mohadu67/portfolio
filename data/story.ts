export const STORY = {
  hero: {
    name: "Mohammed Hamiani",
    tagline: "Dev by day, creator by night.",
    location: "Strasbourg — France",
  },

  rupture: {
    year: "2018",
    eyebrow: "Le départ",
    lines: [
      "À 19 ans, j'ai dû quitter l'école.",
      "Pas par choix.",
      "Par nécessité.",
    ],
    closing:
      "Pas de plan B, pas de filet. Juste une certitude — il faut bosser, vite.",
  },

  kitchens: {
    eyebrow: "2018 — 2023",
    title: "Cinq ans en cuisine.",
    intro:
      "Fallait grandir vite. Le terrain m'a appris ce que l'école n'aurait jamais pu : tenir un service, gérer une équipe, ne rien lâcher.",
    outro: "5 ans · 3 restaurants · une équipe formée.",
    companies: ["KFC Homme de Fer", "Pizza Hut Sengewald", "KFC Porte de l'Hôpital"],
    transferTitle: "Ce que la cuisine m'a appris — et que j'utilise tous les jours en dev.",
    transferIntro:
      "Manager un coup de feu un samedi soir, c'est pas si loin de débugger une prod en flammes un vendredi à 23h. Ces réflexes-là, je les ai ramenés avec moi.",
    transferSkills: [
      {
        title: "Gestion du temps sous pression",
        body: "150 commandes en 30 minutes, ça apprend à prioriser. Aujourd'hui je découpe un sprint comme je découpais un rush.",
        code: "// rush()",
      },
      {
        title: "Rigueur & pointillisme",
        body: "Un gramme de sel en trop, le plat est mort. Une virgule mal placée, le build casse. Même exigence, autre support.",
        code: "if (detail) ship();",
      },
      {
        title: "Management & communication",
        body: "Former, déléguer, désamorcer. Ça sert autant en stand-up qu'au passe d'un service.",
        code: "team.review(PR)",
      },
      {
        title: "Process & standards",
        body: "Recettes, fiches techniques, normes HACCP. La doc et les conventions, j'en ai compris la valeur bien avant de coder.",
        code: "git commit -m",
      },
      {
        title: "Résolution de crise",
        body: "Frigo en panne avant un service ? Plan B en 5 minutes. Tests qui pètent à 18h ? Même réflexe.",
        code: "catch (err) {",
      },
      {
        title: "Sens du client",
        body: "Servir, écouter, ajuster. Un user, c'est un client. Même posture, même soin.",
        code: "user.feedback++",
      },
    ],
  },

  doubleLife: {
    eyebrow: "Le soir",
    day: {
      title: "Le jour, je managais.",
      body: "Plannings, stocks, équipes, services. La pression du terrain.",
    },
    night: {
      title: "La nuit, j'apprenais.",
      body: "HTML, CSS, JS. Tutos YouTube, MDN, Stack Overflow. Et un rêve qui ne me lâchait plus.",
    },
  },

  leap: {
    year: "2024",
    eyebrow: "Le saut",
    title: "J'ai tout quitté.",
    body:
      "Quitter une carrière stable pour repartir de zéro, c'est pas une décision — c'est un saut. J'ai signé chez CCI Campus en septembre 2024. Six mois plus tard, j'avais mon titre RNCP Développeur Web.",
    badge: "Développeur Web & Mobile — CCI Campus",
  },

  skills: {
    eyebrow: "Aujourd'hui",
    title: "Ce que je sais faire.",
    subtitle:
      "Chaque compétence a son histoire — souvent un bug, toujours une leçon.",
  },

  projects: {
    eyebrow: "En production",
    title: "Ce que j'ai construit.",
    subtitle: "Quatre projets en ligne, vrais utilisateurs, vrais bugs corrigés.",
  },

  present: {
    eyebrow: "Maintenant",
    title: "Je termine mon Bachelor.",
    body:
      "CDA — Concepteur Développeur d'Applications. Niveau 6. Architecture, design patterns, tests, sécurité. Je sors en juillet 2026.",
    seeking: {
      title: "Je cherche :",
      items: [
        { label: "Stage", value: "Mars 2026" },
        { label: "Alternance", value: "Septembre 2026" },
      ],
    },
  },

  contact: {
    eyebrow: "On parle ?",
    title: "Construisons quelque chose.",
    body: "Email, LinkedIn, Calendly — choisis ton canal.",
  },
};

export const CHAPTERS = [
  { id: "hero", label: "Intro" },
  { id: "rupture", label: "2018" },
  { id: "kitchens", label: "Cuisines" },
  { id: "double-life", label: "Double vie" },
  { id: "leap", label: "Le saut" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projets" },
  { id: "present", label: "Présent" },
  { id: "contact", label: "Contact" },
] as const;
