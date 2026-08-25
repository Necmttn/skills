# Idea Roast - the negative checklist

Run this BEFORE any build time on a new app idea. It is adversarial by design:
the default verdict is KILL, and an idea has to survive every hard kill to
proceed. Soft flags do not kill alone; three or more = PARK the idea and write
down what evidence would unpark it.

Sources: rork-guide (vendored at `external/rork-guide/GUIDE.md`, section refs
below) for K1-K10 and S1-S4; our own ledgers (REJECTIONS.md, SOTA.md, prior-art
memory) for K11-K13 and S5. Maintenance follows SOTA rules: flip items in place
when evidence changes, never silently delete.

## Hard kills - any single fail ends the idea (or forces a rework)

- [ ] **K1 One-sentence test.** Say what it does in one sentence a stranger parses in one second. Cannot? That is the idea talking, not the copy. (GUIDE §8; §18 - the outreach DM sentence doubles as this test.)
- [ ] **K2 Five-second sound-off test.** Does a 5-second muted recording of the core screen explain the entire thesis? A default-generated UI that "looks fine and says nothing" fails. (GUIDE §11)
- [ ] **K3 Personalized gotcha.** Does the product return an answer about THIS user that they can only get by using it? No personalized payoff = nothing for a viewer to want. (GUIDE §8)
- [ ] **K4 Tarpit / clone check.** Is it AI habit tracker / journal / meal planner / flashcards, or identical to five existing apps? Then the only differentiator is marketing - the weakest axis for a small team against funded studios. Survives only with a mechanism-level spin visible on screen; "mine will be better designed" is not a view. (GUIDE §5)
- [ ] **K5 Different mechanism.** Same problem is fine; same mechanism is not. Name the mechanism no competitor uses (3AK: stride analysis inside Strava's market). (GUIDE §6)
- [ ] **K6 Personal-problem test.** Do WE have this problem weekly, and would we use the app every week? Judge by behavior, not intention - self-deception is cheap. (GUIDE §4)
- [ ] **K7 Frequency + heat.** Felt daily or weekly (not monthly), and emotionally irritating (not mildly inconvenient)? Password-once-a-month is weak pain; procrastinating-every-evening is severe. (GUIDE §4)
- [ ] **K8 Named narrow group.** Describe the user to the point of discomfort: what they do at 7am, what they search at midnight. "Everyone" or "young guys who lift" = kill. (GUIDE §4, §7)
- [ ] **K9 Picture the promo.** Can we already picture a specific creator showing it inside their existing format, in the first 30 seconds, without it feeling like an ad? No picture = no distribution plan. (GUIDE §7)
- [ ] **K10 Willingness to pay, now.** Will 20 reachable people pay $5 this month? If we cannot convince 20 humans, no creator budget fixes it. (GUIDE §13, §14)
- [ ] **K11 App Review exposure (ours).** Does the gotcha depend on an entitlement, purchase pattern, or claim class Apple has already rejected us (or the category) for? Check `REJECTIONS.md` and the submission playbook BEFORE building, not at submit time.
- [ ] **K12 Graveyard check (ours).** Is this a resurrection of prior art we retired (ponto/Workbench rule)? Retired ideas need NEW evidence, not new enthusiasm.
- [ ] **K13 Honest marketability (ours).** Can it be marketed without fabricated proof (fake laurels, invented UI, false exchange-rate claims)? A product that only sells with dark patterns has about three weeks before churn catches up. (GUIDE §3)

## Soft flags - each one is a debt; three or more = park the idea

- [ ] **S1 Channel economics unknown.** We cannot name the niche's creator CPM or a plausible RPM. Fashion-class niches burn money blind. (GUIDE §18)
- [ ] **S2 Floor test unproven.** No demo posted; we do not know whether the gotcha on camera beats a ~300-view TikTok floor. Cheap to fix - post one. (GUIDE §14)
- [ ] **S3 No Tuesday feature.** After the viral pull, nothing boring-but-useful retains (Wrestle AI needed the calorie tracker). Spike-and-collapse shape. (GUIDE §20)
- [ ] **S4 Network-effect cosplay.** A tool contorted into social because growth literature made networks sound mandatory. Utilities are allowed to be utilities. (GUIDE §21)
- [ ] **S5 Uncapped scope (ours).** The one-sentence version needs three sentences of qualifiers, or the "MVP" already contains three personas.

## Verdict line

Record the roast in the idea's doc or issue as:

    ROAST <date>: hard kills passed/failed, soft flags raised, verdict KILL / PARK / BUILD.

An idea with no recorded roast is an idea we have not vetted - same rule as
"no ledger file = no experiment".
