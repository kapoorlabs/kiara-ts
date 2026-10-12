import {
  InMemoryWorkerAdapter,
  NormalizationProfile,
  Store,
  attachBrowserWorkerHost,
  defineSchema,
  numberField,
  textField,
} from "../dist/index.js";

const params = new URL(self.location.href).searchParams;
const rows = Number.parseInt(params.get("rows") ?? "5000", 10);
const delayMs = Number.parseInt(params.get("delayMs") ?? "0", 10);

const schema = defineSchema([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
]);

const store = new Store(schema, { normalizationProfile: NormalizationProfile.JAVA });
for (let index = 0; index < rows; index += 1) {
  store.loadRow({ title: `Movie ${index}`, year: 1980 + (index % 40) });
}
store.prepare();

class DelayedAdapter extends InMemoryWorkerAdapter {
  async execute(request, control = {}) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return super.execute(request, control);
  }
}

const adapter = delayMs > 0 ? new DelayedAdapter() : new InMemoryWorkerAdapter();
adapter.registerStore("movies", store);

attachBrowserWorkerHost(self, adapter);
