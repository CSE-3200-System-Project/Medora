# Data licensing

Code in this repository is [MIT-licensed](LICENSE). Data is not — data licensing here is
split by what the data is, and each of the two data licence files below applies to a
different subset:

| Data | Licence file | Covers |
|---|---|---|
| Medicine reference corpus | [`data/medicine_reference/DATA_LICENSE.md`](data/medicine_reference/DATA_LICENSE.md) | `data/medicine_reference/Final_Medicine_Dataset.csv` and the `drugs`/`brands`/`medicine_search_index` tables it loads |
| Annotations, fixtures, aggregate results | [`tests/benchmarks/DATA_LICENSE.md`](tests/benchmarks/DATA_LICENSE.md) | Synthetic safety fixtures, adjudicated annotations, benchmark tables |

The identifiable prescription images referenced in
[`samples/DATA_USE_NOTICE.md`](samples/DATA_USE_NOTICE.md) are excluded from both licences
above and are not deposited — see that notice and the manuscript's Ethics section for why.
