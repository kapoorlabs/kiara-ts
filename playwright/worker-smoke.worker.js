import {
  InMemoryWorkerAdapter,
  NormalizationProfile,
  Store,
  attachBrowserWorkerHost,
  defineSchema,
  numberField,
  textField,
} from "../dist/index.js";

const schema = defineSchema([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
]);

const store = new Store(schema, { normalizationProfile: NormalizationProfile.JAVA });
store.loadRow({ title: "Cast Away", year: 2000 });
store.loadRow({ title: "Big", year: 1988 });
store.prepare();

const adapter = new InMemoryWorkerAdapter();
adapter.registerStore("movies", store);

attachBrowserWorkerHost(self, adapter);
