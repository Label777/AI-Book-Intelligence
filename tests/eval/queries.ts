/**
 * Контрольный набор для живой проверки поиска (критерий этапа 5):
 * нужная книга должна быть в первой тройке не реже чем в 90 % случаев.
 * Ожидание задаётся словами, которые должны найтись в названии и в авторах.
 */
export interface EvalCase {
  query: string;
  kind: "точное название" | "название и автор" | "опечатка" | "одноимённые" | "кириллица";
  /** Слово из названия (сравнение без регистра, с транслитерацией и опечатками). */
  title: string;
  /** Слово из английского названия — если книга может найтись под ним. */
  titleEn?: string;
  /** Фамилия автора. */
  author: string;
  /** Фамилия латиницей — если транслитерация её не даёт (Клир → Clear). */
  authorEn?: string;
}

export const EVAL_CASES: EvalCase[] = [
  // Точные названия
  { kind: "точное название", query: "Sapiens", title: "sapiens", author: "harari" },
  {
    kind: "точное название",
    query: "Thinking, Fast and Slow",
    title: "thinking",
    author: "kahneman",
  },
  { kind: "точное название", query: "Atomic Habits", title: "atomic", author: "clear" },
  { kind: "точное название", query: "The Lean Startup", title: "lean", author: "ries" },
  { kind: "точное название", query: "Zero to One", title: "zero", author: "thiel" },
  { kind: "точное название", query: "The Black Swan", title: "swan", author: "taleb" },
  { kind: "точное название", query: "Deep Work", title: "deep", author: "newport" },
  {
    kind: "точное название",
    query: "The Selfish Gene",
    title: "selfish",
    author: "dawkins",
  },
  {
    kind: "точное название",
    query: "Guns, Germs, and Steel",
    title: "germs",
    author: "diamond",
  },
  {
    kind: "точное название",
    query: "The Psychology of Money",
    title: "psychology",
    author: "housel",
  },
  {
    kind: "точное название",
    query: "Rich Dad Poor Dad",
    title: "rich",
    author: "kiyosaki",
  },
  {
    kind: "точное название",
    query: "Crime and Punishment",
    title: "crime",
    author: "dostoevsky",
  },
  {
    kind: "точное название",
    query: "Nineteen Eighty-Four",
    title: "eighty",
    author: "orwell",
  },
  {
    kind: "точное название",
    query: "Man's Search for Meaning",
    title: "meaning",
    author: "frankl",
  },
  {
    kind: "точное название",
    query: "The Innovator's Dilemma",
    title: "dilemma",
    author: "christensen",
  },

  // Название и автор
  {
    kind: "название и автор",
    query: "sapiens harari",
    title: "sapiens",
    author: "harari",
  },
  {
    kind: "название и автор",
    query: "Antifragile Taleb",
    title: "antifragile",
    author: "taleb",
  },
  {
    kind: "название и автор",
    query: "Influence Cialdini",
    title: "influence",
    author: "cialdini",
  },
  {
    kind: "название и автор",
    query: "Principles Ray Dalio",
    title: "principles",
    author: "dalio",
  },
  {
    kind: "название и автор",
    query: "Outliers Malcolm Gladwell",
    title: "outliers",
    author: "gladwell",
  },
  {
    kind: "название и автор",
    query: "Dune Frank Herbert",
    title: "dune",
    author: "herbert",
  },
  {
    kind: "название и автор",
    query: "Flow Csikszentmihalyi",
    title: "flow",
    author: "csikszentmihalyi",
  },
  {
    kind: "название и автор",
    query: "Good to Great, Jim Collins",
    title: "great",
    author: "collins",
  },
  {
    kind: "название и автор",
    query: '"The Power of Habit" Duhigg',
    title: "habit",
    author: "duhigg",
  },
  {
    kind: "название и автор",
    query: "Homo Deus Yuval Noah Harari",
    title: "deus",
    author: "harari",
  },

  // Опечатки
  { kind: "опечатка", query: "sapeins harari", title: "sapiens", author: "harari" },
  {
    kind: "опечатка",
    query: "thinking fast and slow kaneman",
    title: "thinking",
    author: "kahneman",
  },
  { kind: "опечатка", query: "atomic habbits", title: "atomic", author: "clear" },
  { kind: "опечатка", query: "the lean statup", title: "lean", author: "ries" },
  { kind: "опечатка", query: "antifragil taleb", title: "antifragile", author: "taleb" },
  {
    kind: "опечатка",
    query: "crime and punishmant",
    title: "crime",
    author: "dostoevsky",
  },
  {
    kind: "опечатка",
    query: "harry poter philosophers stone",
    title: "potter",
    author: "rowling",
  },
  {
    kind: "опечатка",
    query: "psycology of money",
    title: "psychology",
    author: "housel",
  },
  { kind: "опечатка", query: "outliers gladwel", title: "outliers", author: "gladwell" },
  { kind: "опечатка", query: "selfish gene dawkin", title: "selfish", author: "dawkins" },

  // Одноимённые книги: автор в запросе должен выбрать нужную
  { kind: "одноимённые", query: "The Gift Lewis Hyde", title: "gift", author: "hyde" },
  { kind: "одноимённые", query: "The Gift Marcel Mauss", title: "gift", author: "mauss" },
  {
    kind: "одноимённые",
    query: "Mindset Carol Dweck",
    title: "mindset",
    author: "dweck",
  },
  {
    kind: "одноимённые",
    query: "Influence Dale Carnegie",
    title: "influence",
    author: "carnegie",
  },
  {
    kind: "одноимённые",
    query: "Leviathan Hobbes",
    title: "leviathan",
    author: "hobbes",
  },

  // Кириллица
  {
    kind: "кириллица",
    query: "Мастер и Маргарита",
    title: "мастер",
    titleEn: "master",
    author: "булгаков",
  },
  {
    kind: "кириллица",
    query: "Преступление и наказание",
    title: "преступление",
    titleEn: "crime",
    author: "достоевский",
  },
  {
    kind: "кириллица",
    query: "Война и мир Толстой",
    title: "война",
    titleEn: "war",
    author: "толстой",
  },
  { kind: "кириллица", query: "Сапиенс Харари", title: "sapiens", author: "harari" },
  {
    kind: "кириллица",
    query: "Думай медленно, решай быстро",
    title: "думай",
    titleEn: "thinking",
    author: "канеман",
  },
  {
    kind: "кириллица",
    query: "Атомные привычки",
    title: "привычки",
    titleEn: "habits",
    author: "клир",
    authorEn: "clear",
  },
  {
    kind: "кириллица",
    query: "Чёрный лебедь Талеб",
    title: "лебедь",
    titleEn: "swan",
    author: "талеб",
  },
  {
    kind: "кириллица",
    query: "Богатый папа, бедный папа",
    title: "папа",
    titleEn: "dad",
    author: "кийосаки",
  },
  {
    kind: "кириллица",
    query: "Евгений Онегин",
    title: "онегин",
    titleEn: "onegin",
    author: "пушкин",
  },
  {
    kind: "кириллица",
    query: "Собачье сердце Булгаков",
    title: "сердце",
    titleEn: "heart",
    author: "булгаков",
  },
];
