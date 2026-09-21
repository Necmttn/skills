---
name: scrapecreators
description: Find competitor ads and download their videos or images through the ScrapeCreators CLI or API. Use for Meta Ad Library research, advertiser discovery, media collections, or evaluating ScrapeCreators credits. Does not manage advertising campaigns.
---

# ScrapeCreators

The owner prefers [ScrapeCreators](https://scrapecreators.com/) for competitor ad collection after a successful download test. Prefer the existing CLI/API when it fits the request. Download and verify the actual media; a JSON export containing URLs does not complete a download request.

## Access and scope

Use an existing local CLI login or `SCRAPECREATORS_API_KEY`. Keep credentials out of source files, research artifacts, command arguments, and logs. Send the API key only to `api.scrapecreators.com`; media hosts do not need it. Use the user's existing authorization for collection. Buying credits or publishing a collection requires authorization for that action, which may already exist in the conversation.

Check the balance before collection. For a trial without a requested volume, use a bounded sample and report its coverage. Expand only as needed to answer the request. Stop on authentication failure or exhausted credits; do not retry these as transient failures.

```sh
bunx @scrapecreators/cli auth status
bunx @scrapecreators/cli balance
bunx @scrapecreators/cli facebook adlibrary-search-companies --query "Brand name" --output companies.json
bunx @scrapecreators/cli facebook adlibrary-company-ads --help
```

Use `auth login` interactively when the owner needs to save a key. CLI commands below were verified with version 1.0.35. Check current help before assuming parameter names remain unchanged.

## Find the correct advertiser

1. Inspect company-search `searchResults`; verify the brand using its official account and destination website/App Store ID.
2. If the product name returns no advertiser, search ad text or the parent company. Empty name-search results do not establish that no ads exist.

```sh
bunx @scrapecreators/cli facebook adlibrary-search-ads \
  --query "Product name" --country ALL --status ALL --output search.json
bunx @scrapecreators/cli facebook adlibrary-company-ads \
  --pageId VERIFIED_PAGE_ID --country ALL --status ACTIVE --output ads-1.json
```

Keyword searches return `searchResults`; company-ad requests return `results`. Both can return a `cursor`. Pass it with `--cursor` for the next page, saving each raw response. Stop when it is absent, repeats, or the collection limit is reached. `searchResultsCount` is not the count actually downloaded. Filter keyword matches by advertiser and product destination before collection.

Use `ACTIVE` for current examples and `ALL` when historical examples matter. Preserve `is_active` and dates; label inactive ads in the result. A shared advertiser can promote several apps.

## Download and verify media

Inspect every relevant `snapshot.videos`, `snapshot.images`, and `snapshot.cards` entry. Cards can contain separate media and text variants.

- Video: use a nonempty `video_hd_url`, with `video_sd_url` as fallback. A `video_preview_image_url` is a thumbnail, not the video.
- Image: use `original_image_url`, with `resized_image_url` as fallback.
- Preserve card identity and its text/destination alongside each file.
- Fetch media promptly. CDN URLs are temporary references, not permanent archives. If both media URLs fail, refresh that ad's details once before recording a failure.
- Check HTTP status, content type, byte count, and media parsing. Error HTML can arrive instead of an MP4.
- Hash downloaded bytes with SHA-256 to remove exact duplicates. Keep each ad/card reference to the shared file; different URLs can contain identical media.
- Validate files with `ffprobe`; decode or play a representative video from each app. Report separate counts for ad records, unique files, and failures.

Keep raw responses and a manifest containing advertiser ID, ad ID, source link, destination, ad text, dates, collection time, local path, media type, bytes, and hash. Read ad-detail responses defensively: list and detail endpoints can use different casing and body shapes.

## Deliver and assess value

Provide the files or a local gallery with app filters, video controls, download links, and original Meta links. Publish only when requested. For a hosted gallery, keep API credentials and internal account details out of its public files. Verify the public downloads against local hashes before reporting success. Record an explicit sample limit; do not describe a partial collection as complete.

Compare credits used with useful, validated media files. Free credits already support downloads; an upgrade is a capacity decision. Recheck current prices and balance before advising a purchase. The library does not establish purchases, ROAS, profitability, or retargeting status.

## References

- [CLI and authentication](https://docs.scrapecreators.com/integrations/cli/)
- [Company search](https://docs.scrapecreators.com/v1/facebook/adlibrary/search/companies/)
- [Keyword search](https://docs.scrapecreators.com/v1/facebook/adlibrary/search/ads/)
- [Company ads](https://docs.scrapecreators.com/v1/facebook/adlibrary/company/ads/)
- [Ad details and media response](https://docs.scrapecreators.com/v1/facebook/adlibrary/ad/)
- [Pricing](https://scrapecreators.com/)

For Lock In competitors, verified advertiser IDs, and the measured test results, read [references/lockin-test.md](references/lockin-test.md).
