export type Sector = "private" | "public";

export type Job = {
  id: string;
  title: string;
  org: string;
  cityId: string;
  sector: Sector;
  type: string; // CDI / CDD / Stage / Concours...
  source: string; // Rekrute / Alwadifa / Anapec / MarocAnnonces
  posted: string; // ISO date
  deadline?: string | null; // ISO date — application closing date (مباريات)
  url: string;
};

// ⚠️ SAMPLE DATA — will be replaced by the scraper's real data
export const SAMPLE_JOBS: Job[] = [
  // ---- Casablanca
  { id: "j01", title: "Développeur Full-Stack (Java / Angular)", org: "Attijariwafa bank", cityId: "casablanca", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-10", url: "https://www.rekrute.com" },
  { id: "j02", title: "Comptable confirmé(e)", org: "Groupe Label'Vie — Carrefour", cityId: "casablanca", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-09", url: "https://www.rekrute.com" },
  { id: "j03", title: "Téléconseiller(e) francophone", org: "Webhelp Maroc", cityId: "casablanca", sector: "private", type: "CDI", source: "MarocAnnonces", posted: "2026-11-11", url: "https://www.marocannonces.com" },
  { id: "j04", title: "وكلاء تجاريون (إناث) — الرباط وسلا والنواحي", org: "مؤسسة بالرباط", cityId: "casablanca", sector: "private", type: "CDI", source: "Alwadifa", posted: "2026-11-11", url: "https://alwadifa-maroc.com" },
  { id: "j05", title: "Ingénieur DevOps", org: "Banque populaire", cityId: "casablanca", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-08", url: "https://www.rekrute.com" },

  // ---- Rabat
  { id: "j06", title: "مباراة توظيف 443 تقنيا للمالية من الدرجة الثالثة", org: "وزارة الاقتصاد والمالية", cityId: "rabat", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-10", deadline: "2026-11-26", url: "https://alwadifa-maroc.com" },
  { id: "j07", title: "مباراة ولوج سلك التكوين الأساسي — 50 منصب", org: "المدرسة الوطنية للإدارة", cityId: "rabat", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-11", deadline: "2027-01-15", url: "https://alwadifa-maroc.com" },
  { id: "j08", title: "تقني من الدرجة الثالثة + مساعدين إداريين", org: "أرشيف المغرب", cityId: "rabat", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-10", url: "https://alwadifa-maroc.com" },
  { id: "j09", title: "متصرفو الدرجة الثانية والثالثة — 5 مناصب", org: "غرفة التجارة والصناعة والخدمات", cityId: "sale", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-06", url: "https://alwadifa-maroc.com" },
  { id: "j10", title: "Ingénieur DevOps (Cloud / Kubernetes)", org: "Maroc Telecom", cityId: "rabat", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-07", url: "https://www.rekrute.com" },

  // ---- Marrakech
  { id: "j11", title: "مباراة توظيف 113 عون تنفيذ", org: "الشركة الجهوية متعددة الخدمات مراكش - آسفي", cityId: "marrakech", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-11", url: "https://alwadifa-maroc.com" },
  { id: "j12", title: "مباراة توظيف 20 منصب مهندس دولة ومتصرفين وتقنيين", org: "جامعة القاضي عياض", cityId: "marrakech", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-06", url: "https://alwadifa-maroc.com" },
  { id: "j13", title: "Chef de rang — Hôtel 5★", org: "Palais Médina", cityId: "marrakech", sector: "private", type: "CDI", source: "MarocAnnonces", posted: "2026-11-09", url: "https://www.marocannonces.com" },

  // ---- Fès / Meknès
  { id: "j14", title: "مباراة توظيف 120 مراقبة السجون — مركز فاس", org: "المندوبية العامة لإدارة السجون", cityId: "fes", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-11", url: "https://alwadifa-maroc.com" },
  { id: "j15", title: "Assistant(e) administratif(ve) bilingue", org: "Cabinet d'expertise comptable", cityId: "fes", sector: "private", type: "CDD", source: "MarocAnnonces", posted: "2026-11-08", url: "https://www.marocannonces.com" },
  { id: "j16", title: "مباراة توظيف 10 أساتذة محاضرين", org: "جامعة مولاي إسماعيل", cityId: "meknes", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-11", url: "https://alwadifa-maroc.com" },
  { id: "j17", title: "Commercial terrain — produits agroalimentaires", org: "Distribution SARL", cityId: "meknes", sector: "private", type: "CDD", source: "MarocAnnonces", posted: "2026-11-07", url: "https://www.marocannonces.com" },

  // ---- Tanger / Tétouan / Al Hoceima
  { id: "j18", title: "مباراة توظيف 328 منصبا في عدة درجات وتخصصات", org: "المجموعة الصحية الترابية طنجة - تطوان - الحسيمة", cityId: "tanger", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-09", url: "https://alwadifa-maroc.com" },
  { id: "j19", title: "Superviseur centre d'appels", org: "Sitel / Tanger Free Zone", cityId: "tanger", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-10", url: "https://www.rekrute.com" },
  { id: "j20", title: "Technicien de maintenance industrielle (câblage auto)", org: "Leoni", cityId: "tanger", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-08", url: "https://www.rekrute.com" },
  { id: "j21", title: "Animateurs / animatrices touristiques", org: "Complexe balnéaire", cityId: "tetouan", sector: "private", type: "CDD", source: "MarocAnnonces", posted: "2026-11-06", url: "https://www.marocannonces.com" },
  { id: "j22", title: "أطر إدارية وتقنية — 15 منصبا (مكتب التكوين المهني)", org: "مكتب التكوين المهني وإنعاش الشغل", cityId: "alhoceima", sector: "public", type: "Concours", source: "Anapec", posted: "2026-11-05", url: "https://anapec.ma" },

  // ---- Agadir & Sud
  { id: "j23", title: "مباراة توظيف 16 أستاذا محاضرا", org: "جامعة ابن زهر", cityId: "agadir", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-10", url: "https://alwadifa-maroc.com" },
  { id: "j24", title: "Développeur PHP / Laravel", org: "Agence digitale", cityId: "agadir", sector: "private", type: "CDI", source: "MarocAnnonces", posted: "2026-11-09", url: "https://www.marocannonces.com" },
  { id: "j25", title: "Technicien chimie — industrie phosphatière", org: "OCP — Safi", cityId: "safi", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-05", url: "https://www.rekrute.com" },
  { id: "j26", title: "Ingénieur process — raffinerie", org: "Société pétrolière", cityId: "eljadida", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-07", url: "https://www.rekrute.com" },
  { id: "j27", title: "مباراة توظيف أطر إدارية وتقنية — 14 أستاذا محاضرا", org: "جامعة السلطان مولاي سليمان", cityId: "beni-mellal", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-10", url: "https://alwadifa-maroc.com" },
  { id: "j28", title: "مباراة توظيف أطر إدارية وتقنية — 06 مناصب", org: "جامعة الحسن الأول", cityId: "settat", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-05", url: "https://alwadifa-maroc.com" },
  { id: "j29", title: "Commercial / vendeur / livreur", org: "Société de distribution", cityId: "nador", sector: "private", type: "CDD", source: "MarocAnnonces", posted: "2026-11-08", url: "https://www.marocannonces.com" },
  { id: "j30", title: "Agent de réservation — agence de voyages", org: "Agence touristique", cityId: "ouarzazate", sector: "private", type: "CDD", source: "MarocAnnonces", posted: "2026-11-06", url: "https://www.marocannonces.com" },
  { id: "j31", title: "مباراة توظيف متصرفين — جماعة العيون", org: "جماعة العيون", cityId: "laayoune", sector: "public", type: "Concours", source: "Anapec", posted: "2026-11-04", url: "https://anapec.ma" },
  { id: "j32", title: "Chef de projet éolien", org: "Société d'énergies renouvelables", cityId: "dakhla", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-05", url: "https://www.rekrute.com" },
  { id: "j33", title: "Réceptionniste bilingue — Riad", org: "Riad boutique", cityId: "essaouira", sector: "private", type: "CDD", source: "MarocAnnonces", posted: "2026-11-06", url: "https://www.marocannonces.com" },
  { id: "j34", title: "Opérateurs de production — zone franche", org: "Usine textile", cityId: "kenitra", sector: "private", type: "CDD", source: "MarocAnnonces", posted: "2026-11-07", url: "https://www.marocannonces.com" },
  { id: "j35", title: "مهندس دولة تخصص الهندسة المدنية", org: "عمالة إقليم طاطا", cityId: "guelmim", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-08", url: "https://alwadifa-maroc.com" },
  { id: "j36", title: "Ingénieur génie civil", org: "Bureau d'études", cityId: "oujda", sector: "private", type: "CDI", source: "Rekrute", posted: "2026-11-09", url: "https://www.rekrute.com" },
  { id: "j37", title: "مباراة توظيف تقنيين — مركز وطني للبحث العلمي", org: "المركز الوطني للبحث العلمي والتقني", cityId: "khouribga", sector: "public", type: "Concours", source: "Anapec", posted: "2026-11-10", url: "https://anapec.ma" },
  { id: "j38", title: "عون تنفيذ — الشركة الجهوية متعددة الخدمات", org: "الشركة الجهوية متعددة الخدمات", cityId: "errachidia", sector: "public", type: "Concours", source: "Alwadifa", posted: "2026-11-09", url: "https://alwadifa-maroc.com" },
];
