# Lock In Chinese: verified collection

Test date: 2026-09-16. Scope: competitor media downloading, not campaign performance.

The owner selected ScrapeCreators after this test. It retrieved 100 different media files: 74 videos and 26 images. Every file passed ffprobe validation. One video per app passed a two-second decode check. All 100 hosted files matched their local SHA-256 hashes.

| App | Advertiser page ID | App Store ID | Videos | Images |
| --- | --- | --- | ---: | ---: |
| Hourly Hanzi | 1136810212857692 | 6777846080 | 9 | 4 |
| Hourly Hangul | 1136810212857692 | 6778228989 | 6 | 2 |
| Hourly Kana | 1136810212857692 | 6780309160 | 10 | 2 |
| Daily Hanzi | 1029868046875404 | 6756919959 | 12 | 8 |
| Daily Hangul | 1135391303000654 | 6767769904 | 17 | 0 |
| SuperChinese | 425830364539612 | — | 20 | 0 |
| Du Chinese | 158048371210663 | — | 0 | 10 |

Hourly Hanzi, Hourly Hangul, and Hourly Kana advertise under **Hourly Learning** (`hourlylearning`). Product-name advertiser searches returned no matches. Keyword ad searches found the parent advertiser; destination App Store IDs separated its three apps.

The sample capped unique files at 20 per app. It includes inactive ads. Du Chinese images came from three inactive ad records. HelloChinese (`370734829797797`) and ChineseSkill (`761916650503984`) returned no records for the selected pages with ACTIVE and ALL filters; this does not prove absence of advertising elsewhere.

The run used 32 of 100 initial credits. The balance was 68 at the end of that test, not a current account balance. There was no purchase. At test time the provider listed $47 for 25,000 non-expiring credits. Verify current prices before recommending payment. The recommendation was to use the remaining free credits first.

## Evidence and source records

- [Shared collection](https://lockin-ad-research.nokta-studio.workers.dev)
- Apps repository: `apps/lockin-chinese/ad-research/data/` contains raw responses, media manifests, hashes, and decode checks on branch `feat/lockin-ad-gallery`, local commit `62ade8ff` at the time of this entry. This commit was not pushed during the original session.
- Original local collection: `/Users/necmttn/Downloads/lockin-competitor-ads-2026-09-16/`.
- [Hourly Hanzi](https://apps.apple.com/us/app/hourly-hanzi-learn-chinese/id6777846080), [Hourly Hangul](https://apps.apple.com/us/app/hourly-hangul-learn-korean/id6778228989), [Hourly Kana](https://apps.apple.com/us/app/hourly-kana-learn-japanese/id6780309160).
- [Daily Hanzi](https://dailyhanzi.app/), [Daily Hangul](https://dailyhangul.app/).

The static gallery requires no provider key. Large media files stay outside Git and deploy as Cloudflare static assets. A fresh deployment briefly returned 404 despite control-plane success; checks passed after propagation. Verify live availability rather than assuming deployment output proves reachability.
