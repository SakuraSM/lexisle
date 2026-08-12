export const todayKey = new Date().toISOString().slice(0, 10);

export const lexicon = {
  resilience: { phonetic: "/rɪˈzɪliəns/", part: "n.", definition: "恢复力；韧性", example: "Wildlife shows remarkable resilience in changing cities." },
  cortex: { phonetic: "/ˈkɔːrteks/", part: "n.", definition: "大脑皮层；皮质层", example: "During deep sleep, the cortex becomes less active." },
  surge: { phonetic: "/sɜːrdʒ/", part: "n.", definition: "激增；猛增", example: "Deep sleep triggers a surge of cerebrospinal fluid." },
  implications: { phonetic: "/ˌɪmplɪˈkeɪʃənz/", part: "n.", definition: "含义；可能的影响", example: "The implications for health are enormous." },
  accumulate: { phonetic: "/əˈkjuːmjəleɪt/", part: "v.", definition: "积累；逐渐增加", example: "Waste proteins accumulate during the day." },
  cognitive: { phonetic: "/ˈkɑːɡnətɪv/", part: "adj.", definition: "认知的；与思考有关的", example: "Poor sleep may increase cognitive decline." },
  falter: { phonetic: "/ˈfɔːltər/", part: "v.", definition: "衰弱；动摇；失去效力", example: "When the system falters, health risks may rise." },
  cerebrospinal: { phonetic: "/ˌserəbroʊˈspaɪnəl/", part: "adj.", definition: "脑脊髓的", example: "Cerebrospinal fluid carries waste away from the brain." },
  unprecedented: { phonetic: "/ʌnˈpresɪdentɪd/", part: "adj.", definition: "前所未有的", example: "Scientists observed unprecedented changes in the reef." },
  biodiversity: { phonetic: "/ˌbaɪoʊdaɪˈvɜːrsəti/", part: "n.", definition: "生物多样性", example: "Healthy reefs support extraordinary biodiversity." },
  sustainable: { phonetic: "/səˈsteɪnəbəl/", part: "adj.", definition: "可持续的", example: "Cities need sustainable transport systems." },
  empathy: { phonetic: "/ˈempəθi/", part: "n.", definition: "同理心；共情", example: "Fiction can strengthen empathy for unfamiliar lives." },
};

export const seedArticles = [
  {
    id: "deep-sleep",
    title: "Why Deep Sleep Matters More Than You Think",
    source: "Sleep Science Review",
    topic: "睡眠科学特辑",
    url: "https://example.com/deep-sleep",
    image: "/assets/deep-sleep-bedroom.png",
    difficulty: "中级",
    createdAt: "2026-08-12T06:32:00.000Z",
    saved: true,
    progress: 28,
    text: `For years, sleep scientists believed that dreaming was the brain's main nighttime job. But a growing body of research suggests another hero of the night: deep sleep.

During this stage, slow brain waves sweep across the cortex, coordinating a remarkable cleanup operation. A recent study found that deep sleep triggers a surge of cerebrospinal fluid, which flushes out waste proteins that accumulate during the day.

When this system falters, the risk of cognitive decline may rise. The implications are clear: protecting deep sleep isn't a luxury. It is maintenance for your mind.`,
  },
  {
    id: "urban-wildlife",
    title: "How Wildlife Adapts to Urban Life",
    source: "Urban Nature",
    topic: "城市与野生动物",
    url: "https://example.com/urban-wildlife",
    image: "/assets/urban-raccoon.png",
    difficulty: "初级",
    createdAt: "2026-08-11T02:15:00.000Z",
    saved: false,
    progress: 64,
    text: `As cities grow, wildlife shows remarkable resilience. From raccoons navigating alleys to hawks nesting on skyscrapers, these animals adapt in ways that surprise us.

Their success does not mean urban life is easy. Noise, traffic, and artificial light create new hazards, yet flexible species learn to find food and shelter in unexpected places.`,
  },
  {
    id: "coral-cities",
    title: "Coral Reefs: Cities Under the Sea",
    source: "Ocean Weekly",
    topic: "海洋与生态",
    url: "https://example.com/coral-reefs",
    image: "/assets/urban-raccoon.png",
    difficulty: "中高级",
    createdAt: "2026-08-10T08:30:00.000Z",
    saved: true,
    progress: 12,
    text: `Coral reefs support extraordinary biodiversity, even though they cover only a small fraction of the ocean floor. Rising temperatures now create unprecedented stress for these living cities.

Researchers are testing sustainable restoration methods, but protecting reefs also requires reducing the forces that warm and pollute the ocean.`,
  },
];

const initialVocabulary = [
  ["cortex", "learning", 2, 2, "2026-08-14T08:00:00.000Z"],
  ["surge", "new", 0, 1, "2026-08-13T08:00:00.000Z"],
  ["implications", "learning", 1, 3, "2026-08-15T08:00:00.000Z"],
  ["resilience", "review", 3, 5, "2026-08-12T02:00:00.000Z"],
  ["cognitive", "review", 4, 8, "2026-08-12T03:00:00.000Z"],
  ["biodiversity", "mastered", 7, 21, "2026-09-02T08:00:00.000Z"],
].map(([word, status, repetition, intervalDays, nextReviewAt], index) => ({
  id: `vocab-${index + 1}`,
  word,
  ...lexicon[word],
  status,
  repetition,
  intervalDays,
  easeFactor: 2.5,
  nextReviewAt,
  articleId: index < 3 ? "deep-sleep" : index === 3 ? "urban-wildlife" : "coral-cities",
  createdAt: `2026-08-${String(6 + index).padStart(2, "0")}T08:00:00.000Z`,
}));

export const seedState = {
  version: 1,
  articles: seedArticles,
  vocabulary: initialVocabulary,
  notes: [
    { id: "note-1", articleId: "deep-sleep", title: "深睡与记忆", body: "深睡不是被动休息，而是大脑执行清理与巩固记忆的阶段。", tags: ["睡眠", "记忆"], updatedAt: "2026-08-12T05:12:00.000Z" },
  ],
  plans: {
    [todayKey]: { date: todayKey, readingTarget: 1, wordTarget: 5, reviewTarget: 8, readingDone: 0, wordDone: 1, reviewDone: 0 },
  },
  reviewEvents: [],
  settings: { dailyGoal: 5, reminderTime: "20:30", notifications: false, autoSaveWords: true, difficulty: "中级", theme: "light" },
  streak: 15,
  lastStudyDate: todayKey,
};
