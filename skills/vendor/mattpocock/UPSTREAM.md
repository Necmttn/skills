# mattpocock/skills (vendored)

Verbatim mirror of the skills tree from Matt Pocock's repo. **We did not write
these.** Do not edit files here to record our own conventions - own skills live
in `skills/{engineering,misc,personal}/`, verdicts in `kb-site/SOTA.md`.

| | |
|---|---|
| Upstream | https://github.com/mattpocock/skills |
| License | MIT (see `LICENSE`) |
| Vendored commit | `068b6e0c62393147daf03530149cdce209c93da8` (2026-08-15) |
| Vendored on | 2026-08-17 |

This repo began as a clone of upstream (last shared commit 2026-06-25); on
2026-08-17 the mixed tree was split: our own skills stayed in the category
dirs, everything Pocock-authored moved here and was refreshed to the commit
above. Skills upstream dropped between those dates that we had actually used
live frozen in `../mattpocock-legacy/`.

## Re-syncing (optional - we do not track upstream by default)

```
git clone --depth=1 https://github.com/mattpocock/skills /tmp/mp-skills
for cat in engineering productivity misc in-progress; do
  rm -rf skills/vendor/mattpocock/$cat
  cp -R /tmp/mp-skills/skills/$cat skills/vendor/mattpocock/$cat
done
cp /tmp/mp-skills/LICENSE skills/vendor/mattpocock/LICENSE
```

Then update the pinned commit above and re-run `scripts/link-skills.sh`.
