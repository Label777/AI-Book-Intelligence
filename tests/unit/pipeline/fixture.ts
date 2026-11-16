/**
 * Подставная модель и данные для тестов пайплайна.
 * Книга вымышленная — чтобы тестовые данные не утверждали ничего о настоящих книгах.
 */
import type { ModelTier } from "@/pipeline/config";
import type {
  ModelClient,
  ObjectRequest,
  ResearchRequest,
  ResearchResult,
  Usage,
  WebCitation,
} from "@/pipeline/model";
import type { Book, ClaimDraft } from "@/pipeline/schema";
import type { AnalysisRequest } from "@/pipeline/steps/shared";

export const BOOK: Book = {
  workId: "OL0000000W",
  title: "Тихие системы",
  authors: ["Анна Верес"],
  firstPublishYear: 2019,
  description: "Книга о том, как организации снижают информационный шум.",
  subjects: ["Менеджмент"],
};

export const REQUEST: AnalysisRequest = {
  book: BOOK,
  mode: "sources_only",
  language: "ru",
};

/** Порядок адресов задаёт идентификаторы источников: s1 … s6. */
export const CITATIONS: WebCitation[] = [
  {
    url: "https://izdatel.example/tihie-sistemy",
    title: "Тихие системы — издательство",
    citedText:
      "Книга объясняет, почему организации принимают плохие решения не из-за нехватки данных, а из-за избытка сигналов.",
  },
  {
    url: "https://izdatel.example/tihie-sistemy",
    title: "Тихие системы — издательство",
    citedText: "Автор предлагает метод трёх фильтров: источник, срок и цена ошибки.",
  },
  {
    url: "https://encyclopedia.example/wiki/quiet-systems",
    title: "Тихие системы — энциклопедия",
    citedText:
      "В книге вводится понятие сигнального долга — накопленных необработанных сообщений, которые снижают качество решений.",
  },
  {
    url: "https://encyclopedia.example/wiki/quiet-systems",
    title: "Тихие системы — энциклопедия",
    citedText: "Книга состоит из трёх частей: «Шум», «Фильтры» и «Тишина».",
  },
  {
    url: "https://review-a.example/quiet-systems",
    title: "Рецензия: Тихие системы",
    citedText: "Оглавление: Шум, Фильтры, Тишина.",
  },
  {
    url: "https://review-a.example/quiet-systems",
    title: "Рецензия: Тихие системы",
    citedText:
      "Верес описывает команду диспетчеров, которая сократила число оповещений втрое и стала реагировать быстрее.",
  },
  {
    url: "https://review-a.example/quiet-systems",
    title: "Рецензия: Тихие системы",
    citedText: "Слабое место книги — почти все примеры взяты из крупных компаний.",
  },
  {
    url: "https://review-b.example/tihie-sistemy",
    title: "Разбор книги «Тихие системы»",
    citedText: "Главы книги: Шум; Фильтры; Тишина.",
  },
  {
    url: "https://review-b.example/tihie-sistemy",
    title: "Разбор книги «Тихие системы»",
    citedText:
      "По мнению автора, внимание руководителя — самый дефицитный ресурс организации.",
  },
  {
    url: "https://review-b.example/tihie-sistemy",
    title: "Разбор книги «Тихие системы»",
    citedText:
      "Правило «один канал для срочного» автор называет главным практическим выводом.",
  },
  {
    url: "https://journal.example/alerts-study",
    title: "Исследование усталости от оповещений",
    citedText:
      "В исследовании 2021 года операторы, получавшие меньше оповещений, допускали меньше пропусков критических событий.",
  },
  {
    url: "https://interview.example/veres",
    title: "Интервью с Анной Верес",
    citedText:
      "Я писала эту книгу для руководителей, которые тонут в уведомлениях и отчётах.",
  },
];

const fact = (
  key: string,
  text: string,
  sourceId: string,
  excerptId: string,
): ClaimDraft => ({
  key,
  type: "book_fact",
  text,
  evidence: [{ sourceId, excerptId }],
  basedOn: [],
  quote: "",
});
const view = (
  key: string,
  text: string,
  basedOn: string[],
  type: ClaimDraft["type"] = "ai_interpretation",
): ClaimDraft => ({
  key,
  type,
  text,
  evidence: [],
  basedOn,
  quote: "",
});

/**
 * Идентификаторы фактов шага «Саммари». Они следуют из порядка черновиков в ответе;
 * тест пайплайна отдельно проверяет, что соответствие не разошлось.
 */
export const FACT = {
  problem: "c1",
  solution: "c3",
  audience: "c4",
  debt: "c5",
  filters: "c7",
  channel: "c8",
  dispatchers: "c11",
  attention: "c13",
  parts: "c14",
} as const;

export const CLASSIFICATION = {
  sources: [
    { sourceId: "s1", kind: "description", reliability: "high" },
    { sourceId: "s2", kind: "encyclopedia", reliability: "high" },
    { sourceId: "s3", kind: "review", reliability: "medium" },
    { sourceId: "s4", kind: "review", reliability: "medium" },
    { sourceId: "s5", kind: "research", reliability: "high" },
    { sourceId: "s6", kind: "interview", reliability: "high" },
  ],
  tocCandidates: [
    { sourceId: "s3", chapters: ["Шум", "Фильтры", "Тишина"] },
    { sourceId: "s4", chapters: ["Шум", "Фильтры", "Тишина"] },
  ],
};

export const SUMMARY = {
  overview: {
    problem: fact(
      "o1",
      "Книга разбирает, почему организации принимают плохие решения из-за избытка сигналов, а не из-за нехватки данных.",
      "s1",
      "s1e1",
    ),
    intent: view(
      "o2",
      "Автор хочет показать, что внимание руководителя нужно защищать так же строго, как бюджет.",
      ["f5"],
    ),
    solution: fact(
      "o3",
      "В качестве решения автор предлагает метод трёх фильтров: источник, срок и цена ошибки.",
      "s1",
      "s1e2",
    ),
    audience: fact(
      "o4",
      "Книга написана для руководителей, перегруженных уведомлениями и отчётами.",
      "s6",
      "s6e1",
    ),
  },
  units: [
    {
      unitId: "u1",
      facts: [
        fact(
          "f1",
          "Автор вводит понятие сигнального долга — накопленных необработанных сообщений, снижающих качество решений.",
          "s2",
          "s2e1",
        ),
      ],
      conclusion: view(
        "i1",
        "Шум в организации копится как долг и со временем обходится всё дороже.",
        ["f1"],
      ),
      link: null,
    },
    {
      unitId: "u2",
      facts: [
        fact(
          "f2",
          "Метод трёх фильтров оценивает каждое сообщение по источнику, сроку и цене ошибки.",
          "s1",
          "s1e2",
        ),
        fact(
          "f3",
          "Правило «один канал для срочного» автор называет главным практическим выводом.",
          "s4",
          "s4e3",
        ),
      ],
      conclusion: view(
        "i2",
        "Фильтры переносят решение о важности с получателя на правила системы.",
        ["f2", "f3"],
      ),
      link: view(
        "i3",
        "Вторая часть отвечает на проблему первой: фильтры гасят сигнальный долг.",
        ["f1", "f2"],
      ),
    },
    {
      unitId: "u3",
      facts: [
        fact(
          "f4",
          "В книге описана команда диспетчеров, которая втрое сократила число оповещений и стала реагировать быстрее.",
          "s3",
          "s3e2",
        ),
      ],
      conclusion: view(
        "i4",
        "Тишина оказывается рабочим состоянием системы, а не признаком бездействия.",
        ["f4"],
      ),
      link: null,
    },
  ],
  general: [
    fact(
      "f5",
      "По мнению автора, внимание руководителя — самый дефицитный ресурс организации.",
      "s4",
      "s4e2",
    ),
    fact(
      "f6",
      "Книга состоит из трёх частей: «Шум», «Фильтры» и «Тишина».",
      "s2",
      "s2e2",
    ),
  ],
};

const action = (
  text: string,
  object: string,
  when: string,
  horizon: "24h" | "7d" | "30d",
  context: "work" | "business" | "life",
) => ({ text, object, when, horizon, context });

export const IDEAS = {
  ideas: [
    {
      title: "Сигнальный долг",
      statement: view(
        "a1",
        "Необработанные сообщения ведут себя как долг: чем дольше копятся, тем хуже становятся решения.",
        [FACT.debt],
      ),
      explanation: view(
        "a2",
        "Каждое непрочитанное уведомление забирает немного внимания, и в сумме это мешает думать.",
        ["a1"],
      ),
      importance: view(
        "a3",
        "Понятие даёт руководителю измеримый повод сокращать поток сообщений.",
        ["a1"],
      ),
      action: action(
        "В пятницу вечером посчитать непрочитанные сообщения в трёх главных каналах и записать число.",
        "непрочитанные сообщения",
        "в пятницу вечером",
        "7d",
        "work",
      ),
    },
    {
      title: "Три фильтра",
      statement: view(
        "b1",
        "Сообщение заслуживает внимания, только когда известны его источник, срок и цена ошибки.",
        [FACT.filters],
      ),
      explanation: view(
        "b2",
        "Прежде чем читать письмо, полезно спросить: от кого оно, к какому часу и что будет при промахе.",
        ["b1"],
      ),
      importance: null,
      action: action(
        "Завтра утром разобрать входящие по трём вопросам и удалить всё, что не прошло ни одного.",
        "входящие письма",
        "завтра утром",
        "24h",
        "work",
      ),
    },
    {
      title: "Один канал для срочного",
      statement: view(
        "d1",
        "Срочное должно приходить единственным путём, иначе срочным начинает казаться всё подряд.",
        [FACT.channel],
      ),
      explanation: null,
      importance: view(
        "d3",
        "Без такого правила люди проверяют все каналы сразу и теряют время на переключения.",
        ["d1"],
      ),
      action: action(
        "На ближайшей планёрке договориться с командой, какой один канал используется для срочных вопросов.",
        "канал для срочных вопросов",
        "на ближайшей планёрке",
        "7d",
        "business",
      ),
    },
    {
      title: "Внимание как ресурс",
      statement: view(
        "e1",
        "Главное ограничение организации — не объём данных, а внимание тех, кто принимает решения.",
        [FACT.attention, FACT.problem],
      ),
      explanation: view(
        "e2",
        "Данных может быть сколько угодно, но рассмотреть их способен только человек с ограниченным временем.",
        ["e1"],
      ),
      importance: null,
      action: action(
        "В течение месяца раз в неделю отмечать в календаре часы, потраченные на чтение отчётов.",
        "часы на чтение отчётов",
        "раз в неделю в течение месяца",
        "30d",
        "business",
      ),
    },
    {
      title: "Меньше оповещений — быстрее реакция",
      statement: view(
        "g1",
        "Сокращение оповещений не ослабляет бдительность, а ускоряет ответ на действительно важное.",
        [FACT.dispatchers],
      ),
      explanation: null,
      importance: null,
      action: action(
        "Сегодня отключить на телефоне уведомления трёх приложений, которые открываются реже раза в день.",
        "уведомления приложений",
        "сегодня",
        "24h",
        "life",
      ),
    },
  ],
};

export const INSIGHTS = {
  insights: [
    {
      essence: view(
        "n1",
        "Отчёт, который никто не читает, вреден вдвойне: создаёт иллюзию контроля и добавляет шума.",
        [FACT.debt],
      ),
      explanation: view(
        "n2",
        "Его существование успокаивает, хотя содержание ни на что не влияет.",
        ["n1"],
      ),
      example: view(
        "n3",
        "Еженедельная сводка на сорок строк, которую открывают двое из двадцати получателей.",
        ["n1"],
      ),
      mindShift: view(
        "n4",
        "Вопрос «что ещё измерить» сменяется вопросом «что перестать рассылать».",
        ["n1"],
      ),
      action: action(
        "До конца недели спросить у получателей одной регулярной сводки, какие строки они используют.",
        "регулярная сводка",
        "до конца недели",
        "7d",
        "work",
      ),
    },
    {
      essence: view(
        "p1",
        "Фильтр по цене ошибки главнее фильтра по сроку: дешёвый промах легко исправить позже.",
        [FACT.filters],
      ),
      explanation: null,
      example: null,
      mindShift: null,
      action: action(
        "Завтра перед ответом на каждое письмо с пометкой «срочно» оценить, во что обойдётся задержка на день.",
        "письма с пометкой «срочно»",
        "завтра",
        "24h",
        "work",
      ),
    },
    {
      essence: view(
        "q1",
        "Привычка проверять всё подряд возникает там, где нет правил маршрутизации сообщений.",
        [FACT.channel],
      ),
      explanation: null,
      example: null,
      mindShift: view(
        "q4",
        "Проблема перестаёт выглядеть личной слабостью и становится задачей проектирования.",
        ["q1"],
      ),
      action: action(
        "В течение месяца вести список случаев, когда важное сообщение пришло не тем каналом.",
        "случаи неверной маршрутизации",
        "в течение месяца",
        "30d",
        "business",
      ),
    },
    {
      essence: view(
        "r1",
        "Диспетчеры выиграли не благодаря новой технологии, а благодаря отказу от лишнего.",
        [FACT.dispatchers],
      ),
      explanation: null,
      example: null,
      mindShift: null,
      action: action(
        "На следующем обсуждении нового инструмента сначала назвать один процесс, который можно убрать.",
        "процесс, который можно убрать",
        "на следующем обсуждении нового инструмента",
        "30d",
        "business",
      ),
    },
    {
      essence: view(
        "t1",
        "Спокойная рабочая среда получается из устройства процессов, а не из самодисциплины сотрудников.",
        [FACT.attention, FACT.parts],
      ),
      explanation: null,
      example: null,
      mindShift: null,
      action: action(
        "Сегодня вечером выбрать один домашний чат и на неделю перевести его в режим без звука.",
        "домашний чат",
        "сегодня вечером",
        "24h",
        "life",
      ),
    },
  ],
};

export const CONCEPTS = {
  concepts: [
    {
      name: "Сигнальный долг",
      kind: "model",
      statement: fact(
        "k1",
        "Сигнальный долг — это накопленные необработанные сообщения, которые снижают качество решений.",
        "s2",
        "s2e1",
      ),
      explanation: view(
        "k2",
        "Долг растёт незаметно: по одному сообщению, пока разбор не станет отдельной работой.",
        ["k1"],
      ),
    },
    {
      name: "Метод трёх фильтров",
      kind: "method",
      statement: fact(
        "m1",
        "Метод трёх фильтров — проверка сообщения по источнику, сроку и цене ошибки.",
        "s1",
        "s1e2",
      ),
      explanation: null,
    },
  ],
};

export const WORLDVIEW = {
  lens: view(
    "w1",
    "Автор рассматривает организацию как систему передачи сигналов с ограниченной пропускной способностью.",
    [FACT.attention],
  ),
  beliefs: [
    view(
      "w2",
      "Поведение людей определяется устройством среды сильнее, чем их намерениями.",
      [FACT.dispatchers],
    ),
    view("w3", "Избыток информации для автора опаснее её нехватки.", [FACT.problem]),
  ],
  thinkingModel: view(
    "w4",
    "Читателю предлагается сначала убирать лишнее и лишь потом добавлять новое.",
    [FACT.filters, FACT.dispatchers],
  ),
};

export const CRITIQUE = {
  strengths: [
    view(
      "x1",
      "Главный тезис подкреплён наблюдаемым случаем, а не одними рассуждениями.",
      [FACT.dispatchers],
      "critique",
    ),
    {
      key: "x2",
      type: "external_research",
      text: "Исследование 2021 года показало: операторы, получавшие меньше оповещений, реже пропускали критические события.",
      evidence: [{ sourceId: "s5", excerptId: "s5e1" }],
      basedOn: [],
      quote: "",
    },
  ],
  weaknesses: [
    {
      key: "x3",
      type: "external_research",
      text: "Рецензент отмечает, что почти все примеры книги взяты из крупных компаний.",
      evidence: [{ sourceId: "s3", excerptId: "s3e3" }],
      basedOn: [],
      quote: "",
    },
  ],
  disputed: [],
  unproven: [
    view(
      "x4",
      "Из одного случая с диспетчерами нельзя вывести, что правило сработает в любой команде.",
      [FACT.dispatchers],
      "critique",
    ),
  ],
  outdated: [],
  contradicted: [],
};

export const CONNECTIONS = {
  theories: [
    {
      name: "Теория ограничений",
      relation: view(
        "y1",
        "Внимание руководителя играет роль узкого места, которое определяет пропускную способность всей системы.",
        [FACT.attention],
      ),
    },
  ],
  books: [
    {
      title: "Карта внимания",
      author: "Илья Морев",
      relation: view(
        "y2",
        "Дополняет книгу взглядом на то же ограничение со стороны отдельного человека, а не организации.",
        [FACT.attention],
      ),
    },
  ],
  combinations: [
    view(
      "y3",
      "Три фильтра и единый срочный канал усиливают друг друга: первое решает, что пропустить, второе — куда направить.",
      [FACT.filters, FACT.channel],
    ),
  ],
};

export const TAKEAWAYS = {
  main: view(
    "z0",
    "Качество решений растёт, когда организация учится молчать о неважном.",
    [FACT.problem, FACT.attention],
  ),
  items: [
    view(
      "z1",
      "Прежде чем добавлять новый отчёт, стоит найти тот, который можно отменить.",
      [FACT.debt],
    ),
    view(
      "z2",
      "У каждого сообщения должны быть отправитель, крайний час и понятная цена промаха.",
      [FACT.filters],
    ),
    view(
      "z3",
      "Пока срочное приходит несколькими путями, люди вынуждены следить за всеми.",
      [FACT.channel],
    ),
    view(
      "z4",
      "Меньшее число оповещений в описанном случае сопровождалось более быстрой реакцией.",
      [FACT.dispatchers],
    ),
    view("z5", "Беречь стоит не только деньги компании, но и время тех, кто решает.", [
      FACT.attention,
    ]),
  ],
};

const DIMENSIONS = [
  "depth",
  "practicality",
  "originality",
  "rigor",
  "relevance",
  "difficulty",
] as const;
const SCORE_REASONS = [
  "Книга предлагает одну сильную модель, но развивает её на немногих примерах.",
  "Метод из трёх вопросов и правило единого канала можно применить без подготовки.",
  "Образ долга для необработанных сообщений — собственная находка автора.",
  "Аргументация держится на одном подробно описанном случае.",
  "Поток уведомлений с момента выхода книги только вырос.",
  "Изложение опирается на бытовые примеры и не требует специальных знаний.",
];

export const SCORES = {
  scores: DIMENSIONS.map((dimension, i) => ({
    dimension,
    value: [7, 9, 7, 5, 9, 3][i],
    rationale: view(
      `sc${i}`,
      SCORE_REASONS[i],
      [FACT.dispatchers, FACT.filters],
      "critique",
    ),
  })),
  highlights: [
    {
      kind: "strongest",
      ideaId: "idea1",
      reason: view(
        "h1",
        "Через образ долга объясняются почти все остальные положения книги.",
        [FACT.debt],
      ),
    },
    {
      kind: "underrated",
      ideaId: "idea4",
      reason: view(
        "h2",
        "Мысль о внимании как ограничении звучит вскользь, хотя на ней стоит весь метод.",
        [FACT.attention],
      ),
    },
    {
      kind: "disputed",
      ideaId: "idea5",
      reason: view(
        "h3",
        "Вывод о пользе сокращения оповещений опирается на единственный случай.",
        [FACT.dispatchers],
        "critique",
      ),
    },
    {
      kind: "practical",
      ideaId: "idea3",
      reason: view("h4", "О едином срочном канале можно договориться за одну встречу.", [
        FACT.channel,
      ]),
    },
  ],
};

export const DIAGRAMS = {
  diagrams: [
    {
      conceptId: "concept1",
      diagram: {
        type: "flow",
        title: "Как растёт сигнальный долг",
        items: [
          { label: "Сообщения приходят", note: null },
          { label: "Часть остаётся неразобранной", note: null },
          { label: "Качество решений падает", note: null },
        ],
        axes: [],
      },
    },
    {
      conceptId: "concept2",
      diagram: {
        type: "tree",
        title: "Три фильтра",
        items: [
          { label: "Источник", note: null },
          { label: "Срок", note: null },
          { label: "Цена ошибки", note: null },
        ],
        axes: [],
      },
    },
  ],
};

const CALL_USAGE: Usage = {
  calls: 1,
  inputTokens: 1000,
  outputTokens: 400,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  webSearches: 0,
};

type Handler = (request: ObjectRequest<unknown>, attempt: number) => unknown;

/** Вердикты проверки фактов: по умолчанию всё подтверждено. */
export function verdicts(
  overrides: Record<string, "supported" | "partial" | "unsupported"> = {},
): Handler {
  return (request) => ({
    verdicts: [...request.prompt.matchAll(/<claim id="(c\d+)">/g)].map((match) => ({
      claimId: match[1],
      verdict: overrides[match[1]] ?? "supported",
      reason: "Проверено по выдержке.",
    })),
  });
}

export function defaultHandlers(): Record<string, Handler> {
  return {
    "sources.classify": () => CLASSIFICATION,
    "structure.themes": () => ({
      themes: [
        {
          title: "Откуда берётся шум",
          evidence: [{ sourceId: "s2", excerptId: "s2e1" }],
        },
        {
          title: "Как отбирать сообщения",
          evidence: [{ sourceId: "s1", excerptId: "s1e2" }],
        },
        { title: "Что даёт тишина", evidence: [{ sourceId: "s3", excerptId: "s3e2" }] },
      ],
    }),
    summary: () => SUMMARY,
    "analysis.ideas": () => IDEAS,
    "analysis.insights": () => INSIGHTS,
    "analysis.concepts": () => CONCEPTS,
    "analysis.worldview": () => WORLDVIEW,
    "analysis.critique": () => CRITIQUE,
    "analysis.connections": () => CONNECTIONS,
    "analysis.takeaways": () => TAKEAWAYS,
    "analysis.scores": () => SCORES,
    "visuals.diagrams": () => DIAGRAMS,
    "verify.batch": verdicts(),
  };
}

/** Модель, которая отвечает заранее заданными данными и записывает все обращения. */
export class ScriptedModel implements ModelClient {
  readonly calls: string[] = [];
  readonly requests: ObjectRequest<unknown>[] = [];
  private readonly attempts = new Map<string, number>();

  constructor(
    readonly handlers: Record<string, Handler> = defaultHandlers(),
    public citations: WebCitation[] = CITATIONS,
    private readonly models: Record<ModelTier, string> = {
      fast: "fast-1",
      main: "main-1",
      deep: "deep-1",
    },
  ) {}

  modelFor(tier: ModelTier): string {
    return this.models[tier];
  }

  async generateObject<T>(
    request: ObjectRequest<T>,
  ): Promise<{ object: T; usage: Usage }> {
    this.calls.push(request.task);
    this.requests.push(request as ObjectRequest<unknown>);
    const handler = this.handlers[request.task];
    if (!handler) throw new Error(`Нет ответа для задачи ${request.task}`);
    const attempt = (this.attempts.get(request.task) ?? 0) + 1;
    this.attempts.set(request.task, attempt);
    const raw = handler(request as ObjectRequest<unknown>, attempt);
    // Как и настоящий клиент, возвращает только то, что соответствует схеме.
    return { object: request.schema.parse(structuredClone(raw)), usage: CALL_USAGE };
  }

  async research(request: ResearchRequest): Promise<ResearchResult> {
    this.calls.push(request.task);
    return {
      text: "Отчёт о найденных источниках.",
      citations: this.citations,
      usage: { ...CALL_USAGE, webSearches: 5 },
    };
  }

  count(task: string): number {
    return this.calls.filter((call) => call === task).length;
  }
}
