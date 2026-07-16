# Rented Mac providers for fleet expansion

Research for [#14](https://github.com/Necmttn/skills/issues/14) (part of #4). Question: which
rentable macOS machines could join the herdr fleet as additional panes/hosts?

Every candidate node needs, per the ticket:

1. Admin/root to install tailscale, herdr, and the claude/codex CLIs.
2. Git checkouts of private repos (so: no MDM supervision, no vendor snooping concerns that
   would block that).
3. Ideally Xcode + iOS simulators.
4. Per the fleet's VM-execution design ([#16](https://github.com/Necmttn/skills/issues/16),
   which locked in `tart`/`cirruslabs` on Apple's `Virtualization.framework`): ideally the
   ability to run `tart` VMs itself. **This requires bare-metal Apple Silicon** - Apple's
   `Virtualization.framework` needs direct hardware access; a provider that only hands you a
   VM (someone else's hypervisor sits between you and the CPU) cannot nest `tart` inside it.
   This is called out per-provider below.

Apple's macOS SLA caps every physical Mac at **2 additional VM instances** for
development/testing use ([Apple macOS Sequoia SLA
PDF](https://www.apple.com/legal/sla/docs/macOSSequoia.pdf)) - this is the ceiling `tart`
scheduling in #16 has to respect on any bare-metal box, rented or owned.

## Comparison table

| Provider | Pricing model | Min. commitment | Hardware tiers | Root/admin | Bare metal vs VM (tart-capable?) | Provisioning automation | Network / tailscale | Privacy / compliance |
|---|---|---|---|---|---|---|---|---|
| [macly.io](https://macly.io/pricing) | Daily $14.99, weekly $49.98, monthly $99.99, 6-mo/annual discounts | None - cancel anytime, no setup fee | M4 mini only (10-core CPU, 16GB RAM, 256GB SSD; 512GB/1TB sold out) | Full admin via SSH/VNC/AnyDesk | Bare metal, vendor claims "no virtualization, no shared resources" - **should support tart** (no confirmation found in docs; untested) | None documented - signup portal only | Standard public IP, up to 1Gbps - no stated restriction on installing tailscale | [Privacy policy](https://macly.io/privacy): GDPR/CCPA language, TLS in transit + at rest; no SOC2/ISO cert; silent on whether staff can access rented-box contents |
| [MacStadium](https://macstadium.com/pricing) (bare-metal Mac mini/Studio plans, not Orka) | Monthly prepay, $109–$449/mo depending on tier | Monthly; **M4 volume orders (3+) require an annual contract** | M2.S/M4.S/M2.M/M4.M/M2.L/M4.L/M2.XL minis + Mac Studio S1.M/S2.M/S2.L | "Full, root-access control" | Bare metal - **tart-capable** in principle (same Virtualization.framework substrate); Orka is MacStadium's *separate* managed-VM product and is explicitly virtualized (nested tart inside an Orka VM not supported/pointless) | Terraform support exists but is scoped to Orka/VMware/Anka (the VM layer); raw bare-metal box ordering is a manual/sales-assisted process, no self-serve API found | Dedicated Cisco firewall per private cloud, customer gets root on it | Best-in-class: SOC 1/2/3 Type II, ISO 27001/27017/27018, HIPAA, PCI DSS, GDPR/CCPA, EU-US & Swiss-US DPF ([security page](https://macstadium.com/security), [SOC3 announcement](https://www.macstadium.com/blog/macstadium-achieves-soc-3-security-compliance), [ISO 27018](https://macstadium.com/blog/macstadium-achieves-iso-iec-27018-certification-for-cloud-privacy)) |
| [AWS EC2 Mac](https://aws.amazon.com/ec2/instance-types/mac/) (`mac2.metal`, `mac-m4.metal`, etc.) | Per-second billing on a Dedicated Host; On-Demand only (no Spot/Reserved), Savings Plans apply. `mac2.metal` ≈ $0.65/hr per [Vantage](https://instances.vantage.sh/aws/ec2/mac2.metal); `mac1.metal` ≈ $1.08/hr | **Apple SLA-driven: 24h minimum Dedicated Host allocation** before you can release it ([AWS docs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-mac-instances.html)) | mac1 (Intel), mac2 (M1), mac2-m1ultra (M1 Ultra/Studio), mac2-m2, mac2-m2pro, mac-m4, mac-m4pro | Standard EC2 SSH-key root/sudo model | **True bare metal, no hypervisor** - officially tart-capable: Tart ships an [AWS Marketplace listing](https://aws.amazon.com/marketplace/pp/prodview-qczco34wlkdws) and AWS-vended AMIs come with Tart preconfigured. Caveat: a live [cirruslabs/tart#1146](https://github.com/cirruslabs/tart/issues/1146) issue reports nested-VM boot failures on `mac2.metal` specifically with newer guest images (Sequoia/Tahoe 26); older guest OSes (Sonoma) reported working | Full native AWS API/CLI/Terraform/CloudFormation; supports [EC2 Auto Scaling for Mac instances](https://aws.amazon.com/blogs/compute/implementing-autoscaling-for-ec2-mac-instances/) - best automation surface of any option here | Standard VPC networking, security groups, EIP - tailscale installs like any EC2 Linux/macOS box, no special constraint | Standard AWS shared-responsibility model + whatever compliance program the org's AWS account already carries; no Mac-specific privacy caveats found beyond "don't use FileVault, use EBS encryption instead" |
| [Scaleway Apple Silicon](https://www.scaleway.com/en/pricing/apple-silicon/) | Hourly + monthly, e.g. M1 €0.11/hr (€75/mo), M2 €0.17/hr (€115/mo), M4 €0.22–0.29/hr (€149–199/mo), M4 Pro €0.49/hr (€335/mo) | None found stated (pay-as-you-go, monthly cap) | M1, M2, M2 Pro, M4, M4 Pro minis | Root implied by "bare metal dedicated servers" claim | Bare metal dedicated hardware - **should be tart-capable** (no explicit confirmation/community report found either way; treat as unverified but likely, same as macly) | Official [Terraform provider resource `scaleway_apple_silicon`](https://registry.terraform.io/providers/scaleway/scaleway/latest/docs/resources/apple_silicon) + Scaleway API - real self-serve automation, cheapest of the automatable options | 1Gbps standard, 10Gbps upgrade available; standard public IP, tailscale-friendly | EU/French jurisdiction (Scaleway is GDPR-native by default); no specific SOC2/ISO claims surfaced in this pass - needs a follow-up check of Scaleway's own trust/compliance page before handling sensitive repos |
| Other boutique bare-metal shops: [RentAMac](https://rentamac.io/pricing/), [MyRemoteMac](https://myremotemac.com/), [NodeMini](https://nodemini.com/en/index.html), [MACCOME](https://maccome.com/) | Monthly, roughly $69–249/mo for M4/M4 Pro tiers | Monthly, cancel anytime typical | M4 / M4 Pro minis, some also Mac Pro M2 Ultra | Full root/admin advertised (RentAMac: "Full administrator privileges (Root access) with no restrictions") | Bare metal, vendor-claimed "no virtual machines or multi-user environment" (RentAMac) - same reasoning as macly: likely tart-capable, unverified | None - manual signup portal, credentials by email | Standard public IP / SSH | Unclear - no compliance certs surfaced; treat as higher-risk for private source until vetted individually |
| Anti-pattern for contrast: [MacinCloud](https://www.macincloud.com/) | $1/hr or $4/day pay-as-you-go; "Dedicated" $164/mo; "Managed" $25–29/mo + paid add-ons for SSH/RAM/port | Varies by plan | Shared/VM tiers | **Managed plans have no root/admin**; "Dedicated" plans are VMware VMs, not bare metal | **Not bare metal** - Dedicated tier is a VMware VM ([comparison source](https://macly.io/alternatives/macincloud)), so `tart`/Virtualization.framework nesting is a non-starter; Managed tier is shared and rootless | None | N/A | N/A - excluded from fleet consideration on architecture grounds alone |

## Per-provider notes

**macly.io** - cheapest true self-serve bare-metal M4, genuinely no-commitment (daily billing,
cancel anytime), and the pricing/FAQ pages explicitly promise full admin/no-MDM access, which is
exactly what the fleet needs to install tailscale/herdr/CLIs. The gap is verification: no tart
test report exists and the privacy policy is generic boilerplate (GDPR/CCPA mentions, no SOC2/
ISO, no statement on staff access to box contents). Fine for a throwaway validation node; would
want a stronger paper trail before parking a client's private repo checkout there long-term.
Sources: [pricing](https://macly.io/pricing), [FAQ](https://macly.io/faq), [privacy
policy](https://macly.io/privacy).

**MacStadium** - the only option in this survey with real enterprise compliance backing (SOC 1/2/
3, ISO 27001/27017/27018, HIPAA, PCI DSS). Root access on the bare-metal mini/Studio tiers is
confirmed. But provisioning is not self-serve/API-driven for the bare-metal tier - Terraform
support in MacStadium's docs is for the Orka/VMware/Anka *virtualization* layer, and Orka itself
is a managed VM product (nested tart inside an Orka VM is off the table; Orka is MacStadium's own
hypervisor). M4 volume pricing requires an annual contract at 3+ units, which cuts against
"minimal commitment first node." Sources: [pricing](https://macstadium.com/pricing),
[security](https://macstadium.com/security), [Orka
overview](https://docs.macstadium.com/orka/orka-overview/orka-overview), [Terraform on
MacStadium blog post](https://macstadium.com/blog/provisioning-on-macstadium-with-terraform).

**AWS EC2 Mac** - the strongest automation and compliance story of the true bare-metal options:
native Terraform/CloudFormation/API, EC2 Auto Scaling support for Mac instances, and it inherits
whatever AWS compliance program is already in place if the org has an AWS account. It is also the
*only* provider in this survey with a documented, official tart integration path (Tart's own AWS
Marketplace listing + preconfigured AMIs). The catches: (1) Apple's SLA forces AWS to enforce a
hard 24h minimum Dedicated-Host allocation - cheap to test, not free to churn; (2) steady-state
cost is the highest of the bare-metal options (~$470–865/mo for continuous mac2.metal per the
$0.65/hr rate); (3) there's a live open issue
([cirruslabs/tart#1146](https://github.com/cirruslabs/tart/issues/1146)) of tart VMs failing to
boot on `mac2.metal` specifically with newer macOS guest images (Sequoia/Tahoe 26) - would need to
pin an older tart guest image or test `mac-m4.metal` before relying on this for VM-mode jobs.
Sources: [EC2 Mac instances
guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-mac-instances.html), [EC2 Mac
product page](https://aws.amazon.com/ec2/instance-types/mac/), [Vantage mac2.metal
pricing](https://instances.vantage.sh/aws/ec2/mac2.metal), [Vantage mac1.metal
pricing](https://instances.vantage.sh/aws/ec2/mac1.metal), [Tart AWS Marketplace
listing](https://aws.amazon.com/marketplace/pp/prodview-qczco34wlkdws), [Auto Scaling for Mac
blog](https://aws.amazon.com/blogs/compute/implementing-autoscaling-for-ec2-mac-instances/).

**Scaleway Apple Silicon** - best price-to-automation ratio: bare metal, an official Terraform
provider resource (`scaleway_apple_silicon`), hourly billing with no stated minimum term, and
EU/GDPR-native jurisdiction which is a reasonable default for private-repo data residency. No
direct tart confirmation was found (positive or negative) in this pass - flagged as the one
open verification item before relying on it for VM-mode jobs. Sources: [Apple Silicon
pricing](https://www.scaleway.com/en/pricing/apple-silicon/), [Terraform provider
docs](https://registry.terraform.io/providers/scaleway/scaleway/latest/docs/resources/apple_silicon).

**Boutique bare-metal shops (RentAMac, MyRemoteMac, NodeMini, MACCOME)** - functionally similar to
macly: cheap, self-serve, full root, no automation surface, unverified tart support, unverified
compliance posture. Useful as backup/burst capacity once the pattern is proven elsewhere, not a
first choice for the initial node given the total lack of provisioning API. Sources:
[RentAMac pricing](https://rentamac.io/pricing/), [MyRemoteMac](https://myremotemac.com/),
[NodeMini](https://nodemini.com/en/index.html), [MACCOME](https://maccome.com/).

**MacinCloud (anti-pattern)** - included for contrast because it's the provider most likely to be
confused with the bare-metal options above. Its "Dedicated" tier is a VMware VM, not bare metal,
and its cheaper "Managed" tier is shared with no root. Neither can run `tart` (no direct hardware
access to nest a second hypervisor layer under), so it's excluded from fleet consideration
regardless of price. Source: [macly.io's MacinCloud
comparison](https://macly.io/alternatives/macincloud) (vendor-authored but the bare-metal-vs-VMware
distinction it cites matches MacinCloud's own [site](https://www.macincloud.com/) plan
descriptions).

## Recommendation for the first rented node

Two-phase plan, cheapest-validation-first then automation-grade:

1. **First node: macly.io, monthly M4 tier ($99.99/mo, cancel anytime).** It's the fastest,
   cheapest way to prove out the whole stack - tailscale join, herdr install, claude/codex CLI
   auth, private-repo git checkout, Xcode + simulator install, and (critically) an actual `tart`
   VM boot - on genuine bare-metal Apple Silicon with zero long-term commitment. If `tart` turns
   out not to work there (unverified in this research pass), the loss is one month's rent, not an
   annual contract. Treat it as a spike node, not where any client's private repo lives
   long-term, given the thin privacy/compliance paper trail.
2. **Once the stack is validated, standardize additional/permanent nodes on AWS EC2 Mac
   (`mac-m4.metal`, or `mac2.metal` for cost-sensitive spare capacity).** It's the only provider
   here with (a) a genuinely self-serve Terraform/API provisioning path matching the fleet's
   "ideally API/terraform" requirement, (b) an official, vendor-supported tart integration path
   (AWS Marketplace listing + preconfigured AMI), and (c) compliance/data-handling terms that
   inherit from the org's existing AWS account rather than a boutique vendor's ad hoc policy. Pin
   the tart guest-image version and confirm against
   [cirruslabs/tart#1146](https://github.com/cirruslabs/tart/issues/1146) before depending on
   VM-mode jobs on `mac2.metal` specifically; `mac-m4.metal` has not been reported broken.
   Budget for the 24h Apple-SLA minimum lease per host and the ~$470–865/mo continuous-use range.
3. **Escalate to MacStadium only if/when a client engagement requires SOC2/ISO/HIPAA-grade
   paperwork** for where their private repo checkout physically lives - it's the only provider
   surveyed with that certification stack, but it's the slowest to provision (no self-serve API
   for the bare-metal tier) and the most expensive at volume (annual contract at 3+ M4 units).
4. **Scaleway is worth a second look** once someone runs the one missing experiment: confirm
   `tart` actually boots on a Scaleway Apple Silicon instance. If it does, its
   Terraform-native provisioning at roughly half AWS's steady-state cost makes it a strong
   AWS-alternative for the second/third automated node.

## Open follow-ups

- Confirm `tart` boot works on a live Scaleway Apple Silicon instance (no report found either
  way).
- Confirm `tart` boot works on a live macly.io / RentAMac-class boutique box (same gap).
- Re-check [cirruslabs/tart#1146](https://github.com/cirruslabs/tart/issues/1146) before
  provisioning `mac2.metal` for VM-mode jobs - it may be resolved by the time this is acted on.
- Get exact `mac-m4.metal`/`mac-m4pro.metal` hourly pricing from the AWS Pricing Calculator
  (this pass only confirmed `mac1.metal` ≈ $1.08/hr and `mac2.metal` ≈ $0.65/hr via
  [Vantage](https://instances.vantage.sh/aws/ec2/)).
