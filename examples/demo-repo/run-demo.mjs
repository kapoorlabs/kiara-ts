import {
  createCondition,
  defineSchema,
  DictionaryTrie,
  KeywordSearch,
  NormalizationProfile,
  numberField,
  Operator,
  Store,
  textField,
} from "../../dist/index.js";

const movieSchema = defineSchema([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
  textField("actors", {
    caseInsensitive: true,
    secondaryType: "commaSeparatedStrings",
  }),
  numberField("rating"),
  textField("plotKeywords", {
    caseInsensitive: true,
    secondaryType: "commaSeparatedStrings",
    stemmedIndex: true,
  }),
]);

const movieRows = [
  {
    title: "Cast Away",
    year: 2000,
    actors: "Tom Hanks, Helen Hunt",
    rating: 8.1,
    plotKeywords: "island,survival,package",
  },
  {
    title: "Apollo 13",
    year: 1995,
    actors: "Tom Hanks, Bill Paxton",
    rating: 7.6,
    plotKeywords: "nasa,mission,survival",
  },
  {
    title: "Big",
    year: 1988,
    actors: "Tom Hanks",
    rating: 7.3,
    plotKeywords: "wish,body-swap,family",
  },
];

const store = new Store(movieSchema, { normalizationProfile: NormalizationProfile.JAVA });
for (const row of movieRows) {
  store.loadRow(row);
}
store.prepare();

const structuredResults = store.search([
  createCondition({
    field: "year",
    operator: Operator.BETWEEN,
    lowerValue: 1990,
    upperValue: 2001,
  }),
  createCondition({
    field: "actors",
    operator: Operator.CONTAINS_EITHER,
    values: ["tom hanks"],
  }),
]);

const keywordSearch = new KeywordSearch(store);
const keywordResults = keywordSearch.bestMatch("apolo mission", { limit: 5 });

const airports = [
  { airportName: "John F Kennedy International", countryName: "united states", airportCode: "jfk" },
  { airportName: "Los Angeles International", countryName: "united states", airportCode: "lax" },
  { airportName: "Indira Gandhi International", countryName: "india", airportCode: "del" },
  { airportName: "Dubai International", countryName: "united arab emirates", airportCode: "dxb" },
];

const airportTrie = new DictionaryTrie();
for (const airport of airports) {
  airportTrie.addText(airport.airportName);
  airportTrie.addText(airport.countryName);
  airportTrie.addText(airport.airportCode);
}

function suggestAirportTokens(input) {
  const normalized = input.trim().toLowerCase();
  if (normalized.length === 0) {
    return [];
  }

  const byPrefix = airportTrie.predict(normalized, 10);
  if (byPrefix.length > 0) {
    return byPrefix;
  }

  const corrected = airportTrie.getOneEditCandidate(normalized);
  return corrected === null ? [] : [corrected];
}

const airportSuggestions = {
  prefix: suggestAirportTokens("int"),
  typoFallback: suggestAirportTokens("interntional"),
};

console.log("=== Kiara TypeScript Demo Repo: in action ===");
console.log("");
console.log("Structured search (year between 1990-2001, actor contains Tom Hanks):");
console.log(structuredResults.map((row) => ({ title: row.title, year: row.year, rating: row.rating })));
console.log("");
console.log("Keyword bestMatch (input: 'apolo mission'):");
console.log({
  matchedKeywords: keywordResults.matchedKeywords,
  correctedKeywords: keywordResults.correctedKeywords,
  results: keywordResults.results.map((row) => row.title),
});
console.log("");
console.log("Airport suggestion tokens:");
console.log(airportSuggestions);
